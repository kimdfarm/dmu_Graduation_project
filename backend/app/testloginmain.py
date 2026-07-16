import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, EmailStr
import asyncio
from contextlib import asynccontextmanager  # 🎯 추가 필요
from utils.scheduler import scheduler
from supabase import create_client, Client
import secrets

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
supabase: Client = create_client(os.getenv("MAIN_URL"), os.getenv("MAIN_KEY"))

# 요청 데이터 포맷
class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    name: str  # 사용자의 실제 이름
@app.post("/auth/signup", status_code=status.HTTP_201_CREATED, tags=["Auth"])
def sign_up(user_data: SignUpRequest):
    try:
        # [STEP 1] Supabase Auth 회원가입
        auth_response = supabase.auth.sign_up({
            "email": user_data.email,
            "password": user_data.password,
            "options": {"data": {"name": user_data.name}}
        })
        
        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Auth 회원가입 실패")

        # Supabase Auth가 생성해 준 랜덤 전 세계 고유 UUID를 그대로 가져옵니다!
        real_user_uuid = auth_response.user.id 

        # [STEP 2] public.members 테이블에 저장 (이제 id 자리에 uuid 문자열이 들어갑니다)
        supabase.table("members").insert({
            "id": real_user_uuid,  # 👈 여기에 진짜 UUID 탑재!
            "email": user_data.email,
            "password": user_data.password,
            "role": "user",
            "status": "active"
        }).execute()
        
        # [STEP 3] public.member_profiles 테이블에도 동일한 UUID 연결
        supabase.table("member_profiles").insert({
            "member_id": real_user_uuid,  # 👈 외래키로 똑같이 연결!
            "name": user_data.name,
            "phone_number": None,
            "birth_date": None,
            "gender": None,
            "avatar_url": None
        }).execute()
        
        # [STEP 3] public.member_profiles 테이블에도 동일한 UUID 연결
        supabase.table("member_profiles").insert({
            "member_id": real_user_uuid, 
            "name": user_data.name,
            "phone_number": None,
            "birth_date": None,
            "gender": None,
            "avatar_url": None
        }).execute()

        return {
            "message": "회원가입 및 랜덤 ID 연동이 성공적으로 완료되었습니다.",
            "db_member_id": real_user_uuid,  # 이제 유추 불가능한 랜덤 UUID가 반환됨!
            "email": user_data.email,
            "name": user_data.name
        }

    except Exception as e:
        if str(e) == "Auth 회원가입 실패":
            raise HTTPException(status_code=400, detail="회원가입 실패: 이메일이 이미 존재하거나 잘못된 요청입니다.")
        elif str(e) == "User already registered":
            raise HTTPException(status_code=400, detail="회원가입 실패: 이미 등록된 이메일입니다.")
        print("❌ Supabase 연동 중 에러 발생:", str(e))
        raise HTTPException(status_code=400, detail=f"회원가입 실패: {str(e)}")