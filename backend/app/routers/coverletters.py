from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime
import uuid

from app.core.config import get_supabase

router = APIRouter(
    prefix="/api/cover-letters",
    tags=["CoverLetters"]
)

# ------------------------------------------------------------------
# 1. Pydantic Schemas (요청/응답 모델)
# ------------------------------------------------------------------

# JSONB 내부 세부 항목 스키마
class DetailItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: Optional[str] = ""
    original_text: Optional[str] = ""
    spell_checked_text: Optional[str] = None
    ai_proofread_text: Optional[str] = None
    selected_version: Optional[str] = "ORIGINAL"  # ORIGINAL, SPELL, AI

# 프론트엔드에서 넘겨주는 동적 문항/섹션 구조
class SectionInput(BaseModel):
    section_type: str = "GENERAL"
    section_title: str
    display_order: Optional[int] = 1
    columns: Optional[List[str]] = Field(default_factory=list)
    details: Optional[List[DetailItem]] = Field(default_factory=list)

# 새 자기소개서 생성 요청
class CoverLetterCreateRequest(BaseModel):
    member_id: str
    title: str = "제목 없는 자기소개서"
    category: Optional[str] = "일반"
    custom_sections: Optional[List[SectionInput]] = None  # 프론트엔드 맞춤 문항 리스트

# 섹션 단일 생성 요청
class SectionCreateRequest(BaseModel):
    section_type: str = "GENERAL"
    section_title: str
    display_order: Optional[int] = 1
    columns: Optional[List[str]] = None
    details: Optional[List[DetailItem]] = []

# 섹션 업데이트 요청
class SectionUpdateRequest(BaseModel):
    section_title: Optional[str] = None
    display_order: Optional[int] = None
    columns: Optional[List[str]] = None
    details: Optional[List[DetailItem]] = None


# ------------------------------------------------------------------
# 2. 엔드포인트 구현
# ------------------------------------------------------------------

# [1] 새 자기소개서 생성 (동적 문항 & 컬럼 반영)
@router.post("", status_code=status.HTTP_201_CREATED)
async def create_cover_letter(payload: CoverLetterCreateRequest):
    try:
        supabase = get_supabase()
        
        # A. documents 테이블에 자기소개서(COVER_LETTER) 추가
        doc_response = supabase.table("documents").insert({
            "member_id": payload.member_id,
            "title": payload.title,
            "doc_type": "COVER_LETTER",
            "category": payload.category
        }).execute()

        if not doc_response.data:
            raise HTTPException(status_code=400, detail="자기소개서 생성 실패")

        new_doc = doc_response.data[0]
        doc_id = new_doc["id"]

        sections_to_insert = []

        # B-1. 프론트엔드에서 전달한 맞춤 프레임/문항 구조가 있는 경우
        if payload.custom_sections and len(payload.custom_sections) > 0:
            for idx, sec in enumerate(payload.custom_sections):
                cols = sec.columns if sec.columns and len(sec.columns) > 0 else ["질문 항목", "작성 내용"]
                
                init_details = [
                    {
                        "id": f"init-cl-sec-{idx+1}-1",
                        "title": f"{sec.section_title} 세부 내용",
                        "original_text": "내용을 입력해주세요.",
                        "spell_checked_text": None,
                        "ai_proofread_text": None,
                        "selected_version": "ORIGINAL"
                    }
                ] if not sec.details else [d.model_dump() for d in sec.details]

                sections_to_insert.append({
                    "document_id": doc_id,
                    "section_type": sec.section_type,
                    "section_title": sec.section_title,
                    "display_order": sec.display_order or (idx + 1),
                    "columns": cols,
                    "details": init_details
                })

        # B-2. custom_sections가 없는 경우 기본 자기소개서 항목(4종)으로 Fallback
        else:
            default_cols = ["질문 항목", "작성 내용"]
            sections_to_insert = [
                {
                    "document_id": doc_id,
                    "section_type": "MOTIVATION",
                    "section_title": "1. 지원 동기 및 입사 후 포부",
                    "display_order": 1,
                    "columns": default_cols,
                    "details": [{"id": "init-cl-1", "title": "지원 동기", "original_text": "해당 회사 및 직무에 지원한 이유와 입사 후 목표를 기술해 주세요.", "selected_version": "ORIGINAL"}]
                },
                {
                    "document_id": doc_id,
                    "section_type": "STRENGTHS",
                    "section_title": "2. 직무 관련 핵심 역량 및 강점",
                    "display_order": 2,
                    "columns": default_cols,
                    "details": [{"id": "init-cl-2", "title": "핵심 역량", "original_text": "직무와 관련된 본인만의 강점과 역량을 기술해 주세요.", "selected_version": "ORIGINAL"}]
                },
                {
                    "document_id": doc_id,
                    "section_type": "PROBLEM_SOLVING",
                    "section_title": "3. 기술적 문제 해결 및 프로젝트 경험",
                    "display_order": 3,
                    "columns": default_cols,
                    "details": [{"id": "init-cl-3", "title": "문제 해결 경험", "original_text": "프로젝트 수행 중 경험한 어려움과 이를 극복한 과정을 기술해 주세요.", "selected_version": "ORIGINAL"}]
                },
                {
                    "document_id": doc_id,
                    "section_type": "COLLABORATION",
                    "section_title": "4. 협업 및 소통 경험",
                    "display_order": 4,
                    "columns": default_cols,
                    "details": [{"id": "init-cl-4", "title": "협업 사례", "original_text": "팀워크를 발휘하여 성과를 만들어낸 경험을 기술해 주세요.", "selected_version": "ORIGINAL"}]
                }
            ]

        sec_response = supabase.table("document_sections").insert(sections_to_insert).execute()

        return {
            "id": doc_id,
            "title": new_doc["title"],
            "category": new_doc["category"],
            "message": "자기소개서가 성공적으로 생성되었습니다.",
            "sections": sec_response.data
        }

    except Exception as e:
        print(f"❌ 자기소개서 생성 에러: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# [2] 내 자기소개서 목록 조회
@router.get("")
async def get_cover_letters(member_id: str):
    try:
        supabase = get_supabase()
        response = supabase.table("documents") \
            .select("*, document_sections(*)") \
            .eq("member_id", member_id) \
            .eq("doc_type", "COVER_LETTER") \
            .order("created_at", desc=True) \
            .execute()
            
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# [3] 특정 자기소개서 상세 및 섹션 조회
@router.get("/{cover_letter_id}")
async def get_cover_letter_detail(cover_letter_id: str):
    try:
        supabase = get_supabase()
        doc_res = supabase.table("documents").select("*").eq("id", cover_letter_id).execute()
        if not doc_res.data:
            raise HTTPException(status_code=404, detail="자기소개서를 찾을 수 없습니다.")

        sec_res = supabase.table("document_sections") \
            .select("*") \
            .eq("document_id", cover_letter_id) \
            .order("display_order", desc=False) \
            .execute()

        result = doc_res.data[0]
        result["sections"] = sec_res.data
        return result

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ 자기소개서 상세 조회 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# [4] 자기소개서 삭제
@router.delete("/{cover_letter_id}")
async def delete_cover_letter(cover_letter_id: str):
    try:
        supabase = get_supabase()
        supabase.table("documents").delete().eq("id", cover_letter_id).execute()
        return {"message": "자기소개서가 삭제되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# [5] 문항(섹션) 추가
@router.post("/{cover_letter_id}/sections", status_code=status.HTTP_201_CREATED)
async def create_section(cover_letter_id: str, payload: SectionCreateRequest):
    try:
        supabase = get_supabase()
        details_data = [item.model_dump() for item in payload.details] if payload.details else []
        
        insert_data = {
            "document_id": cover_letter_id,
            "section_type": payload.section_type,
            "section_title": payload.section_title,
            "display_order": payload.display_order,
            "details": details_data
        }
        if payload.columns is not None:
            insert_data["columns"] = payload.columns

        response = supabase.table("document_sections").insert(insert_data).execute()

        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# [6] 문항(섹션) 업데이트
@router.patch("/sections/{section_id}")
async def update_section(section_id: str, payload: SectionUpdateRequest):
    try:
        supabase = get_supabase()
        update_data = {}
        if payload.section_title is not None:
            update_data["section_title"] = payload.section_title
        if payload.display_order is not None:
            update_data["display_order"] = payload.display_order
        if payload.columns is not None:
            update_data["columns"] = payload.columns
        if payload.details is not None:
            update_data["details"] = [item.model_dump() for item in payload.details]

        if not update_data:
            raise HTTPException(status_code=400, detail="수정할 정보가 없습니다.")

        response = supabase.table("document_sections") \
            .update(update_data) \
            .eq("id", section_id) \
            .execute()

        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# [7] 문항(섹션) 삭제
@router.delete("/sections/{section_id}", status_code=status.HTTP_200_OK)
async def delete_cover_letter_section(section_id: str):
    try:
        supabase = get_supabase()   
        response = supabase.table("document_sections") \
            .delete() \
            .eq("id", section_id) \
            .execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="삭제할 문항을 찾지 못했습니다.")

        return {"message": "문항이 성공적으로 삭제되었습니다.", "deleted_id": section_id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))