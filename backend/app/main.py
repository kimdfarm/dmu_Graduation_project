from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from supabase import create_client, Client
from dotenv import load_dotenv
import os


app = FastAPI()

# CORS 설정 (React 연동)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
load_dotenv()

# Supabase 프로젝트 설정 (본인의 URL과 Anon Key로 변경)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 요청 데이터 모델
class SignUpRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class SignInRequest(BaseModel):
    email: EmailStr
    password: str
class LoginRequest(BaseModel):
    email: str
    password: str


import uuid


# 1. 회원가입 API
@app.post("/api/signup")
async def signup(data: SignUpRequest):
    try:
        fake_user_id = str(uuid.uuid4())
        
        # ⚠️ 이제 'password' 열도 함께 테이블에 집어넣습니다!
        db_response = supabase.table("menbers").insert({
            "id": fake_user_id,
            "email": data.email,
            "username": data.name,
            "password": data.password  # 👈 추가된 password 열에 저장
        }).execute()
        
        return {"message": "회원가입이 완료되었습니다!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    
@app.post("/api/login")
async def login(data: LoginRequest):
    try:
        # 이메일로 유저 찾기
        response = supabase.table("menbers").select("*").eq("email", data.email).execute()
        
        if not response.data:
            raise HTTPException(status_code=400, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
        
        user = response.data[0]
        
        # 🔥 [핵심] 입력된 비밀번호와 DB에 저장된 비밀번호를 직접 비교!
        if user.get("password") != data.password:
            raise HTTPException(status_code=400, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
        
        return {
            "message": "로그인 성공!",
            "user": {
                "email": user.get("email"),
                "username": user.get("username")
            }
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))