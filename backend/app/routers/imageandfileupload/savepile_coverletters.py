import json
import re
import ast
import time
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, status
from pydantic import BaseModel, Field
from groq import Groq

from app.core.config import get_supabase, GROQ_API_KEY
from app.routers.imageandfileupload.file_parser import extract_text_from_file 
from app.routers.imageandfileupload.savepile_resume import safe_json_parse, get_available_groq_models  

router = APIRouter(
    prefix="/api/cover-letters",
    tags=["Cover Letters"]
)

groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


# 💡 1. Pydantic 스키마 정의
class CoverLetterDetail(BaseModel):
    id: str = Field(description="항목 ID (예: card_1, card_2)")
    title: str = Field(description="세부 항목 또는 프로젝트 제목")
    column_values: Dict[str, str] = Field(description="섹션의 ai_columns 키들에 대응하는 실제 값 매핑 딕셔너리 (질문 반복 금지)")

class CoverLetterSection(BaseModel):
    section_type: str = Field(description="섹션 유형 (예: HEADER, COVER_LETTER_SECTION, PROJECT)")
    section_title: str = Field(description="문항의 주제 또는 질문 제목 (예: 기본 정보, 1. 지원동기 및 포부, 2. 주요 프로젝트 및 성과)")
    display_order: int = Field(description="표시 순서 (1부터 시작)")
    ai_columns: List[str] = Field(description="이 섹션의 카드가 공통으로 공유할 컬럼 목록 (예: 서술형은 ['내용'], 프로젝트는 ['구현 내용', '사용 기술'])")
    details: List[CoverLetterDetail] = Field(description="해당 섹션에 속한 세부 내용 및 카드 목록들")

class CoverLetterSchema(BaseModel):
    doc_type: str = Field(default="COVER_LETTER", description="문서 타입")
    sections: List[CoverLetterSection] = Field(description="자기소개서 섹션 목록")


# 💡 2. 데이터 정제 및 동적 컬럼 매핑 함수
def normalize_cover_letter_data(parsed_dict: dict) -> dict:
    if not isinstance(parsed_dict, dict):
        return {"doc_type": "COVER_LETTER", "sections": []}

    raw_sections = parsed_dict.get("sections") or parsed_dict.get("data") or []
    if isinstance(raw_sections, dict):
        raw_sections = [raw_sections]

    normalized_sections = []

    for idx, sec in enumerate(raw_sections):
        if not isinstance(sec, dict):
            continue

        section_title = (
            sec.get("section_title") or 
            sec.get("title") or 
            f"자소서 문항 {idx + 1}"
        )
        section_type = sec.get("section_type") or "DYNAMIC_SECTION"
        
        raw_details = sec.get("details") or sec.get("items") or sec.get("contents") or []
        if isinstance(raw_details, dict):
            raw_details = [raw_details]

        section_ai_columns = sec.get("ai_columns") or []
        discovered_keys = []

        for item in raw_details:
            if isinstance(item, dict):
                vals = item.get("column_values") or {}
                for k in vals.keys():
                    if k not in discovered_keys:
                        discovered_keys.append(k)

        if discovered_keys:
            section_ai_columns = discovered_keys
        elif not section_ai_columns:
            section_ai_columns = ["내용"]

        normalized_details = []

        for d_idx, item in enumerate(raw_details):
            if isinstance(item, dict):
                card_id = str(item.get("id") or f"card_{idx + 1}_{d_idx + 1}")
                item_title = str(item.get("title") or item.get("name") or "").strip()
                
                incoming_values = item.get("column_values") or {}
                uniform_column_values = {}
                formatted_text_parts = []
                
                all_item_keys = list(section_ai_columns)
                for k in incoming_values.keys():
                    if k not in all_item_keys:
                        all_item_keys.append(k)

                for col in all_item_keys:
                    val = str(incoming_values.get(col, "")).strip()
                    if val:
                        uniform_column_values[col] = val
                        formatted_text_parts.append(f"[{col}]\n{val}")
                
                structured_text = "\n\n".join(formatted_text_parts)

                if uniform_column_values or structured_text.strip():
                    normalized_details.append({
                        "id": card_id,
                        "title": item_title,
                        "original_text": structured_text.strip(),
                        "ai_columns": list(uniform_column_values.keys()),
                        "column_values": uniform_column_values
                    })

        if normalized_details:
            normalized_sections.append({
                "section_type": str(section_type),
                "section_title": str(section_title).strip(),
                "display_order": idx + 1,
                "columns": section_ai_columns,
                "details": normalized_details
            })

    return {
        "doc_type": parsed_dict.get("doc_type", "COVER_LETTER"),
        "sections": normalized_sections
    }


# 💡 3. Groq 파싱 함수 (주제와 내용 분리 아키텍처 적용)
def parse_cover_letter_with_groq(raw_text: str) -> dict:
    if not groq_client:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="서버에 GROQ_API_KEY가 설정되지 않았습니다."
        )

    cleaned_text = raw_text.strip() if raw_text else ""
    if len(cleaned_text) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="파일에서 읽을 수 있는 텍스트를 추출하지 못했습니다."
        )

    safe_raw_text = cleaned_text.replace("{", "{{").replace("}", "}}")

    SYSTEM_PROMPT = """You are an expert cover letter parsing engine and career consultant.

ARCHITECTURE RULES & STRICT INSTRUCTIONS:
1. **Topic-Content Separation (주제와 내용 분리)**:
   - The overarching topic or question heading MUST be placed strictly in `section_title`.
   - **DO NOT create a redundant question column or repeat the section title inside `details` or `column_values`.** The `section_title` already acts as the topic.
2. **Proper Column & Card Structuring**:
   - **For Header / Profile Section**: Group profile attributes into a single card where `ai_columns` are attributes and `column_values` hold their values.
   - **For Essay / Motivation Questions**: Do not split unnecessarily. Use a single card with a clean column like `["내용"]` (or `["Content"]` if English) containing the verbatim answer text.
   - **For Project / Multi-item Sections**: If there are distinct sub-items, split them into separate detail cards (`details`) where each card's `title` is the sub-item name, and columns represent details.
3. **Language Matching (언어 일치)**: **All section titles (`section_title`) and column headers (`ai_columns`) must match the language of the source cover letter text.** If the source text is written in English, generate column headers and section titles in English. If it is in Korean, use Korean.
4. **Lossless Extraction (원문 유지)**: Do not summarize, translate, or alter the original text; extract and preserve sentences verbatim in their original language[cite: 2].
5. **JSON Output**: Output strictly valid JSON matching the requested schema without markdown block wrappers."""
    target_models = get_available_groq_models(groq_client)
    last_error = None

    for model_name in target_models:
        try:
            response = groq_client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT + f"\n\nTarget JSON Schema structure:\n{CoverLetterSchema.model_json_schema()}"},
                    {"role": "user", "content": f"Parse all data dynamically from this cover letter text into the exact JSON schema:\n\n{safe_raw_text}"}
                ],
                temperature=0.1,  
                max_tokens=8192,  
                response_format={"type": "json_object"}
            )

            raw_content = response.choices[0].message.content or ""
            clean_json_str = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_content.strip(), flags=re.MULTILINE)

            if clean_json_str:
                parsed_dict = json.loads(clean_json_str)
                validated_data = CoverLetterSchema(**parsed_dict)
                normalized_result = normalize_cover_letter_data(validated_data.model_dump())

                if len(normalized_result["sections"]) > 0:
                    return normalized_result

        except Exception as e:
            last_error = e
            time.sleep(0.5)
            continue

    raise HTTPException(
        status_code=500,
        detail=f"모든 유효 Groq 모델 파싱 실패: {str(last_error)}"
    )


# 💡 4. 업로드 라우터
@router.post("/upload")
async def upload_cover_letter_file(
    member_id: str = Form(...),
    title: str = Form(...),
    category: str = Form("자기소개서"),
    file: UploadFile = File(...)
):
    created_document_id = None

    try:
        file_bytes = await file.read()
        raw_text = extract_text_from_file(file_bytes, file.filename)

        if not raw_text or not raw_text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="파일에서 텍스트를 추출할 수 없습니다."
            )

        parsed_result = parse_cover_letter_with_groq(raw_text)

        supabase = get_supabase()
        doc_payload = {
            "member_id": member_id,
            "title": title,
            "doc_type": parsed_result.get("doc_type", "COVER_LETTER"),
            "category": category
        }
        doc_res = supabase.table("documents").insert(doc_payload).execute()

        if not doc_res.data:
            raise HTTPException(status_code=500, detail="documents 테이블 저장에 실패하였습니다.")

        created_document_id = doc_res.data[0]["id"]

        sections_data = parsed_result.get("sections", [])
        sections_payload = []

        for idx, sec in enumerate(sections_data):
            if not isinstance(sec, dict):
                continue
                
            sections_payload.append({
                "document_id": created_document_id,
                "section_type": sec.get("section_type", "DYNAMIC_SECTION"),
                "section_title": sec.get("section_title", f"문항 {idx + 1}"),
                "display_order": sec.get("display_order", idx + 1),
                "columns": sec.get("columns", ["내용"]),
                "details": sec.get("details", [])
            })

        if sections_payload:
            sec_res = supabase.table("document_sections").insert(sections_payload).execute()
            if not sec_res.data:
                raise HTTPException(status_code=500, detail="document_sections 테이블 저장에 실패하였습니다.")

        return {
            "status": "success",
            "id": created_document_id,
            "title": title,
            "category": category,
            "section_count": len(sections_payload)
        }

    except Exception as e:
        if created_document_id:
            try:
                supabase = get_supabase()
                supabase.table("documents").delete().eq("id", created_document_id).execute()
            except Exception as rollback_err:
                print(f"[Rollback Failed]: {rollback_err}")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"자기소개서 업로드 및 파싱 저장 실패: {str(e)}"
        )