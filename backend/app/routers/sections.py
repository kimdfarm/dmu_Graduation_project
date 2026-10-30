from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
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
    ai_columns: Optional[List[str]] = []
    mode: Optional[str] = "STAR"

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
        response = groq_client.completions.create(
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
# Helper 3: [자기소개서(Cover Letter) 전용] AI 동적 교정 및 컬럼 생성 함수 (프롬프트 강화)
# ------------------------------------------------------------------
import json

def run_coverletter_ai_proofread_llm(text: str, mode: str = "STAR") -> dict:
    if not text.strip():
        return {"ai_proofread_text": "", "ai_columns": []}

    mode_descriptions = {
        "STAR": "STAR 기법(Situation, Task, Action, Result) 흐름에 맞추어 항목을 나누어 작성",
        "IMPACT": "핵심 과제, 개선 및 기여도, 정량적 성과(Impact)를 중심으로 강력하게 어필",
        "TECH": "사용 기술, 기술적 난관(Troubleshooting), 해결 및 성능 개선 과정 위주로 전문성 강조",
        "TONE": "역할 개요 및 주요 업무와 성과를 중심으로 프로페셔널한 비즈니스 문어체로 윤문"
    }

    mode_desc = mode_descriptions.get(mode, mode_descriptions["STAR"])

    prompt = f"""
    다음 자기소개서/프로젝트 카드 텍스트를 선택된 교정 모드("{mode}" - {mode_desc})에 맞추어 채용 담당자의 눈길을 사로잡는 매끄러운 문장으로 재작성해 주세요.

    [작성 지침]
    1. 완성형 경어체(~했습니다, ~구현했습니다 등)를 사용하세요.
    2. 원문의 핵심 키워드, 수치, 구조는 손실 없이 유지하세요.
    3. 이 텍스트의 특성과 내용을 가장 잘 담아낼 수 있는 맞춤형 분석 컬럼 이름들을 `ai_columns` 배열(예: 2~4개)로 직접 결정해 주세요.
    4. **매우 중요**: `ai_proofread_text` 본문 텍스트는 반드시 `ai_columns`에 정의한 각 컬럼 이름과 **정확히 일치하는 대괄호 태그 형식**으로 나누어 작성해 주세요. 
       (형식 예시: "[컬럼1이름]\\n내용...\\n\\n[컬럼2이름]\\n내용...")
    
    반드시 아래의 **JSON 형식**으로만 응답하세요. 다른 설명이나 인사말은 절대 포함하지 마세요.
    {{
      "ai_proofread_text": "[컬럼1]\\n내용...\\n\\n[컬럼2]\\n내용...",
      "ai_columns": ["컬럼1", "컬럼2"]
    }}

    [원문]
    {text}
    """

    try:
        response = groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": "너는 채용 트렌드를 꿰뚫고 있는 수석 자기소개서 컨설턴트이며, 반드시 JSON 형식으로만 응답하는 데이터 프로세서이다."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
        )
        content = response.choices[0].message.content.strip()
        
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()

        result_data = json.loads(content)
        return {
            "ai_proofread_text": result_data.get("ai_proofread_text", text),
            "ai_columns": result_data.get("ai_columns", [mode, "내용"])
        }
    except Exception as e:
        print(f"Groq API Call Error (CoverLetter Proofread Dynamic Mode {mode}): {e}")
        return {"ai_proofread_text": text, "ai_columns": [mode, "내용"]}


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
# Endpoint 2: 맞춤법 교정 (공통, 캐싱 적용)
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
# Endpoint 3-1: [이력서 전용] AI 교정 엔드포인트 (캐싱 적용)
# ------------------------------------------------------------------
@router.post("/{section_id}/resume-ai-proofread", response_model=List[AIProofreadResponseItem])
async def resume_ai_proofread_section(
    section_id: str,
    payload: SectionTextRequest,
    supabase: Client = Depends(get_supabase)
):
    cached_map = {}
    existing_columns = []
    try:
        db_res = supabase.table("document_sections") \
            .select("columns, ai_proofread_text") \
            .eq("id", section_id) \
            .execute()
        
        if db_res.data and len(db_res.data) > 0:
            section_data = db_res.data[0]
            existing_columns = section_data.get("columns", [])
            existing_list = section_data.get("ai_proofread_text")
            if isinstance(existing_list, list):
                for item in existing_list:
                    if isinstance(item, dict) and "id" in item and "ai_proofread_text" in item:
                        cached_map[item["id"]] = item["ai_proofread_text"]
    except Exception as e:
        print(f"Supabase Select Error: {e}")

    proofread_results = []
    has_new_llm_call = False

    for item in payload.details:
        existing_text = cached_map.get(item.id)
        if existing_text and existing_text.strip():
            ai_text = existing_text
        else:
            ai_text = run_resume_ai_proofread_llm(item.original_text)
            has_new_llm_call = True

        proofread_results.append({
            "id": item.id,
            "ai_proofread_text": ai_text,
            "ai_columns": existing_columns,
            "mode": "RESUME"
        })

    base_cols = existing_columns if existing_columns else ["항목", "내용"]
    target_ai_columns = base_cols + ["개선 및 성과"]

    if has_new_llm_call:
        try:
            update_payload = {
                "selected_version": "AI",
                "ai_proofread_text": proofread_results,
                "ai_columns": target_ai_columns
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
# Endpoint 3-2: [자기소개서 전용] 완벽한 모드별 캐싱 & 동적 컬럼 매칭 엔드포인트
# ------------------------------------------------------------------
# [자기소개서 전용] AI 교정 엔드포인트 수정 부분
@router.post("/{section_id}/coverletter-ai-proofread", response_model=List[AIProofreadResponseItem])
async def coverletter_ai_proofread_section(
    section_id: str,
    payload: SectionTextRequest,
    supabase: Client = Depends(get_supabase)
):
    current_mode = payload.mode if payload.mode else "STAR"

    # 1. DB에서 기존 모드 그룹 리스트 및 섹션 정보 조회
    existing_groups = []
    try:
        db_res = supabase.table("document_sections") \
            .select("ai_proofread_text, ai_columns") \
            .eq("id", section_id) \
            .execute()
        
        if db_res.data and len(db_res.data) > 0:
            section_data = db_res.data[0]
            raw_data = section_data.get("ai_proofread_text")
            if isinstance(raw_data, list):
                existing_groups = raw_data
    except Exception as e:
        print(f"Supabase Select Error: {e}")

    target_group = None
    for group in existing_groups:
        if isinstance(group, dict) and group.get("mode") == current_mode:
            target_group = group
            break

    requested_ids = [item.id for item in payload.details]
    cached_items_map = {}
    existing_group_columns = []

    if target_group:
        existing_group_columns = target_group.get("ai_columns", [])
        items_list = target_group.get("items", [])
        for it in items_list:
            if isinstance(it, dict) and "id" in it:
                cached_items_map[it["id"]] = it.get("ai_proofread_text", "")

    all_cached = len(requested_ids) > 0 and all(rid in cached_items_map and cached_items_map[rid].strip() for rid in requested_ids)

    # 이미 캐시가 완벽히 존재할 때도, 섹션 테이블의 ai_columns가 최신 상태로 동기화되도록 보장
    resolved_columns = existing_group_columns
    if all_cached and resolved_columns:
        # 캐시 데이터로 바로 응답하더라도 DB의 ai_columns 업데이트를 위해 아래 로직 태우기 혹은 바로 업데이트
        pass

    new_items_list = []
    has_new_llm_call = False

    for item in payload.details:
        existing_text = cached_items_map.get(item.id)

        if existing_text and existing_text.strip():
            ai_text = existing_text
        else:
            ai_response = run_coverletter_ai_proofread_llm(item.original_text, mode=current_mode)
            ai_text = ai_response["ai_proofread_text"]
            if ai_response["ai_columns"]:
                resolved_columns = ai_response["ai_columns"]
            has_new_llm_call = True

        new_items_list.append({
            "id": item.id,
            "ai_proofread_text": ai_text
        })

    if not resolved_columns:
        resolved_columns = [current_mode, "내용"]

    # 모드별 그룹 구조 갱신
    updated_groups = []
    group_found = False
    for group in existing_groups:
        if isinstance(group, dict) and group.get("mode") == current_mode:
            updated_groups.append({
                "mode": current_mode,
                "ai_columns": resolved_columns,
                "items": new_items_list
            })
            group_found = True
        else:
            updated_groups.append(group)

    if not group_found:
        updated_groups.append({
            "mode": current_mode,
            "ai_columns": resolved_columns,
            "items": new_items_list
        })

    # 💡 [핵심] DB 업데이트 시 ai_proofread_text 뿐만 아니라, 섹션 레벨의 ai_columns 컬럼에 현재 모드의 열 구조를 대입합니다!
    try:
        update_payload = {
            "selected_version": "AI",
            "ai_proofread_text": updated_groups,
            "ai_columns": resolved_columns  # 👈 이 부분이 빠져있어 프론트가 스타일(컬럼)을 못 읽던 문제를 해결합니다.
        }
        supabase.table("document_sections") \
            .update(update_payload) \
            .eq("id", section_id) \
            .execute()
    except Exception as e:
        print(f"Supabase Update Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"DB 저장 오류: {str(e)}"
        )

    response_items = []
    for it in new_items_list:
        response_items.append(AIProofreadResponseItem(
            id=it["id"],
            ai_proofread_text=it["ai_proofread_text"],
            ai_columns=resolved_columns,
            mode=current_mode
        ))

    return response_items


