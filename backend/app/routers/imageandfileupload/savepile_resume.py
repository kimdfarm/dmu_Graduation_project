import json
import re
import ast
import time
import uuid
from typing import Optional
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, status
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
    PRIMARY_MODEL = "allam-2-7b"
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
        
        raw_details = (
            sec.get("details") or 
            sec.get("items") or 
            sec.get("contents") or 
            []
        )
        if isinstance(raw_details, dict):
            raw_details = [raw_details]

        normalized_details = []
        global_ai_columns = []

        for d_idx, item in enumerate(raw_details):
            if isinstance(item, dict):
                card_id = str(item.get("id") or f"card_{idx + 1}_{d_idx + 1}")
                item_title = str(item.get("title") or item.get("name") or "항목").strip()
                
                # 새로운 구조 수용: ai_columns와 column_values 처리
                ai_columns = item.get("ai_columns") or sec.get("ai_columns") or ["컬럼1", "컬럼2"]
                column_values = item.get("column_values") or {}

                for col in ai_columns:
                    if col not in global_ai_columns:
                        global_ai_columns.append(col)

                # 기존 호환용 ai_proofread_text(문자열 조합) 생성
                formatted_text_parts = []
                for col in ai_columns:
                    val = column_values.get(col, "")
                    formatted_text_parts.append(f"[{col}]\n{val}")
                
                structured_text = "\n\n".join(formatted_text_parts)

                if structured_text.strip():
                    normalized_details.append({
                        "id": card_id,
                        "title": item_title,
                        "original_text": structured_text.strip(),
                        "ai_columns": ai_columns,
                        "column_values": column_values
                    })

        if normalized_details:
            normalized_sections.append({
                "section_type": str(section_type),
                "section_title": str(section_title).strip(),
                "display_order": idx + 1,
                "columns": global_ai_columns if global_ai_columns else ["컬럼1", "컬럼2"],
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

    truncated_text = cleaned_text[:]
    safe_raw_text = truncated_text.replace("{", "{{").replace("}", "}}")

    # 사용자 요구사항에 맞춘 새로운 JSON Output Schema 프롬프트 적용
    SYSTEM_PROMPT = f"""You are an ultra-comprehensive document parsing engine.

[작성 지침]
1. 이 텍스트에 가장 잘 어울리는 분석 컬럼들(예: 프로젝트명, 기간, 역할, 사용 기술, 상세 내용 등)을 선정하세요.
2. 각 컬럼별로 작성된 내용을 아래의 **JSON 딕셔너리 형식**으로만 매핑하여 응답하세요.
3. 절대 오타나 원문을 임의로 요약·누락하지 말고 충실히 반영하세요.

반드시 아래의 **JSON 형식**으로만 응답하세요. 다른 설명이나 인사말은 절대 포함하지 마세요.
{{
  "doc_type": "RESUME",
  "sections": [
    {
      "section_type": "CAREER",
      "section_title": "경력 및 프로젝트",
      "display_order": 1,
      "details": [
        {
          "id": "card_1",
          "title": "프로젝트 제목",
          "ai_columns": ["컬럼1", "컬럼2", "컬럼3"],
          "column_values": {{
            "컬럼1": "해당 컬럼에 들어갈 내용...",
            "컬럼2": "해당 컬럼에 들어갈 내용..."
          }}
        }
      ]
    }
  ]
}}"""

    target_models = get_available_groq_models(groq_client)
    last_error = None

    for model_name in target_models:
        try:
            print(f"[Groq Attempting Model]: {model_name}")
            response = groq_client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Parse all data dynamically from this text into the requested JSON schema:\n\n{safe_raw_text}"}
                ],
                temperature=0.1,  
                max_tokens=4096,
                response_format={"type": "json_object"}
            )

            raw_content = response.choices[0].message.content or ""
            clean_json_str = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_content.strip(), flags=re.MULTILINE)

            if clean_json_str:
                parsed = safe_json_parse(clean_json_str)
                normalized_result = normalize_resume_data(parsed)

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
                "columns": sec.get("columns", ["컬럼1", "컬럼2"]),
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