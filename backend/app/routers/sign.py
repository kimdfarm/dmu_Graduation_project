import os
import random
import uuid
import json
import base64
import urllib.request
import urllib.parse
from email.mime.text import MIMEText
from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from app.core.config import get_supabase

router = APIRouter(
    prefix="/sign",
    tags=["sign"]
)

# ==========================================
# Google OAuth 2.0 & Gmail API 설정 (HTTPS / 443 포트)
# ==========================================
GMAIL_CLIENT_ID = os.getenv("GMAIL_CLIENT_ID")
GMAIL_CLIENT_SECRET = os.getenv("GMAIL_CLIENT_SECRET")
GMAIL_REFRESH_TOKEN = os.getenv("GMAIL_REFRESH_TOKEN")
SENDER_EMAIL = os.getenv("GMAIL_SENDER_EMAIL")  # 본인 Gmail 주소 (예: test@gmail.com)

def get_gmail_access_token() -> str:
    """
    Refresh Token을 이용해 HTTPS POST(443) 요청으로 새로운 Access Token을 발급받습니다.
    """
    token_url = "https://oauth2.googleapis.com/token"
    payload = urllib.parse.urlencode({
        "client_id": GMAIL_CLIENT_ID,
        "client_secret": GMAIL_CLIENT_SECRET,
        "refresh_token": GMAIL_REFRESH_TOKEN,
        "grant_type": "refresh_token"
    }).encode("utf-8")

    req = urllib.request.Request(
        token_url,
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            return res_data["access_token"]
    except Exception as e:
        raise Exception(f"Gmail Access Token 발급 실패: {str(e)}")


def send_gmail_api(to_email: str, subject: str, body: str):
    """
    Gmail REST API 엔드포인트로 HTTPS POST(443) 웹 요청을 보내 메일을 전송합니다.
    """
    access_token = get_gmail_access_token()

    # MIME 메시지 생성
    msg = MIMEText(body)
    msg["to"] = to_email
    msg["from"] = SENDER_EMAIL
    msg["subject"] = subject

    # Gmail API 규격에 맞게 Base64URL 인코딩
    raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")

    api_url = "https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send"
    post_data = json.dumps({"raw": raw_message}).encode("utf-8")

    req = urllib.request.Request(
        api_url,
        data=post_data,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        raise Exception(f"Gmail API 전송 실패: {str(e)}")


# --- DTO 정의 ---
class EmailVerifyRequest(BaseModel):
    email: EmailStr
    purpose: str                     # "signup" | "find_id" | "find_pw"

class EmailCheckRequest(BaseModel):
    email: EmailStr
    token: str
    purpose: str                     # "signup" | "find_id" | "find_pw"

class FinalSignUpRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


# --- 1️⃣ OTP 발송 (Gmail REST API - HTTPS 443 적용) ---
@router.post("/send-otp")
def send_otp_email(payload: EmailVerifyRequest):
    try:
        supabase = get_supabase()
        
        # [CASE A] 회원가입인 경우
        if payload.purpose == "signup":
            result = supabase.table("members").select("email").eq("email", payload.email).execute()
            if result.data:
                raise HTTPException(status_code=400, detail="이미 가입된 아이디(이메일)입니다.")

        # [CASE B] 아이디/비번 찾기인 경우
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

        # 메일 발송 제목 및 내용 구성
        purpose_korean = {
            "signup": "회원가입",
            "find_id": "아이디 찾기",
            "find_pw": "비밀번호 찾기"
        }.get(payload.purpose, "본인 인증")

        subject = f"[{purpose_korean}] 요청하신 인증번호 안내"
        body = f"안녕하세요! 요청하신 {purpose_korean}을 위한 인증번호는 [{generated_otp}] 입니다."

        # Gmail API (HTTPS / 443 포트) 전송 실행
        send_gmail_api(payload.email, subject, body)

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
            supabase.table("email_otps").update({"is_approved": True}).eq("email", payload.email).execute()
            
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


# --- 4️⃣ 최종 회원가입 ---
@router.post("/signup-final")
def signup_final(user_data: FinalSignUpRequest):
    try:
        supabase = get_supabase()   
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
        
        supabase.table("members").insert({
            "id": new_user_uuid,
            "email": user_data.email, 
            "password": user_data.password,
            "name": user_data.name,
            "role": "user", 
            "status": "active"
        }).execute()
        
        supabase.table("member_profiles").insert({
            "member_id": new_user_uuid, 
            "name": user_data.name
        }).execute()
        
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