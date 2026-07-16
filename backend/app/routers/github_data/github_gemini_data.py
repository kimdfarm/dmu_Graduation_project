import os
import asyncio
from datetime import datetime
from typing import List, Dict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
from dotenv import load_dotenv

# 기존 설정된 supabase 클라이언트 가져오기
from app.core.config import supabase
import google.generativeai as genai

load_dotenv()

router = APIRouter(
    prefix="/github",
    tags=["GitHub Data (Resume Work Experience Template)"]
)

GITHUB_GRAPHQL_URL = "https://api.github.com/graphql"

# Gemini API 설정
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


class AnalyzeRequest(BaseModel):
    member_id: str          
    github_username: str    
    github_token: str       


# 이력서 내 경력 사항(Experience) 포맷으로 가공하는 AI 함수
async def analyze_rich_repo_with_gemini(username: str, repo_info: Dict) -> str:
    """
    구글 제미나이를 활용하여 개발자의 저장소 활동 기록을 이력서 경력 란에 바로 들어갈 수 있는 
    '주요 업무 및 성과' 텍스트로 요약 및 가공합니다.
    """
    if not GEMINI_API_KEY:
        return "Gemini API Key가 설정되지 않았습니다."

    commit_str = "\n".join([f"- {c}" for c in repo_info['commits']]) if repo_info['commits'] else "최근 커밋 기록 없음"
    issue_str = "\n".join([f"- [{i['state']}] {i['title']}" for i in repo_info['issues']]) if repo_info['issues'] else "최근 관련 이슈 없음"
    pr_str = "\n".join([f"- [{p['state']}] {p['title']}" for p in repo_info['prs']]) if repo_info['prs'] else "최근 Pull Request 없음"

    prompt = f"""
    당신은 IT 전문 커리어 코치이자 채용 담당자입니다.
    개발자 '{username}'의 '{repo_info['name']}' 저장소 내 활동 데이터(Commit, Issue, PR)를 분석하여, 
    이 프로젝트가 어떤 프로젝트인지 요약하고, 개발자가 달성한 기여를 **이력서 내 경력(Experience) 항목의 '주요 수행 업무 및 성과'로 바로 삽입할 수 있게** 작성해 주세요.

    [저장소 메타데이터]
    - 저장소 이름: {repo_info['name']}
    - 사용 기술 스택: {repo_info['lang']}
    - 프로젝트 설명: {repo_info['raw_desc']}

    [상세 개발 활동 로그]
    1. 커밋 메시지 내역:
    {commit_str}

    2. 참여 및 생성한 이슈(Issue) 내역:
    {issue_str}

    3. 생성 및 처리한 풀 리퀘스트(PR) 내역:
    {pr_str}

    [이력서 경력 항목 작성 가이드라인]
    1. **이력서 경력란 전용 어조 사용 (★필수)**
       - 제3자의 평가적 관점(~한 것으로 보임, ~기여를 함)은 절대 배제합니다.
       - 개발자 본인의 주도적 행동을 나타내는 **개조식 서술어 종결 표현(~함, ~임, ~ 구축, ~ 완료)**을 사용해 주세요.
       - (예시) "데이터를 정제하는 역할을 수행한 것으로 추정됩니다" (X) -> "데이터 파이프라인 정제 프로세스를 설계하고 가공 모듈을 직접 구현함" (O)

    2. **정성적 성과 추론 및 구체화**
       - 단순 작업 수량 나열("커밋 10번 함")은 제외하고, 커밋 메시지와 이슈/PR 목적을 분석하여 **어떤 기술적 문제를 해결했는지, 어떤 핵심 기능을 설계/개선했는지** 직관적으로 드러나게 작성해 주세요.

    3. **출력 구조 (이력서 포맷)**
       - 오직 아래의 항목과 불릿 포인트(•) 형태로만 구성해 주세요. 다른 서론이나 맺음말은 전부 제외해 주세요.
       
       **[프로젝트 개요]**
       - {repo_info['name']} 프로젝트에 대한 한 줄 요약 정의
       
       **[수행 업무 및 성과 (Key Tasks & Accomplishments)]**
       - 수집된 실제 로그 기반 성과 2~3개를 명확한 개조식 불릿 포인트로 작성 (사용 스택 명시)

    [출력 예시]
    **[프로젝트 개요]**
    - {repo_info['lang']} 기반 실시간 데이터 분석 인프라 구축 프로젝트
    
    **[수행 업무 및 성과]**
    - {repo_info['lang']}을 활용한 API 비동기 라우터 설계 및 대용량 트래픽 처리 성능 고도화 수행
    - 시스템 예외 처리 로직 및 예기치 못한 API 연결 끊김 이슈에 대응하는 트러블슈팅을 주도하여 서버 안정성을 향상시킴
    - 브랜치 관리 전략 하에 다수의 코드 리뷰 및 PR 피드백을 반영하며 코드 가독성 개선 및 리팩토링 진행
    """

    try:
        model = genai.GenerativeModel("gemini-3.5-flash")
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, model.generate_content, prompt)
        return response.text.strip()
    except Exception as e:
        return f"이력서 경력 기술 가공 실패: {str(e)}"


@router.post("/analyze")
async def analyze_github_each_repo(request: AnalyzeRequest):
    username = request.github_username
    member_id = request.member_id
    github_token = request.github_token

    headers = {
        "Authorization": f"Bearer {github_token}",
        "Content-Type": "application/json",
    }

    graphql_query = """
    query($login: String!) {
      user(login: $login) {
        repositories(first: 6, orderBy: {field: UPDATED_AT, direction: DESC}) {
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
                    nodes { message }
                  }
                }
              }
            }
            issues(first: 5, orderBy: {field: UPDATED_AT, direction: DESC}) {
              nodes { title state }
            }
            pullRequests(first: 5, orderBy: {field: UPDATED_AT, direction: DESC}) {
              nodes { title state }
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

        repos_raw_data = user_data["repositories"]["nodes"]
        if not repos_raw_data:
            return {"message": "분석할 저장소가 없습니다.", "inserted_count": 0}

        careers_to_insert = []

        for repo in repos_raw_data:
            repo_name = repo["name"]
            raw_desc = repo["description"] or "작성된 설명 없음"
            start_date = repo["createdAt"].split("T")[0]
            end_date = repo["updatedAt"].split("T")[0]
            company_name = repo["owner"]["login"] if repo["owner"]["__typename"] == "Organization" else "Personal Project"
            lang = repo["primaryLanguage"]["name"] if repo["primaryLanguage"] else "Unknown"
            
            commit_messages = []
            if repo.get("defaultBranchRef") and repo["defaultBranchRef"].get("target"):
                commit_nodes = repo["defaultBranchRef"]["target"]["history"].get("nodes")
                if commit_nodes:
                    commit_messages = [c["message"] for c in commit_nodes]

            issue_list = []
            if repo.get("issues") and repo["issues"].get("nodes"):
                issue_list = [{"title": i["title"], "state": i["state"]} for i in repo["issues"]["nodes"]]

            pr_list = []
            if repo.get("pullRequests") and repo["pullRequests"].get("nodes"):
                pr_list = [{"title": p["title"], "state": p["state"]} for p in repo["pullRequests"]["nodes"]]

            repo_rich_info = {
                "name": repo_name,
                "lang": lang,
                "raw_desc": raw_desc,
                "commits": commit_messages,
                "issues": issue_list,
                "prs": pr_list
            }

            print(f"[{repo_name}] 이력서용 경력 항목 변환 가공 중...")
            ai_resume_experience = await analyze_rich_repo_with_gemini(username, repo_rich_info)

            final_description = (
                f"{ai_resume_experience}\n\n"
                f"[추가 메타데이터]\n"
                f"- 주요 사용 기술: {lang}\n"
                f"- GitHub Repository: {repo['url']}"
            )

            career_data = {
                "member_id": member_id,
                "company_name": company_name,
                "department": "R&D", 
                "job_title": "Software Engineer", 
                "start_date": start_date,
                "end_date": end_date,
                "is_current": False,
                "description": final_description
            }
            careers_to_insert.append(career_data)
            
            await asyncio.sleep(0.8)

        # 💡 [해결 핵심 포인트] Supabase v2 파싱 에러(columns parameter) 우회
        # delete()와 insert() 뒤에 데이터베이스 기본 키 또는 전체(*)를 명시적으로 셀렉트하는 `.select("id")` 등을 추가하거나,
        # 빈 컬럼 파싱 문제를 막기 위해 명시적 체이닝을 구성했습니다.
        try:
            # 1. 기존 데이터 초기화 (영향받는 행의 ID만 선택 반환하여 파싱 오류 해결)
            supabase.table("careers").delete().eq("member_id", member_id).select("id").execute()
            
            # 2. 신규 데이터 대량 추가
            supabase.table("careers").insert(careers_to_insert).execute()
            
            return {
                "status": "success",
                "message": "각 저장소별 깃허브 활동 로그를 분석하여 이력서 '경력 사항' 규격에 맞춰 Supabase에 등록을 완료했습니다.",
                "inserted_count": len(careers_to_insert)
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Supabase 반영 중 오류 발생: {str(e)}")