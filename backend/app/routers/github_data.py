import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
from app.core.config import supabase  # 기존 설정된 supabase 클라이언트

router = APIRouter(
    prefix="/github",
    tags=["GitHub Data"]
)

GITHUB_GRAPHQL_URL = "https://api.github.com/graphql"

class AnalyzeRequest(BaseModel):
    member_id: str          # 내 서비스의 회원 ID
    github_username: str    # 분석할 사용자의 GitHub ID
    github_token: str       # 테스트용 또는 프론트엔드에서 넘겨받을 토큰


@router.post("/analyze")
async def analyze_github_with_oauth(request: AnalyzeRequest):
    username = request.github_username
    member_id = request.member_id
    github_token = request.github_token

    # 1. 넘겨받은 GitHub 토큰으로 헤더 설정
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Content-Type": "application/json",
    }

    # 2. GraphQL 쿼리 실행
    graphql_query = """
    query($login: String!) {
      user(login: $login) {
        repositories(first: 20, orderBy: {field: UPDATED_AT, direction: DESC}) {
          nodes {
            name
            description
            createdAt
            updatedAt
            url
            owner { login __typename }
            primaryLanguage { name }
            defaultBranchRef {
              target {
                ... on Commit {
                  history(first: 10) {
                    totalCount
                    nodes { message committedDate }
                  }
                }
              }
            }
          }
        }
      }
    }
    """

    async with httpx.AsyncClient() as client:
        response = await client.post(
            GITHUB_GRAPHQL_URL,
            json={"query": graphql_query, "variables": {"login": username}},
            headers=headers
        )

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="GitHub GraphQL API 호출 실패")

        result_data = response.json()
        
        if "errors" in result_data:
            raise HTTPException(status_code=400, detail=result_data["errors"][0]["message"])

        user_data = result_data.get("data", {}).get("user")
        if not user_data:
            raise HTTPException(status_code=404, detail="GitHub 유저를 찾을 수 없습니다.")

        repos = user_data["repositories"]["nodes"]
        if not repos:
            return {"message": "분석할 저장소가 없습니다.", "inserted_count": 0}

        careers_to_insert = []

        for repo in repos:
            repo_name = repo["name"]
            repo_desc = repo["description"] or "설명 없음"
            start_date = repo["createdAt"].split("T")[0]
            end_date = repo["updatedAt"].split("T")[0]
            
            company_name = repo["owner"]["login"] if repo["owner"]["__typename"] == "Organization" else "Personal Project"
            lang = repo["primaryLanguage"]["name"] if repo["primaryLanguage"] else "Unknown"
            
            commit_count = 0
            recent_commit_msg = "기록 없음"
            if repo.get("defaultBranchRef") and repo["defaultBranchRef"].get("target"):
                history = repo["defaultBranchRef"]["target"]["history"]
                commit_count = history.get("totalCount", 0)
                if history.get("nodes"):
                    recent_commit_msg = history["nodes"][0]["message"]

            description_summary = (
                f"[프로젝트] {repo_name}\n"
                f"[설명] {repo_desc}\n"
                f"[기술 스택] {lang}\n"
                f"[활동 요약] 총 {commit_count}개의 커밋 기여\n"
                f"[최근 작업] {recent_commit_msg}\n"
                f"[링크] {repo['url']}"
            )

            career_data = {
                "member_id": member_id,
                "company_name": company_name,
                "department": "GitHub GraphQL Engine",
                "job_title": "Open Source Contributor" if company_name != "Personal Project" else "Main Developer",
                "start_date": start_date,
                "end_date": end_date,
                "is_current": False,
                "description": description_summary
            }
            careers_to_insert.append(career_data)

        try:
            # ⭐ 핵심 추가: 새로운 데이터를 넣기 전에, 이 유저(member_id)의 기존 이력 데이터를 먼저 삭제합니다.
            supabase.table("careers").delete().eq("member_id", member_id).execute()

            # 3. 새로운 데이터 일괄 저장 (Bulk Insert)
            supabase_response = supabase.table("careers").insert(careers_to_insert).execute()
            
            return {
                "status": "success",
                "message": "기존 데이터를 초기화하고 최신 정보를 업데이트했습니다.",
                "inserted_count": len(careers_to_insert),
                "data": supabase_response.data
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Supabase 데이터 처리 오류: {str(e)}")