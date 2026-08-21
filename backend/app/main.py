import os
import asyncio
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# 스케줄러 및 설정 로드
from app.utils.scheduler import scheduler

# 라우터 임포트
from app.routers import sign
from app.routers import login
from app.routers import resume
from app.routers.github_data import github_groq_data
from app.routers.imageandfileupload.usegrog import router as usegrog_router
from app.routers.imageandfileupload import savepile
from app.routers.setting.profilesetting import router as settings_router
from app.routers.setting import educersetting
from app.routers.github_data import github_data
from app.routers import sections
load_dotenv()

# 환경 변수 로드
MAIN_URL = os.getenv("MAIN_URL")
MAIN_KEY = os.getenv("MAIN_KEY")
CRAWL_URL = os.getenv("CRAWL_URL")
CRAWL_KEY = os.getenv("CRAWL_KEY")


# 🚀 서버 시작(Startup)과 종료(Shutdown) Lifespan 설계
@asynccontextmanager
async def lifespan(app: FastAPI):
    # [Startup] 서버 가동 시 스케줄러 시작
    if not scheduler.running:
        scheduler.start()
        print("📡 [시스템 가동] 백그라운드 실시간 수집 및 만료 삭제 엔진이 정상 시작되었습니다.")
        
    yield  # 서버 실행 유지
    
    # [Shutdown] 서버 종료 시 스케줄러 안전 종료
    if scheduler.running:
        scheduler.shutdown()
        print("🛑 [시스템 종료] 백그라운드 스케줄러가 안전하게 종료되었습니다.")


app = FastAPI(title="Graduation Project AI App API", lifespan=lifespan)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(sign.router)
app.include_router(login.router)
app.include_router(github_groq_data.router)
app.include_router(usegrog_router)
app.include_router(settings_router)
app.include_router(educersetting.router)
app.include_router(resume.router)
app.include_router(savepile.router)  # /api/resumes/upload 엔드포인트 담당
app.include_router(github_data.router)  # /api/auth/github 엔드포인트 담당
app.include_router(sections.router)  # /api/sections 엔드포인트 담당
# ❌ file_parser.router 제거 완료 (유틸리티 모듈이므로 라우터 등록 안 함)


@app.get("/", tags=["Root"])
def read_root():
    return {"message": "FastAPI 서버 가동 중! 구조 분리 완료."}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)