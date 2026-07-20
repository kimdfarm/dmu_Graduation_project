import os
import asyncio
from typing import List, Dict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
from dotenv import load_dotenv

# 기존 설정된 supabase 클라이언트 가져오기
from app.core.config import supabase
# 💡 [변경 포인트] OpenAI 라이브러리 임포트
from openai import OpenAI

load_dotenv()

router = APIRouter(
    prefix="/github",
    tags=["GitHub Data (Resume Work Experience Template)"]
)

GITHUB_GRAPHQL_URL = "https://api.github.com/graphql"

# 💡 [변경 포인트] OpenAI API 설정
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


class AnalyzeRequest(BaseModel):
    member_id: str          
    github_username: str    
    github_token: str       


# 💡 [변경 포인트] OpenAI 기반의 이력서 가공 함수
async def analyze_rich_repo_with_openai(username: str, repo_info: Dict) -> str:
    if not openai_client:
        raise RuntimeError("OpenAI API Key가 시스템에 설정되지 않았습니다.")

    commit_str = "\n".join([f"- {c}" for c in repo_info['commits']]) if repo_info['commits'] else "최근 커밋 기록 없음"
    issue_str = "\n".join([f"- [{i['state']}] {i['title']}" for i in repo_info['issues']]) if repo_info['issues'] else "최근 관련 이슈 없음"
    pr_str = "\n".join([f"- [{p['state']}] {p['title']}" for p in repo_info['prs']]) if repo_info['prs'] else "최근 Pull Request 없음"

    prompt = f"""
    당신은 IT 전문 테크 채용 담당자이자 시니어 백엔드 엔지니어입니다.
    개발자 '{username}'의 '{repo_info['name']}' 저장소 활동 로그를 기반으로, 
    팩트(Fact)를 왜곡하지 않으면서 군더더기 없이 간결한 이력서용 '수행 업무 및 성과'를 작성해 주세요.

    [저장소 메타데이터]
    - 저장소 이름: {repo_info['name']}
    - 사용 기술 스택: {repo_info['lang']}
    - 프로젝트 설명: {repo_info['raw_desc']}

    [★ 이력서 작성 필수 제약 조건 ★]
    1. 종결어미 통제 (명사형/개조식 서술형)
       - 모든 문장은 '~함', '~임', '~ 구축', '~ 완료', '~ 설계', '~ 구현'으로만 끝나야 합니다.
       - '~하였습니다', '~했습니다', '~인 것으로 보입니다' 같은 구어체나 추측성 서술은 절대 금지합니다.

    2. 오타 및 번역체 교정
       - 데이터 '크로링'과 같은 번역 오류나 오타는 반드시 '크롤링(Crawling)'으로 올바르게 수정하여 기술하십시오.

    3. 행동(Action) + 방식(How) + 결과(Result) 구조화
       - 단순히 "무엇을 구현함"에 그치지 말고, 어떤 기술을 활용해서 어떻게 개선했는지 기술적 맥락을 담아 서술하십시오.

    4. 중복 제거 및 압축 (최대 2개 제한)
       - 비슷한 성과가 여러 번 나열되지 않도록 가장 핵심적인 기여 2가지만 선정해 팩트 위주로 압축 요약하십시오.

    [출력 포맷 (반드시 지켜야 함)]
    오직 아래 항목만 출력하고, 서론/결론/코드블록 마크다운 등 다른 부가적인 멘트는 일절 배제하고 핵심 기술 성과를 작성해 주세요.

    [{repo_info['name']}에서의 활동 경력]
    • [첫 번째 핵심 기술 성과 작성]
    • [두 번째 핵심 기술 성과 작성]

    [실제 개발 활동 로그]
    1. 커밋 메시지 내역:
    {commit_str}

    2. 참여 및 생성한 이슈(Issue) 내역:
    {issue_str}

    3. 생성 및 처리한 풀 리퀘스트(PR) 내역:
    {pr_str}
    """

    try:
        # 비동기 환경에서 동기 OpenAI 라이브러리를 안전하게 실행하기 위해 run_in_executor 사용
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: openai_client.chat.completions.create(
                model="gpt-4o-mini",  # 💡 비용 효율적이고 강력한 최신 mini 모델 사용
                messages=[
                    {"role": "system", "content": "You are a professional Korean resume writer. Write only in Korean."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
            )
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        raise RuntimeError(f"OpenAI API 호출 실패: {str(e)}")


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
        repositories(first: 50, orderBy: {field: UPDATED_AT, direction: DESC}) {
          nodes {
            name
            description
            isFork
            createdAt
            updatedAt
            url
            owner { login __typename }
            primaryLanguage { name }
            defaultBranchRef {
              target {
                ... on Commit {
                  history(first: 10) {
                    nodes { 
                      message 
                      author {
                        name
                        user {
                          login
                        }
                      }
                    }
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

    # 헤비 유저 데이터 수집을 위해 GitHub GraphQL 타임아웃 60초 설정
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(
                GITHUB_GRAPHQL_URL,
                json={"query": graphql_query, "variables": {"login": username}},
                headers=headers
            )
        except Exception as e:
            raise HTTPException(
                status_code=500, 
                detail=f"GitHub API 통신 오류 (타임아웃 의심): {type(e).__name__} - {str(e)}"
            )

        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code, 
                detail=f"GitHub GraphQL API 호출 실패 (상태 코드: {response.status_code})"
            )

        result_data = response.json()
        if "errors" in result_data:
            raise HTTPException(status_code=400, detail=result_data["errors"][0]["message"])

        user_data = result_data.get("data", {}).get("user")
        if not user_data:
            raise HTTPException(status_code=404, detail="GitHub 유저를 찾을 수 없습니다.")

        repos_raw_data = user_data["repositories"]["nodes"]
        if not repos_raw_data:
            return {"message": "분석할 저장소가 없습니다.", "inserted_count": 0}

        valid_repos = []

        # 1차 필터링: 활동 내역이 존재하는 유효 저장소 추출
        for repo in repos_raw_data:
            repo_name = repo["name"]
            is_fork = repo.get("isFork", False)
            
            commit_messages = []
            if repo.get("defaultBranchRef") and repo["defaultBranchRef"].get("target"):
                commit_nodes = repo["defaultBranchRef"]["target"]["history"].get("nodes")
                if commit_nodes:
                    for c in commit_nodes:
                        commit_author_login = None
                        if c.get("author") and c["author"].get("user"):
                            commit_author_login = c["author"]["user"].get("login")
                        
                        if (commit_author_login and commit_author_login.lower() == username.lower()) or \
                           (c.get("author") and c["author"].get("name", "").lower() == username.lower()):
                            commit_messages.append(c["message"])

            issue_list = []
            if repo.get("issues") and repo["issues"].get("nodes"):
                issue_list = [{"title": i["title"], "state": i["state"]} for i in repo["issues"]["nodes"]]

            pr_list = []
            if repo.get("pullRequests") and repo["pullRequests"].get("nodes"):
                pr_list = [{"title": p["title"], "state": p["state"]} for p in repo["pullRequests"]["nodes"]]

            if is_fork and not commit_messages and not issue_list and not pr_list:
                continue

            if not commit_messages and not issue_list and not pr_list:
                continue

            valid_repos.append({
                "repo_data": repo,
                "commits": commit_messages,
                "issues": issue_list,
                "prs": pr_list
            })

        # OpenAI 토큰 및 비용 방지를 위해 최근 활동 기준 상위 최대 10개만 제한 분석
        target_repos = valid_repos[:10]
        careers_to_insert = []

        for item in target_repos:
            repo = item["repo_data"]
            repo_name = repo["name"]
            raw_desc = repo["description"] or "작성된 설명 없음"
            start_date = repo["createdAt"].split("T")[0]
            end_date = repo["updatedAt"].split("T")[0]
            company_name = repo["owner"]["login"] if repo["owner"]["__typename"] == "Organization" else "Personal Project"
            lang = repo["primaryLanguage"]["name"] if repo["primaryLanguage"] else "Unknown"

            repo_rich_info = {
                "name": repo_name,
                "lang": lang,
                "raw_desc": raw_desc,
                "commits": item["commits"],
                "issues": item["issues"],
                "prs": item["prs"]
            }

            print(f"[{repo_name}] OpenAI로 이력서 경력 항목 가공 중...")
            
            try:
                # 💡 [변경 포인트] OpenAI 기반 함수 호출
                ai_resume_experience = await analyze_rich_repo_with_openai(username, repo_rich_info)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"AI 분석 처리 실패: {str(e)}")

            final_description = f"{ai_resume_experience}\n\n"

            career_data = {
                "member_id": member_id,
                "company_name": company_name,
                "department": "Github", 
                "job_title": "Software Engineer", 
                "start_date": start_date,
                "end_date": end_date,
                "is_current": False,
                "description": final_description,
                "data_source": repo['url']
            }
            careers_to_insert.append(career_data)
            
            await asyncio.sleep(1)  # OpenAI는 Rate limit이 널널하므로 대기 시간을 1초로 축소

        # Supabase 반영 (트랜잭션)
        try:
            # 💡 [보존 로직] 다른 수동 입력 및 사진/파일 데이터를 위해 department='Github'만 선택 삭제
            supabase.table("careers") \
                .delete() \
                .eq("member_id", member_id) \
                .eq("department", "Github") \
                .execute()
            
            if careers_to_insert:
                supabase.table("careers").insert(careers_to_insert).execute()
            
            return {
                "status": "success",
                "message": "기존 파일 및 사진 경력은 보존하고, OpenAI(gpt-4o-mini) 기반 Github 경력만 갱신했습니다.",
                "inserted_count": len(careers_to_insert),
                "return": careers_to_insert
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Supabase 반영 중 오류 발생: {str(e)}")