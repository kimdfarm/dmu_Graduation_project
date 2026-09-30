import os
import random
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
import resend  # resend 라이브러리로 변경[cite: 18]
from app.core.config import get_supabase

router = APIRouter(
    prefix="/sign",
    tags=["sign"]
)

# Resend API 키 설정 (Render 대시보드 Environment 변수에 RESEND_API_KEY 추가 등록 권장)
resend.api_key = os.getenv("RESEND_API_KEY")

# 1. OTP 발송 요청 DTO
class EmailVerifyRequest(BaseModel):
    email: EmailStr
    purpose: str                     # "signup" | "find_id" | "find_pw"

# OTP 검증 요청 DTO
class EmailCheckRequest(BaseModel):
    email: EmailStr
    token: str
    purpose: str                     # "signup" | "find_id" | "find_pw"

# 최종 가입 DTO
class FinalSignUpRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


# --- 1️⃣ OTP 발송 (Resend API 적용으로 Errno 101 해결) ---
@router.post("/send-otp")
def send_otp_email(payload: EmailVerifyRequest):
    try:
        supabase = get_supabase()
        # [CASE A] 회원가입인 경우: 이미 가입된 이메일 체크
        if payload.purpose == "signup":
            result = supabase.table("members").select("email").eq("email", payload.email).execute()
            if result.data:
                raise HTTPException(status_code=400, detail="이미 가입된 아이디(이메일)입니다.")

        # [CASE B] 아이디/비번 찾기인 경우: 회원 존재 여부 체크
        elif payload.purpose in ["find_id", "find_pw"]:
            result = supabase.table("members").select("email").eq("email", payload.email).execute()
            if not result.data:
                raise HTTPException(status_code=404, detail="등록되지 않은 아이디(이메일)입니다.")

        # 6자리 OTP 생성 후 DB 저장
        generated_otp = str(random.randint(100000, 999999))
        supabase.table("email_otps").upsert({
            "email": payload.email,
            "otp_code": generated_otp,
            "is_approved": False,
            "purpose": payload.purpose
        }).execute()

        # 메일 발송 제목 및 용어 설정
        purpose_korean = {
            "signup": "회원가입",
            "find_id": "아이디 찾기",
            "find_pw": "비밀번호 찾기"
        }.get(payload.purpose, "본인 인증")

        subject = f"[{purpose_korean}] 요청하신 인증번호 안내"
        html_content = f"<p>안녕하세요! 요청하신 {purpose_korean}을 위한 인증번호는 <strong>[{generated_otp}]</strong> 입니다.</p>"

        # Resend HTTP API 호출 (Render의 포트 차단 방화벽 영향을 받지 않음)
        resend.Emails.send({
            "from": "onboarding@resend.dev",  # Resend에서 기본 제공하는 도메인
            "to": payload.email,
            "subject": subject,
            "html": html_content
        })

        return {"status": "success", "message": f"{purpose_korean} 코드가 발송되었습니다."}

    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=f"메일 발송 실패: {str(e)}")


# --- 2️⃣ OTP 검증 ---
@router.post("/emailok")
def check_email_ok(payload: EmailCheckRequest):
    try:
        supabase = get_supabase()
        result = supabase.table("email_otps").select("*").eq("email", payload.email).execute()
        if not result.data:
            raise HTTPException(status_code=400, detail="인증 요청 내역이 존재하지 않습니다.")

        db_otp = result.data[0]["otp_code"]

        if db_otp == payload.token:
            # 인증 성공 처리
            supabase.table("email_otps").update({"is_approved": True}).eq("email", payload.email).execute()
            
            # 아이디 찾기인 경우 이름 조회 후 리턴
            if payload.purpose == "find_id":
                user_query = supabase.table("members").select("name").eq("email", payload.email).execute()
                user_name = user_query.data[0]["name"] if user_query.data else "이름 없음"
                
                supabase.table("email_otps").delete().eq("email", payload.email).execute()
                
                return {
                    "status": "success",
                    "message": "본인 인증에 성공하여 회원 정보를 찾았습니다.",
                    "user_info": {
                        "email": payload.email,
                        "name": user_name
                    }
                }
            
            return {
                "status": "success",
                "message": "인증에 성공하였습니다. 다음 단계를 진행해 주세요."
            }
        else:
            raise HTTPException(status_code=400, detail="인증 코드가 일치하지 않습니다.")

    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=f"검증 오류: {str(e)}")


# --- 3️⃣ 아이디(이름) 중복 확인 ---
@router.get("/check-name")
def check_name_duplicate(name: str):
    supabase = get_supabase()
    response = supabase.table("members").select("name").eq("name", name).execute()
    
    if response.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 사용 중인 이름입니다."
        )
        
    return {"message": "사용 가능한 이름입니다."}


# --- 4️⃣ 최종 회원가입 (중복 통합 및 정리) ---
@router.post("/signup-final")
def signup_final(user_data: FinalSignUpRequest):
    try:
        supabase = get_supabase()   
        # OTP 승인 여부 확인
        otp_response = (
            supabase.table("email_otps")
            .select("is_approved")
            .eq("email", user_data.email)
            .execute()
        )

        if not otp_response.data or not otp_response.data[0].get("is_approved"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이메일 인증을 먼저 완료해 주세요."
            )
            
        new_user_uuid = str(uuid.uuid4())
        
        # members 테이블 저장
        supabase.table("members").insert({
            "id": new_user_uuid,
            "email": user_data.email, 
            "password": user_data.password,
            "name": user_data.name,
            "role": "user", 
            "status": "active"
        }).execute()
        
        # member_profiles 테이블 저장
        supabase.table("member_profiles").insert({
            "member_id": new_user_uuid, 
            "name": user_data.name
        }).execute()
        
        # 임시 OTP 데이터 삭제
        supabase.table("email_otps").delete().eq("email", user_data.email).execute()
        
        return {
            "status": "success", 
            "message": "회원가입이 완료되었습니다.",
            "user_id": new_user_uuid
        }
        
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        if "duplicate key" in str(e).lower():
            raise HTTPException(status_code=400, detail="이미 가입된 이메일 주소입니다.")
        raise HTTPException(status_code=400, detail=f"최종 회원가입 실패: {str(e)}")