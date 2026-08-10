from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.core.config import get_supabase

router = APIRouter(
    prefix="/users",
    tags=["Profile Settings"]
)

# Request Body 모델에 detail_address 추가
class ProfileUpdateRequest(BaseModel):
    name: str
    email: Optional[str] = None
    phone_number: Optional[str] = None
    birth_date: Optional[str] = None
    gender: Optional[str] = "M"
    avatar_url: Optional[str] = None
    address: Optional[str] = None
    detail_address: Optional[str] = None  # 👈 추가됨


# ① 프로필 조회
@router.get("/{user_id}")
async def get_user_profile(user_id: str):
    try:
        supabase = get_supabase()
        response = (
            supabase.table("member_profiles")
            .select("*")
            .eq("member_id", user_id)
            .execute()
        )

        if not response.data or len(response.data) == 0:
            return {
                "member_id": user_id,
                "name": "",
                "email": "",
                "phone_number": "",
                "birth_date": "",
                "gender": "M",
                "avatar_url": "",
                "address": "",
                "detail_address": ""  # 👈 기본값 추가됨
            }

        return response.data[0]

    except Exception as e:
        print(f"❌ GET /users/{user_id} 에러 발생: {str(e)}")
        raise HTTPException(status_code=500, detail=f"유저 정보 조회 중 오류: {str(e)}")


# ② 프로필 저장 및 수정
@router.put("/{user_id}/profile")
def update_user_profile(user_id: str, payload: ProfileUpdateRequest):
    try:
        supabase = get_supabase()
        profile_dict = payload.model_dump() if hasattr(payload, 'model_dump') else payload.dict()
        
        # 빈 문자열("") 처리
        profile_dict["phone_number"] = profile_dict.get("phone_number") or None
        profile_dict["birth_date"] = profile_dict.get("birth_date") or None
        profile_dict["avatar_url"] = profile_dict.get("avatar_url") or None
        profile_dict["address"] = profile_dict.get("address") or None
        profile_dict["detail_address"] = profile_dict.get("detail_address") or None
        profile_dict["updated_at"] = datetime.utcnow().isoformat()

        existing_profile = supabase.table("member_profiles").select("id").eq("member_id", user_id).execute()

        if existing_profile.data and len(existing_profile.data) > 0:
            res = supabase.table("member_profiles").update(profile_dict).eq("member_id", user_id).execute()
        else:
            profile_dict["member_id"] = user_id
            res = supabase.table("member_profiles").insert(profile_dict).execute()

        return {
            "status": "success",
            "message": "프로필 정보가 성공적으로 업데이트되었습니다.",
            "data": res.data
        }

    except Exception as e:
        print(f"❌ [PUT Profile Error]: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"프로필 업데이트 실패: {str(e)}"
        )


# ③ 이메일 단1회 가져와 member_profiles에 동기화하는 API
@router.post("/{user_id}/sync-email")
async def sync_user_email(user_id: str):
    try:
        supabase = get_supabase()
        member_res = (
            supabase.table("members")
            .select("email")
            .eq("id", user_id)
            .execute()
        )

        if not member_res.data or len(member_res.data) == 0:
            raise HTTPException(status_code=404, detail="members 테이블에서 계정 이메일을 찾을 수 없습니다.")

        fetched_email = member_res.data[0].get("email")

        existing_profile = (
            supabase.table("member_profiles")
            .select("id")
            .eq("member_id", user_id)
            .execute()
        )

        if existing_profile.data and len(existing_profile.data) > 0:
            supabase.table("member_profiles").update({"email": fetched_email}).eq("member_id", user_id).execute()
        else:
            supabase.table("member_profiles").insert({"member_id": user_id, "email": fetched_email}).execute()

        return {
            "status": "success",
            "message": "이메일이 member_profiles 테이블에 연동되었습니다.",
            "email": fetched_email
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [Sync Email Error]: {str(e)}")
        raise HTTPException(status_code=500, detail=f"이메일 연동 실패: {str(e)}")