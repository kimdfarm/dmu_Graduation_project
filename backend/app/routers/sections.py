from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from supabase import Client
from groq import Groq

from app.core.config import get_supabase, GROQ_API_KEY


router = APIRouter(
    prefix="/api/sections",
    tags=["sections"]
)

groq_client = Groq(api_key=GROQ_API_KEY)


# ------------------------------------------------------------------
# Request / Response Pydantic 스키마
# ------------------------------------------------------------------
class DetailItem(BaseModel):
    id: str
    original_text: str

class SectionTextRequest(BaseModel):
    details: List[DetailItem]
    mode: Optional[str] = "STAR"  # 자기소개서용 4가지 모드 ('STAR', 'IMPACT', 'TECH', 'TONE')

class SpellCheckResponseItem(BaseModel):
    id: str
    spell_checked_text: str

class AIProofreadResponseItem(BaseModel):
    id: str
    ai_proofread_text: str

class UpdateVersionRequest(BaseModel):
    selected_version: str  # 'ORIGINAL', 'SPELL', 'AI' 중 하나


# ------------------------------------------------------------------
# Helper 1: 공통 맞춤법 교정
# ------------------------------------------------------------------
def run_spell_check_llm(text: str) -> str:
    if not text.strip():
        return ""

    prompt = f"""
    다음 한국어 텍스트의 맞춤법, 띄어쓰기, 문맥적 오류를 올바르게 교정해 주세요.
    원문의 의미와 문단 구조(줄바꿈 등)를 그대로 유지하되, 오직 맞춤법만 자연스럽게 수정해야 합니다.
    부가적인 설명이나 인삿말 없이, 오직 교정된 결과 텍스트만 출력하세요.

    [원문]
    {text}
    """

    try:
        response = groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": "너는 한국어 맞춤법 및 문법 교정 전문가이다."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Groq API Call Error: {e}")
        return text


# ------------------------------------------------------------------
# Helper 2: [이력서(Resume) 전용] AI 교정 함수
# 특징: 이력서에 어울리는 간결한 개조식 명사형 종결 어미(~함, ~기여함, ~구현 등) 적용
# ------------------------------------------------------------------
def run_resume_ai_proofread_llm(text: str) -> str:
    if not text.strip():
        return ""

    prompt = f"""
    다음 이력서/경력기술서 텍스트를 채용 담당자의 눈길을 사로잡는 전문적인 개조식 스타일로 재작성해 주세요.

    [작성 지침]
    1. '했음', '함', '담당함', '구현', '최적화' 등 격식 있고 간결한 개조식(Bullet point) 명사형/체언 종결 어미를 사용하세요.
    2. 구어체나 모호한 표현을 전문적이고 명확한 직무 어휘로 다듬어 주세요.
    3. 원문의 주요 키워드, 수치, 구조는 손실 없이 그대로 유지해야 합니다.
    4. 설명이나 인삿말 없이 오직 이력서용으로 재작성된 텍스트만 출력하세요.

    [원문]
    {text}
    """

    try:
        response = groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": "너는 채용 담당자의 눈길을 사로잡는 전문 이력서 컨설턴트 및 라이터이다."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Groq API Call Error (Resume Proofread): {e}")
        return text


# ------------------------------------------------------------------
# Helper 3: [자기소개서(Cover Letter) 전용] 4가지 모드 AI 교정 함수
# ------------------------------------------------------------------
def run_coverletter_ai_proofread_llm(text: str, mode: str = "STAR") -> str:
    if not text.strip():
        return ""

    mode_instructions = {
        "STAR": """
        [모드: STAR 기법 강조]
        - 지원자의 경험을 Situation(상황), Task(과제), Action(행동), Result(결과) 구조가 선명하게 드러나도록 재구성하세요.
        - 본인이 구체적으로 어떤 행동(Action)을 취해 문제를 해결했는지 인과관계가 돋보이게 다듬어 주세요.
        - 신뢰감 주는 완성형 경어체(~했습니다, ~기여했습니다 등)를 사용하세요.
        """,
        "IMPACT": """
        [모드: 수치/성과 중심 (Impact Booster)]
        - 지원자의 기여도와 성과가 객관적인 수치, 효율성 개선율(예: %, 시간 단축 등)을 중심으로 강력하게 어필되도록 재작성하세요.
        - 모호한 표현은 "어떤 임팩트를 남겼는지" 결과를 최우선으로 하는 문장으로 격상시키세요.
        - 설득력 높은 완성형 경어체를 사용하세요.
        """,
        "TECH": """
        [모드: 기술 스택 & 트러블슈팅 강조]
        - 사용된 기술 스택, 아키텍처, 그리고 기술적 난관을 극복한 트러블슈팅 과정이 전문가 눈에 띄도록 기술 용어를 명확히 다듬어 주세요.
        - 단순 작업 나열이 아니라, 기술적 의사결정 과정과 문제 해결 능력이 돋보이게 작성하세요.
        - 개발 직군 자소서에 어울리는 전문적이고 명확한 직무 어휘와 경어체를 사용하세요.
        """,
        "TONE": """
        [모드: 톤앤매너 맞춤 (대기업/스타트업)]
        - 대기업의 신뢰감·체계성 또는 스타트업의 실행력·주도성이 돋보이는 프로페셔널한 비즈니스 톤으로 윤문하세요.
        - 군더더기 없는 세련된 문어체를 사용하여 채용 담당자에게 강한 신뢰를 주는 어조로 완성하세요.
        """
    }

    selected_instruction = mode_instructions.get(mode, mode_instructions["STAR"])

    prompt = f"""
    다음 자기소개서 텍스트를 채용 담당자의 눈길을 사로잡는 매끄러운 서술형 문장으로 재작성해 주세요.

    {selected_instruction}

    [공통 작성 지침]
    1. 이력서와 달리 자기소개서이므로 '~했습니다', '~고자 합니다' 등 완성형 경어체를 사용하세요.
    2. 원문의 핵심 키워드, 수치, 구조는 손실 없이 그대로 유지해야 합니다.
    3. 일반적인 AI가 쓴 흔적(~를 통해 등)을 지우고 지원자의 진정성이 느껴지도록 자연스럽게 작성하세요.
    4. 설명이나 인삿말 없이 오직 자소서용으로 재작성된 텍스트만 출력하세요.

    [원문]
    {text}
    """

    try:
        response = groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": "너는 채용 트렌드를 꿰뚫고 있는 최고 수석 자기소개서 컨설턴트 및 전문 라이터이다."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Groq API Call Error (CoverLetter Proofread Mode {mode}): {e}")
        return text


# ------------------------------------------------------------------
# Endpoint 1: document_sections의 selected_version 변경
# ------------------------------------------------------------------
@router.patch("/{section_id}/version")
async def update_section_version(
    section_id: str,
    payload: UpdateVersionRequest,
    supabase: Client = Depends(get_supabase)
):
    try:
        res = supabase.table("document_sections") \
            .update({"selected_version": payload.selected_version}) \
            .eq("id", section_id) \
            .execute()
        return {"success": True, "data": res.data}
    except Exception as e:
        print(f"Supabase Version Update Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"버전 업데이트 실패: {str(e)}"
        )


# ------------------------------------------------------------------
# Endpoint 2: 맞춤법 교정 (공통)
# ------------------------------------------------------------------
@router.post("/{section_id}/spell-check", response_model=List[SpellCheckResponseItem])
async def spell_check_section(
    section_id: str,
    payload: SectionTextRequest,
    supabase: Client = Depends(get_supabase)
):
    cached_map = {}
    try:
        db_res = supabase.table("document_sections") \
            .select("spell_checked_text") \
            .eq("id", section_id) \
            .execute()
        
        if db_res.data and len(db_res.data) > 0:
            existing_list = db_res.data[0].get("spell_checked_text")
            if isinstance(existing_list, list):
                for item in existing_list:
                    if isinstance(item, dict) and "id" in item and "spell_checked_text" in item:
                        cached_map[item["id"]] = item["spell_checked_text"]
    except Exception as e:
        print(f"Supabase Select Error (section_id: {section_id}): {e}")

    corrected_results = []
    has_new_llm_call = False

    for item in payload.details:
        existing_text = cached_map.get(item.id)
        
        if existing_text and existing_text.strip():
            checked_text = existing_text
        else:
            checked_text = run_spell_check_llm(item.original_text)
            has_new_llm_call = True

        corrected_results.append({
            "id": item.id,
            "spell_checked_text": checked_text
        })

    try:
        update_payload = {"selected_version": "SPELL"}
        if has_new_llm_call or not cached_map:
            update_payload["spell_checked_text"] = corrected_results

        supabase.table("document_sections") \
            .update(update_payload) \
            .eq("id", section_id) \
            .execute()
    except Exception as e:
        print(f"Supabase Update Error (section_id: {section_id}): {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"DB 저장 중 오류가 발생했습니다: {str(e)}"
        )

    return [SpellCheckResponseItem(**item) for item in corrected_results]


# ------------------------------------------------------------------
# Endpoint 3-1: [이력서 전용] AI 교정 엔드포인트
# ------------------------------------------------------------------
@router.post("/{section_id}/resume-ai-proofread", response_model=List[AIProofreadResponseItem])
async def resume_ai_proofread_section(
    section_id: str,
    payload: SectionTextRequest,
    supabase: Client = Depends(get_supabase)
):
    proofread_results = []
    has_new_llm_call = False

    for item in payload.details:
        ai_text = run_resume_ai_proofread_llm(item.original_text)
        has_new_llm_call = True

        proofread_results.append({
            "id": item.id,
            "ai_proofread_text": ai_text
        })

    try:
        update_payload = {
            "selected_version": "AI",
            "ai_proofread_text": proofread_results
        }
        supabase.table("document_sections") \
            .update(update_payload) \
            .eq("id", section_id) \
            .execute()
    except Exception as e:
        print(f"Supabase Update Error (Resume AI): {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"DB 저장 오류: {str(e)}"
        )

    return [AIProofreadResponseItem(**item) for item in proofread_results]


# ------------------------------------------------------------------
# Endpoint 3-2: [자기소개서 전용] 4가지 모드 AI 교정 엔드포인트
# ------------------------------------------------------------------
@router.post("/{section_id}/coverletter-ai-proofread", response_model=List[AIProofreadResponseItem])
async def coverletter_ai_proofread_section(
    section_id: str,
    payload: SectionTextRequest,
    supabase: Client = Depends(get_supabase)
):
    # 클라이언트가 전달한 자소서 모드 확인 (기본값: 'STAR')
    current_mode = payload.mode if payload.mode else "STAR"

    proofread_results = []
    has_new_llm_call = False

    for item in payload.details:
        ai_text = run_coverletter_ai_proofread_llm(item.original_text, mode=current_mode)
        has_new_llm_call = True

        proofread_results.append({
            "id": item.id,
            "ai_proofread_text": ai_text
        })

    try:
        update_payload = {
            "selected_version": "AI",
            "ai_proofread_text": proofread_results
        }
        supabase.table("document_sections") \
            .update(update_payload) \
            .eq("id", section_id) \
            .execute()
    except Exception as e:
        print(f"Supabase Update Error (CoverLetter AI): {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"DB 저장 오류: {str(e)}"
        )

    return [AIProofreadResponseItem(**item) for item in proofread_results]