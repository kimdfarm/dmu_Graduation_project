from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional, Any,Dict
from datetime import datetime
import uuid
from groq import AsyncGroq
from app.core.config import get_supabase , GROQ_API_KEY
import json
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




# -------------------------------------------------------------------
# Pydantic Schemas (요청/응답 규격)
# -------------------------------------------------------------------
class ResumeGenerateRequest(BaseModel):
    member_id: str
    resume_id: str  # 또는 int (Supabase의 resumes PK 타입에 맞춰 조정)
    title: str = "이력서 기반 AI 맞춤 자기소개서"
    category: Optional[str] = "일반"

class CoverLetterResponse(BaseModel):
    id: int
    member_id: str
    title: str
    category: str
    created_at: str

# -------------------------------------------------------------------
# DB 및 AI 서비스 연동 가상 함수 (실제 DB / LLM 서비스 코드와 연결)
# -------------------------------------------------------------------
async def fetch_resume_from_db(resume_id: int, member_id: str) -> Dict[str, Any]:
    """
    DB에서 해당 resume_id와 member_id에 해당하는 이력서 및 세부 섹션 데이터를 조회합니다.
    """
    # TODO: 실제 사용 중인 ORM(SQLAlchemy 등) 또는 DB 조회 로직 작성
    # 예시:
    # resume = await db.query(Resume).filter(Resume.id == resume_id, Resume.member_id == member_id).first()
    # if not resume: return None
    
    # 더미 반환 예시 (실제 DB 필드 구조에 맞추어 수정)
    return {
        "id": resume_id,
        "title": "백엔드 개발자 이력서",
        "category": "백엔드 개발자",
        "sections": [
            {
                "section_name": "경력사항",
                "details": ["FastAPI 및 PostgreSQL 기반 API 개발 및 최적화"]
            },
            {
                "section_name": "프로젝트",
                "details": ["AI 자기소개서 서비스 자동화 파이프라인 구축"]
            }
        ]
    }

async def generate_cover_letter_with_ai(resume_data: Dict[str, Any], category: str) -> List[Dict[str, Any]]:
    """
    LLM(Gemini / OpenAI 등) 모델을 호출하여 이력서 데이터를 바탕으로 자기소개서 문항 및 답변을 생성합니다.
    """
    # TODO: Gemini API 또는 OpenAI API 호출 로직 작성
    # prompt = f"다음 이력서 정보를 기반으로 {category} 직무 맞춤 자기소개서를 작성해줘: {resume_data}"
    
    return [
        {
            "section_type": "GENERATED",
            "section_title": "1. 지원 동기 및 직무 관련 역량",
            "content": f"{resume_data.get('title')}에서 쌓은 경험을 바탕으로, 백엔드 개발자로서 효율적인 데이터 처리와 안정적인 서비스 구축에 기여하고자 지원하였습니다.",
            "display_order": 1
        },
        {
            "section_type": "GENERATED",
            "section_title": "2. 문제 해결 및 프로젝트 경험",
            "content": "프로젝트 수행 중 백엔드 API 응답 속도 개선과 비동기 처리를 도입하여 사용자 경험을 크게 향상시킨 경험이 있습니다.",
            "display_order": 2
        }
    ]



GROQ_MODEL_NAME = "openai/gpt-oss-120b"

# Groq 비동기 클라이언트 초기화
groq_client = AsyncGroq(api_key=GROQ_API_KEY)


# ------------------------------------------------------------------
# 1. Pydantic Schemas
# ------------------------------------------------------------------

class ResumeGenerateRequest(BaseModel):
    member_id: str
    resume_id: str
    title: str = "이력서 기반 AI 맞춤 자기소개서"
    category: Optional[str] = "일반"


# ------------------------------------------------------------------
# 2. 토큰 절약을 위한 텍스트 정제 함수
# ------------------------------------------------------------------

def summarize_resume_for_prompt(resume_sections: list, max_chars: int = 1500) -> str:
    """
    이력서 데이터에서 불필요한 공백과 구조를 줄이고 핵심 텍스트만 추출하여 프롬프트 토큰을 아낍니다.
    """
    compact_text = []
    for sec in resume_sections:
        title = sec.get("section_title", "")
        details = sec.get("details", [])
        
        detail_texts = []
        for d in details:
            # AI 교정본 -> 맞춤법 검사본 -> 원본 순으로 최우선 1개 채택
            text = d.get("ai_proofread_text") or d.get("spell_checked_text") or d.get("original_text") or ""
            if text.strip():
                detail_texts.append(text.strip())
        
        if detail_texts:
            compact_text.append(f"[{title}]: {' / '.join(detail_texts)}")

    full_summary = "\n".join(compact_text)
    return full_summary[:max_chars]  # 글자 수 제한으로 토큰 폭탄 방지


# ------------------------------------------------------------------
# 3. Groq API 기반 이력서 자기소개서 생성 엔드포인트
# ------------------------------------------------------------------

@router.post("/resume-generate", status_code=status.HTTP_201_CREATED)
async def generate_cover_letter_from_resume(payload: ResumeGenerateRequest):
    try:
        supabase = get_supabase()

        # 1. Supabase에서 해당 이력서 조회
        resume_res = supabase.table("documents") \
            .select("*, document_sections(*)") \
            .eq("id", payload.resume_id) \
            .eq("member_id", payload.member_id) \
            .execute()

        if not resume_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="선택한 이력서 정보를 찾을 수 없습니다."
            )

        resume_data = resume_res.data[0]
        resume_sections = resume_data.get("document_sections", [])

        # 2. 이력서 텍스트 요약 (토큰 절약)
        compressed_resume = summarize_resume_for_prompt(resume_sections, max_chars=1500)

        # 3. 개선된 프롬프트 설계 (이력서 나열이 아닌 자연스러운 자소서 문장 생성 강제)
        system_prompt = (
            "너는 IT/소프트웨어 분야 전문 취업 컨설턴트야.\n"
            "전달받은 지원자의 이력 요약 데이터를 바탕으로 "
            f"'{payload.category}' 직무에 지원하기 위한 완성도 높은 **자기소개서**를 작성해줘.\n\n"
            "[작성 지침 및 규칙]\n"
            "1. 절대 이력서처럼 단어나 개조식 불렛포인트(•)로 기술 스택만 단순 나열하지 마라.\n"
            "2. 모든 내용은 매끄럽고 구체적인 **자연어 경어체(~했습니다, ~하고자 합니다)** 완성형 문장으로 구성해라.\n"
            "3. 각 문항의 'content'는 최소 300자 이상, 2~3개의 문단으로 나누어 설득력 있는 스토리(경험 -> 역할 및 성과 -> 직무 적용점) 형태로 작성해라.\n"
            "4. 문단 간 줄바꿈이 필요한 경우 실제 줄바꿈(Enter)을 사용하여 작성해라.\n\n"
            "[응답 JSON 규격]\n"
            "반드시 아래 JSON 구조로만 응답해라:\n"
            "{\n"
            '  "sections": [\n'
            '    {"section_type": "MOTIVATION", "section_title": "1. 지원 동기 및 입사 후 포부", "content": "자연스러운 문장 형태의 자기소개서 내용..."},\n'
            '    {"section_type": "STRENGTHS", "section_title": "2. 직무 핵심 역량 및 프로젝트 경험", "content": "자연스러운 문장 형태의 자기소개서 내용..."}\n'
            '  ]\n'
            "}"
        )

        user_prompt = f"지원자의 이력 요약 정보:\n{compressed_resume}"

        # 4. Groq API 비동기 호출
        completion = await groq_client.chat.completions.create(
            model=GROQ_MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.7,  # 창의적이고 자연스러운 문장을 위해 약간 상향
            max_completion_tokens=1500
        )

        # 5. 응답 파싱 및 텍스트 깨짐 정제
        ai_response_content = completion.choices[0].message.content
        parsed_json = json.loads(ai_response_content)
        parsed_sections = parsed_json.get("sections", [])

        generated_ai_sections = []
        for idx, sec in enumerate(parsed_sections):
            raw_content = sec.get("content", "")
            
            # \n• 같은 개조식 문자 및 이스케이프 이중 텍스트 정제
            cleaned_content = raw_content.replace("\\n", "\n").replace("•", "").strip()

            generated_ai_sections.append({
                "section_type": sec.get("section_type", "GENERAL"),
                "section_title": sec.get("section_title", f"{idx+1}. 항목"),
                "display_order": idx + 1,
                "columns": ["질문 항목", "작성 내용"],
                "details": [{
                    "id": f"res-gen-{uuid.uuid4().hex[:8]}",
                    "title": sec.get("section_title", ""),
                    "original_text": cleaned_content,
                    "spell_checked_text": None,
                    "ai_proofread_text": None,
                    "selected_version": "ORIGINAL"
                }]
            })

        # 6. Supabase documents 테이블에 new COVER_LETTER 생성
        doc_response = supabase.table("documents").insert({
            "member_id": payload.member_id,
            "title": payload.title,
            "doc_type": "COVER_LETTER",
            "category": payload.category
        }).execute()

        if not doc_response.data:
            raise HTTPException(status_code=400, detail="자기소개서 문서 생성 실패")

        new_doc_id = doc_response.data[0]["id"]

        # 7. document_sections 레코드 등록
        sections_to_insert = [
            {
                "document_id": new_doc_id,
                "section_type": sec["section_type"],
                "section_title": sec["section_title"],
                "display_order": sec["display_order"],
                "columns": sec["columns"],
                "details": sec["details"]
            }
            for sec in generated_ai_sections
        ]

        sec_response = supabase.table("document_sections").insert(sections_to_insert).execute()

        return {
            "id": new_doc_id,
            "title": payload.title,
            "category": payload.category,
            "message": "Groq AI 기반 자기소개서가 성공적으로 생성되었습니다.",
            "sections": sec_response.data
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ Groq AI 생성 과정 오류: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI 자기소개서 생성 중 오류 발생: {str(e)}"
        )
