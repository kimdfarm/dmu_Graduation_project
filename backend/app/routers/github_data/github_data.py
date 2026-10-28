from concurrent.futures import ThreadPoolExecutor
import json
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Header, status, Query, Response
from pydantic import BaseModel
import httpx
from supabase import Client
from groq import Groq, RateLimitError, AuthenticationError, APIError
from datetime import datetime, timedelta, timezone, time
from app.core.config import get_supabase, GROQ_API_KEY , YOUR_GITHUB_CLIENT_ID , YOUR_GITHUB_CLIENT_SECRET , GITHUB_REDIRECT_URI
import requests
import traceback

def deduct_user_energy(db: Client, member_id: str, amount: int, description: str = "AI 기능 사용"):
    """사용자의 에너지를 확인하고 차감하는 헬퍼 함수"""
    credit_res = db.table("user_credits").select("balance").eq("member_id", member_id).execute()
    
    if not credit_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="유저 크레딧 정보를 찾을 수 없습니다."
        )
    
    current_balance = credit_res.data[0]["balance"]
    
    if current_balance < amount:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED, 
            detail=f"에너지가 부족합니다. (필요 에너지: {amount}회, 잔여 에너지: {current_balance}회)"
        )
    
    new_balance = current_balance - amount
    
    # 잔액 업데이트
    db.table("user_credits").update({
        "balance": new_balance, 
        "updated_at": datetime.utcnow().isoformat()
    }).eq("member_id", member_id).execute()
    
    # 트랜잭션 로그 기록
    db.table("credit_transactions").insert({
        "member_id": member_id,
        "amount": -amount,
        "transaction_type": "AI_GENERATION",
        "description": description
    }).execute()
    
    return new_balance

router = APIRouter(
    prefix="/api",
    tags=["github-resumes"]
)
class GithubAuthRequest(BaseModel):
    code: str
    user_id: str | None = None

@router.post("/auth/github/callback")
def github_callback(payload: GithubAuthRequest, response: Response): # 💡 Response 객체 추가
    # 1. GitHub Access Token 요청
    token_url = "https://github.com/login/oauth/access_token"
    headers = {"Accept": "application/json"}
    data = {
        "client_id": YOUR_GITHUB_CLIENT_ID,
        "client_secret": YOUR_GITHUB_CLIENT_SECRET,
        "code": payload.code,
        "redirect_uri": GITHUB_REDIRECT_URI
    }

    res = requests.post(token_url, headers=headers, data=data)
    token_data = res.json()

    if "error" in token_data or res.status_code != 200:
        raise HTTPException(
            status_code=400, 
            detail=f"GitHub Token 교환 실패: {token_data.get('error_description', '알 수 없는 오류')}"
        )

    access_token = token_data.get("access_token")

    # 2. access_token으로 GitHub 유저 정보 조회
    user_res = requests.get(
        "https://api.github.com/user",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    github_user = user_res.json()

    # 3. 💡 HTTP-Only 쿠키에 GitHub Access Token 저장
    response.set_cookie(
        key="github_access_token",
        value=access_token,
        httponly=True,
        max_age=60 * 60 * 24 * 7,
        samesite="none",      # 크로스 도메인 쿠키 전송을 위해 "none" 설정 (HTTPS 환경)[cite: 13]
        secure=True          # samesite="none" 사용 시 True 필수[cite: 13]
    )

    # 4. JSON 응답 반환 (프론트엔드용)
    return {
        "status": "success",
        "github_id": github_user.get("login"),
        "github_avatar_url": github_user.get("avatar_url"),
        "access_token": access_token  # 프론트엔드 전송용
    }



import json

def preprocess_github_data(raw_graphql_data: dict, default_repo_name: str = "") -> dict:
    """NOISE_PATTERNS 제거 버전: 오직 중복 병합 및 반복 횟수(가중치) 산출로 토큰 절감"""
    
    # 1. 저장소명(프로젝트명) 추출
    repo_name = (
        raw_graphql_data.get("name") 
        or raw_graphql_data.get("repo_name") 
        or raw_graphql_data.get("full_name") 
        or default_repo_name 
        or "프로젝트"
    )

    # 2. 기술 스택 추출
    languages_data = raw_graphql_data.get("languages", {})
    tech_stacks = []
    
    if isinstance(languages_data, dict):
        if "nodes" in languages_data:
            tech_stacks = [n.get("name") for n in languages_data.get("nodes", []) if n and n.get("name")]
        elif "edges" in languages_data:
            tech_stacks = [e.get("node", {}).get("name") for e in languages_data.get("edges", []) if e and e.get("node")]
        else:
            tech_stacks = [k for k in languages_data.keys() if k not in ["nodes", "edges"]]
    elif isinstance(languages_data, list):
        tech_stacks = languages_data

    # 3. 커밋 내역 안전 추출
    commits_raw = []
    default_branch = raw_graphql_data.get("defaultBranchRef") or {}
    if isinstance(default_branch, dict):
        target = default_branch.get("target") or {}
        if isinstance(target, dict):
            history = target.get("history") or {}
            if isinstance(history, dict):
                commits_raw = history.get("nodes") or []

    if not commits_raw:
        object_data = raw_graphql_data.get("object") or {}
        if isinstance(object_data, dict):
            history = object_data.get("history") or {}
            commits_raw = history.get("nodes") or []

    if not commits_raw and isinstance(raw_graphql_data.get("commits"), list):
        commits_raw = raw_graphql_data["commits"]

    # 💡 4. 중복 병합 및 반복 횟수(기능 집중도) 집계 (삭제/필터링 로직 제거)
    merged_commits = {}
    for c in commits_raw:
        if not isinstance(c, dict):
            continue
            
        msg = (c.get("messageHeadline") or c.get("message") or "").strip()
        if not msg:
            continue

        additions = c.get("additions", 0)
        deletions = c.get("deletions", 0)

        # 의존성 패키지 폭증으로 인한 이상치만 최소한으로 보정
        if additions > 5000: additions = 100
        if deletions > 5000: deletions = 100

        # 중복 키로 묶어 누적
        if msg in merged_commits:
            merged_commits[msg]["additions"] += additions
            merged_commits[msg]["deletions"] += deletions
            merged_commits[msg]["count"] += 1
        else:
            merged_commits[msg] = {
                "additions": additions,
                "deletions": deletions,
                "count": 1
            }

    # 병합된 커밋 목록 생성 (반복 횟수 명시)
    clean_commits = []
    for msg, stat in merged_commits.items():
        clean_commits.append(
            f"- {msg} (집중도/반복: {stat['count']}회, +{stat['additions']}/-{stat['deletions']}라인)"
        )

    # 5. PR/Issue 내역 중복 병합
    prs_raw = []
    prs_data = raw_graphql_data.get("pullRequests") or {}
    if isinstance(prs_data, dict):
        prs_raw = prs_data.get("nodes") or []

    merged_prs = {}
    for pr in prs_raw:
        if isinstance(pr, dict):
            title = (pr.get("title") or "").strip()
            state = pr.get("state", "")
            if title:
                key = f"[PR] {title} (상태: {state})"
                merged_prs[key] = merged_prs.get(key, 0) + 1

    clean_prs = [f"- {title}" + (f" (반복 {cnt}회)" if cnt > 1 else "") for title, cnt in merged_prs.items()]

    return {
        "repo_name": repo_name,
        "tech_stacks": tech_stacks,
        "key_commits": clean_commits,
        "key_prs_and_issues": clean_prs
    }



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
제시된 'GitHub 본인 기여 데이터'를 분석하여 개발자의 이력서용 핵심 성과 문장(불렛포인트 3~5개)을 작성해라.

[GitHub 본인 기여 데이터]
{github_graphql_data}

[작성 규칙 - 엄격 준수]
1. **언어 일치**: 반드시 **한국어**로 작성해라.
2. **노이즈 제거 (매우 중요)**:
   - "발표 준비 끝", "수정", "update" 같은 단순 커밋 메시지는 성과 항목에서 완전 제외해라.
   - 백만 단위 이상의 비현실적인 코드 추가/삭제 라인 수(의존성 라이브러리 설치 등)는 수치로 언급하지 말고 "대규모 데이터셋 처리" 또는 "코드베이스 최적화" 등으로 추상화하여 표현해라.
3. **성과 중심 작성**: 단순 커밋 나열이 아닌, "어떤 기술/기능을 구현하여 어떤 효과를 얻었는지" 핵심 기능과 구조 설계 중심으로 요약해라.
4. **출력 형식**: 오직 JSON 스키마 {{"role_summary": "string", "achievements": ["string"]}} 형식으로만 응답해라.
"""

GROQ_MODEL_NAME = "openai/gpt-oss-120b"

def parse_single_repo_card_with_groq(graphql_data: dict, card_idx: int) -> dict:
    if not groq_client:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GROQ_API_KEY가 설정되지 않았습니다."
        )

    # 요청 페이로드의 repo_name 우선 확인
    fallback_name = graphql_data.get("repo_name", f"프로젝트_{card_idx}")
    cleaned_data = preprocess_github_data(graphql_data, default_repo_name=fallback_name)

    repo_name = cleaned_data["repo_name"]
    tech_stack_str = ", ".join(cleaned_data["tech_stacks"]) if cleaned_data["tech_stacks"] else "미지정"

    # LLM 전달용 프롬프트 강화
    # prompt_content 부분
    prompt_content = f"""
[프로젝트 정보]
- 저장소명: {repo_name}
- 사용 기술: {tech_stack_str}

[실제 개발 기여 및 작업 빈도 내역]
- 커밋 내역: {json.dumps(cleaned_data['key_commits'], ensure_ascii=False)}
- PR/이슈 내역: {json.dumps(cleaned_data['key_prs_and_issues'], ensure_ascii=False)}

[작성 규칙]
1. 제시된 커밋/PR 내역 중 '반복 횟수'나 '라인 변경량'이 높은 작업 항목을 이 개발자의 '핵심 구현 기능 및 주요 역할'로 판단하여 성과를 작성해라.
2. 커밋 메시지에 등장하는 모듈명, 기능명, 기술 단어를 직접 언급하며 문장을 완성해라.
3. 근거 없는 비현실적인 상투어는 자제하고 실제 작업 기록 기반의 성과 문장(achievements) 3~5개를 작성해라.
4. 반드시 한국어로 작성하고, JSON 스키마 {{"role_summary": "string", "achievements": ["string"]}} 형식으로만 응답해라.
"""

    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL_NAME,
            messages=[
                {
                    "role": "system", 
                    "content": "당신은 개발자의 GitHub 정제 데이터를 이력서 문장으로 변환해 주는 라이터입니다."
                },
                {"role": "user", "content": prompt_content}
            ],
            temperature=0.1,  # 환각 방지를 위해 0.1로 하향
            response_format={"type": "json_object"}
        )

        content = response.choices[0].message.content if response.choices else None
        if not content:
            raise HTTPException(status_code=500, detail="Groq API 응답 본문이 비어있습니다.")

        res_json = json.loads(content) or {}
        role_summary = res_json.get("role_summary", f"{repo_name} 개발 및 구현")
        achievements = res_json.get("achievements", [])

        formatted_list = []
        if isinstance(achievements, list):
            for item in achievements:
                text = str(next(iter(item.values()), "")) if isinstance(item, dict) else str(item)
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
            "title": repo_name,  # 💡 카드 제목을 실제 저장소 이름으로 고정
            "original_text": original_text,
            "spell_checked_text": None,
            "ai_proofread_text": None,
            "selected_version": "ORIGINAL"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"카드 생성 중 오류: {str(e)}")

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
        target_repo_name = parts[1]  # 예: "repo_name"

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://api.github.com/graphql",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json={
                "query": GRAPHQL_REPO_QUERY,
                "variables": {
                    "owner": target_owner,
                    "name": target_repo_name
                }
            }
        )
        
        # 💡 GraphQL 응답 결과 체크
        res_data = response.json()
        if "errors" in res_data:
            raise HTTPException(
                status_code=400, 
                detail=f"GitHub GraphQL 요청 실패: {res_data['errors'][0].get('message')}"
            )
        
        # 💡 [핵심 수정 위치]
        # data -> repository 안의 객체를 직접 추출합니다.
        raw_data = res_data.get("data", {})
        repo_analytics = raw_data.get("repository") or {}

        if not repo_analytics:
            raise HTTPException(
                status_code=404,
                detail=f"저장소 정보를 찾을 수 없습니다: {target_owner}/{target_repo_name}"
            )

        # 💡 preprocess_github_data가 읽을 수 있도록 repo_name 키를 확실히 지정
        repo_analytics["repo_name"] = repo_analytics.get("name") or target_repo_name

        return repo_analytics
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

        # 💡 5,000 토큰당 1 에너지 계산
        estimated_tokens, required_energy = estimate_tokens_and_cost_v2(projects_data)

        # 💡 에너지 잔여량 검증 및 차감 수행
        deduct_user_energy(
            db=db, 
            member_id=payload.member_id, 
            amount=required_energy, 
            description=f"GitHub 분석 (입력 토큰: {estimated_tokens:,}개, 사용 에너지: {required_energy}회)"
        )

        details_list = []
        for idx, repo_analytics in enumerate(projects_data, start=1):
            if not repo_analytics or not isinstance(repo_analytics, dict):
                continue

            try:
                card_detail = parse_single_repo_card_with_groq(repo_analytics, card_idx=idx)
                if card_detail and isinstance(card_detail, dict):
                    details_list.append(card_detail)
            except Exception as parse_err:
                print(f"[{idx}번 저장소 카드 생성 실패]: {parse_err}")
                continue

        if not details_list:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="GitHub 저장소 분석 데이터를 카드로 생성하는 데 실패했습니다."
            )

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
            "total_projects": len(details_list),
            "estimated_tokens": estimated_tokens,
            "deducted_energy": required_energy
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        if created_document_id:
            try:
                db.table("documents").delete().eq("id", created_document_id).execute()
            except Exception as rollback_err:
                print(f"Rollback failed: {rollback_err}")

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

        # 시작일이나 종료일이 전달되지 않았으면 빈 배열 처리
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

        # 4. 저장소 포맷팅 및 날짜 필터링 (최종 pushed_at 또는 updated_at 기준)
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

            pushed_at_str = repo.get("pushed_at") or repo.get("updated_at")
            if pushed_at_str:
                try:
                    pushed_dt = datetime.strptime(pushed_at_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
                    if start_datetime <= pushed_dt <= end_datetime:
                        filtered_repos.append(repo_item)
                except Exception:
                    pass

        # 중복 제거 후 저장소 목록 반환
        unique_repos_dict = {repo["full_name"]: repo for repo in filtered_repos}
        final_repos = list(unique_repos_dict.values())

        return {"repositories": final_repos}

    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"서버 내부 오류: {str(e)}")

def estimate_tokens_and_cost_v2(projects_data: list) -> tuple[int, int]:
    total_chars = 0
    for repo in projects_data:
        # 전처리기를 통과한 정제 데이터 크기 측정
        cleaned = preprocess_github_data(repo)
        text_blob = json.dumps(cleaned, ensure_ascii=False)
        total_chars += len(text_blob)
    
    # 대략적인 토큰 환산 (코드/한글/영어 혼합 시 약 3글자당 1토큰)
    estimated_tokens = total_chars // 3 
    
    # 💡 5,000 토큰당 1 에너지 차감 (최소 1에너지 보장)
    energy_cost = max(1, estimated_tokens // 5000)
    
    return estimated_tokens, energy_cost

@router.get("develop/github/repositories")
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

        # 시작일이나 종료일이 전달되지 않았으면 빈 배열 처리
        if not start_date or not end_date:
            return {"repositories": []}

        token = authorization.replace("Bearer ", "").strip()
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json"
        }

        # 2. 💡 [핵심 수정] token 유무와 상관없이 입력받은 github_id 사용자의 저장소 목록 조회
        # (토큰을 헤더에 넣어서 요청하면 GitHub Rate Limit 제한을 회피하면서 타인의 Public 저장소를 조회할 수 있습니다)
        gh_url = f"https://api.github.com/users/{github_id}/repos?sort=updated&per_page=100"
        
        response = requests.get(gh_url, headers=headers, timeout=10)

        # 만약 인증 실패 시 헤더 없이 재시도
        if response.status_code != 200:
            response = requests.get(gh_url, headers={"Accept": "application/vnd.github.v3+json"}, timeout=10)

        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code, 
                detail=f"[{github_id}] 사용자의 GitHub 저장소를 불러오지 못했습니다."
            )

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

        # 4. 저장소 포맷팅 및 날짜 필터링 (최종 pushed_at 또는 updated_at 기준)
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

            pushed_at_str = repo.get("pushed_at") or repo.get("updated_at")
            if pushed_at_str:
                try:
                    pushed_dt = datetime.strptime(pushed_at_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
                    if start_datetime <= pushed_dt <= end_datetime:
                        filtered_repos.append(repo_item)
                except Exception:
                    pass

        # 중복 제거 후 저장소 목록 반환
        unique_repos_dict = {repo["full_name"]: repo for repo in filtered_repos}
        final_repos = list(unique_repos_dict.values())

        return {"repositories": final_repos}

    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"서버 내부 오류: {str(e)}")

# 💡 2. 에너지 사전 견적(계산) API 추가
class EstimateCostRequest(BaseModel):
    analysis_data: Dict[str, Any]

@router.post("/github/estimate-cost")
def estimate_github_cost(payload: EstimateCostRequest):
    """
    이미 분석된 여러 저장소 데이터를 받아 한 번에 총 토큰과 에너지를 계산합니다.
    """
    analysis_data = payload.analysis_data or {}
    projects_data = analysis_data.get("projects_data", [])
    
    if not projects_data and analysis_data.get("repo_name"):
        projects_data = [analysis_data]
        
    if not projects_data:
        return {"estimated_tokens": 0, "energy_cost": 1}
        
    total_tokens, energy = estimate_tokens_and_cost_v2(projects_data)
    
    return {
        "estimated_tokens": total_tokens,
        "energy_cost": energy,
        "message": f"입력 토큰: {total_tokens:,}개 (에너지: {energy}회)"
    }


