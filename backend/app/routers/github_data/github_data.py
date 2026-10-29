from concurrent.futures import ThreadPoolExecutor
import json
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Header, status, Query, Response
from pydantic import BaseModel
import httpx
from supabase import Client
from groq import Groq, RateLimitError, AuthenticationError, APIError
from datetime import datetime, timedelta, timezone, time
from app.core.config import get_supabase, GROQ_API_KEY, YOUR_GITHUB_CLIENT_ID, YOUR_GITHUB_CLIENT_SECRET, GITHUB_REDIRECT_URI
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
def github_callback(payload: GithubAuthRequest, response: Response):
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

    user_res = requests.get(
        "https://api.github.com/user",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    github_user = user_res.json()

    response.set_cookie(
        key="github_access_token",
        value=access_token,
        httponly=True,
        max_age=60 * 60 * 24 * 7,
        samesite="none",
        secure=True
    )

    return {
        "status": "success",
        "github_id": github_user.get("login"),
        "github_avatar_url": github_user.get("avatar_url"),
        "access_token": access_token
    }

def preprocess_github_data(raw_graphql_data: dict, default_repo_name: str = "", target_author: str = "") -> dict:
    """특정 작성자(target_author)의 기여 내역만 필터링하여 토큰 및 정확도 산출"""
    effective_author = target_author or raw_graphql_data.get("target_author", "")
    repo_name = (
        raw_graphql_data.get("name") 
        or raw_graphql_data.get("repo_name") 
        or raw_graphql_data.get("full_name") 
        or default_repo_name 
        or "프로젝트"
    )

    languages_data = raw_graphql_data.get("languages", {})
    tech_stacks = []
    if isinstance(languages_data, dict):
        if "nodes" in languages_data:
            tech_stacks = [n.get("name") for n in languages_data.get("nodes", []) if n and n.get("name")]
        elif "edges" in languages_data:
            tech_stacks = [e.get("node", {}).get("name") for e in languages_data.get("edges", []) if e and e.get("node")]

    commits_raw = []
    default_branch = raw_graphql_data.get("defaultBranchRef") or {}
    if isinstance(default_branch, dict):
        target = default_branch.get("target") or {}
        if isinstance(target, dict):
            history = target.get("history") or {}
            if isinstance(history, dict):
                commits_raw = history.get("nodes") or []

    merged_commits = {}
    for c in commits_raw:
        if not isinstance(c, dict):
            continue
            
        author_info = c.get("author") or {}
        user_info = author_info.get("user") or {}
        author_login = user_info.get("login", "")

        if effective_author and author_login.lower() != effective_author.lower():
            continue

        msg = (c.get("messageHeadline") or c.get("message") or "").strip()
        if not msg:
            continue

        additions = c.get("additions", 0)
        deletions = c.get("deletions", 0)

        if additions > 5000: additions = 100
        if deletions > 5000: deletions = 100

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

    clean_commits = [
        f"- {msg} (집중도/반복: {stat['count']}회, +{stat['additions']}/-{stat['deletions']}라인)"
        for msg, stat in merged_commits.items()
    ]

    prs_raw = []
    prs_data = raw_graphql_data.get("pullRequests") or {}
    if isinstance(prs_data, dict):
        prs_raw = prs_data.get("nodes") or []

    merged_prs = {}
    for pr in prs_raw:
        if isinstance(pr, dict):
            pr_author = (pr.get("author") or {}).get("login", "")
            if effective_author and pr_author.lower() != effective_author.lower():
                continue

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
# 1. Author(작성자) 정보가 포함된 GraphQL Query (최대 100개로 상향)
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
    
    # 💡 커밋 히스토리 최대 100개로 변경
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: 100) {
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
    
    # 💡 최근 Issue 최대 100개로 변경
    issues(first: 100, orderBy: {field: CREATED_AT, direction: DESC}) {
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
    
    # 💡 최근 PR 최대 100개로 변경
    pullRequests(first: 100, orderBy: {field: CREATED_AT, direction: DESC}) {
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

GROQ_MODEL_NAME = "openai/gpt-oss-120b"

def parse_single_repo_card_with_groq(graphql_data: dict, card_idx: int, template_columns: list = None, language: str = "ko") -> dict:
    if not groq_client:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GROQ_API_KEY가 설정되지 않았습니다."
        )

    fallback_name = graphql_data.get("repo_name", f"프로젝트_{card_idx}")
    cleaned_data = preprocess_github_data(graphql_data, default_repo_name=fallback_name)

    repo_name = cleaned_data["repo_name"]
    tech_stack_str = ", ".join(cleaned_data["tech_stacks"]) if cleaned_data["tech_stacks"] else "미지정"
    
    target_columns = template_columns if template_columns and len(template_columns) > 0 else [
        "Project Name (프로젝트명 & 역할)",
        "Timeline (기간)",
        "Tech Stack (사용 기술)",
        "Architecture & Impact (아키텍처 및 기술적 성과)"
    ]

    # 💡 언어 설정에 따른 프롬프트 분기 가이드
    lang_instruction = "반드시 자연스러운 **한국어(Korean)**로 작성해 주세요." if language == "ko" else "Please write everything in professional **English**."

    # ==========================================
    # 🤖 [Stage 1] 언어별 심층 분석 및 성과 추출 (Temperature 0.6)
    # ==========================================
    stage1_prompt = f"""
[프로젝트 원본 데이터]
- 저장소명: {repo_name}
- 사용 기술: {tech_stack_str}
- 커밋 내역: {json.dumps(cleaned_data['key_commits'], ensure_ascii=False)}
- PR 및 이슈: {json.dumps(cleaned_data['key_prs_and_issues'], ensure_ascii=False)}

[요청 사항]
1. 이 개발자의 GitHub 활동 내역을 바탕으로 단순 나열이 아닌, 실제 어떤 문제를 해결했고 어떤 아키텍처적 기여를 했는지 상세하고 풍부한 전문 개발 성과 서술문을 작성해 주세요.
2. 숨겨진 맥락과 기술적 깊이를 살려 구체적으로 4~6개의 핵심 성과 포인트로 풀어내 주세요.
3. 언어 규칙: {lang_instruction}
"""

    try:
        stage1_res = groq_client.chat.completions.create(
            model=GROQ_MODEL_NAME,
            messages=[
                {"role": "system", "content": "당신은 시니어 기술 리드이자 개발자 역량을 심층 분석하는 전문 테크니컬 라이터입니다."},
                {"role": "user", "content": stage1_prompt}
            ],
            temperature=0.6,
        )
        deep_analysis_text = stage1_res.choices[0].message.content if stage1_res.choices else "상세 분석 내용 없음"

        # ==========================================
        # 📐 [Stage 2] 선택된 템플릿 구조 및 DB 규격 맞춤형 포맷팅 (Temperature 0.1)
        # ==========================================
        stage2_system_prompt = f"""You are a professional resume formatting and database structuring engine.
CRITICAL GOAL: Transform the deep analysis text into exact JSON format matching the selected template columns.

Rules:
1. You MUST use the exact column names provided in the template list.
2. For each column, format the output in `original_text` starting with its exact name wrapped in brackets like `[컬럼명]` followed by content bullets.
3. Distribute the analysis appropriately across the given columns. If a column's data is minimal, summarize concisely.
4. Maintain the language used in the deep analysis text.

Template Columns to use:
{json.dumps(target_columns, ensure_ascii=False)}

JSON Output Schema:
{{
  "title": "프로젝트 이름",
  "columns": {json.dumps(target_columns, ensure_ascii=False)},
  "original_text": "[컬럼명1]\\n• 내용...\\n\\n[컬럼명2]\\n• 내용..."
}}
Return raw JSON without markdown formatting."""

        stage2_user_prompt = f"""
[심층 분석된 개발 성과 데이터]
{deep_analysis_text}

[저장소 기본 정보]
- 저장소명: {repo_name}
- 사용 기술: {tech_stack_str}

위 데이터를 지정된 템플릿 컬럼들에 정확히 매핑하여 지정된 JSON 스키마 형태로 반환해 주세요.
"""

        stage2_res = groq_client.chat.completions.create(
            model=GROQ_MODEL_NAME,
            messages=[
                {"role": "system", "content": stage2_system_prompt},
                {"role": "user", "content": stage2_user_prompt}
            ],
            temperature=0.1,
            response_format={"type": "json_object"}
        )

        content = stage2_res.choices[0].message.content if stage2_res.choices else None
        if not content:
            raise HTTPException(status_code=500, detail="Groq API 응답 본문이 비어있습니다.")

        res_json = json.loads(content) or {}
        card_title = res_json.get("title", repo_name)
        
        res_columns = res_json.get("columns", target_columns)
        original_text = res_json.get("original_text", f"[{target_columns[0]}]\n• {repo_name}")

        return {
            "id": f"card_{card_idx}",
            "title": card_title,
            "columns": res_columns,
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
    template_columns: Optional[List[str]] = None
    language: Optional[str] = "ko"  # 💡 프론트에서 넘어오는 언어 ('ko' 또는 'en')
    analysis_data: Optional[Dict[str, Any]] = None

@router.post("/github/analyze")
async def analyze_repository_graphql(
    payload: RepoAnalyzeRequest,
    authorization: Optional[str] = Header(None)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="GitHub Access Token이 필요합니다.")
    
    token = authorization.split(" ")[1]

    target_owner = payload.github_id
    target_repo_name = payload.repo_name

    if "/" in payload.repo_name:
        parts = payload.repo_name.split("/")
        target_owner = parts[0]
        target_repo_name = parts[1]

    # 💡 페이지네이션을 적용하여 기간 내 커밋을 안정적으로 수집
    async with httpx.AsyncClient(timeout=1200.0) as client:
        all_commits = []
        has_next_page = True
        after_cursor = None
        
        start_dt = datetime.strptime(payload.start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc) if payload.start_date else None

        # 최대 3페이지(300개)까지만 안전하게 순회하여 타임아웃 방지
        for _ in range(3):
            if not has_next_page:
                break

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
                        "name": target_repo_name,
                        "afterCursor": after_cursor
                    }
                }
            )
            
            res_data = response.json()
            if "errors" in res_data:
                raise HTTPException(
                    status_code=400, 
                    detail=f"GitHub GraphQL 요청 실패: {res_data['errors'][0].get('message')}"
                )
            
            raw_data = res_data.get("data", {})
            repo_analytics = raw_data.get("repository") or {}

            if not repo_analytics:
                raise HTTPException(
                    status_code=404,
                    detail=f"저장소 정보를 찾을 수 없습니다: {target_owner}/{target_repo_name}"
                )

            # 첫 요청 시 기본 저장소 메타데이터 확보
            if not all_commits:
                base_repo_data = repo_analytics

            # 커밋 히스토리 추출
            history_data = repo_analytics.get("defaultBranchRef", {}).get("target", {}).get("history", {})
            page_info = history_data.get("pageInfo", {})
            nodes = history_data.get("nodes", [])

            should_stop = False
            for node in nodes:
                committed_date = node.get("committedDate")
                if committed_date and start_dt:
                    try:
                        commit_dt = datetime.fromisoformat(committed_date.replace("Z", "+00:00"))
                        if commit_dt < start_dt:
                            should_stop = True
                    except Exception:
                        pass
                all_commits.append(node)

            if should_stop or not page_info.get("hasNextPage"):
                break

            after_cursor = page_info.get("endCursor")
            has_next_page = page_info.get("hasNextPage", False)

        # 수집된 방대한 커밋 내역을 기본 저장소 구조에 교체 주입
        if base_repo_data.get("defaultBranchRef") and base_repo_data["defaultBranchRef"].get("target"):
            base_repo_data["defaultBranchRef"]["target"]["history"]["nodes"] = all_commits

        base_repo_data["repo_name"] = base_repo_data.get("name") or target_repo_name
        base_repo_data["target_author"] = target_owner

        return base_repo_data
    
@router.post("/resumes/github-generate")
async def generate_github_resume(
    payload: GithubResumeGenerateRequest,
    db: Client = Depends(get_supabase)
):
    created_document_id = None

    try:
        analysis_data = payload.analysis_data or {}
        projects_data = analysis_data.get("projects_data", [])
        template_columns = payload.template_columns # 💡 템플릿 컬럼 전달

        if not projects_data and analysis_data.get("repo_name"):
            projects_data = [analysis_data]

        if not projects_data:
            raise HTTPException(
                status_code=400, 
                detail="분석된 저장소 데이터(projects_data)가 존재하지 않습니다."
            )

        estimated_tokens, required_energy = estimate_tokens_and_cost_v2(projects_data)

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
                # 💡 template_columns와 language를 함께 전달
                card_detail = parse_single_repo_card_with_groq(
                    repo_analytics, 
                    card_idx=idx, 
                    template_columns=template_columns,
                    language=payload.language
                )
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

        # 💡 dict 객체이므로 대괄호 키 접근 방식을 사용하고, 없으면 template_columns나 기본값을 사용
        columns = (details_list[-1].get("columns") if details_list else None) or template_columns or ["프로젝트명", "담당 역할", "사용 기술 및 스택", "주요 구현 및 문제 해결 성과"]
        
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

def estimate_tokens_and_cost_v2(projects_data: list) -> tuple[int, int]:
    total_chars = 0
    for repo in projects_data:
        target_author = repo.get("target_author", "")
        cleaned = preprocess_github_data(repo, target_author=target_author)
        text_blob = json.dumps(cleaned, ensure_ascii=False)
        total_chars += len(text_blob)
    
    estimated_tokens = total_chars // 3 
    energy_cost = max(1, estimated_tokens // 5000)
    
    return estimated_tokens, energy_cost

@router.get("/develop/github/repositories")
def get_github_repositories(
    github_id: str,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    months: Optional[int] = Query(None),
    authorization: Optional[str] = Header(None)
):
    try:
        if not start_date or not end_date:
            return {"repositories": []}

        token = authorization.replace("Bearer ", "").strip() if authorization else ""
        headers = {
            "Accept": "application/vnd.github.v3+json"
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"

        raw_repos = []

        gh_url = f"https://api.github.com/users/{github_id}/repos?sort=updated&per_page=100"
        response = requests.get(gh_url, headers=headers, timeout=10)
        if response.status_code == 200:
            raw_repos.extend(response.json())

        search_headers = {
            "Accept": "application/vnd.github.v3+json"
        }
        if token:
            search_headers["Authorization"] = f"Bearer {token}"
            
        search_url = f"https://api.github.com/search/commits?q=author:{github_id}&sort=author-date&order=desc&per_page=30"
        search_res = requests.get(search_url, headers=search_headers, timeout=10)

        if search_res.status_code == 200:
            search_data = search_res.json()
            items = search_data.get("items", [])
            contributed_repo_full_names = set()

            for item in items:
                repo_info = item.get("repository")
                if repo_info and isinstance(repo_info, dict):
                    full_name = repo_info.get("full_name")
                    if full_name:
                        contributed_repo_full_names.add(full_name)

            for full_name in contributed_repo_full_names:
                repo_detail_url = f"https://api.github.com/repos/{full_name}"
                detail_res = requests.get(repo_detail_url, headers=headers, timeout=5)
                if detail_res.status_code == 200:
                    raw_repos.append(detail_res.json())

        start_datetime = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        end_datetime = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)

        filtered_repos = []
        for repo in raw_repos:
            if not repo or not isinstance(repo, dict):
                continue
                
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

        unique_repos_dict = {repo["full_name"]: repo for repo in filtered_repos}
        return {"repositories": list(unique_repos_dict.values())}

    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"서버 내부 오류: {str(e)}")

class EstimateCostRequest(BaseModel):
    analysis_data: Dict[str, Any]

@router.post("/github/estimate-cost")
def estimate_github_cost(payload: EstimateCostRequest):
    analysis_data = payload.analysis_data or {}
    projects_data = analysis_data.get("projects_data", [])
    
    if not projects_data and analysis_data.get("repo_name"):
        projects_data = [analysis_data]
        
    if not projects_data:
        return {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "energy_cost": 1}
        
    total_chars = 0
    for repo in projects_data:
        target_author = repo.get("target_author", "")
        cleaned = preprocess_github_data(repo, target_author=target_author)
        text_blob = json.dumps(cleaned, ensure_ascii=False)
        total_chars += len(text_blob)
    
    # 💡 입력 토큰과 출력 토큰을 동일하게 가져가거나, 명확한 1:1 비례로 설정
    input_tokens = total_chars // 3
    output_tokens = input_tokens  # 출력값도 입력값과 동일하게 계산
    total_tokens = input_tokens + output_tokens
    
    # 💡 5,000토큰당 1에너지 (원하시는 기준에 맞춰 조절 가능)
    energy_cost = max(1, total_tokens // 5000)
    
    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
        "energy_cost": energy_cost,
        "message": f"입력: {input_tokens:,}개 / 출력: {output_tokens:,}개 / 총 토큰: {total_tokens:,}개"
    }


def estimate_tokens_and_cost_v2(projects_data: list) -> tuple[int, int]:
    total_chars = 0
    for repo in projects_data:
        target_author = repo.get("target_author", "")
        cleaned = preprocess_github_data(repo, target_author=target_author)
        text_blob = json.dumps(cleaned, ensure_ascii=False)
        total_chars += len(text_blob)
    
    input_tokens = total_chars // 3
    output_tokens = input_tokens * 2  # 출력값은 입력값의 2배로 설정
    total_tokens = input_tokens *2 + output_tokens
    
    energy_cost = max(1, total_tokens // 5000)
    
    return total_tokens, energy_cost
