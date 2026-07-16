import os
import random
import smtplib
from email.mime.text import MIMEText
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from app.core.config import supabase
import uuid
router = APIRouter(
    prefix="/login",
    tags=["login"]
)
# --- 로그인 요청 데이터 포맷 ---
class LoginRequest(BaseModel):
    name: str
    password: str
# 최종 비밀번호 재설정 요청
class ResetPasswordRequest(BaseModel):
    email: EmailStr
    new_password: str

# 🔓 [LOGIN API] 로그인 처리
@router.post("/login")
def login(payload: LoginRequest):
    try:
        # 💡 이메일이 아닌 일반 ID(name)로 DB 조회!
        result = supabase.table("members") \
            .select("id, name, password, role, status") \
            .eq("name", payload.name) \
            .execute()
            
        if not result.data:
            raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 틀렸습니다.")
            
        user = result.data[0]
        
        if user["password"] != payload.password:
            raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 틀렸습니다.")
            
        return {
            "status": "success",
            "message": "로그인에 성공했습니다!",
            "user": {
                "id": user["id"],
                "name": user["name"]
            }
        }
    except Exception as e:
        if isinstance(e, HTTPException): 
            raise e
        raise HTTPException(
            status_code=500, 
            detail=f"로그인 처리 중 서버 오류가 발생했습니다: {str(e)}"
        )

# --- 3️⃣ 🔒 [비밀번호 찾기 전용] 비밀번호 최종 변경 API ---
@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest):
    try:
        # 이메일 인증 통과 완료 상태(is_approved = True)인지 확인
        result = supabase.table("email_otps").select("is_approved").eq("email", payload.email).execute()
        
        if not result.data or not result.data[0]["is_approved"]:
            raise HTTPException(status_code=400, detail="이메일 인증을 먼저 완료해 주세요.")
            
        # 비밀번호 업데이트 (members 테이블 교체)
        supabase.table("members") \
            .update({"password": payload.new_password}) \
            .eq("email", payload.email) \
            .execute()
            
        # 사용한 인증 정보 삭제
        supabase.table("email_otps").delete().eq("email", payload.email).execute()
        
        return {
            "status": "success",
            "message": "비밀번호가 성공적으로 변경되었습니다! 새 비밀번호로 로그인해 주세요."
        }
        
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=f"비밀번호 재설정 실패: {str(e)}")





