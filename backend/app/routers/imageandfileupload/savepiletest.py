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
    try:
        models_data = client.models.list()
        active_models = []
        EXCLUDE_PATTERNS = ["whisper", "vision", "guard", "embed", "compound", "allam"]

        for m in models_data.data:
            model_id = m.id
            model_id_lower = model_id.lower()
            is_active = getattr(m, "active", True)
            
            if is_active and not any(pat in model_id_lower for pat in EXCLUDE_PATTERNS):
                active_models.append(model_id)

        active_models.sort(key=lambda x: (
            0 if "llama" in x.lower() else (1 if "gemma" in x.lower() else 2)
        ))
        return active_models
    except Exception as e:
        print(f"[Groq Model List Fetch Error]: {e}")
        return []


def split_text_by_columns(raw_text: str, columns: list, card_title: str = "") -> str:
    """
    하나의 텍스트 덩어리 안에 있는 [태그] 들을 파싱하여,
    프론트엔드가 파싱할 수 있는 [컬럼명]\\n• 내용 형태의 규격 문자열로 자동 개편합니다.
    """
    if not raw_text or not columns:
        return raw_text

    # 1. 텍스트 내에서 [컬럼명] 패턴 분할 (앞에 불릿 '•' 또는 '프로젝트명' 등 텍스트가 섞인 경우 정단)
    cleaned_text = re.sub(r'^[•\s\-\*]+\s*', '', raw_text.strip())
    
    # [태그] 기준으로 분할하기 위한 정규식
    tag_pattern = r'\[([^\]]+)\]'
    matches = list(re.finditer(tag_pattern, cleaned_text))

    col_data = {col: [] for col in columns}

    if not matches:
        # 태그가 아예 없는 경우 첫 번째 컬럼에 배치
        lines = [line.strip() for line in cleaned_text.split('\n') if line.strip()]
        for line in lines:
            line_content = re.sub(r'^[•\s\-\*]+\s*', '', line)
            if line_content:
                col_data[columns[0]].append(f"• {line_content}")
    else:
        # 첫 번째 태그 전까지의 텍스트 처리
        first_match_start = matches[0].start()
        header_text = cleaned_text[:first_match_start].strip()
        
        first_col = columns[0]
        if card_title and card_title != "항목":
            col_data[first_col].append(f"• {card_title}")
        elif header_text:
            lines = [l.strip() for l in header_text.split('\n') if l.strip()]
            for l in lines:
                l_content = re.sub(r'^[•\s\-\*]+\s*', '', l)
                if l_content:
                    col_data[first_col].append(f"• {l_content}")

        # 태그별 내용 추출 및 배치
        for i, match in enumerate(matches):
            tag_name = match.group(1).strip()
            start_pos = match.end()
            end_pos = matches[i + 1].start() if i + 1 < len(matches) else len(cleaned_text)
            
            content_block = cleaned_text[start_pos:end_pos].strip()
            
            # 컬럼명 매칭 (완전 일치 또는 부분 일치)
            target_col = None
            for col in columns:
                if col == tag_name or col in tag_name or tag_name in col:
                    target_col = col
                    break
            
            if not target_col:
                target_col = columns[-1]  # 매칭 실패 시 마지막 컬럼(상세 내용 등)에 입력

            lines = [l.strip() for l in content_block.split('\n') if l.strip()]
            for l in lines:
                l_content = re.sub(r'^[•\s\-\*]+\s*', '', l)
                if l_content and not l_content.startswith('['):
                    col_data[target_col].append(f"• {l_content}")

    # 2. columns 순서대로 [컬럼명]\n• 내용1\n• 내용2 형태 문자열 조립
    formatted_blocks = []
    for col in columns:
        items = col_data.get(col, [])
        if items:
            block = f"[{col}]\n" + "\n".join(items)
            formatted_blocks.append(block)

    return "\n\n".join(formatted_blocks)


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
        
        # 각 섹션 종류별 기본 columns 설정
        default_cols = ["항목", "상세내용"]
        if "경력" in section_title or "프로젝트" in section_title:
            default_cols = ["프로젝트명", "기간", "역할/포지션", "상세 내용"]
        elif "학력" in section_title:
            default_cols = ["학교명", "기간", "전공/학위", "주요 이수/비고"]
        elif "자격증" in section_title or "기타" in section_title:
            default_cols = ["자격증명", "취득 연도", "비고"]

        columns = sec.get("columns") or default_cols

        raw_details = (
            sec.get("details") or 
            sec.get("items") or 
            sec.get("contents") or 
            []
        )
        if isinstance(raw_details, dict):
            raw_details = [raw_details]

        normalized_details = []
        for d_idx, item in enumerate(raw_details):
            if isinstance(item, dict):
                card_id = str(item.get("id") or f"card_{idx + 1}_{d_idx + 1}")
                item_title = str(item.get("title") or item.get("name") or "항목").strip()
                
                raw_orig = item.get("original_text") or item.get("content") or ""
                
                # 핵심: 텍스트를 columns 구조에 맞게 자동 분해하여 파싱
                structured_text = split_text_by_columns(str(raw_orig), columns, item_title)

                if structured_text.strip():
                    normalized_details.append({
                        "id": card_id,
                        "title": item_title,
                        "original_text": structured_text.strip(),
                        "spell_checked_text": item.get("spell_checked_text"),
                        "ai_proofread_text": item.get("ai_proofread_text"),
                        "selected_version": item.get("selected_version", "ORIGINAL")
                    })
            elif isinstance(item, str) and item.strip():
                structured_text = split_text_by_columns(item, columns)
                normalized_details.append({
                    "id": f"card_{idx + 1}_{d_idx + 1}",
                    "title": "상세 내용",
                    "original_text": structured_text,
                    "spell_checked_text": None,
                    "ai_proofread_text": None,
                    "selected_version": "ORIGINAL"
                })

        if normalized_details:
            normalized_sections.append({
                "section_type": str(section_type),
                "section_title": str(section_title).strip(),
                "display_order": idx + 1,
                "columns": columns,
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

    truncated_text = cleaned_text[:4000]
    safe_raw_text = truncated_text.replace("{", "{{").replace("}", "}}")

    SYSTEM_PROMPT = """You are an expert resume parsing engine.
Extract ALL information into separate columns defined in "columns".

Schema rules:
1. "columns" define exact column headers for each section.
   - For Projects/Career: ["프로젝트명", "기간", "역할/포지션", "상세 내용"]
   - For Education: ["학교명", "기간", "전공/학위", "주요 이수/비고"]
   - For Certification: ["자격증명", "취득 연도", "비고"]
2. In "original_text", DO NOT write bullet points BEFORE "[ColumnName]".
   MUST write EXACTLY like this:

[프로젝트명]
• 프로젝트 이름

[기간]
• 2026.05 - 2026.06

[역할/포지션]
• 개인 자동화 프로젝트

[상세 내용]
• 상세 업무 1
• 상세 업무 2

JSON Format:
{
  "doc_type": "RESUME",
  "sections": [
    {
      "section_type": "CAREER",
      "section_title": "경력 및 프로젝트",
      "display_order": 1,
      "columns": ["프로젝트명", "기간", "역할/포지션", "상세 내용"],
      "details": [
        {
          "id": "card_1",
          "title": "프로젝트명",
          "original_text": "[프로젝트명]\\n• 지원 시스템\\n\\n[기간]\\n• 2026.05 - 2026.06\\n\\n[역할/포지션]\\n• 개인 개발\\n\\n[상세 내용]\\n• 기능 구현",
          "selected_version": "ORIGINAL"
        }
      ]
    }
  ]
}
Return raw JSON without markdown."""

    target_models = get_available_groq_models(groq_client)
    last_error = None

    for model_name in target_models:
        try:
            print(f"[Groq Attempting Model]: {model_name}")
            response = groq_client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Parse this resume:\n\n{safe_raw_text}"}
                ],
                temperature=0.1,
                max_tokens=3000
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