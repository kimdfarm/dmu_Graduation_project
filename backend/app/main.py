import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
import asyncio
from supabase import create_client, Client

load_dotenv()

app = FastAPI()

# 1. 환경 변수에서 URL과 KEY 가져오기
MAIN_URL = os.getenv("MAIN_URL")
MAIN_KEY = os.getenv("MAIN_KEY")

CRAWL_URL = os.getenv("CRAWL_URL")
CRAWL_KEY = os.getenv("CRAWL_KEY")

# 2. 예외 처리 (혹시 모를 설정 누락 방지)
if not all([MAIN_URL, MAIN_KEY, CRAWL_URL, CRAWL_KEY]):
    raise ValueError(".env 파일에 Supabase 설정 값이 누락되었습니다. 확인해 주세요!")

# 3. 각각의 Supabase 클라이언트 초기화
supabase_main: Client = create_client(MAIN_URL, MAIN_KEY)
supabase_crawl: Client = create_client(CRAWL_URL, CRAWL_KEY)
# 2. 비동기 데이터 조회 함수 정의
async def get_cover_letter(user_id: str, letter_id: str):
    # 메인 DB에서 자소서 가져오기 (동기 함수를 비동기로 실행하기 위해 run_in_executor 사용 가능)
    # 여기서는 개념 이해를 위해 단순화한 흐름만 보여드립니다.
    response = supabase_main.table("cover_letters").select("*").eq("id", letter_id).eq("user_id", user_id).execute()
    return response.data[0] if response.data else None

async def get_job_posting(job_id: str):
    # 크롤링 DB에서 채용 공고 가져오기
    response = supabase_crawl.table("job_postings").select("*").eq("id", job_id).execute()
    return response.data[0] if response.data else None

# 3. FastAPI 엔드포인트
@app.get("/portfolio/{user_id}/{letter_id}")
async def get_combined_data(user_id: str, letter_id: str):
    
    # 🚨 [Step 1] 먼저 자소서 정보를 가져옴
    letter = await get_cover_letter(user_id, letter_id)
    if not letter:
        raise HTTPException(status_code=404, detail="자소서를 찾을 수 없습니다.")
        
    # 자소서에 저장된 채용공고 ID 추출
    target_job_id = letter.get("job_posting_id")
    
    # 🚨 [Step 2] 연관된 채용공고 정보를 크롤링 DB에서 가져옴
    job_info = None
    if target_job_id:
        job_info = await get_job_posting(target_job_id)
    
    # 🚨 [Step 3] FastAPI가 두 데이터를 이쁘게 합쳐서 반환
    return {
        "status": "success",
        "cover_letter": letter,
        "matched_job_posting": job_info
    }