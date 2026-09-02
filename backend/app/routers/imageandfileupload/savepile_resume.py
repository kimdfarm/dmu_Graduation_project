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


def split_text_by_columns(raw_text: str, columns: list, card_title: str = "") -> tuple[str, list]:
    if not raw_text:
        return raw_text, columns or ["항목", "상세내용"]

    cleaned_text = re.sub(r'^[•\s\-\*]+\s*', '', raw_text.strip())
    tag_pattern = r'\[([^\]]+)\]'
    matches = list(re.finditer(tag_pattern, cleaned_text))

    final_columns = list(columns) if columns else []
    for match in matches:
        tag_name = match.group(1).strip()
        if tag_name not in final_columns:
            final_columns.append(tag_name)

    if not final_columns:
        final_columns = ["항목", "상세내용"]

    col_data = {col: [] for col in final_columns}
    norm_columns = [c.strip().lower() for c in final_columns]

    if not matches:
        lines = [line.strip() for line in cleaned_text.split('\n') if line.strip()]
        for line in lines:
            line_content = re.sub(r'^[•\s\-\*]+\s*', '', line)
            if line_content and line_content.strip().lower() not in norm_columns:
                col_data[final_columns[0]].append(f"• {line_content}")
    else:
        first_match_start = matches[0].start()
        header_text = cleaned_text[:first_match_start].strip()
        
        first_col = final_columns[0]
        if header_text:
            lines = [l.strip() for l in header_text.split('\n') if l.strip()]
            for l in lines:
                l_content = re.sub(r'^[•\s\-\*]+\s*', '', l)
                if l_content and l_content.strip().lower() not in norm_columns:
                    col_data[first_col].append(f"• {l_content}")

        for i, match in enumerate(matches):
            tag_name = match.group(1).strip()
            start_pos = match.end()
            end_pos = matches[i + 1].start() if i + 1 < len(matches) else len(cleaned_text)
            
            content_block = cleaned_text[start_pos:end_pos].strip()
            
            target_col = None
            for col in final_columns:
                if col.lower() == tag_name.lower():
                    target_col = col
                    break
            
            if not target_col:
                target_col = final_columns[-1]

            lines = [l.strip() for l in content_block.split('\n') if l.strip()]
            for l in lines:
                l_content = re.sub(r'^[•\s\-\*]+\s*', '', l)
                if (
                    l_content 
                    and not l_content.startswith('[') 
                    and l_content.strip().lower() != tag_name.lower()
                    and l_content.strip().lower() not in norm_columns
                ):
                    col_data[target_col].append(f"• {l_content}")

    formatted_blocks = []
    for col in final_columns:
        items = col_data.get(col, [])
        if items:
            block = f"[{col}]\n" + "\n".join(items)
            formatted_blocks.append(block)

    return "\n\n".join(formatted_blocks), final_columns


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
        columns = sec.get("columns") or []

        raw_details = (
            sec.get("details") or 
            sec.get("items") or 
            sec.get("contents") or 
            []
        )
        if isinstance(raw_details, dict):
            raw_details = [raw_details]

        normalized_details = []
        all_updated_columns = list(columns)

        for d_idx, item in enumerate(raw_details):
            if isinstance(item, dict):
                card_id = str(item.get("id") or f"card_{idx + 1}_{d_idx + 1}")
                item_title = str(item.get("title") or item.get("name") or "항목").strip()
                raw_orig = item.get("original_text") or item.get("content") or ""
                
                structured_text, updated_cols = split_text_by_columns(str(raw_orig), all_updated_columns, item_title)
                
                for c in updated_cols:
                    if c not in all_updated_columns:
                        all_updated_columns.append(c)

                if structured_text.strip():
                    # 교정 필드 제거 및 순수 원문만 유지
                    normalized_details.append({
                        "id": card_id,
                        "title": item_title,
                        "original_text": structured_text.strip()
                    })
            elif isinstance(item, str) and item.strip():
                structured_text, updated_cols = split_text_by_columns(item, all_updated_columns)
                for c in updated_cols:
                    if c not in all_updated_columns:
                        all_updated_columns.append(c)

                normalized_details.append({
                    "id": f"card_{idx + 1}_{d_idx + 1}",
                    "title": "상세 내용",
                    "original_text": structured_text
                })

        if normalized_details:
            normalized_sections.append({
                "section_type": str(section_type),
                "section_title": str(section_title).strip(),
                "display_order": idx + 1,
                "columns": all_updated_columns if all_updated_columns else ["항목", "상세내용"],
                "details": normalized_details
            })

    return {
        "doc_type": parsed_dict.get("doc_type", "RESUME"),
        "sections": normalized_sections
    }


def parse_resume_with_groq(raw_text: str) -> dict:
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

    # 프롬프트 명시: 맞춤법/오타 수정 절대 금지 지침 추가
    SYSTEM_PROMPT = """You are an ultra-comprehensive document parsing engine.
CRITICAL GOAL: Extract 100% of ALL information from the input document exactly as written without discarding, omitting, correcting, or summarizing ANY detail.

STRICT INSTRUCTION REGARDING SPELLING/TYPOS:
- DO NOT fix, correct, or alter any typos, spelling errors, or grammatical mistakes in the original text.
- Preserve the EXACT raw words and character sequences as provided in the input text.

Rules for Dynamic Column Generation:
1. DO NOT restrict yourself to a fixed list of column names.
2. Analyze each item/entry in the document and DYNAMICALLY define appropriate "columns" for each section.
3. In "original_text", format EVERY extracted field with its matching tag like `[컬럼명]`.

JSON Output Schema:
{
  "doc_type": "RESUME",
  "sections": [
    {
      "section_type": "CAREER",
      "section_title": "경력 및 프로젝트",
      "display_order": 1,
      "columns": ["프로젝트명", "기간", "역할/포지션", "사용 기술", "상세 내용"],
      "details": [
        {
          "id": "card_1",
          "title": "스마트 이력서 시스템",
          "original_text": "[프로젝트명]\\n• 스마트 이력서 시스템\\n\\n[기간]\\n• 2026.05 - 2026.06\\n\\n[역할/포지션]\\n• 개발자\\n\\n[사용 기술]\\n• Python\\n\\n[상세 내용]\\n• 기능 구현"
        }
      ]
    }
  ]
}
Return raw JSON without markdown formatting."""

    target_models = get_available_groq_models(groq_client)
    last_error = None

    for model_name in target_models:
        try:
            print(f"[Groq Attempting Model]: {model_name}")
            response = groq_client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Parse all data dynamically from this text without modifying any original text:\n\n{safe_raw_text}"}
                ],
                temperature=0.1,  
                max_tokens=4096
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

        parsed_result = parse_resume_with_groq(raw_text)

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
                "columns": sec.get("columns", ["항목", "내용"]),
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