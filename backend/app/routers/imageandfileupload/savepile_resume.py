import json
import re
import ast
import time
import uuid
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, status
from pydantic import BaseModel, Field
from groq import Groq

from app.core.config import get_supabase, GROQ_API_KEY
from .file_parser import extract_text_from_file

router = APIRouter(
    prefix="/api/resumes",
    tags=["resumes"]
)

groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

try:
    from json_repair import repair_json
except ImportError:
    repair_json = None


def extract_and_clean_json(text: str) -> str:
    if not text:
        return ""
    cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", text.strip())
    cleaned = re.sub(r"\n?```$", "", cleaned).strip()
    
    start_idx = cleaned.find('{')
    end_idx = cleaned.rfind('}')
    if start_idx != -1 and end_idx != -1 and start_idx < end_idx:
        return cleaned[start_idx:end_idx + 1]
    return cleaned


def safe_json_parse(json_str: str) -> dict:
    cleaned_str = extract_and_clean_json(json_str)

    if repair_json:
        try:
            return json.loads(repair_json(cleaned_str))
        except Exception:
            pass

    try:
        return json.loads(cleaned_str, strict=False)
    except json.JSONDecodeError:
        pass

    try:
        cleaned = re.sub(r',(\s*[}\]])', r'\1', cleaned_str)
        cleaned = re.sub(r'(?<!\\)[\r\n]+', r'\\n', cleaned)
        return json.loads(cleaned, strict=False)
    except json.JSONDecodeError:
        pass

    try:
        evaluated = ast.literal_eval(cleaned_str)
        if isinstance(evaluated, dict):
            return evaluated
    except (ValueError, SyntaxError):
        pass

    raise ValueError("LLM 응답 JSON 파싱 실패")


def get_available_groq_models(client) -> list:
    PRIMARY_MODEL = "openai/gpt-oss-120b"
    active_models = [PRIMARY_MODEL]

    try:
        models_data = client.models.list()
        EXCLUDE_PATTERNS = ["whisper", "vision", "guard", "embed", "compound", "allam"]

        for m in models_data.data:
            model_id = m.id
            model_id_lower = model_id.lower()
            is_active = getattr(m, "active", True)
            
            if is_active and model_id != PRIMARY_MODEL and not any(pat in model_id_lower for pat in EXCLUDE_PATTERNS):
                active_models.append(model_id)

        return active_models
    except Exception as e:
        print(f"[Groq Model List Fetch Error]: {e}")
        return [PRIMARY_MODEL]


# --- 1. Pydantic 스키마 정의 (섹션 레벨 ai_columns 강제 구조) ---
class ResumeDetail(BaseModel):
    id: str = Field(description="항목 ID (예: card_1)")
    title: str = Field(description="항목 또는 프로젝트 제목")
    column_values: Dict[str, str] = Field(description="섹션의 ai_columns 키들에 대응하는 실제 값 매핑 딕셔너리")

class ResumeSection(BaseModel):
    section_type: str = Field(description="섹션 유형 (예: PERSONAL, SKILLS, CAREER, EDUCATION, CERTIFICATION)")
    section_title: str = Field(description="섹션 제목 (예: 인적사항, 핵심 역량, 경력 및 프로젝트 등)")
    display_order: int = Field(description="표시 순서 (1부터 시작)")
    ai_columns: List[str] = Field(description="이 섹션의 모든 카드가 공통으로 공유할 컬럼 목록 (예: ['프로젝트명', '기간', '역할 및 기술', '상세 내용'])")
    details: List[ResumeDetail] = Field(description="해당 섹션에 속한 세부 카드 목록들")

class ResumeSchema(BaseModel):
    doc_type: str = Field(default="RESUME", description="문서 타입")
    sections: List[ResumeSection] = Field(description="이력서 섹션 목록")


def normalize_resume_data(parsed_dict: dict) -> dict:
    if not isinstance(parsed_dict, dict):
        return {"doc_type": "RESUME", "sections": []}

    raw_sections = parsed_dict.get("sections") or parsed_dict.get("data") or []
    if isinstance(raw_sections, dict):
        raw_sections = [raw_sections]

    normalized_sections = []

    for idx, sec in enumerate(raw_sections):
        if not isinstance(sec, dict):
            continue

        section_title = (
            sec.get("section_title") or 
            sec.get("category") or 
            sec.get("title") or 
            "세부 정보"
        )
        section_type = sec.get("section_type") or "CUSTOM"
        
        raw_details = sec.get("details") or sec.get("items") or sec.get("contents") or []
        if isinstance(raw_details, dict):
            raw_details = [raw_details]

        # 1. 섹션 내 카드들의 모든 column_values 키를 수집하여 유니온(Union) 대표 컬럼 생성
        section_ai_columns = sec.get("ai_columns") or []
        discovered_keys = []

        for item in raw_details:
            if isinstance(item, dict):
                vals = item.get("column_values") or {}
                for k in vals.keys():
                    if k not in discovered_keys:
                        discovered_keys.append(k)

        # 수집된 키가 있으면 그것을 대표 ai_columns로 채택 (데이터 손실 차단)
        if discovered_keys:
            section_ai_columns = discovered_keys
        elif not section_ai_columns:
            section_ai_columns = ["내용"]

        normalized_details = []

        for d_idx, item in enumerate(raw_details):
            if isinstance(item, dict):
                card_id = str(item.get("id") or f"card_{idx + 1}_{d_idx + 1}")
                item_title = str(item.get("title") or item.get("name") or f"항목 {d_idx + 1}").strip()
                
                incoming_values = item.get("column_values") or {}
                uniform_column_values = {}
                formatted_text_parts = []
                
                # 2. 섹션 컬럼에 정의된 키뿐만 아니라 incoming_values의 모든 데이터 보존
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

                # 단 하나라도 텍스트나 값이 남아있다면 무조건 결과 카드에 포함
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
        "doc_type": parsed_dict.get("doc_type", "RESUME"),
        "sections": normalized_sections
    }

def parse_resume_with_groq(raw_text: str, mode: str = "RESUME") -> dict:
    if not groq_client:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="서버에 GROQ_API_KEY가 설정되지 않았습니다."
        )

    cleaned_text = raw_text.strip() if raw_text else ""
    if len(cleaned_text) < 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="파일에서 읽을 수 있는 텍스트를 추출하지 못했습니다."
        )

    safe_raw_text = cleaned_text.replace("{", "{{").replace("}", "}}")

    # 프롬프트에 아키텍처 규칙을 명확히 주입하여 섹션 분리 및 공통 컬럼 구조 강제
    SYSTEM_PROMPT = """You are an expert resume parsing engine and career consultant.

ARCHITECTURE RULES & STRICT INSTRUCTIONS:
1. **Documents & Sections**: The resume is a single container. You must divide it into distinct logical **Sections** (`document_sections`).
2. **Language Matching (언어 일치)**: **All section titles (`section_title`) and column headers (`ai_columns`) must match the language of the source resume text.** If the source resume is written in English, generate column headers and section titles in English (e.g., "Project Name", "Period", "Role"). If it is in Korean, use Korean.
3. **Section-Level Unified Columns**: **Each Section must define its own unified `ai_columns` array at the section level.** All detail cards within that section **must share the exact same `ai_columns`**, acting like a uniform table where each card holds corresponding `column_values`.
4. **No Mixing**: Never mix unrelated categories or disparate column structures into the same section.
5. **Lossless Extraction (원문 유지)**: 절대 텍스트를 요약하거나, 다른 언어로 번역하거나, 임의로 수정하지 말고 원본 문장을 그대로 유지할 것. Do not summarize, translate, or alter the original text; extract and preserve sentences verbatim in their original language.
6. **JSON Output**: Output strictly valid JSON matching the requested schema without markdown block wrappers."""

    target_models = get_available_groq_models(groq_client)
    last_error = None

    for model_name in target_models:
        try:
            print(f"[Groq Attempting Model (Structured Section-based)]: {model_name}")
            
            response = groq_client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT + f"\n\nTarget JSON Schema structure:\n{ResumeSchema.model_json_schema()}"},
                    {"role": "user", "content": f"Parse all data dynamically from this text into the exact JSON schema:\n\n{safe_raw_text}"}
                ],
                temperature=0.1,  
                max_tokens=8192,  # <-- 이 부분을 추가하여 출력 한도를 늘려주세요.
                response_format={"type": "json_object"}
            )

            raw_content = response.choices[0].message.content or ""
            clean_json_str = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_content.strip(), flags=re.MULTILINE)

            if clean_json_str:
                parsed_dict = json.loads(clean_json_str)
                validated_data = ResumeSchema(**parsed_dict)
                normalized_result = normalize_resume_data(validated_data.model_dump())

                if len(normalized_result["sections"]) > 0:
                    print(f"[Success Parsing with Model]: {model_name}")
                    return normalized_result

        except Exception as e:
            print(f"[Model Retry Failed] {model_name} -> {e}")
            last_error = e
            time.sleep(0.5)
            continue

    raise HTTPException(
        status_code=500,
        detail=f"모든 유효 Groq 모델 파싱 실패: {str(last_error)}"
    )


@router.post("/upload")
async def upload_resume_file(
    member_id: str = Form(...),
    title: str = Form(...),
    category: str = Form(...),
    mode: Optional[str] = Form("RESUME"),
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

        parsed_result = parse_resume_with_groq(raw_text, mode=mode)

        doc_payload = {
            "member_id": member_id,
            "title": title,
            "doc_type": parsed_result.get("doc_type", "RESUME"),
            "category": category
        }
        supabase = get_supabase()
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
                "section_type": sec.get("section_type", "CUSTOM"),
                "section_title": sec.get("section_title", "세부 정보"),
                "display_order": sec.get("display_order", idx + 1),
                "columns": sec.get("columns", ["항목명", "내용"]),
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

        print(f"[Upload Error]: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"이력서 업로드 및 파싱 저장 실패: {str(e)}"
        )