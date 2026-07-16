import os
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
from dotenv import load_dotenv

# ⭐ 핵심: 이미 설정된 supabase 및 openai 클라이언트를 가져옵니다.
from app.core.config import supabase

# AI 분석을 위한 라이브러리 설치 필요: pip install openai
from openai import OpenAI

load_dotenv()

# APIRouter 선언
router = APIRouter(
    prefix="/github",
    tags=["GitHub Data (AI Enhanced)"]
)

# 환경 변수 및 설정
GITHUB_GRAPHQL_URL = "https://api.github.com/graphql"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") # 발급받은 API Key를 .env에 꼭 추가해 주세요.
openai_client = OpenAI(api_key=OPENAI_API_KEY)


class AnalyzeRequest(BaseModel):
    member_id: str          # 내 서비스의 회원 ID
    github_username: str    # 분석할 사용자의 GitHub ID
    github_token: str       # 테스트용 또는 프론트엔드에서 넘겨받을 토큰


# 💡 [함수 추가] 수집된 원시 데이터를 AI가 분석하여 정성적인 멘트를 생성하는 함수
async def analyze_contribution_pattern_with_ai(
    username: str, 
    repo_stats: List[Dict], 
    contribution_raw_data: Dict
) -> str:
    """
    OpenAI 모델을 사용하여 사용자의 GitHub 활동 패턴을 정성적으로 분석합니다.
    """
    if not OPENAI_API_KEY:
        return "OpenAI API Key가 설정되지 않아 AI 분석을 수행할 수 없습니다."

    # 1. AI에게 던질 데이터 가공 (너무 많은 Raw 데이터를 던지면 토큰 비용이 폭발하므로 핵심 위주로 요약)
    # 주요 저장소 요약
    top_repos = repo_stats[:3] # 최근 업데이트된 상위 3개
    repo_context = []
    for r in top_repos:
        repo_context.append(
            f" - '{r['name']}': 주 언어={r['lang']}, 총 커밋={r['commit_count']}, 최근작업='{r['recent_commit_msg']}'"
        )
    repo_summary_text = "\n".join(repo_context)

    # 활동 캘린더 데이터 요약
    cal_data = contribution_raw_data.get("contributionCalendar", {})
    total_commits = contribution_raw_data.get("totalCommitContributions", 0)
    total_issues = contribution_raw_data.get("totalIssueContributions", 0)
    total_prs = contribution_raw_data.get("totalPullRequestContributions", 0)
    
    # AI에게 보낼 최종 프롬프트 구성
    prompt = f"""
    당신은 전문 기술 면접관이자 커리어 코치입니다. 다음 GitHub 원시 데이터를 바탕으로 개발자 '{username}'의 성향과 전문성을 분석하여 정성적인 '총평'을 작성해 주세요.

    [제공되는 원시 데이터]
    1. 주요 저장소 패턴:
    {repo_summary_text}
    
    2. 다각적인 활동 통계 (지난 1년):
    - 총 커밋 기여: {total_commits}회
    - 이슈 생성: {total_issues}회
    - PR 생성 및 기여: {total_prs}회

    [분석 요청 사항]
    - 단순히 숫자를 나열하지 말고, 정성적으로 분석하세요. (예: "총 100커밋 했군요" (X) -> "꾸준한 커밋 패턴을 보아 성실성이 돋보이며..." (O))
    - 어떤 종류의 프로젝트를 선호하는지, 어떤 언어에 강점이 있는지 유추하세요.
    - 이슈 및 PR 활동을 통해 협업이나 오픈소스 기여에 적극적인지 분석하세요. (이슈/PR 숫자가 적다면 커밋 위주의 단독 개발 성향임을 언급해도 좋습니다.)
    - 최근 작업 내용을 보아 현재 어떤 기술에 관심을 두고 있는지 유추하세요.
    - 전체적으로 이 개발자를 한마디로 정의하는 '핵심 키워드'와 함께, 매끄러운 2~3문장 이내의 총평을 작성해 주세요. (한국어로 작성)
    """

    try:
        # AI 모델 호출 (GPT-3.5-turbo 기준)
        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7, # 창의성 조절 (0.7은 적당한 수준)
            max_tokens=250,  # 답변 길이 제한
        )
        # AI가 내놓은 분석 멘트 추출
        ai_comment = response.choices[0].message.content.strip()
        return ai_comment
    except Exception as e:
        return f"AI 분석 중 오류가 발생했습니다: {str(e)}"


@router.post("/analyze")
async def analyze_github_with_ai(request: AnalyzeRequest):
    username = request.github_username
    member_id = request.member_id
    github_token = request.github_token

    # 지난 1년간의 데이터를 가져오기 위한 날짜 계산
    today = datetime.utcnow()
    one_year_ago = (today - timedelta(days=365)).isoformat() + "Z" # ISO8601 형식

    # 1. 넘겨받은 GitHub 토큰으로 헤더 설정
    headers = {
        "Authorization": f"Bearer {github_token}",
        "Content-Type": "application/json",
    }

    # 💡 [GraphQL 쿼리 확장] 단순 커밋 10개가 아닌, 1년간의 Contribution Calendar 전체 데이터를 가져옵니다.
    graphql_query = """
    query($login: String!, $from: DateTime!) {
      user(login: $login) {
        # 1. 사용자의 지난 1년간 상세 활동 통계 (Contribution Calendar) - 추가됨
        contributionsCollection(from: $from) {
          totalCommitContributions
          totalIssueContributions
          totalPullRequestContributions
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                date
                weekday
              }
            }
          }
        }
        
        # 2. 저장소 정보 (기존 구조 유지하되 AI 피딩용으로 데이터 살짝 추가)
        repositories(first: 10, orderBy: {field: UPDATED_AT, direction: DESC}) {
          nodes {
            name
            description
            createdAt
            updatedAt
            url
            owner { login __typename }
            primaryLanguage { name }
            stargazerCount # 추가: 저장소의 인기도
            defaultBranchRef {
              target {
                ... on Commit {
                  history(first: 1) { # AI에게 보낼 최근 커밋 1개 메세지만
                    totalCount
                    nodes { message }
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
            json={"query": graphql_query, "variables": {"login": username, "from": one_year_ago}},
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

        # 데이터 파싱
        contribution_raw_data = user_data["contributionsCollection"]
        repos_raw_data = user_data["repositories"]["nodes"]
        
        if not repos_raw_data:
            return {"message": "분석할 저장소가 없습니다.", "inserted_count": 0}

        # 💡 [로직 수정] AI 분석 함수에 던지기 위한 중간 데이터 가공 및 저장소별 description_summary 생성
        repo_processed_stats = []
        careers_to_insert = []

        # 저장소 반복문
        for repo in repos_raw_data:
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

            # AI 분석용 중간 데이터 수집
            repo_processed_stats.append({
                "name": repo_name,
                "lang": lang,
                "commit_count": commit_count,
                "recent_commit_msg": recent_commit_msg,
                "stargazers": repo["stargazerCount"]
            })

            # 개별 저장소용 설명 요약 (기존과 유사)
            individual_summary = (
                f"[프로젝트] {repo_name}\n"
                f"[설명] {repo_desc}\n"
                f"[기술 스택] {lang}\n"
                f"[활동 요약] 총 {commit_count}개의 커밋 기여 (★{repo['stargazerCount']})\n"
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
                "description": individual_summary # 개별 저장소 요약 우선 저장
            }
            careers_to_insert.append(career_data)

        # 💡 [핵심 추가] AI를 활용한 전체 활동 패턴 정성 분석 수행
        # 이 분석은 비동기로 OpenAI API를 호출하므로 시간이 살짝 걸립니다. (Swagger 테스트 시 느려짐 주의)
        print(f"[{username}] 사용자 AI 활동 분석 시작...")
        ai_qualitative_comment = await analyze_contribution_pattern_with_ai(username, repo_processed_stats, contribution_raw_data)
        print(f"[{username}] AI 분석 완료: {ai_qualitative_comment[:30]}...") # 일부만 출력


        # 💡 [로직 수정] 생성된 AI 분석 총평을 최종 데이터의 description_summary 맨 위에 얹어줍니다.
        for career in careers_to_insert:
            final_summary = (
                f"[AI가 분석한 개발 성향 총평]\n"
                f"☞ {ai_qualitative_comment}\n\n"
                f"--- [상세 프로젝트 정보] ---\n"
                f"{career['description']}"
            )
            career['description'] = final_summary # AI 분석 결과 반영

        try:
            # 새로운 데이터를 넣기 전에, 이 유저(member_id)의 기존 이력 데이터를 먼저 삭제합니다. (초기화)
            supabase.table("careers").delete().eq("member_id", member_id).execute()

            # 새로운 데이터 일괄 저장 (Bulk Insert)
            supabase_response = supabase.table("careers").insert(careers_to_insert).execute()
            
            return {
                "status": "success",
                "message": "AI 기반 정성 분석을 완료하고 최신 정보를 업데이트했습니다.",
                "ai_comment_snippet": ai_qualitative_comment, # Swagger에서 바로 볼 수 있게 리턴값에 추가
                "inserted_count": len(careers_to_insert)
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Supabase 데이터 처리 오류: {str(e)}")