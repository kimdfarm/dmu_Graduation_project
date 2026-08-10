from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional, Union, Any
from datetime import date, datetime

# 💡 기존 app.core.config의 supabase 객체 가져오기
from app.core.config import get_supabase

router = APIRouter(
    prefix="/api/profile-settings",
    tags=["Profile Settings - Educations & Certificates"]
)


# ------------------------------------------------------------------------------
# Pydantic Schemas
# ------------------------------------------------------------------------------
# 🎓 학력 Schema
class EducationBase(BaseModel):
    school_name: str
    major: str
    education_level: Optional[str] = "학사"
    status: Optional[str] = "재학"
    admission_date: Union[date, str] # 💡 date 객체 또는 string 모두 허용[cite: 8]
    graduation_date: Optional[Union[date, str]] = None

class EducationCreate(EducationBase):
    pass

class EducationResponse(EducationBase):
    id: Union[str, int, Any]  # 👈 int/str 둘 다 수용 가능하도록 변경
    member_id: str
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class CertificateBase(BaseModel):
    certificate_name: str
    issuing_organization: Optional[str] = None
    certificate_number: Optional[str] = None
    acquisition_date: Optional[Union[date, str]] = None # 💡 date 객체 또는 string 모두 허용[cite: 8]

class CertificateCreate(CertificateBase):
    pass

class CertificateResponse(CertificateBase):
    id: Union[str, int, Any]  # 👈 int/str 둘 다 수용 가능하도록 변경
    member_id: str
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


# ------------------------------------------------------------------------------
# 🎓 1. 학력 (Educations) Endpoints
# ------------------------------------------------------------------------------
@router.get("/educations/{member_id}", response_model=List[EducationResponse])
def get_educations(member_id: str):
    """특정 회원의 학력 목록 조회"""
    try:
        supabase = get_supabase()
        response = supabase.table("educations").select("*").eq("member_id", member_id).order("admission_date", desc=True).execute()
        return response.data or []
    except Exception as e:
        print(f"❌ 학력 조회 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"학력 정보 조회 실패: {str(e)}")

@router.post("/educations/{member_id}", response_model=EducationResponse, status_code=status.HTTP_201_CREATED)
def create_education(member_id: str, edu: EducationCreate):
    """학력 정보 추가"""
    try:
        supabase = get_supabase()
        data = edu.model_dump(exclude_none=True)
        data["member_id"] = member_id
        
        if "admission_date" in data and data["admission_date"]: 
            data["admission_date"] = data["admission_date"].isoformat()
        if "graduation_date" in data and data["graduation_date"]: 
            data["graduation_date"] = data["graduation_date"].isoformat()

        response = supabase.table("educations").insert(data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="학력 정보 저장 실패")
        return response.data[0]
    except Exception as e:
        print(f"❌ 학력 추가 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"학력 정보 추가 중 오류: {str(e)}")

@router.delete("/educations/{education_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_education(education_id: str):
    """학력 정보 삭제"""
    try:
        supabase = get_supabase()
        supabase.table("educations").delete().eq("id", education_id).execute()
        return None
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"학력 정보 삭제 중 오류: {str(e)}")


# ------------------------------------------------------------------------------
# 📜 2. 자격증 (Certificates) Endpoints
# ------------------------------------------------------------------------------
@router.get("/certificates/{member_id}", response_model=List[CertificateResponse])
def get_certificates(member_id: str):
    """특정 회원의 자격증 목록 조회"""
    try:
        supabase = get_supabase()
        response = supabase.table("certificates").select("*").eq("member_id", member_id).order("acquisition_date", desc=True).execute()
        return response.data or []
    except Exception as e:
        print(f"❌ 자격증 조회 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"자격증 목록 조회 실패: {str(e)}")

@router.post("/certificates/{member_id}", response_model=CertificateResponse, status_code=status.HTTP_201_CREATED)
def create_certificate(member_id: str, cert: CertificateCreate):
    """자격증 정보 추가"""
    try:
        data = cert.model_dump(exclude_none=True)
        data["member_id"] = member_id
        
        if "acquisition_date" in data and data["acquisition_date"]: 
            data["acquisition_date"] = data["acquisition_date"].isoformat()

        response = supabase.table("certificates").insert(data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="자격증 정보 저장 실패")
        return response.data[0]
    except Exception as e:
        print(f"❌ 자격증 추가 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"자격증 추가 중 오류: {str(e)}")

@router.delete("/certificates/{certificate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_certificate(certificate_id: str):
    """자격증 정보 삭제"""
    try:
        supabase = get_supabase()   
        supabase.table("certificates").delete().eq("id", certificate_id).execute()
        return None
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"자격증 삭제 중 오류: {str(e)}")