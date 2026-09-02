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

class SpellCheckResponseItem(BaseModel):
    id: str
    spell_checked_text: str

class AIProofreadResponseItem(BaseModel):
    id: str
    ai_proofread_text: str

class UpdateVersionRequest(BaseModel):
    selected_version: str  # 'ORIGINAL', 'SPELL', 'AI' 중 하나


# ------------------------------------------------------------------
# Helper: Groq LLM 호출 함수
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


def run_ai_proofread_llm(text: str) -> str:
    if not text.strip():
        return ""

    prompt = f"""
    다음 텍스트를 전문적인 이력서/경력기술서 스타일에 맞게 재작성해 주세요.

    [작성 지침]
    1. '했음', '함', '담당함' 등 격식 있고 간결한 개조식(Bullet point) 명사형 종결 어미를 사용하세요.
    2. 구어체나 모호한 표현을 전문적이고 명확한 직무 어휘로 다듬어 주세요.
    3. 원문의 주요 키워드, 수치, 구조([항목명] 등)는 손실 없이 그대로 유지해야 합니다.
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
        print(f"Groq API Call Error (AI Proofread): {e}")
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
# Endpoint 2: 맞춤법 교정 (DB 캐싱 조회 후 비어있을 때만 LLM 호출)
# ------------------------------------------------------------------
@router.post("/{section_id}/spell-check", response_model=List[SpellCheckResponseItem])
async def spell_check_section(
    section_id: str,
    payload: SectionTextRequest,
    supabase: Client = Depends(get_supabase)
):
    # 1. DB에서 기존 spell_checked_text 데이터 조회
    cached_map = {}
    try:
        db_res = supabase.table("document_sections") \
            .select("spell_checked_text") \
            .eq("id", section_id) \
            .execute()
        
        if db_res.data and len(db_res.data) > 0:
            existing_list = db_res.data[0].get("spell_checked_text")
            if isinstance(existing_list, list):
                # { item_id: "교정된 텍스트" } 매핑 생성
                for item in existing_list:
                    if isinstance(item, dict) and "id" in item and "spell_checked_text" in item:
                        cached_map[item["id"]] = item["spell_checked_text"]
    except Exception as e:
        print(f"Supabase Select Error (section_id: {section_id}): {e}")

    corrected_results = []
    has_new_llm_call = False

    # 2. 항목별 캐시 확인 및 없으면 LLM 호출
    for item in payload.details:
        existing_text = cached_map.get(item.id)
        
        # 데이터가 이미 존재하는 경우 AI를 호출하지 않음
        if existing_text and existing_text.strip():
            checked_text = existing_text
        else:
            checked_text = run_spell_check_llm(item.original_text)
            has_new_llm_call = True

        corrected_results.append({
            "id": item.id,
            "spell_checked_text": checked_text
        })

    # 3. 새로운 LLM 호출이 있었거나 selected_version 변경이 필요하면 DB 업데이트
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
# Endpoint 3: AI 이력서 교정 (DB 캐싱 조회 후 비어있을 때만 LLM 호출)
# ------------------------------------------------------------------
@router.post("/{section_id}/ai-proofread", response_model=List[AIProofreadResponseItem])
async def ai_proofread_section(
    section_id: str,
    payload: SectionTextRequest,
    supabase: Client = Depends(get_supabase)
):
    # 1. DB에서 기존 ai_proofread_text 데이터 조회
    cached_map = {}
    try:
        db_res = supabase.table("document_sections") \
            .select("ai_proofread_text") \
            .eq("id", section_id) \
            .execute()
        
        if db_res.data and len(db_res.data) > 0:
            existing_list = db_res.data[0].get("ai_proofread_text")
            if isinstance(existing_list, list):
                # { item_id: "교정된 텍스트" } 매핑 생성
                for item in existing_list:
                    if isinstance(item, dict) and "id" in item and "ai_proofread_text" in item:
                        cached_map[item["id"]] = item["ai_proofread_text"]
    except Exception as e:
        print(f"Supabase Select Error (section_id: {section_id}): {e}")

    proofread_results = []
    has_new_llm_call = False

    # 2. 항목별 캐시 확인 및 없으면 LLM 호출
    for item in payload.details:
        existing_text = cached_map.get(item.id)
        
        # 데이터가 이미 존재하는 경우 AI를 호출하지 않음
        if existing_text and existing_text.strip():
            ai_text = existing_text
        else:
            ai_text = run_ai_proofread_llm(item.original_text)
            has_new_llm_call = True

        proofread_results.append({
            "id": item.id,
            "ai_proofread_text": ai_text
        })

    # 3. 새로운 LLM 호출이 있었거나 selected_version 변경이 필요하면 DB 업데이트
    try:
        update_payload = {"selected_version": "AI"}
        if has_new_llm_call or not cached_map:
            update_payload["ai_proofread_text"] = proofread_results

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

    return [AIProofreadResponseItem(**item) for item in proofread_results]



