import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, EmailStr
import asyncio
from contextlib import asynccontextmanager  # 🎯 추가 필요
from utils.scheduler import scheduler
from supabase import create_client, Client


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



if not MAIN_URL or not MAIN_KEY:
    raise ValueError("Supabase URL 또는 Key가 .env 파일에 설정되지 않았습니다.")

supabase: Client = create_client(MAIN_URL, MAIN_KEY)

# 요청 데이터 포맷 정의 (Pydantic Schema)
class SignUpRequest(BaseModel):
    email: EmailStr
    password: str

@app.post("/auth/signup", status_code=status.HTTP_201_CREATED, tags=["Auth"])
def sign_up(user_data: SignUpRequest):
    """
    Supabase Auth를 이용한 회원가입 API입니다.
    이메일과 비밀번호를 받아 사용자를 생성합니다.
    """
    try:
        # Supabase 가입 API 호출
        response = supabase.auth.sign_up({
            "email": user_data.email,
            "password": user_data.password
        })
        
        # 가입 성공 시 유저 정보 반환
        if response.user:
            return {
                "message": "회원가입이 성공적으로 완료되었습니다.",
                "user_id": response.user.id,
                "email": response.user.email
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="회원가입에 실패했습니다. 입력 정보를 확인하세요."
            )
            
    except Exception as e:
        # 중복 이메일 등의 에러 처리
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

# 서버 실행 테스트용 메인 루트
@app.get("/", tags=["Root"])
def read_root():
    return {"message": "FastAPI 서버가 정상 작동 중입니다. /docs 로 이동하세요."}