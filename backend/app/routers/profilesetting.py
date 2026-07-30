from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.core.config import supabase  # 본인의 Supabase Client import 경로

router = APIRouter(
    prefix="/users",
    tags=["Profile Settings"]
)

class ProfileUpdateRequest(BaseModel):
    name: str
    phone_number: Optional[str] = None
    birth_date: Optional[str] = None
    gender: Optional[str] = "M"
    avatar_url: Optional[str] = None


# ① 프로필 조회 (GET /users/{user_id})
@router.get("/{user_id}")
def get_user_profile(user_id: str):
    try:
        # 1. members 테이블에서 계정 정보 조회 (id 기준)
        member_res = supabase.table("members").select("id, email, role, status").eq("id", user_id).execute()
        
        if not member_res.data or len(member_res.data) == 0:
            raise HTTPException(status_code=404, detail="존재하지 않는 회원입니다.")
        
        member_info = member_res.data[0]

        # 2. member_profiles 테이블에서 프로필 정보 조회 (member_id 기준)
        profile_res = supabase.table("member_profiles").select("*").eq("member_id", user_id).execute()
        profile_info = profile_res.data[0] if profile_res.data and len(profile_res.data) > 0 else {}

        # 3. 데이터 통합 (컬럼이 없을 때도 안전하게 기본값 처리)
        combined_data = {
            "id": member_info.get("id"),
            "email": member_info.get("email", ""),
            "role": member_info.get("role", "USER"),
            "status": member_info.get("status", "ACTIVE"),
            "name": profile_info.get("name", ""),
            "phone_number": profile_info.get("phone_number") or "",
            "birth_date": str(profile_info.get("birth_date")) if profile_info.get("birth_date") else "",
            "gender": profile_info.get("gender") or "M",
            "avatar_url": profile_info.get("avatar_url") or ""
        }

        return {
            "status": "success",
            "data": combined_data
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ [GET Profile Error]: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"프로필 조회 실패: {str(e)}"
        )


# ② 프로필 저장 및 수정 (PUT /users/{user_id}/profile)
@router.put("/{user_id}/profile")
def update_user_profile(user_id: str, payload: ProfileUpdateRequest):
    try:
        profile_dict = payload.model_dump() if hasattr(payload, 'model_dump') else payload.dict()
        
        # 빈 문자열("") 입력 시 supabase에는 None(NULL)으로 저장되도록 정리
        profile_dict["phone_number"] = profile_dict.get("phone_number") or None
        profile_dict["birth_date"] = profile_dict.get("birth_date") or None
        profile_dict["avatar_url"] = profile_dict.get("avatar_url") or None
        profile_dict["updated_at"] = datetime.utcnow().isoformat()

        # 기존 프로필 존재 여부 확인 (member_id 기준)
        existing_profile = supabase.table("member_profiles").select("id").eq("member_id", user_id).execute()

        if existing_profile.data and len(existing_profile.data) > 0:
            # 존재하면 UPDATE
            res = supabase.table("member_profiles").update(profile_dict).eq("member_id", user_id).execute()
        else:
            # 처음 설정하는 경우 INSERT (member_id 지정)
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