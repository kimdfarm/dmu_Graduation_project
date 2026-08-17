from concurrent.futures import ThreadPoolExecutor
import json
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Header, status, Query
from pydantic import BaseModel
import httpx
from supabase import Client
from groq import Groq, RateLimitError, AuthenticationError, APIError
from datetime import datetime, timedelta, timezone,time
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
너는 개발자의 GitHub 실제 기여 내역(Commit, Issue, PR)을 바탕으로 이력서용 성과 문장을 생성하는 전문 라이터다.
제시된 '본인 실제 기여 데이터'만을 분석하여 4~6개의 구체적인 성과 불렛포인트로 작성해라.

[GitHub 본인 기여 데이터]
{github_graphql_data}

[작성 규칙]
1. 없는 내용을 지어내지 말고, 제시된 본인 커밋/이슈/PR 내역에 근거해서만 작성해라.
2. "~ 구축하여 성능 개선", "~ 리팩토링으로 유지보수성 확보", "~ 기능 구현" 형태의 능동적 어조를 사용해라.
3. JSON 형식으로 `role_summary`와 `achievements` 배열을 반환해라.
"""


# ------------------------------------------------------------------
# Groq 모델 설정 (원하는 모델의 주석을 해제하여 사용)
# ------------------------------------------------------------------
GROQ_MODEL_NAME = "llama-3.1-8b-instant"  # 70B 대체 추천 모델

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
                {"role": "system", "content": "You are a professional Korean tech resume writer. Generate achievements based ONLY on the user's actual contributions in valid JSON with schema: {\"role_summary\": \"string\", \"achievements\": [\"string\"]}"},
                {"role": "user", "content": GITHUB_CAREER_PROMPT.format(github_graphql_data=raw_str)}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        res_json = json.loads(response.choices[0].message.content)
        role_summary = res_json.get("role_summary", "기여 개발자")
        achievements = res_json.get("achievements", [])

        # 💡 [핵심 수정] achievements 요소가 dict나 str 어떤 형태든 안전하게 처리
        formatted_list = []
        for item in achievements:
            if isinstance(item, dict):
                # 딕셔너리로 반환된 경우 내부 첫 번째 값(value)을 추출
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


# ------------------------------------------------------------------
# 2. [핵심] 본인 기여 데이터만 추출 및 검증 로직 적용
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
                    "owner": payload.github_id,
                    "name": payload.repo_name
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

        # 💡 A. 커밋 중 본인이 작성한 커밋만 필터링 (Null-safe 처리)
        user_commits = []
        default_branch = repo_data.get("defaultBranchRef") or {}
        target = default_branch.get("target") or {}
        history = target.get("history") or {}
        nodes = history.get("nodes") or []

        for c in nodes:
            author_dict = c.get("author") or {}
            author_user = author_dict.get("user") or {}
            author_login = author_user.get("login", "").lower()
            
            if author_login == target_user:
                user_commits.append({
                    "message": c.get("messageHeadline", ""),
                    "date": c.get("committedDate", ""),
                    "changes": f"+{c.get('additions', 0)} / -{c.get('deletions', 0)}"
                })

        # 💡 B. 본인이 직접 생성한 Issue만 필터링 (Null-safe 처리)
        user_issues = []
        issues_data = repo_data.get("issues") or {}
        for i in issues_data.get("nodes") or []:
            author_dict = i.get("author") or {}
            author_login = author_dict.get("login", "").lower()
            if author_login == target_user:
                user_issues.append({
                    "title": i.get("title", ""),
                    "state": i.get("state", ""),
                    "labels": [l["name"] for l in (i.get("labels") or {}).get("nodes") or []]
                })

        # 💡 C. 본인이 직접 작성한 PR만 필터링 (Null-safe 처리)
        user_prs = []
        prs_data = repo_data.get("pullRequests") or {}
        for pr in prs_data.get("nodes") or []:
            author_dict = pr.get("author") or {}
            author_login = author_dict.get("login", "").lower()
            if author_login == target_user:
                user_prs.append({
                    "title": pr.get("title", ""),
                    "state": pr.get("state", ""),
                    "review_decision": pr.get("reviewDecision", "NONE"),
                    "changes": f"+{pr.get('additions', 0)} / -{pr.get('deletions', 0)}",
                    "labels": [l["name"] for l in (pr.get("labels") or {}).get("nodes") or []]
                })

        # 💡 D. 본인의 직접 기여 내역이 0건이면 400 반환
        if not user_commits and not user_issues and not user_prs:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"'{payload.repo_name}' 저장소에 사용자 '{payload.github_id}'님의 기여 활동 내역(Commit, PR, Issue)이 존재하지 않습니다."
            )

        # 언어 비율 계산 (Null-safe 처리)
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
# 2. 다중 저장소 이력서 생성 엔드포인트 수정
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

        # 프론트엔드에서 넘어온 분석 결과가 배열 형태가 아니거나 단건인 경우 호환 처리
        if not projects_data and analysis_data.get("repo_name"):
            projects_data = [analysis_data]

        if not projects_data:
            raise HTTPException(
                status_code=400, 
                detail="분석된 저장소 데이터(projects_data)가 존재하지 않습니다."
            )

        # 1. 선택된 각 저장소별로 AI 분석을 수행하여 details 카드 리스트 구축
        details_list = []
        for idx, repo_analytics in enumerate(projects_data, start=1):
            card_detail = parse_single_repo_card_with_groq(repo_analytics, card_idx=idx)
            details_list.append(card_detail)

        # 2. documents 메인 레코드 생성
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

        # 3. document_sections 단일 레코드에 모든 저장소 detail 항목(card_1, card_2...) 추가
        columns = ["프로젝트명", "담당 역할", "사용 기술 및 스택", "주요 구현 및 문제 해결 성과"]
        
        section_payload = {
            "document_id": created_document_id,
            "section_type": "EXPERIENCE",
            "section_title": "경력 및 주요 프로젝트 성과",
            "display_order": 1,
            "columns": columns,
            "details": details_list  # [card_1, card_2, ...] 여러 항목이 들어감
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
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization 토큰이 필요합니다.")

        token = authorization.replace("Bearer ", "").strip()
        headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json"
        }

        gh_url = "https://api.github.com/user/repos?sort=updated&per_page=100&type=all"
        response = requests.get(gh_url, headers=headers, timeout=10)

        if response.status_code != 200:
            gh_url = f"https://api.github.com/users/{github_id}/repos?sort=updated&per_page=100"
            response = requests.get(gh_url, headers=headers, timeout=10)

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="GitHub 저장소를 불러오지 못했습니다.")

        raw_repos = response.json()

        # Python 3.9 이하 환경 대응 안전한 YYYY-MM-DD 날짜 파싱
        start_datetime = None
        end_datetime = None

        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                start_datetime = datetime.combine(start_dt.date(), time.min, tzinfo=timezone.utc)
            except ValueError:
                pass

        if end_date:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                end_datetime = datetime.combine(end_dt.date(), time.max, tzinfo=timezone.utc)
            except ValueError:
                pass

        if not start_datetime and not end_datetime:
            calc_months = months if months is not None else 12
            start_datetime = datetime.now(timezone.utc) - timedelta(days=calc_months * 30)

        seen_ids = set()
        filtered_repos = []
        all_repos_formatted = []

        for repo in raw_repos:
            repo_id = repo.get("id")
            if not repo_id or repo_id in seen_ids:
                continue

            is_fork = repo.get("fork", False)
            created_at_str = repo.get("created_at")
            pushed_at_str = repo.get("pushed_at") or repo.get("updated_at")

            # 포크 후 추가 푸시가 없는 저장소 제외
            if is_fork:
                if not pushed_at_str or not created_at_str:
                    continue
                try:
                    created_dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                    pushed_dt = datetime.fromisoformat(pushed_at_str.replace("Z", "+00:00"))
                    if pushed_dt <= created_dt + timedelta(seconds=10):
                        continue
                except Exception:
                    pass

            seen_ids.add(repo_id)

            repo_item = {
                "id": repo_id,
                "name": repo.get("name"),
                "full_name": repo.get("full_name"),
                "description": repo.get("description"),
                "language": repo.get("language"),
                "stargazers_count": repo.get("stargazers_count", 0),
                "is_private": repo.get("private", False),
                "is_fork": is_fork,
                "created_at": repo.get("created_at"),  # 💡 [필수 추가] 저장소 생성 시간
                "updated_at": repo.get("updated_at"),
                "pushed_at": repo.get("pushed_at"),
                "activity_count": 0  # 기본값 초기화
            }
            all_repos_formatted.append(repo_item)

            if pushed_at_str:
                try:
                    clean_date_str = pushed_at_str.replace("Z", "+00:00")
                    pushed_date = datetime.fromisoformat(clean_date_str)
                    if pushed_date.tzinfo is None:
                        pushed_date = pushed_date.replace(tzinfo=timezone.utc)

                    is_after_start = True if not start_datetime else (pushed_date >= start_datetime)
                    is_before_end = True if not end_datetime else (pushed_date <= end_datetime)

                    if is_after_start and is_before_end:
                        filtered_repos.append(repo_item)
                except Exception:
                    filtered_repos.append(repo_item)

        result_repos = filtered_repos if len(filtered_repos) > 0 else all_repos_formatted

        # 💡 [NEW] 선택 기간 동안의 커밋 활동 수(activity_count) 병렬 조회 함수
        def fetch_repo_activity(repo):
            full_name = repo["full_name"]
            commit_url = f"https://api.github.com/repos/{full_name}/commits"
            
            # 본인의 github_id 커밋만 요청하도록 author 파라미터 추가
            params = {
                "author": github_id,
                "per_page": 100
            }
            if start_datetime:
                params["since"] = start_datetime.isoformat()
            if end_datetime:
                params["until"] = end_datetime.isoformat()

            try:
                # timeout을 2.5초로 줄여 병목 현상 방지
                res = requests.get(commit_url, headers=headers, params=params, timeout=2.5)
                if res.status_code == 200:
                    commits = res.json()
                    repo["activity_count"] = len(commits) if isinstance(commits, list) else 0
                else:
                    repo["activity_count"] = 0
            except Exception:
                repo["activity_count"] = 0
            return repo

        # 스레드 개수를 15개로 늘려 병렬 처리 속도 향상
        with ThreadPoolExecutor(max_workers=15) as executor:
            result_repos = list(executor.map(fetch_repo_activity, result_repos))

        return {"repositories": result_repos}

        # 최대 10개의 스레드로 커밋 수 병렬 조회 (속도 최적화)
        with ThreadPoolExecutor(max_workers=10) as executor:
            result_repos = list(executor.map(fetch_repo_activity, result_repos))

        return {"repositories": result_repos}

    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))