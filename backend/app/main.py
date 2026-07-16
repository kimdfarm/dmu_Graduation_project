import os
from fastapi import FastAPI
from app.routers import sign
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
import asyncio
from contextlib import asynccontextmanager  # 🎯 추가 필요
from app.utils.scheduler import scheduler
from supabase import create_client, Client
from fastapi.middleware.cors import CORSMiddleware
from app.routers.github_data import github_groq_data


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

# FastAPI를 선언할 때 lifespan을 매개변수로 넣어줍니다.
app = FastAPI(title="Graduation Project AI App API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 배포 시 실제 React 도메인으로 교체 권장
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ⭐ 핵심: sign 파일 안에 있는 router를 수하로 등록(조립)합니다.
app.include_router(sign.router)
app.include_router(github_groq_data.router)

@app.get("/", tags=["Root"])
def read_root():
    return {"message": "FastAPI 서버 가동 중! 구조 분리 완료."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
