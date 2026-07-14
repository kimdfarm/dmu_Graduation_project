import os
import random
import smtplib
from email.mime.text import MIMEText
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from app.core.config import supabase
import uuid
router = APIRouter(
    prefix="/sign",
    tags=["sign"]
)

# --- 구글 SMTP 설정 (여기에 본인 정보 입력) ---
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_SENDER_EMAIL = os.getenv("SMTP_SENDER_EMAIL")
SMTP_SENDER_PASSWORD = os.getenv("SMTP_SENDER_PASSWORD")

# --- 요청 데이터 포맷 ---
class EmailVerifyRequest(BaseModel):
    email: EmailStr

class EmailCheckRequest(BaseModel):
    email: EmailStr
    token: str  # 유저가 입력한 6자리 숫자

class FinalSignUpRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


# 1️⃣ [STEP 1] 6자리 숫자를 만들어서 DB에 저장(Upsert)하고 메일 발송
@router.post("/send-otp")
def send_otp_email(payload: EmailVerifyRequest):
    try:
        generated_otp = str(random.randint(100000, 999999))
        
        # DB에 저장
        supabase.table("email_otps").upsert({
            "email": payload.email,
            "otp_code": generated_otp,
            "is_approved": False
        }).execute()
        
        # 메일 발송 로직
        subject = "[인증번호] 회원가입 이메일 인증 코드입니다."
        body = f"안녕하세요! 회원가입 인증번호는 [{generated_otp}] 입니다."
        
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = SMTP_SENDER_EMAIL  # 💡 환경변수 값 사용
        msg["To"] = payload.email
        
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_SENDER_EMAIL, SMTP_SENDER_PASSWORD)  # 💡 환경변수 값 사용
            server.sendmail(SMTP_SENDER_EMAIL, payload.email, msg.as_string())
            
        return {"message": "입력하신 이메일로 6자리 인증 코드가 발송되었습니다."}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"메일 발송 실패: {str(e)}")
    

# 2️⃣ [STEP 2] 유저가 입력한 숫자가 DB에 저장된 것과 일치하는지 확인 (emailok)
@router.post("/emailok")
def check_email_ok(payload: EmailCheckRequest):
    try:
        # DB에서 해당 이메일의 데이터 가져오기
        result = supabase.table("email_otps").select("*").eq("email", payload.email).execute()
        
        if not result.data:
            raise HTTPException(status_code=400, detail="인증 요청 내역이 없습니다.")
            
        db_otp = result.data[0]["otp_code"]
        
        # 번호 매칭 검증
        if db_otp == payload.token:
            # 일치하면 가입 승인 도장(is_approved = True) 찍기
            supabase.table("email_otps").update({"is_approved": True}).eq("email", payload.email).execute()
            return {
                "status": "success",
                "message": "이메일 인증이 완료되었습니다! 가입을 진행해 주세요."
            }
        else:
            raise HTTPException(status_code=400, detail="인증 코드가 올바르지 않습니다.")
            
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=400, detail="인증 처리 중 오류가 발생했습니다.")


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