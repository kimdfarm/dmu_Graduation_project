import os
import random
import smtplib
from email.mime.text import MIMEText
from fastapi import APIRouter, HTTPException, Query, status, UploadFile, File, Form
from pydantic import BaseModel, EmailStr
from app.core.config import get_supabase
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




class DeleteAccountRequest(BaseModel):
    user_id: str
@router.delete("/delete")
def delete_account(payload: DeleteAccountRequest):
    """
    회원 탈퇴 API: members 테이블에서 해당 user_id 삭제
    """
    try:
        supabase = get_supabase()
        # DB의 members 테이블에서 user_id 삭제
        response = supabase.from_('members').delete().eq('id', payload.user_id).execute()
        
        # 삭제된 레코드가 없는 경우 예외 처리
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="해당 사용자를 찾을 수 없거나 이미 삭제되었습니다."
            )
            
        # (선택) Supabase Auth 사용자 계정도 완전히 삭제하고 싶은 경우
        # supabase.auth.admin.delete_user(payload.user_id)

        return {"status": "success", "message": "회원 탈퇴가 성공적으로 완료되었습니다."}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"회원 탈퇴 처리 중 오류가 발생했습니다: {str(e)}"
        )

@router.post("/upload-avatar")
async def upload_avatar(
    user_id: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        supabase = get_supabase()
        # 1. 기존 DB에서 유저의 기존 avatar_url 가져오기 (이전 이미지 삭제용)
        existing_profile = supabase.from_("member_profiles") \
            .select("avatar_url") \
            .eq("id", user_id) \
            .execute()

        # 2. 기존 프로필 이미지가 Storage에 존재한다면 파일 삭제
        if existing_profile.data and len(existing_profile.data) > 0:
            old_url = existing_profile.data[0].get("avatar_url")
            if old_url and "/profile/" in old_url:
                old_file_path = old_url.split("/profile/")[-1]
                try:
                    supabase.storage.from_("profile").remove([old_file_path])
                except Exception as del_err:
                    print(f"기존 이미지 삭제 패스: {del_err}")

        # 3. 새 파일 업로드 (경로: user_id/uuid.ext)
        file_ext = file.filename.split(".")[-1]
        new_file_name = f"{user_id}/{uuid.uuid4()}.{file_ext}"
        contents = await file.read()

        supabase.storage.from_("profile").upload(
            path=new_file_name,
            file=contents,
            file_options={"content-type": file.content_type, "upsert": "true"}
        )

        # 4. 업로드된 파일의 Public URL 가져오기
        public_url = supabase.storage.from_("profile").get_public_url(new_file_name)

        # 💡 5. [핵심] member_profiles 테이블의 avatar_url 업데이트!
        db_response = supabase.from_("member_profiles") \
            .update({"avatar_url": public_url}) \
            .eq("member_id", user_id) \
            .execute()

        # DB 업데이트 결과 검증
        if not db_response.data:
            print(f"경고: user_id({user_id})에 해당하는 member_profiles 행을 찾지 못해 DB 업데이트 실패")

        return {
            "status": "success",
            "avatar_url": public_url
        }

    except Exception as e:
        print(f"Avatar Upload DB Error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"프로필 이미지 업로드 및 DB 저장 실패: {str(e)}"
        )

@router.get("/me")
async def get_my_info(user_id: str):
    try:
        if not user_id or user_id == "null" or user_id == "undefined":
            raise HTTPException(status_code=400, detail="유효하지 않은 user_id입니다.")
        
        supabase = get_supabase()
        response = (
            supabase.table("member_profiles")
            .select("*")
            .eq("member_id", user_id)
            .execute()
        )

        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=404, detail="회원 정보를 찾을 수 없습니다.")

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        print(f"GET /login/me 에러 발생: {str(e)}")
        raise HTTPException(status_code=500, detail=f"로그인 정보 확인 실패: {str(e)}")





