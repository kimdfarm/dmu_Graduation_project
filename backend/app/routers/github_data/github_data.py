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
import re
import ast

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
    try:
        effective_author = target_author or raw_graphql_data.get("target_author", "")
        repo_name = (
            raw_graphql_data.get("name") 
            or raw_graphql_data.get("repo_name") 
            or raw_graphql_data.get("full_name") 
            or default_repo_name 
            or "프로젝트"
        )

        languages_data = raw_graphql_data.get("languages", {}) or {}
        tech_stacks = []
        if isinstance(languages_data, dict):
            if "nodes" in languages_data:
                tech_stacks = [n.get("name") for n in (languages_data.get("nodes") or []) if n and n.get("name")]
            elif "edges" in languages_data:
                tech_stacks = [e.get("node", {}).get("name") for e in (languages_data.get("edges") or []) if e and e.get("node")]

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

            if effective_author and author_login and author_login.lower() != effective_author.lower():
                continue

            msg = (c.get("messageHeadline") or c.get("message") or "").strip()
            if not msg:
                continue

            additions = c.get("additions", 0) or 0
            deletions = c.get("deletions", 0) or 0

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
                if effective_author and pr_author and pr_author.lower() != effective_author.lower():
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
    except Exception as e:
        print(f"Preprocessor Error: {e}")
        return {
            "repo_name": default_repo_name or "프로젝트",
            "tech_stacks": [],
            "key_commits": [],
            "key_prs_and_issues": []
        }

groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

try:
    from json_repair import repair_json
except ImportError:
    repair_json = None


def extract_and_clean_json(text: str) -> str:
    if not text:
        return ""
    cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", text.strip())
    cleaned = re.sub(r"\n?```$", "", cleaned).strip()
    
    start_idx = cleaned.find('{')
    end_idx = cleaned.rfind('}')
    if start_idx != -1 and end_idx != -1 and start_idx < end_idx:
        return cleaned[start_idx:end_idx + 1]
    return cleaned


def safe_json_parse(json_str: str) -> dict:
    cleaned_str = extract_and_clean_json(json_str)

    if repair_json:
        try:
            return json.loads(repair_json(cleaned_str))
        except Exception:
            pass

    try:
        return json.loads(cleaned_str, strict=False)
    except json.JSONDecodeError:
        pass

    try:
        cleaned = re.sub(r',(\s*[}\]])', r'\1', cleaned_str)
        cleaned = re.sub(r'(?<!\\)[\r\n]+', r'\\n', cleaned)
        return json.loads(cleaned, strict=False)
    except json.JSONDecodeError:
        pass

    try:
        evaluated = ast.literal_eval(cleaned_str)
        if isinstance(evaluated, dict):
            return evaluated
    except (ValueError, SyntaxError):
        pass

    raise ValueError("LLM 응답 JSON 파싱 실패")


def normalize_github_resume_data(parsed_dict: dict) -> dict:
    if not isinstance(parsed_dict, dict):
        return {"doc_type": "RESUME", "sections": []}

    raw_sections = parsed_dict.get("sections") or parsed_dict.get("data") or []
    if isinstance(raw_sections, dict):
        raw_sections = [raw_sections]

    normalized_sections = []

    for idx, sec in enumerate(raw_sections):
        if not isinstance(sec, dict):
            continue

        section_title = (
            sec.get("section_title") or 
            sec.get("category") or 
            sec.get("title") or 
            "세부 정보"
        )
        section_type = sec.get("section_type") or "PROJECTS"
        
        raw_details = (
            sec.get("details") or 
            sec.get("items") or 
            sec.get("contents") or 
            []
        )
        if isinstance(raw_details, dict):
            raw_details = [raw_details]

        normalized_details = []
        global_ai_columns = []

        for d_idx, item in enumerate(raw_details):
            if isinstance(item, dict):
                card_id = str(item.get("id") or f"card_{idx + 1}_{d_idx + 1}")
                item_title = str(item.get("title") or item.get("name") or "항목").strip()
                
                ai_columns = item.get("ai_columns") or sec.get("ai_columns") or ["항목", "내용"]
                column_values = item.get("column_values") or {}

                for col in ai_columns:
                    if col not in global_ai_columns:
                        global_ai_columns.append(col)

                formatted_text_parts = []
                for col in ai_columns:
                    val = column_values.get(col, "")
                    formatted_text_parts.append(f"[{col}]\n{val}")
                
                structured_text = "\n\n".join(formatted_text_parts)

                if structured_text.strip():
                    normalized_details.append({
                        "id": card_id,
                        "title": item_title,
                        "original_text": structured_text.strip(),
                        "ai_columns": ai_columns,
                        "column_values": column_values,
                        "selected_version": "ORIGINAL"
                    })

        if normalized_details:
            normalized_sections.append({
                "section_type": str(section_type),
                "section_title": str(section_title).strip(),
                "display_order": idx + 1,
                "columns": global_ai_columns if global_ai_columns else ["항목", "내용"],
                "details": normalized_details
            })

    return {
        "doc_type": parsed_dict.get("doc_type", "RESUME"),
        "sections": normalized_sections
    }


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
    template_structure: Optional[Dict[str, Any]] = None  
    language: Optional[str] = "ko"
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

    async with httpx.AsyncClient(timeout=1200.0) as client:
        all_commits = []
        has_next_page = True
        after_cursor = None
        
        start_dt = datetime.strptime(payload.start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc) if payload.start_date else None

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

            if not all_commits:
                base_repo_data = repo_analytics

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

    if not groq_client:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GROQ_API_KEY가 설정되지 않았습니다."
        )

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

        # 1. 상위 documents 문서 생성
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

        # 2. 프론트엔드에서 전달된 템플릿 전체 구조 가져오기
        template_structure = payload.template_structure or {}
        template_sections = template_structure.get("sections", [])
        
        if not template_sections and payload.template_columns:
            template_sections = [
                {
                    "type": "PROJECTS",
                    "title": "경력 및 주요 프로젝트 성과",
                    "columns": payload.template_columns
                }
            ]

        lang_instruction = "반드시 자연스러운 **한국어(Korean)**로 작성해 주세요." if payload.language == "ko" else "Please write everything in professional **English**."

        model2_system_prompt = f"""You are an expert resume formatting and database structuring engine.

CRITICAL GOALS:
1. Analyze the provided GitHub repository analysis data.
2. Structure the data logically according to the requested template sections.
3. For each section and card/item, define appropriate custom column headers (`ai_columns`, e.g., ["프로젝트명", "주요 역할", "사용 기술", "상세 내용"]).
4. **DO NOT duplicate the entire text across all columns.** Distribute and summarize the text into its corresponding specific column keys in `column_values`.
5. Language rule: {lang_instruction}

반드시 아래의 **JSON 형식**으로만 응답하세요. 다른 설명이나 인사말은 절대 포함하지 마세요.
{{
  "doc_type": "RESUME",
  "sections": [
    {{
      "section_type": "PROJECTS",
      "section_title": "섹션 제목",
      "display_order": 1,
      "details": [
        {{
          "id": "card_1_1",
          "title": "프로젝트/항목 제목",
          "ai_columns": ["컬럼1", "컬럼2"],
          "column_values": {{
            "컬럼1": "내용...",
            "컬럼2": "내용..."
          }}
        }}
      ]
    }}
  ]
}}"""

        model2_user_prompt = f"""
[템플릿 섹션 정의 목록]
{json.dumps(template_sections, ensure_ascii=False)}

[깃허브 원본 프로젝트 분석 데이터]
{json.dumps(projects_data, ensure_ascii=False)}

위 데이터를 바탕으로 지정된 템플릿 섹션들에 알맞은 내용을 표준화된 JSON 스키마 형태로 생성해 주세요.
"""

        try:
            model2_res = groq_client.chat.completions.create(
                model=GROQ_MODEL_NAME,
                messages=[
                    {"role": "system", "content": model2_system_prompt},
                    {"role": "user", "content": model2_user_prompt}
                ],
                temperature=0.1,  
                max_tokens=4096,
                response_format={"type": "json_object"}
            )

            raw_content = model2_res.choices[0].message.content or ""
            clean_json_str = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_content.strip(), flags=re.MULTILINE)

            parsed_result = {}
            if clean_json_str:
                parsed = safe_json_parse(clean_json_str)
                parsed_result = normalize_github_resume_data(parsed)

            sections_data = parsed_result.get("sections", [])
            
            if not sections_data:
                sections_data = [
                    {
                        "section_type": "PROJECTS",
                        "section_title": "주요 프로젝트",
                        "display_order": 1,
                        "columns": ["프로젝트명", "주요 내용"],
                        "details": [{
                            "id": "card_1_1",
                            "title": payload.repo_name or "GitHub Project",
                            "original_text": "[프로젝트명]\nGitHub 프로젝트\n\n[주요 내용]\n분석 데이터 기반 자동 생성",
                            "ai_columns": ["프로젝트명", "주요 내용"],
                            "column_values": {"프로젝트명": payload.repo_name or "GitHub Project", "주요 내용": "분석 데이터 기반 자동 생성"},
                            "selected_version": "ORIGINAL"
                        }]
                    }
                ]

        except RateLimitError as rle:
            print(f"Groq 토큰 한도 초과(Rate Limit): {rle}")
            raise HTTPException(
                status_code=429,
                detail="Groq API 분당 토큰/요청 한도(Rate Limit)를 초과했습니다. 잠시 후 다시 시도해 주세요."
            )
        except Exception as sec_err:
            print(f"섹션 생성 중 오류 발생: {sec_err}")
            raise HTTPException(
                status_code=500,
                detail=f"섹션 AI 생성 중 오류 발생: {str(sec_err)}"
            )

        all_sections_list = []
        for idx, sec in enumerate(sections_data):
            if not isinstance(sec, dict):
                continue
                
            all_sections_list.append({
                "document_id": created_document_id,
                "section_type": sec.get("section_type", "PROJECTS"),
                "section_title": sec.get("section_title", "세부 정보"),
                "display_order": sec.get("display_order", idx + 1),
                "columns": sec.get("columns", ["항목", "내용"]),
                "details": sec.get("details", [])
            })

        if all_sections_list:
            sec_res = db.table("document_sections").insert(all_sections_list).execute()
            if not sec_res.data:
                raise HTTPException(status_code=500, detail="document_sections 일괄 저장 실패")

        return {
            "status": "success",
            "id": created_document_id,
            "title": payload.title,
            "category": payload.category,
            "total_sections": len(all_sections_list)
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
            status_status_code=status.HTTP_500_INTERNAL_SERVER_ERROR if hasattr(status, 'HTTP_500_INTERNAL_SERVER_ERROR') else 500,
            detail=f"GitHub 이력서 자동 생성 실패: {str(e)}"
        )


def estimate_tokens_and_cost_v2(projects_data: list) -> tuple[int, int]:
    total_chars = 0
    for repo in projects_data:
        target_author = repo.get("target_author", "")
        cleaned = preprocess_github_data(repo, target_author=target_author)
        text_blob = json.dumps(cleaned, ensure_ascii=False)
        total_chars += len(text_blob)
    
    input_tokens = total_chars // 3
    output_tokens = input_tokens * 2 
    total_tokens = input_tokens * 2 + output_tokens
    
    return total_tokens, 0

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
        return {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
        
    total_chars = 0
    for repo in projects_data:
        target_author = repo.get("target_author", "")
        cleaned = preprocess_github_data(repo, target_author=target_author)
        text_blob = json.dumps(cleaned, ensure_ascii=False)
        total_chars += len(text_blob)
    
    input_tokens = total_chars // 3
    output_tokens = input_tokens 
    total_tokens = input_tokens + output_tokens
    
    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
        "message": f"입력: {input_tokens:,}개 / 출력: {output_tokens:,}개 / 총 토큰: {total_tokens:,}개"
    }