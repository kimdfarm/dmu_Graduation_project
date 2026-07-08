import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
import asyncio
from fastapi.concurrency import asynccontextmanager
from supabase import create_client, Client

from backend.app.utils import scheduler

load_dotenv()


# 1. 환경 변수에서 URL과 KEY 가져오기
MAIN_URL = os.getenv("MAIN_URL")
MAIN_KEY = os.getenv("MAIN_KEY")

CRAWL_URL = os.getenv("CRAWL_URL")
CRAWL_KEY = os.getenv("CRAWL_KEY")
# 🚀 서버 시작(Startup)과 종료(Shutdown)를 한 번에 관리하는 최신 lifespan 설계
@asynccontextmanager
async def lifespan(app: FastAPI):
    # [Startup 영역] 서버가 켜질 때 실행될 로직
    if not scheduler.running:
        scheduler.start()
        print("📡 [시스템 가동] 백그라운드 실시간 수집 및 3개월 만료 삭제 엔진이 정상 시작되었습니다.")
        
    yield  # 💡 서버가 가동 중인 동안은 여기서 대기합니다 (다른 API들 정상 작동)
    
    # [Shutdown 영역] 서버가 꺼질 때 실행될 로직
    if scheduler.running:
        scheduler.shutdown()
        print("🛑 [시스템 종료] 백그라운드 스케줄러가 안전하게 종료되었습니다.")

app = FastAPI(title="Graduation Project AI App API", lifespan=lifespan)




