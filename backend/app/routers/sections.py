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
    mode: Optional[str] = "STAR"

class SpellCheckResponseItem(BaseModel):
    id: str
    spell_checked_text: str

class AIProofreadResponseItem(BaseModel):
    id: str
    ai_proofread_text: str
    ai_columns: Optional[List[str]] = []
    column_values: Optional[Dict[str, str]] = {}
    mode: Optional[str] = "STAR"

class UpdateVersionRequest(BaseModel):
    selected_version: str
    ai_style: Optional[str] = None

import json

# ------------------------------------------------------------------
# Helper 1: 기존 섹션 컬럼과 AI 모드 권장 컬럼을 결합하여 통일된 use_columns 도출
# ------------------------------------------------------------------
# ------------------------------------------------------------------
# Helper 1: 기존 섹션 컬럼과 AI 모드 권장 컬럼을 결합하여 통일된 use_columns 도출 (col_max 적용)
# ------------------------------------------------------------------
def derive_unified_columns_with_ai(mode: str, existing_columns: list, sample_texts: list, col_max: int = 6) -> list:
    mode_defaults = {
        "STAR": ["Situation", "Task", "Action", "Result"],
        "IMPACT": ["Core Challenge", "Implemented Solution", "Quantitative Impact"],
        "TECH": ["Technology Stack", "Technical Challenges", "Solution & Implementation", "Performance Improvements"],
        "TONE": ["Role", "Technologies", "Key Achievements"]
    }
    
    default_cols = mode_defaults.get(mode, ["지원 동기", "핵심 역량", "입사 후 포부"])
    
    combined_base = []
    for col in existing_columns:
        if col and col not in ["질문", "답변"] and col not in combined_base:
            combined_base.append(col)
            
    for col in default_cols:
        if col not in combined_base:
            combined_base.append(col)

    if not sample_texts:
        return combined_base[:col_max]

    prompt = f"""
    너는 전문 데이터 스키마 설계 및 자기소개서 컨설턴트이다.
    현재 '{mode}' 모드로 자기소개서 카드들을 AI 교정 및 재구성하려고 한다.
    
    1. 해당 모드 참고 권장 컬럼: {default_cols}
    2. 기존에 정의된 컬럼들: {existing_columns}
    3. 병합된 후보 컬럼 풀: {combined_base}
    4. 원문 샘플 텍스트: {sample_texts[:2]}
    
    위 정보들을 바탕으로, 이 섹션의 **모든 카드에 공통으로 적용할 가장 이상적이고 일관된 3~{col_max}개의 분석 컬럼 이름 목록(JSON 배열)**을 결정해 줘.
    반드시 아래의 **JSON 형식**으로만 응답하며, 다른 설명은 절대 포함하지 마세요.
    언어는 기존의 정의된 컬럼 언어로 통일하시오.
    {{
      "unified_columns": ["컬럼1", "컬럼2", "컬럼3"]
    }}
    """

    try:
        response = groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": "너는 오직 JSON 형식으로만 응답하는 데이터 스키마 프로세서이다."},
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
            
        result = json.loads(content)
        columns = result.get("unified_columns", [])
        if columns and isinstance(columns, list):
            # 반환된 컬럼도 col_max 개수만큼 안전하게 잘라줍니다.
            return columns[:col_max]
    except Exception as e:
        print(f"AI Column Unification Error: {e}")

    return combined_base[:col_max] if combined_base else default_cols[:col_max]

# ------------------------------------------------------------------
# Helper 2: 공통 맞춤법 교정
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
# Helper 3: [자기소개서 전용] N개 카드를 한 번에 일괄 교정 및 분할하는 함수
# ------------------------------------------------------------------
def run_batch_coverletter_ai_proofread_llm(details: list, mode: str = "STAR", target_columns: list = None) -> dict:
    if not details:
        return {}

    mode_descriptions = {
        "STAR": "STAR 기법(Situation, Task, Action, Result) 흐름에 맞추어 내용을 4개 단계로 나누어 작성",
        "IMPACT": "핵심 과제(Core Challenge), 해결 방법(Implemented Solution), 정량적 성과(Quantitative Impact)로 나누어 작성",
        "TECH": "사용 기술(Technology Stack), 기술적 난관(Technical Challenges), 해결 및 구현(Solution & Implementation), 성과 개선(Performance Improvements)으로 나누어 작성",
        "TONE": "역할(Role), 활용 기술(Technologies), 주요 성과(Key Achievements) 항목으로 나누어 작성"
    }

    mode_desc = mode_descriptions.get(mode, mode_descriptions["STAR"])
    
    # 💡 수정 포인트: 내부에서 다시 derive 함수를 부르지 않고, 엔드포인트에서 넘어온 target_columns를 메인으로 사용
    columns_to_use = target_columns if target_columns else ["지원 동기", "핵심 역량", "입사 후 포부"]

    cards_payload = [{"id": d.id, "original_text": d.original_text} for d in details]

    prompt = f"""
    너는 자기소개서 텍스트 분석 및 윤문 전문 컨설턴트이다.
    전달받은 여러 개의 자기소개서 카드(문항)들을 각각 "{mode}" 모드({mode_desc})에 맞추어 분석하고, **반드시 아래에 지정된 공통 컬럼들에 정확히 맞추어** 내용을 분할 및 요약해 주세요.

    [공통 지정 컬럼 목록]
    {columns_to_use}

    [작성 지침]
    1. 각 카드별로 'id'를 그대로 유지해야 합니다.
    2. 지정된 컬럼 목록을 각각의 키(Key)로 사용하여 내용을 적절히 분할하세요.
    3. 절대 모든 컬럼에 동일한 전체 원문 텍스트를 중복해서 넣지 마세요.
    4. 반드시 아래의 **JSON 배열 형식**으로만 응답하며, 마크다운 코드 블록(```)이나 다른 설명, 인사말은 절대 포함하지 마세요.

    [응답 JSON 형식 예시]
    [
      {{
        "id": "카드아이디1",
        "column_values": {{
          "{columns_to_use[0]}": "분할된 내용...",
          "{columns_to_use[1] if len(columns_to_use) > 1 else columns_to_use[0]}": "분할된 내용..."
        }}
      }}
    ]

    [입력 카드 데이터 목록]
    {json.dumps(cards_payload, ensure_ascii=False)}
    """

    results_map = {}
    try:
        response = groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": "너는 여러 개의 자소서 카드를 지정된 컬럼에 맞추어 일괄 처리하고 정확히 JSON 배열 형식으로만 반환하는 데이터 프로세서이다."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
        )
        content = response.choices[0].message.content.strip()
        
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()

        parsed_array = json.loads(content)
        if isinstance(parsed_array, list):
            for item in parsed_array:
                card_id = str(item.get("id"))
                raw_vals = item.get("column_values", {})
                
                normalized_vals = {}
                for col in columns_to_use:
                    val = raw_vals.get(col, "")
                    if not val:
                        for k, v in raw_vals.items():
                            if k.lower() == col.lower() or col.lower() in k.lower():
                                val = v
                                break
                    normalized_vals[col] = val

                formatted_parts = [f"[{col}]\n{normalized_vals.get(col, '')}" for col in columns_to_use]
                
                results_map[card_id] = {
                    "ai_proofread_text": "\n\n".join(formatted_parts),
                    "ai_columns": columns_to_use,
                    "column_values": normalized_vals
                }
    except Exception as e:
        print(f"Batch AI Proofread Error: {e}")

    # Fallback 처리 시 원문만 뱉지 않고 기본 컬럼 구조에 맞춰 안전하게 분배
    for d in details:
        c_id = str(d.id)
        if c_id not in results_map:
            fallback_vals = {col: (d.original_text if idx == 0 else "") for idx, col in enumerate(columns_to_use)}
            formatted_parts = [f"[{col}]\n{fallback_vals.get(col, '')}" for col in columns_to_use]
            results_map[c_id] = {
                "ai_proofread_text": "\n\n".join(formatted_parts),
                "ai_columns": columns_to_use,
                "column_values": fallback_vals
            }

    return results_map


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
# Endpoint 2: 맞춤법 교정
# ------------------------------------------------------------------
@router.post("/{section_id}/spell-check", response_model=List[AIProofreadResponseItem])
async def spell_check_section(
    section_id: str,
    payload: SectionTextRequest,
    supabase: Client = Depends(get_supabase)
):
    existing_columns = ["질문", "답변"]
    cached_map = {}
    try:
        db_res = supabase.table("document_sections") \
            .select("columns, spell_checked_text") \
            .eq("id", section_id) \
            .execute()
        
        if db_res.data and len(db_res.data) > 0:
            sec_data = db_res.data[0]
            existing_columns = sec_data.get("columns", []) or ["질문", "답변"]
            existing_list = sec_data.get("spell_checked_text")
            
            if isinstance(existing_list, list):
                for item in existing_list:
                    if isinstance(item, dict) and "id" in item:
                        cached_map[str(item["id"])] = item
    except Exception as e:
        print(f"Supabase Select Error (section_id: {section_id}): {e}")

    corrected_results = []

    for item in payload.details:
        item_id_str = str(item.id)
        cached_item = cached_map.get(item_id_str)
        
        if cached_item and (cached_item.get("spell_checked_text") or cached_item.get("column_values")):
            checked_text = cached_item.get("spell_checked_text", item.original_text)
            column_vals = cached_item.get("column_values", {})
            card_cols = cached_item.get("ai_columns", existing_columns)
        else:
            checked_text = run_spell_check_llm(item.original_text)
            
            column_vals = {}
            card_cols = list(existing_columns)
            
            import re
            regex = re.compile(r'\[(.*?)\]([\s\S]*?)(?=\[|$)')
            matches = regex.findall(item.original_text)
            
            if matches:
                card_cols = []
                for col_name, content in matches:
                    c_name = col_name.strip()
                    card_cols.append(c_name)
                    column_vals[c_name] = run_spell_check_llm(content.strip())
            else:
                target_col = card_cols[1] if len(card_cols) > 1 else card_cols[0]
                column_vals[target_col] = checked_text
                for c in card_cols:
                    if c != target_col:
                        column_vals[c] = ""

        corrected_results.append({
            "id": item.id,
            "spell_checked_text": checked_text,
            "ai_columns": card_cols,
            "column_values": column_vals,
            "mode": "SPELL"
        })

    try:
        update_payload = {
            "selected_version": "SPELL",
            "spell_checked_text": corrected_results
        }

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

    return [
        AIProofreadResponseItem(
            id=item["id"],
            ai_proofread_text=item["spell_checked_text"],
            ai_columns=item["ai_columns"],
            column_values=item["column_values"],
            mode="SPELL"
        )
        for item in corrected_results
    ]


def run_single_card_ai_proofread_llm(card_id: str, original_text: str, mode: str, target_columns: list) -> dict:
    mode_descriptions = {
        "STAR": "STAR 기법(Situation, Task, Action, Result) 흐름에 맞추어 내용 분류",
        "IMPACT": "핵심 과제(Core Challenge), 해결 방법(Implemented Solution), 정량적 성과(Quantitative Impact)로 내용 분류",
        "TECH": "사용 기술(Technology Stack), 기술적 난관(Technical Challenges), 해결 및 구현(Solution & Implementation), 성과 개선(Performance Improvements)으로 내용 분류",
        "TONE": "역할(Role), 활용 기술(Technologies), 주요 성과(Key Achievements) 항목으로 내용 분류"
    }
    mode_desc = mode_descriptions.get(mode, mode_descriptions["STAR"])

    # 💡 왜곡 방지 및 팩트 기반 추출을 강조한 프롬프트
    prompt = f"""
    너는 자기소개서 텍스트 분석 및 데이터 분류 전문 컨설턴트이다.
    전달받은 1개의 자기소개서 카드 내용을 "{mode}" 모드({mode_desc})에 맞추어 분석하되, **절대 내용을 임의로 창작, 과장, 혹은 왜곡해서는 안 된다.**

    [필수 원칙 (왜곡 방지)]
    1. **팩트 기반 분류:** 원문에 명시된 사실, 수치, 기술 명칭, 경험만을 바탕으로 지정된 컬럼에 나누어 담으세요. 원문에 없는 내용을 상상해서 채워 넣거나 미화(과장)하지 마십시오.
    2. **내용 누락 방지:** 원문에 있는 중요한 맥락이나 성과 수치가 임의로 누락되지 않도록 주의하세요.
    3. **중복 배정 금지:** 모든 컬럼에 동일한 전체 원문을 복사해서 넣지 말고, 각 컬럼의 의미에 맞는 내용만 정확히 발췌하세요. 만약 특정 컬럼에 해당하는 내용이 원문에 없다면 빈 문자열("")을 반환하세요.

    [공통 지정 컬럼 목록]
    {target_columns}

    [반환 형식]
    반드시 아래의 **JSON 형식**으로만 응답하며, 마크다운 코드 블록(```)이나 다른 설명, 인사말은 절대 포함하지 마세요.
    {{
      "column_values": {{
        "{target_columns[0]}": "원문에서 추출한 내용...",
        "{target_columns[1] if len(target_columns) > 1 else target_columns[0]}": "원문에서 추출한 내용..."
      }}
    }}

    [입력 원문 텍스트]
    {original_text}
    """

    normalized_vals = {col: "" for col in target_columns}
    try:
        response = groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": "너는 원문의 사실 관계를 절대 왜곡하지 않고 지정된 컬럼에 정확히 분류하는 데이터 프로세서이다."},
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

        parsed = json.loads(content)
        raw_vals = parsed.get("column_values", {})
        
        for col in target_columns:
            val = raw_vals.get(col, "")
            if not val:
                for k, v in raw_vals.items():
                    if k.lower() == col.lower() or col.lower() in k.lower():
                        val = v
                        break
            normalized_vals[col] = val

    except Exception as e:
        print(f"Single Card AI Proofread Error (id: {card_id}): {e}")
        if target_columns:
            normalized_vals[target_columns[0]] = original_text

    formatted_parts = [f"[{col}]\n{normalized_vals.get(col, '')}" for col in target_columns]
    
    return {
        "id": card_id,
        "ai_proofread_text": "\n\n".join(formatted_parts),
        "ai_columns": target_columns,
        "column_values": normalized_vals
    }
# ------------------------------------------------------------------
# Endpoint 3: [자기소개서 전용] 1번 고정된 컬럼 기반으로 개별 카드 순회 교정 엔드포인트
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

    sample_texts = [d.original_text for d in payload.details]
    existing_group_cols = target_group.get("ai_columns", []) if target_group else []
    combined_base_cols = list(set(base_sec_columns + existing_group_cols))
    
    # 💡 1. 컬럼 구조는 최초 1번만 창의적/동적으로 도출하여 고정값으로 사용
    use_columns = derive_unified_columns_with_ai(
        mode=current_style, 
        existing_columns=combined_base_cols, 
        sample_texts=sample_texts
    )

    cached_map = {}
    if target_group:
        items_list = target_group.get("items", [])
        if isinstance(items_list, list):
            for it in items_list:
                if isinstance(it, dict) and "id" in it:
                    cached_map[str(it["id"])] = it

    new_items_list = []

    # 💡 2. 일괄(Batch) 방식 대신, 카드 1개씩 반복(Loop)하며 고정된 use_columns에 맞추어 개별 처리
    for item in payload.details:
        item_id_str = str(item.id)
        
        # 캐시가 존재하고 컬럼 구조가 일치하면 그대로 사용
        if item_id_str in cached_map:
            cached_item = cached_map[item_id_str]
            old_vals = cached_item.get("column_values", {})
            normalized_cached_vals = {col: old_vals.get(col, "") for col in use_columns}
            
            new_items_list.append({
                "id": item.id,
                "ai_proofread_text": cached_item.get("ai_proofread_text", ""),
                "ai_columns": use_columns,
                "column_values": normalized_cached_vals
            })
            continue

        # 캐시에 없으면 카드 1개씩 단독 LLM 호출 (카드 간 간섭/혼동 방지)
        single_result = run_single_card_ai_proofread_llm(
            card_id=item.id,
            original_text=item.original_text,
            mode=current_style,
            target_columns=use_columns
        )
        
        new_items_list.append(single_result)

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


groq_client = Groq(api_key=GROQ_API_KEY)

# ------------------------------------------------------------------
# Request / Response Pydantic 스키마
# ------------------------------------------------------------------
class ResumeDetailItem(BaseModel):
    id: str
    original_text: str

class ResumeTextRequest(BaseModel):
    details: List[ResumeDetailItem]
    mode: Optional[str] = "PROJECT"
    col_max: Optional[int] = 5

class ResumeAIResponseItem(BaseModel):
    id: str
    ai_proofread_text: str
    ai_columns: Optional[List[str]] = []
    column_values: Optional[Dict[str, str]] = {}
    mode: Optional[str] = "PROJECT"

# ------------------------------------------------------------------
# 이력서 모드별 동적 컬럼 도출 Helper
# ------------------------------------------------------------------
def derive_resume_unified_columns_with_ai(mode: str, existing_columns: list, sample_texts: list, col_max: int = 5) -> list:
    mode_defaults = {
        "PROJECT": ["프로젝트명", "기간 및 인원", "서비스 개요", "담당 역할", "기술 스택"],
        "IMPACT": ["Core Challenge", "Implemented Solution", "Quantitative Impact", "Key Metric"],
        "TECH": ["Technology Stack", "Technical Challenges", "Architecture & Implementation", "Troubleshooting"],
        "COMP": ["Core Skills", "Key Experience", "Problem Solving", "Collaboration"]
    }
    
    default_cols = mode_defaults.get(mode, ["프로젝트명", "주요 역할", "사용 기술", "성과"])
    
    combined_base = []
    for col in existing_columns:
        if col and col not in ["질문", "답변"] and col not in combined_base:
            combined_base.append(col)
            
    for col in default_cols:
        if col not in combined_base:
            combined_base.append(col)

    if not sample_texts:
        return combined_base[:col_max]

    prompt = f"""
    너는 전문 데이터 스키마 설계 및 이력서(경력기술서) 컨설턴트이다.
    현재 '{mode}' 모드로 이력서 카드(프로젝트/경력 항목)들을 AI 교정 및 재구성하려고 한다.
    
    1. 해당 모드 참고 권장 컬럼: {default_cols}
    2. 기존에 정의된 컬럼들: {existing_columns}
    3. 병합된 후보 컬럼 풀: {combined_base}
    4. 원문 샘플 텍스트: {sample_texts[:2]}
    
    위 정보들을 바탕으로, 이 섹션의 **모든 이력서 카드에 공통으로 적용할 가장 이상적이고 일관된 3~{col_max}개의 분석 컬럼 이름 목록(JSON 배열)**을 결정해 줘.
    반드시 아래의 **JSON 형식**으로만 응답하며, 다른 설명은 절대 포함하지 마세요.
    언어는 기존의 정의된 컬럼 언어로 통일하시오.
    {{
      "unified_columns": ["컬럼1", "컬럼2", "컬럼3"]
    }}
    """

    try:
        response = groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": "너는 오직 JSON 형식으로만 응답하는 데이터 스키마 프로세서이다."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
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
            return columns[:col_max]
    except Exception as e:
        print(f"Resume AI Column Unification Error: {e}")

    return combined_base[:col_max] if combined_base else default_cols[:col_max]


# ------------------------------------------------------------------
# 단일 이력서 카드 개별 교정 헬퍼
# ------------------------------------------------------------------
def run_single_resume_card_ai_proofread_llm(card_id: str, original_text: str, mode: str, target_columns: list) -> dict:
    mode_descriptions = {
        "PROJECT": "프로젝트 중심형 (프로젝트명, 역할, 아키텍처, 기술 스택 중심으로 명확히 분할)",
        "IMPACT": "성과·지표 중심형 (핵심 과제, 해결 방법, 정량적 수치 성과 중심으로 분할)",
        "TECH": "기술 심층형 (기술적 난관, 트러블슈팅, 아키텍처 구현 방식으로 깊이 있게 분할)",
        "COMP": "직무 역량 매칭형 (보유 기술, 핵심 경험, 문제 해결 및 협업 능력으로 분할)"
    }
    mode_desc = mode_descriptions.get(mode, mode_descriptions["PROJECT"])

    # 💡 왜곡 및 과장 방지를 위한 엄격한 제약 지침 추가
    prompt = f"""
    너는 이력서 및 경력기술서 분석 전문 데이터 프로세서이다.
    전달받은 1개의 이력서 카드 원문을 "{mode}" 모드({mode_desc})에 맞추어 분석하되, **절대 내용을 임의로 창작, 과장, 윤문, 혹은 왜곡해서는 안 된다.**

    [필수 원칙 (정보 왜곡 및 누락 방지)]
    1. **오직 원문 기반 추출 (Extraction):** 원문에 명시된 사실, 기술명, 수치, 경험만을 바탕으로 지정된 컬럼에 나누어 담으세요. 원문에 없는 내용을 지어내거나 과장해서 미화하지 마십시오.
    2. **핵심 데이터 누락 금지:** 원문에 포함된 구체적인 수치(%, 명, 기간 등)나 핵심 기술 스택이 임의로 누락되거나 변형되지 않도록 주의하세요.
    3. **정확한 매핑:** 각 컬럼의 성격에 맞지 않는 내용을 억지로 채워 넣지 말고, 해당하는 내용이 원문에 없다면 해당 컬럼의 값은 빈 문자열("")로 두세요. 모든 컬럼에 전체 원문을 똑같이 복사해 넣지 마세요.

    [공통 지정 컬럼 목록]
    {target_columns}

    [반환 형식 지침]
    반드시 아래의 **JSON 형식**으로만 응답하며, 마크다운 코드 블록(```)이나 다른 설명, 인사말은 절대 포함하지 마세요.
    {{
      "column_values": {{
        "{target_columns[0]}": "원문에서 추출/분할된 내용...",
        "{target_columns[1] if len(target_columns) > 1 else target_columns[0]}": "원문에서 추출/분할된 내용..."
      }}
    }}

    [입력 원문 텍스트]
    {original_text}
    """

    normalized_vals = {col: "" for col in target_columns}
    try:
        response = groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": "너는 원문의 사실 관계를 절대 왜곡하거나 창작하지 않고 지정된 컬럼에 정확히 분류하는 엄격한 데이터 프로세서이다."},
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

        parsed = json.loads(content)
        raw_vals = parsed.get("column_values", {})
        
        for col in target_columns:
            val = raw_vals.get(col, "")
            if not val:
                for k, v in raw_vals.items():
                    if k.lower() == col.lower() or col.lower() in k.lower():
                        val = v
                        break
            normalized_vals[col] = val

    except Exception as e:
        print(f"Single Resume Card AI Proofread Error (id: {card_id}): {e}")
        if target_columns:
            normalized_vals[target_columns[0]] = original_text

    formatted_parts = [f"[{col}]\n{normalized_vals.get(col, '')}" for col in target_columns]
    
    return {
        "id": card_id,
        "ai_proofread_text": "\n\n".join(formatted_parts),
        "ai_columns": target_columns,
        "column_values": normalized_vals
    }
# ------------------------------------------------------------------
# 이력서 전용 AI 교정 엔드포인트 (모드별 그룹핑 저장 지원)
# ------------------------------------------------------------------
@router.post("/{section_id}/ai-proofread", response_model=List[ResumeAIResponseItem])
async def resume_ai_proofread_section(
    section_id: str,
    payload: ResumeTextRequest,
    supabase: Client = Depends(get_supabase)
):
    current_style = payload.mode if payload.mode else "PROJECT"
    col_max = payload.col_max if payload.col_max else 5

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

    sample_texts = [d.original_text for d in payload.details]
    existing_group_cols = target_group.get("ai_columns", []) if target_group else []
    combined_base_cols = list(set(base_sec_columns + existing_group_cols))
    
    use_columns = derive_resume_unified_columns_with_ai(
        mode=current_style, 
        existing_columns=combined_base_cols, 
        sample_texts=sample_texts,
        col_max=col_max
    )

    cached_map = {}
    if target_group:
        items_list = target_group.get("items", [])
        if isinstance(items_list, list):
            for it in items_list:
                if isinstance(it, dict) and "id" in it:
                    cached_map[str(it["id"])] = it

    new_items_list = []

    for item in payload.details:
        item_id_str = str(item.id)
        
        if item_id_str in cached_map:
            cached_item = cached_map[item_id_str]
            old_vals = cached_item.get("column_values", {})
            normalized_cached_vals = {col: old_vals.get(col, "") for col in use_columns}
            
            new_items_list.append({
                "id": item.id,
                "ai_proofread_text": cached_item.get("ai_proofread_text", ""),
                "ai_columns": use_columns,
                "column_values": normalized_cached_vals
            })
            continue

        single_result = run_single_resume_card_ai_proofread_llm(
            card_id=item.id,
            original_text=item.original_text,
            mode=current_style,
            target_columns=use_columns
        )
        
        new_items_list.append(single_result)

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
        response_items.append(ResumeAIResponseItem(
            id=it["id"],
            ai_proofread_text=it["ai_proofread_text"],
            ai_columns=use_columns,
            column_values=it.get("column_values", {}),
            mode=current_style
        ))

    return response_items