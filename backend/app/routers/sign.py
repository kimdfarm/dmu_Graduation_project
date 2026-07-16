import os
import random
import smtplib
from email.mime.text import MIMEText
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from app.core.config import supabase
import uuid
from typing import Optional
router = APIRouter(
    prefix="/sign",
    tags=["sign"]
)

# --- 구글 SMTP 설정 (여기에 본인 정보 입력) ---
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_SENDER_EMAIL = os.getenv("SMTP_SENDER_EMAIL")
SMTP_SENDER_PASSWORD = os.getenv("SMTP_SENDER_PASSWORD")

# 1. OTP 발송 요청 (가입, 아이디찾기, 비번찾기 공용)
class EmailVerifyRequest(BaseModel):
    email: EmailStr
    purpose: str                     # "signup" | "find_id" | "find_pw"

# OTP 검증 요청
class EmailCheckRequest(BaseModel):
    email: EmailStr
    token: str
    purpose: str                     # "signup" | "find_id" | "find_pw"

class FinalSignUpRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


# --- 1️⃣ OTP 발송 (가입 / 아이디 찾기 / 비번 찾기 공통) ---
@router.post("/send-otp")
def send_otp_email(payload: EmailVerifyRequest):
    try:
        # [CASE A] 회원가입인 경우: 이미 가입된 이메일(ID)인지 체크
        if payload.purpose == "signup":
            result = supabase.table("members").select("email").eq("email", payload.email).execute()
            if result.data:
                raise HTTPException(status_code=400, detail="이미 가입된 아이디(이메일)입니다.")

        # [CASE B] 아이디 찾기 / 비밀번호 찾기인 경우: 존재하는 회원인지 먼저 체크
        elif payload.purpose in ["find_id", "find_pw"]:
            result = supabase.table("members").select("email").eq("email", payload.email).execute()
            if not result.data:
                raise HTTPException(status_code=404, detail="등록되지 않은 아이디(이메일)입니다.")

        # 6자리 OTP 생성 후 DB 저장
        generated_otp = str(random.randint(100000, 999999))
        supabase.table("email_otps").upsert({
            "email": payload.email,
            "otp_code": generated_otp,
            "is_approved": False
        }).execute()

        # 메일 발송 제목 설정
        purpose_korean = {
            "signup": "회원가입",
            "find_id": "아이디 찾기",
            "find_pw": "비밀번호 찾기"
        }.get(payload.purpose, "본인 인증")

        subject = f"[{purpose_korean}] 요청하신 인증번호 안내"
        body = f"안녕하세요! 요청하신 {purpose_korean}을 위한 인증번호는 [{generated_otp}] 입니다."

        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = SMTP_SENDER_EMAIL
        msg["To"] = payload.email

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_SENDER_EMAIL, SMTP_SENDER_PASSWORD)
            server.sendmail(SMTP_SENDER_EMAIL, payload.email, msg.as_string())

        return {"status": "success", "message": f"{purpose_korean} 코드가 발송되었습니다."}

    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=f"메일 발송 실패: {str(e)}")
    
# --- 2️⃣ OTP 검증 (가입 / 아이디 찾기 / 비번 찾기 공통) ---
@router.post("/emailok")
def check_email_ok(payload: EmailCheckRequest):
    try:
        result = supabase.table("email_otps").select("*").eq("email", payload.email).execute()
        if not result.data:
            raise HTTPException(status_code=400, detail="인증 요청 내역이 존재하지 않습니다.")

        db_otp = result.data[0]["otp_code"]

        if db_otp == payload.token:
            # 인증 성공 처리
            supabase.table("email_otps").update({"is_approved": True}).eq("email", payload.email).execute()
            
            # [CASE A] 아이디 찾기인 경우: 이메일 인증이 성공했으니, DB에서 이메일로 가입된 '이름(name)'을 조회해 보여줌!
            if payload.purpose == "find_id":
                user_query = supabase.table("members").select("name").eq("email", payload.email).execute()
                user_name = user_query.data[0]["name"] if user_query.data else "이름 없음"
                
                # 사용한 OTP 내역 바로 삭제
                supabase.table("email_otps").delete().eq("email", payload.email).execute()
                
                return {
                    "status": "success",
                    "message": "본인 인증에 성공하여 회원 정보를 찾았습니다.",
                    "user_info": {
                        "email": payload.email,
                        "name": user_name
                    }
                }
            
            # 회원가입(signup)이나 비밀번호 재설정(find_pw)은 다음 단계가 있으므로 성공 메시지만 반환
            return {
                "status": "success",
                "message": "인증에 성공하였습니다. 다음 단계를 진행해 주세요."
            }
        else:
            raise HTTPException(status_code=400, detail="인증 코드가 일치하지 않습니다.")

    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail=f"검증 오류: {str(e)}")
    


# 3️⃣ [STEP 3] 최종 가입 완료 후 DB에서 인증 데이터 삭제
@router.post("/signup-final")
def signup_final(user_data: FinalSignUpRequest):
    try:
        # 1. 우리 DB에서 승인된 이메일인지 체크
        result = supabase.table("email_otps").select("is_approved").eq("email", user_data.email).execute()
        
        if not result.data or not result.data[0]["is_approved"]:
            raise HTTPException(status_code=400, detail="이메일 인증(emailok)을 먼저 완료해 주세요.")
            
        # 2. 💡 Supabase sign 대신, 우리가 직접 유저 고유 ID(UUID)를 생성합니다!
        new_user_uuid = str(uuid.uuid4())
        
        # 3. 내 public.members 테이블 저장
        supabase.table("members").insert({
            "id": new_user_uuid,              # 우리가 만든 UUID 꽂기
            "email": user_data.email, 
            "password": user_data.password,   # 실제 서비스에선 암호화 필수, 졸작은 패스 가능
            "name": user_data.name,
            "role": "user", 
            "status": "active"
        }).execute()
        
        # 4. 내 public.member_profiles 테이블 저장
        supabase.table("member_profiles").insert({
            "member_id": new_user_uuid, 
            "name": user_data.name
        }).execute()
        
        # 5. 가입 성공 후 DB에서 인증 임시 레코드 삭제
        supabase.table("email_otps").delete().eq("email", user_data.email).execute()
        
        return {
            "status": "success", 
            "message": "Supabase sign 없이 회원가입이 완벽하게 완료되었습니다!",
            "user_id": new_user_uuid
        }
        
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        # 이메일 중복 체크 에러 처리
        if "duplicate key" in str(e).lower():
            raise HTTPException(status_code=400, detail="이미 가입된 이메일 주소입니다.")
        raise HTTPException(status_code=400, detail=f"최종 회원가입 실패: {str(e)}")