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
    column_values: Optional[Dict[str, str]] = {}  # 💡 컬럼별 매핑 데이터를 위한 필드 추가
    mode: Optional[str] = "STAR"

class UpdateVersionRequest(BaseModel):
    selected_version: str  # 'ORIGINAL', 'SPELL', 'AI' 중 하나
    ai_style: Optional[str] = None  # 💡 ai_style 필드 추가

import json

# 💡 [추가] AI를 소환하여 기존 컬럼과 모드 기본 컬럼을 분석하고 최적의 통일된 use_columns를 추천받는 함수
def derive_unified_columns_with_ai(mode: str, existing_columns: list, sample_texts: list) -> list:
    default_mode_columns = {
        "STAR": ["Situation", "Task", "Action", "Result"],
        "IMPACT": ["Core Challenge", "Implemented Solution", "Quantitative Impact"],
        "TECH": ["Technology Stack", "Technical Challenges", "Solution & Implementation", "Performance Improvements"],
        "TONE": ["Role", "Technologies", "Key Achievements"]
    }
    
    mode_defaults = default_mode_columns.get(mode, ["항목", "내용"])
    
    # 결합할 대상이 없다면 모드 기본값 반환
    if not existing_columns and not sample_texts:
        return mode_defaults

    prompt = f"""
    너는 전문 데이터 스키마 설계 및 자기소개서 컨설턴트이다.
    현재 '{mode}' 모드로 자기소개서 카드들을 AI 교정하려고 한다.
    
    1. 해당 모드의 기본 권장 컬럼: {mode_defaults}
    2. 이전에 사용되었던 기존 컬럼들: {existing_columns}
    3. 카드들의 원문 샘플: {sample_texts[:2]}
    
    위 정보들을 종합하여, 이 섹션의 모든 카드에 공통으로 적용할 **가장 이상적이고 일관된 3~4개의 분석 컬럼 이름 목록(JSON 배열)**을 결정해 줘.
    반드시 아래의 **JSON 형식**으로만 응답하며, 다른 설명은 절대 포함하지 마세요.
    {{
      "unified_columns": ["컬럼1", "컬럼2", "컬럼3"]
    }}
    """

    try:
        response = groq_client.chat.completions.create(
            model="qwen/qwen3.8-27b",
            messages=[
                {"role": "system", "content": "너는 오직 JSON 형식으로만 응답하는 데이터 스키마 프로세서이다."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
            
        result = json.loads(content)
        columns = result.get("unified_columns", [])
        if columns and isinstance(columns, list):
            return columns
    except Exception as e:
        print(f"AI Column Unification Error: {e}")

    # 실패 시 기본값과 기존 컬럼 병합 폴백
    merged = list(mode_defaults)
    for col in existing_columns:
        if col not in merged and col not in ["질문", "답변"]:
            merged.append(col)
    return merged

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
            model="qwen/qwen3.8-27b",
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
            model="qwen/qwen3.8-27b",
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
# Helper 3: [자기소개서(Cover Letter) 전용] AI 동적 교정 및 컬럼 생성 함수 (요청하신 방식 적용)
# ------------------------------------------------------------------
import json

# 수정 후 (target_columns 파라미터 추가 및 프롬프트 반영)
def run_coverletter_ai_proofread_llm(text: str, mode: str = "STAR", target_columns: list = None) -> dict:
    if not text.strip():
        return {"ai_proofread_text": "", "ai_columns": [], "column_values": {}}

    mode_descriptions = {
        "STAR": "STAR 기법(Situation, Task, Action, Result) 흐름에 맞추어 항목을 나누어 작성",
        "IMPACT": "핵심 과제, 개선 및 기여도, 정량적 성과(Impact)를 중심으로 강력하게 어필",
        "TECH": "사용 기술, 기술적 난관(Troubleshooting), 해결 및 성능 개선 과정 위주로 전문성 강조",
        "TONE": "역할 개요 및 주요 업무와 성과를 중심으로 프로페셔널한 비즈니스 문어체로 윤문"
    }

    mode_desc = mode_descriptions.get(mode, mode_descriptions["STAR"])
    cols_hint = f"지정된 컬럼 목록: {target_columns}" if target_columns else "텍스트 내용에 맞는 개수와 이름"

    prompt = f"""
    다음 자기소개서/프로젝트 카드 텍스트를 "{mode}" 모드({mode_desc})에 맞추어 전문적인 문장으로 재작성해 주세요.

    [작성 지침]
    1. 분석 컬럼은 다음을 참고하여 선정하세요: {cols_hint}
    2. 각 컬럼별로 작성된 내용을 아래의 **JSON 딕셔너리 형식**으로만 매핑하여 응답하세요.
    
    반드시 아래의 **JSON 형식**으로만 응답하세요. 다른 설명이나 인사말은 절대 포함하지 마세요.
    {{
      "ai_columns": {target_columns if target_columns else '["컬럼1", "컬럼2", "컬럼3"]'},
      "column_values": {{
        "컬럼1": "해당 컬럼에 들어갈 내용...",
        "컬럼2": "해당 컬럼에 들어갈 내용..."
      }}
    }}

    [원문]
    {text}
    """

    try:
        response = groq_client.chat.completions.create(
            model="qwen/qwen3.8-27b",
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
        ai_columns = result_data.get("ai_columns", target_columns if target_columns else [])
        column_values = result_data.get("column_values", {})

        formatted_text_parts = []
        for col in ai_columns:
            val = column_values.get(col, "")
            formatted_text_parts.append(f"[{col}]\n{val}")
        
        ai_proofread_text = "\n\n".join(formatted_text_parts)

        return {
            "ai_proofread_text": ai_proofread_text,
            "ai_columns": ai_columns,
            "column_values": column_values
        }
    except Exception as e:
        print(f"Groq API Call Error (CoverLetter Proofread Dynamic Mode {mode}): {e}")
        return {"ai_proofread_text": text, "ai_columns": target_columns if target_columns else [mode, "내용"], "column_values": {mode: text}}

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
        update_data = {"selected_version": payload.selected_version}
        
        if payload.ai_style:
            update_data["ai_style"] = payload.ai_style

        res = supabase.table("document_sections") \
            .update(update_data) \
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
            "column_values": {},
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
# Endpoint 3-2: [자기소개서 전용] 동적 컬럼 매칭 및 캐싱 엔드포인트
# ------------------------------------------------------------------
@router.post("/{section_id}/coverletter-ai-proofread", response_model=List[AIProofreadResponseItem])
async def coverletter_ai_proofread_section(
    section_id: str,
    payload: SectionTextRequest,
    supabase: Client = Depends(get_supabase)
):
    current_style = payload.mode if payload.mode else "STAR"

    existing_groups = []
    base_sec_columns = []
    try:
        db_res = supabase.table("document_sections") \
            .select("columns, ai_proofread_text, ai_style") \
            .eq("id", section_id) \
            .execute()
        
        if db_res.data and len(db_res.data) > 0:
            section_data = db_res.data[0]
            base_sec_columns = section_data.get("columns", []) or []
            raw_data = section_data.get("ai_proofread_text")
            if isinstance(raw_data, list):
                existing_groups = raw_data
    except Exception as e:
        print(f"Supabase Select Error: {e}")

    target_group = None
    for group in existing_groups:
        if isinstance(group, dict) and group.get("mode") == current_style:
            target_group = group
            break

    # 💡 [핵심] AI를 먼저 소환하여 기본 모드 컬럼과 기존 컬럼을 지능적으로 결합·추천받기
    sample_texts = [d.original_text for d in payload.details]
    existing_group_cols = target_group.get("ai_columns", []) if target_group else []
    combined_base_cols = list(set(base_sec_columns + existing_group_cols))
    
    use_columns = derive_unified_columns_with_ai(
        mode=current_style, 
        existing_columns=combined_base_cols, 
        sample_texts=sample_texts
    )

    # id 기반 캐시 맵 생성
    cached_map = {}
    if target_group:
        items_list = target_group.get("items", [])
        if isinstance(items_list, list):
            for it in items_list:
                if isinstance(it, dict) and "id" in it:
                    cached_map[str(it["id"])] = it

    new_items_list = []

    # 각 카드별 처리 (AI가 확정한 공통 use_columns 주입)
    for item in payload.details:
        item_id_str = str(item.id)
        
        if item_id_str in cached_map:
            cached_item = cached_map[item_id_str]
            new_items_list.append({
                "id": item.id,
                "ai_proofread_text": cached_item.get("ai_proofread_text", ""),
                "column_values": cached_item.get("column_values", {})
            })
        else:
            ai_response = run_coverletter_ai_proofread_llm(
                item.original_text, 
                mode=current_style, 
                target_columns=use_columns
            )
            new_items_list.append({
                "id": item.id,
                "ai_proofread_text": ai_response["ai_proofread_text"],
                "column_values": ai_response["column_values"]
            })

    # DB 저장
    updated_groups = [g for g in existing_groups if isinstance(g, dict) and g.get("mode") != current_style]
    updated_groups.append({
        "mode": current_style,
        "ai_columns": use_columns,
        "items": new_items_list
    })

    try:
        update_payload = {
            "selected_version": "AI",
            "ai_style": current_style,
            "ai_proofread_text": updated_groups
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
            ai_columns=use_columns,
            column_values=it.get("column_values", {}),
            mode=current_style
        ))

    return response_items