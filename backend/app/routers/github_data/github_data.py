from concurrent.futures import ThreadPoolExecutor
import json
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Header, status, Query
from pydantic import BaseModel
import httpx
from supabase import Client
from groq import Groq, RateLimitError, AuthenticationError, APIError
from datetime import datetime, timedelta, timezone, time
from app.core.config import get_supabase, GROQ_API_KEY
import requests
import traceback

router = APIRouter(
    prefix="/api",
    tags=["github-resumes"]
)

groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

# ------------------------------------------------------------------
# 1. Author(작성자) 정보가 포함된 GraphQL Query
# ------------------------------------------------------------------
GRAPHQL_REPO_QUERY = """
query GetRepoAnalytics($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    name
    description
    isFork
    stargazerCount
    forkCount
    
    languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
      totalSize
      edges {
        size
        node { name }
      }
    }
    
    # 최근 커밋 및 커밋 작성자 login
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: 50) {
            nodes {
              messageHeadline
              committedDate
              additions
              deletions
              author {
                user {
                  login
                }
              }
            }
          }
        }
      }
    }
    
    # 최근 Issue 및 작성자 login
    issues(first: 30, orderBy: {field: CREATED_AT, direction: DESC}) {
      nodes {
        title
        state
        createdAt
        author {
          login
        }
        labels(first: 5) {
          nodes { name }
        }
      }
    }
    
    # 최근 PR 및 작성자 login
    pullRequests(first: 30, orderBy: {field: CREATED_AT, direction: DESC}) {
      nodes {
        title
        state
        mergedAt
        createdAt
        additions
        deletions
        reviewDecision
        author {
          login
        }
        labels(first: 5) {
          nodes { name }
        }
      }
    }
  }
}
"""

GITHUB_CAREER_PROMPT = """
[지시사항]
제시된 'GitHub 본인 기여 데이터'를 분석하여 개발자의 이력서용 성과 문장(불렛포인트 4~6개)을 작성해라.

[GitHub 본인 기여 데이터]
{github_graphql_data}

[작성 규칙 - 엄격 준수]
1. **언어 일치 원칙**: 입력된 기여 데이터의 주된 언어(한국어 등)로 작성해라. 입력 내용이 한국어 기반이라면 결과물(`role_summary`, `achievements`)도 반드시 **한국어**로 작성되어야 한다. 절대 영어로 반환하지 마라.
2. **사실 기반 작성**: 없는 내용을 지어내지 말고, 제시된 본인 커밋/이슈/PR 내역에 근거해서만 작성해라.
3. **어조**: "~ 구축하여 성능 개선", "~ 리팩토링으로 유지보수성 확보", "~ 기능 구현" 형태의 능동적 어조를 사용해라.
4. **출력 형식**: 반드시 지정된 JSON 구조(`role_summary`와 `achievements` 배열)로 반환해라.
"""

GROQ_MODEL_NAME = "openai/gpt-oss-120b"

def parse_single_repo_card_with_groq(graphql_data: dict, card_idx: int) -> dict:
    if not groq_client:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GROQ_API_KEY가 설정되지 않았습니다."
        )

    repo_name = graphql_data.get("repo_name", f"프로젝트_{card_idx}")
    languages_dict = graphql_data.get("languages", {})
    tech_stack_str = ", ".join(languages_dict.keys()) if languages_dict else "개발 언어 정보 없음"

    try:
        raw_str = json.dumps(graphql_data, ensure_ascii=False, indent=2)
        response = groq_client.chat.completions.create(
    model=GROQ_MODEL_NAME,
    messages=[
        {
            "role": "system", 
            "content": (
                "당신은 개발자의 GitHub 활동 데이터를 바탕으로 전문적인 이력서를 작성하는 라이터입니다. "
                "제시된 기여 데이터의 주요 사용 언어(한국어 등)를 자동으로 감지하여 반드시 해당 언어로 결과를 작성해야 합니다. "
                "결과는 오직 다음 JSON 스키마 형식으로만 응답하세요: "
                "{\"role_summary\": \"string\", \"achievements\": [\"string\"]}"
            )
        },
        {"role": "user", "content": GITHUB_CAREER_PROMPT.format(github_graphql_data=raw_str)}
    ],
    temperature=0.2,  # 일관성을 위해 temperature를 0.3에서 0.2로 낮추는 것을 권장합니다.
    response_format={"type": "json_object"}
)
        
        res_json = json.loads(response.choices[0].message.content)
        role_summary = res_json.get("role_summary", "기여 개발자")
        achievements = res_json.get("achievements", [])

        formatted_list = []
        for item in achievements:
            if isinstance(item, dict):
                text = str(next(iter(item.values()), "")) if item else ""
            else:
                text = str(item)
            
            clean_text = text.strip("• ").strip()
            if clean_text:
                formatted_list.append(f"• {clean_text}")

        achievements_formatted = "\n".join(formatted_list) if formatted_list else "• 주요 기능 및 모듈 구현"

        original_text = (
            f"[프로젝트명]\n• {repo_name}\n\n"
            f"[담당 역할]\n• {role_summary}\n\n"
            f"[사용 기술 및 스택]\n• {tech_stack_str}\n\n"
            f"[주요 구현 및 문제 해결 성과]\n{achievements_formatted}"
        )

        return {
            "id": f"card_{card_idx}",
            "title": repo_name,
            "original_text": original_text,
            "spell_checked_text": None,
            "ai_proofread_text": None,
            "selected_version": "ORIGINAL"
        }

    except RateLimitError:
        raise HTTPException(status_code=429, detail="API 키 사용량이 모두 소진되었습니다.")
    except AuthenticationError:
        raise HTTPException(status_code=401, detail="API 키가 만료되었습니다.")
    except APIError as e:
        raise HTTPException(status_code=502, detail=f"Groq API 통신 에러: {str(e)}")

class RepoAnalyzeRequest(BaseModel):
    github_id: str
    repo_name: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    extraction_time: Optional[str] = None

class GithubResumeGenerateRequest(BaseModel):
    member_id: str
    title: str
    category: str
    repo_name: str
    analysis_data: Optional[Dict[str, Any]] = None


# 날짜 범위 체크 헬퍼 함수
def is_within_date_range(date_str: str, start_dt: Optional[datetime], end_dt: Optional[datetime]) -> bool:
    if not date_str:
        return True
    try:
        clean_date_str = date_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean_date_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
            
        if start_dt and dt < start_dt:
            return False
        if end_dt and dt > end_dt:
            return False
        return True
    except Exception:
        return True


# ------------------------------------------------------------------
# 2. 본인 기여 데이터 추출 + 선택한 기간 내 내역 필터링
# ------------------------------------------------------------------
@router.post("/github/analyze")
async def analyze_repository_graphql(
    payload: RepoAnalyzeRequest,
    authorization: Optional[str] = Header(None)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="GitHub Access Token이 필요합니다.")
    
    token = authorization.split(" ")[1]
    target_user = payload.github_id.lower()

    # 기간 설정 파싱 (start_date ~ end_date)
    start_datetime = None
    end_datetime = None

    if payload.start_date:
        try:
            s_dt = datetime.strptime(payload.start_date, "%Y-%m-%d")
            start_datetime = datetime.combine(s_dt.date(), time.min, tzinfo=timezone.utc)
        except ValueError:
            pass

    if payload.end_date:
        try:
            e_dt = datetime.strptime(payload.end_date, "%Y-%m-%d")
            end_datetime = datetime.combine(e_dt.date(), time.max, tzinfo=timezone.utc)
        except ValueError:
            pass

    target_owner = payload.github_id
    target_repo_name = payload.repo_name

    if "/" in payload.repo_name:
        parts = payload.repo_name.split("/")
        target_owner = parts[0]      # 예: "owner_name"
        target_repo_name = parts[1] # 예: "repo_name"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.github.com/graphql",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json={
                "query": GRAPHQL_REPO_QUERY,
                "variables": {
                    "owner": target_owner,        # 정제된 owner 적용
                    "name": target_repo_name      # 순수 저장소 이름 적용
                }
            }
        )

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="GitHub GraphQL API 요청 실패")

        res_json = response.json()
        if "errors" in res_json:
            raise HTTPException(status_code=400, detail=f"GraphQL 오류: {res_json['errors'][0]['message']}")

        data = res_json.get("data") or {}
        repo_data = data.get("repository")
        if not repo_data:
            raise HTTPException(status_code=404, detail="저장소 정보를 찾을 수 없습니다.")

        # A. 커밋 중 본인 작성 & 기간 내 작성 필터링
        user_commits = []
        default_branch = repo_data.get("defaultBranchRef") or {}
        target = default_branch.get("target") or {}
        history = target.get("history") or {}
        nodes = history.get("nodes") or []

        for c in nodes:
            author_dict = c.get("author") or {}
            author_user = author_dict.get("user") or {}
            author_login = author_user.get("login", "").lower()
            commit_date = c.get("committedDate", "")
            
            if author_login == target_user and is_within_date_range(commit_date, start_datetime, end_datetime):
                user_commits.append({
                    "message": c.get("messageHeadline", ""),
                    "date": commit_date,
                    "changes": f"+{c.get('additions', 0)} / -{c.get('deletions', 0)}"
                })

        # B. 이슈 중 본인 생성 & 기간 내 생성 필터링
        user_issues = []
        issues_data = repo_data.get("issues") or {}
        for i in issues_data.get("nodes") or []:
            author_dict = i.get("author") or {}
            author_login = author_dict.get("login", "").lower()
            issue_date = i.get("createdAt", "")

            if author_login == target_user and is_within_date_range(issue_date, start_datetime, end_datetime):
                user_issues.append({
                    "title": i.get("title", ""),
                    "state": i.get("state", ""),
                    "labels": [l["name"] for l in (i.get("labels") or {}).get("nodes") or []]
                })

        # C. PR 중 본인 작성 & 기간 내 작성 필터링
        user_prs = []
        prs_data = repo_data.get("pullRequests") or {}
        for pr in prs_data.get("nodes") or []:
            author_dict = pr.get("author") or {}
            author_login = author_dict.get("login", "").lower()
            pr_date = pr.get("createdAt", "")

            if author_login == target_user and is_within_date_range(pr_date, start_datetime, end_datetime):
                user_prs.append({
                    "title": pr.get("title", ""),
                    "state": pr.get("state", ""),
                    "review_decision": pr.get("reviewDecision", "NONE"),
                    "changes": f"+{pr.get('additions', 0)} / -{pr.get('deletions', 0)}",
                    "labels": [l["name"] for l in (pr.get("labels") or {}).get("nodes") or []]
                })

        # D. 설정된 기간 내 본인의 기여 내역이 0건이면 400 반환
        if not user_commits and not user_issues and not user_prs:
            date_info = ""
            if payload.start_date or payload.end_date:
                date_info = f" 설정 기간({payload.start_date or '시작일 미지정'} ~ {payload.end_date or '종료일 미지정'}) 내에"

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"'{payload.repo_name}' 저장소에 사용자 '{payload.github_id}'님의{date_info} 기여 활동 내역(Commit, PR, Issue)이 존재하지 않습니다."
            )

        # 언어 비율 계산
        lang_data = repo_data.get("languages") or {}
        total_size = lang_data.get("totalSize") or 1
        languages_percentage = {}
        for edge in (lang_data.get("edges") or []):
            node = edge.get("node") or {}
            lang_name = node.get("name", "Unknown")
            size = edge.get("size", 0)
            pct = round((size / total_size) * 100, 1)
            if pct >= 1.0:
                languages_percentage[lang_name] = f"{pct}%"

        return {
            "repo_name": repo_data.get("name"),
            "is_fork": repo_data.get("isFork", False),
            "user_activity_summary": {
                "commit_count": len(user_commits),
                "issue_count": len(user_issues),
                "pr_count": len(user_prs)
            },
            "languages": languages_percentage,
            "user_commits": user_commits,
            "user_issues": user_issues,
            "user_pull_requests": user_prs
        }


# ------------------------------------------------------------------
# 다중 저장소 이력서 생성 엔드포인트
# ------------------------------------------------------------------
@router.post("/resumes/github-generate")
async def generate_github_resume(
    payload: GithubResumeGenerateRequest,
    db: Client = Depends(get_supabase)
):
    created_document_id = None

    try:
        analysis_data = payload.analysis_data or {}
        projects_data = analysis_data.get("projects_data", [])

        if not projects_data and analysis_data.get("repo_name"):
            projects_data = [analysis_data]

        if not projects_data:
            raise HTTPException(
                status_code=400, 
                detail="분석된 저장소 데이터(projects_data)가 존재하지 않습니다."
            )

        details_list = []
        for idx, repo_analytics in enumerate(projects_data, start=1):
            card_detail = parse_single_repo_card_with_groq(repo_analytics, card_idx=idx)
            details_list.append(card_detail)

        doc_payload = {
            "member_id": payload.member_id,
            "title": payload.title,
            "doc_type": "RESUME",
            "category": payload.category
        }
        doc_res = db.table("documents").insert(doc_payload).execute()

        if not doc_res.data:
            raise HTTPException(status_code=500, detail="documents 테이블 저장 실패")

        created_document_id = doc_res.data[0]["id"]

        columns = ["프로젝트명", "담당 역할", "사용 기술 및 스택", "주요 구현 및 문제 해결 성과"]
        
        section_payload = {
            "document_id": created_document_id,
            "section_type": "EXPERIENCE",
            "section_title": "경력 및 주요 프로젝트 성과",
            "display_order": 1,
            "columns": columns,
            "details": details_list
        }

        sec_res = db.table("document_sections").insert(section_payload).execute()
        if not sec_res.data:
            raise HTTPException(status_code=500, detail="document_sections 테이블 저장 실패")

        return {
            "status": "success",
            "id": created_document_id,
            "title": payload.title,
            "category": payload.category,
            "total_projects": len(details_list)
        }

    except Exception as e:
        if created_document_id:
            try:
                db.table("documents").delete().eq("id", created_document_id).execute()
            except Exception as rollback_err:
                print(f"Rollback failed: {rollback_err}")

        print(f"[GitHub Resume Generation Error]: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GitHub 이력서 자동 생성 실패: {str(e)}"
        )

@router.get("/github/repositories")
def get_github_repositories(
    github_id: str,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    months: Optional[int] = Query(None),
    authorization: str = Header(None)
):
    try:
        # 1. 필수 토큰 검증
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization 토큰이 필요합니다.")

        # 💡 [핵심 추가] 시작일이나 종료일이 전달되지 않았으면 아무것도 안 나오게 (빈 배열) 처리
        if not start_date or not end_date:
            return {"repositories": []}

        token = authorization.replace("Bearer ", "").strip()
        headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json"
        }

        # 2. GitHub 저장소 목록 조회
        if token:
            gh_url = "https://api.github.com/user/repos?sort=updated&per_page=100&type=all"
        else:
            gh_url = f"https://api.github.com/users/{github_id}/repos?sort=updated&per_page=100"
        response = requests.get(gh_url, headers=headers, timeout=10)

        if response.status_code != 200:
            gh_url = f"https://api.github.com/users/{github_id}/repos?sort=updated&per_page=100"
            response = requests.get(gh_url, headers=headers, timeout=10)

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="GitHub 저장소를 불러오지 못했습니다.")

        raw_repos = response.json()

        # 3. 날짜 파싱 (isoformat)
        start_datetime = None
        end_datetime = None

        if start_date:
            try:
                start_datetime = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                pass

        if end_date:
            try:
                # 종료일의 23:59:59까지 포함
                end_datetime = datetime.strptime(end_date, "%Y-%m-%d").replace(
                    hour=23, minute=59, second=59, tzinfo=timezone.utc
                )
            except ValueError:
                pass

        # 날짜 파싱 실패 시에도 빈 결과 반환
        if not start_datetime or not end_datetime:
            return {"repositories": []}

        # 4. 저장소 포맷팅 및 날짜 필터링
        all_repos_formatted = []
        filtered_repos = []

        for repo in raw_repos:
            repo_item = {
                "id": repo.get("id"),
                "name": repo.get("name"),
                "full_name": repo.get("full_name"),
                "description": repo.get("description"),
                "is_private": repo.get("private", False),
                "stargazers_count": repo.get("stargazers_count", 0),
                "language": repo.get("language"),
                "created_at": repo.get("created_at"),
                "pushed_at": repo.get("pushed_at"),
                "updated_at": repo.get("updated_at"),
            }
            all_repos_formatted.append(repo_item)

            pushed_at_str = repo.get("pushed_at") or repo.get("updated_at")
            if pushed_at_str:
                try:
                    pushed_dt = datetime.strptime(pushed_at_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
                    if start_datetime <= pushed_dt <= end_datetime:
                        filtered_repos.append(repo_item)
                except Exception:
                    pass

        # 💡 [핵심 수정] 필터 조건에 부합하는 저장소만 반환 (부합하는 게 없으면 빈 배열)
        result_repos = filtered_repos

        # 5. 각 저장소별 커밋/활동 수 계산
        # 5. 각 저장소별 커밋, PR, 이슈 활동 수 병렬/연산 계산
        def fetch_repo_activity(repo):
                # 💡 저장소 고유 식별자(full_name: owner/repo_name) 사용
                full_name = repo["full_name"]
                
                # 파라미터 공통 설정 (작성자: github_id, 지정 기간: since ~ until)
                base_params = {
                    "author": github_id,
                    "per_page": 100
                }
                if start_datetime:
                    base_params["since"] = start_datetime.isoformat()
                if end_datetime:
                    base_params["until"] = end_datetime.isoformat()

                total_activity = 0

                # 1) 커밋 수 조회 (해당 full_name 저장소 전용)
                try:
                    commit_res = requests.get(
                        f"https://api.github.com/repos/{full_name}/commits",
                        headers=headers,
                        params=base_params,
                        timeout=2.5
                    )
                    if commit_res.status_code == 200:
                        commits = commit_res.json()
                        if isinstance(commits, list):
                            total_activity += len(commits)
                except Exception:
                    pass

                # 2) 이슈(Issue) 및 PR 작성 내역 조회
                try:
                    issue_params = {
                        "creator": github_id,
                        "state": "all",
                        "per_page": 100
                    }
                    if start_datetime:
                        issue_params["since"] = start_datetime.isoformat()
                    
                    issue_res = requests.get(
                        f"https://api.github.com/repos/{full_name}/issues",
                        headers=headers,
                        params=issue_params,
                        timeout=2.5
                    )
                    if issue_res.status_code == 200:
                        issues = issue_res.json()
                        if isinstance(issues, list):
                            total_activity += len(issues)
                except Exception:
                    pass

                # 개별 저장소 활동 수 저장
                repo["activity_count"] = total_activity
                return repo
        # ThreadPoolExecutor로 저장소별 활동 수 병렬 조회
        with ThreadPoolExecutor(max_workers=15) as executor:
            result_repos = list(executor.map(fetch_repo_activity, result_repos))
        unique_repos_dict = {repo["full_name"]: repo for repo in result_repos}
        final_repos = list(unique_repos_dict.values())

        # 2. (선택) 활동 내역(activity_count > 0)이 존재하는 저장소만 남기기
        final_repos = [r for r in final_repos if r.get("activity_count", 0) > 0]

        return {"repositories": final_repos}

    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"서버 내부 오류: {str(e)}")