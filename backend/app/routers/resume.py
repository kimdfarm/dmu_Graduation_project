from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime
import uuid

from app.core.config import get_supabase

router = APIRouter(
    prefix="/api/resumes",
    tags=["Resumes"]
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

# 프론트엔드에서 넘겨주는 동적 섹션 구조
class SectionInput(BaseModel):
    section_type: str = "GENERAL"
    section_title: str
    display_order: Optional[int] = 1
    columns: Optional[List[str]] = Field(default_factory=list)
    details: Optional[List[DetailItem]] = Field(default_factory=list)

# 새 이력서 생성 요청 (💡 custom_sections 필드 추가)
class ResumeCreateRequest(BaseModel):
    member_id: str
    title: str = "제목 없는 문서"
    category: Optional[str] = "일반"
    custom_sections: Optional[List[SectionInput]] = None  # 프론트엔드 맞춤 컬럼/섹션 리스트

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

# [1] 새 이력서 생성 (동적 섹션 & 컬럼 반영)
@router.post("", status_code=status.HTTP_201_CREATED)
async def create_resume(payload: ResumeCreateRequest):
    try:
        # A. documents 테이블에 이력서 추가
        supabase = get_supabase()
        doc_response = supabase.table("documents").insert({
            "member_id": payload.member_id,
            "title": payload.title,
            "doc_type": "RESUME",
            "category": payload.category
        }).execute()

        if not doc_response.data:
            raise HTTPException(status_code=400, detail="이력서 생성 실패")

        new_doc = doc_response.data[0]
        doc_id = new_doc["id"]

        sections_to_insert = []

        # B-1. 프론트엔드에서 전달한 맞춤 프레임/컬럼 구조가 있는 경우
        if payload.custom_sections and len(payload.custom_sections) > 0:
            for idx, sec in enumerate(payload.custom_sections):
                # 프론트엔드가 보낸 컬럼이 없으면 기본 2컬럼 제공
                cols = sec.columns if sec.columns and len(sec.columns) > 0 else ["항목", "내용"]
                
                # 기본 안내문 생성
                init_details = [
                    {
                        "id": f"init-sec-{idx+1}-1",
                        "title": f"{sec.section_title} 입력",
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

        # B-2. 프론트엔드에서 custom_sections를 안 보낸 경우 fallback (한국 표준 6종)
        else:
            default_cols = ["제목/역할", "참여 기간", "상세 업무 및 성과"]
            sections_to_insert = [
                {
                    "document_id": doc_id,
                    "section_type": "SUMMARY",
                    "section_title": "1. 간단 명료한 자기소개 (Summary)",
                    "display_order": 1,
                    "columns": default_cols,
                    "details": [{"id": "init-summary-1", "title": "핵심역량 요약", "original_text": "어떤 가치를 만드는 개발자인지 3~4줄로 명확하게 요약해 주세요.", "selected_version": "ORIGINAL"}]
                },
                {
                    "document_id": doc_id,
                    "section_type": "MOTIVATION",
                    "section_title": "2. 지원 동기 및 포부",
                    "display_order": 2,
                    "columns": default_cols,
                    "details": [{"id": "init-motivation-1", "title": "지원 동기", "original_text": "해당 회사/직무에 지원하게 된 계기와 기여하고 싶은 바를 적어주세요.", "selected_version": "ORIGINAL"}]
                },
                {
                    "document_id": doc_id,
                    "section_type": "EXPERIENCE",
                    "section_title": "3. 주요 프로젝트 및 경력 사항",
                    "display_order": 3,
                    "columns": default_cols,
                    "details": [{"id": "init-exp-1", "title": "프로젝트명 / 역할", "original_text": "수행한 핵심 역할, 사용 기술 스택, 성과를 적어주세요.", "selected_version": "ORIGINAL"}]
                },
                {
                    "document_id": doc_id,
                    "section_type": "SKILLS",
                    "section_title": "4. 보유 기술 스택 및 활용 능력",
                    "display_order": 4,
                    "columns": default_cols,
                    "details": [{"id": "init-skill-1", "title": "주요 기술 및 수준", "original_text": "주로 다루는 언어, 프레임워크의 숙련도를 설명해 주세요.", "selected_version": "ORIGINAL"}]
                },
                {
                    "document_id": doc_id,
                    "section_type": "ACTIVITIES",
                    "section_title": "5. 기타 활동 (대외활동, 교육, 대회를 포함)",
                    "display_order": 5,
                    "columns": default_cols,
                    "details": [{"id": "init-act-1", "title": "활동명 및 내용", "original_text": "부트캠프, 해커톤 등 관련 활동을 적어주세요.", "selected_version": "ORIGINAL"}]
                },
                {
                    "document_id": doc_id,
                    "section_type": "LINK",
                    "section_title": "6. 주요 포트폴리오 및 링크",
                    "display_order": 6,
                    "columns": default_cols,
                    "details": [{"id": "init-link-1", "title": "GitHub / 기술 블로그 링크", "original_text": "https://github.com/...", "selected_version": "ORIGINAL"}]
                }
            ]

        sec_response = supabase.table("document_sections").insert(sections_to_insert).execute()

        return {
            "id": doc_id,
            "title": new_doc["title"],
            "category": new_doc["category"],
            "message": "맞춤형 프레임 및 컬럼으로 이력서가 성공적으로 생성되었습니다.",
            "sections": sec_response.data
        }

    except Exception as e:
        print(f"❌ 이력서 생성 에러: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# [2] 내 이력서 목록 조회
@router.get("")
async def get_resumes(member_id: str):
    try:
        supabase = get_supabase()
        response = supabase.table("documents") \
            .select("*, document_sections(*)") \
            .eq("member_id", member_id) \
            .eq("doc_type", "RESUME") \
            .order("created_at", desc=True) \
            .execute()
            
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# [3] 특정 이력서 상세 및 섹션 조회
@router.get("/{resume_id}")
async def get_resume_detail(resume_id: str):
    try:
        supabase = get_supabase()
        doc_res = supabase.table("documents").select("*").eq("id", resume_id).execute()
        if not doc_res.data:
            raise HTTPException(status_code=404, detail="이력서를 찾을 수 없습니다.")

        sec_res = supabase.table("document_sections") \
            .select("*") \
            .eq("document_id", resume_id) \
            .order("display_order", desc=False) \
            .execute()

        result = doc_res.data[0]
        result["sections"] = sec_res.data
        return result

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ 이력서 상세 조회 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# [4] 이력서 삭제
@router.delete("/{resume_id}")
async def delete_resume(resume_id: str):
    try:
        supabase = get_supabase()
        supabase.table("documents").delete().eq("id", resume_id).execute()
        return {"message": "삭제 완료되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# [5] 섹션 추가
@router.post("/{resume_id}/sections", status_code=status.HTTP_201_CREATED)
async def create_section(resume_id: str, payload: SectionCreateRequest):
    try:
        supabase = get_supabase()
        details_data = [item.model_dump() for item in payload.details] if payload.details else []
        
        insert_data = {
            "document_id": resume_id,
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

# [6] 섹션 업데이트
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

# [7] 섹션 삭제
@router.delete("/sections/{section_id}", status_code=status.HTTP_200_OK)
async def delete_resume_section(section_id: str):
    try:
        supabase = get_supabase()   
        response = supabase.table("document_sections") \
            .delete() \
            .eq("id", section_id) \
            .execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="삭제할 섹션을 찾지 못했습니다.")

        return {"message": "섹션이 성공적으로 삭제되었습니다.", "deleted_id": section_id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))