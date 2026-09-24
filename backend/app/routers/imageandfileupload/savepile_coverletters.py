import re
from typing import Optional
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, status
from groq import Groq

from app.core.config import get_supabase, GROQ_API_KEY
from app.routers.imageandfileupload.file_parser import extract_text_from_file 
from app.routers.imageandfileupload.savepile_resume import safe_json_parse, get_available_groq_models  

router = APIRouter(
    prefix="/api/cover-letters",
    tags=["Cover Letters"]
)

groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


# 💡 1. [태그] 기반 동적 컬럼 추출 및 정제 함수 (이력서 동일 로직)
def split_text_by_columns(raw_text: str, columns: list, card_title: str = "") -> tuple[str, list]:
    if not raw_text:
        return raw_text, columns or ["질문/항목", "작성 내용"]

    cleaned_text = re.sub(r'^[•\s\-\*]+\s*', '', raw_text.strip())
    tag_pattern = r'\[([^\]]+)\]'
    matches = list(re.finditer(tag_pattern, cleaned_text))

    final_columns = list(columns) if columns else []
    for match in matches:
        tag_name = match.group(1).strip()
        if tag_name not in final_columns:
            final_columns.append(tag_name)

    if not final_columns:
        final_columns = ["질문/항목", "작성 내용"]

    col_data = {col: [] for col in final_columns}
    norm_columns = [c.strip().lower() for c in final_columns]

    if not matches:
        lines = [line.strip() for line in cleaned_text.split('\n') if line.strip()]
        for line in lines:
            line_content = re.sub(r'^[•\s\-\*]+\s*', '', line)
            if line_content and line_content.strip().lower() not in norm_columns:
                col_data[final_columns[0]].append(f"• {line_content}")
    else:
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


# 💡 2. 자소서 데이터를 다중 섹션 & 동적 컬럼으로 정제하는 함수
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

        section_title = sec.get("section_title") or sec.get("title") or f"자소서 문항 {idx + 1}"
        section_type = sec.get("section_type") or "DYNAMIC_SECTION"
        columns = sec.get("columns") or []

        raw_details = sec.get("details") or sec.get("items") or []
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
                    normalized_details.append({
                        "id": card_id,
                        "title": item_title,
                        "original_text": structured_text.strip()
                    })

        if normalized_details:
            normalized_sections.append({
                "section_type": str(section_type),
                "section_title": str(section_title).strip(),
                "display_order": idx + 1,
                "columns": all_updated_columns if all_updated_columns else ["질문/항목", "작성 내용"],
                "details": normalized_details
            })

    return {
        "doc_type": parsed_dict.get("doc_type", "COVER_LETTER"),
        "sections": normalized_sections
    }


# 💡 3. LLM 프롬프트 다중 섹션/다중 컬럼 허용으로 개편
def parse_cover_letter_with_groq(raw_text: str) -> dict:
    if not groq_client:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY가 설정되지 않았습니다.")

    SYSTEM_PROMPT = """You are an ultra-flexible document parsing engine specialized in cover letters.

CRITICAL GOALS:
1. MULTIPLE SECTIONS: Separate EACH distinct question/topic into its OWN section in the `sections` array.
2. DYNAMIC COLUMNS: Do NOT limit columns to ["질문/항목", "내용"]. Define custom column headers matching the text (e.g. ["질문 내용", "핵심 경험", "입사 후 포부"] or any relevant headers).
3. TAG FORMAT: Wrap extracted fields in `original_text` using matching bracket tags like `[Column Name]`.

JSON Output Schema Example:
{
  "doc_type": "COVER_LETTER",
  "sections": [
    {
      "section_type": "MOTIVATION",
      "section_title": "1. 지원 동기 및 포부",
      "display_order": 1,
      "columns": ["지원 이유", "달성 목표"],
      "details": [
        {
          "id": "card_1",
          "title": "지원 동기",
          "original_text": "[지원 이유]\n• 백엔드 개발자 성장 목표\n\n[달성 목표]\n• 시스템 최적화 기여"
        }
      ]
    },
    {
      "section_type": "PROJECT",
      "section_title": "2. 주요 프로젝트 및 성과",
      "display_order": 2,
      "columns": ["프로젝트명", "수행 역할", "성과"],
      "details": [
        {
          "id": "card_2",
          "title": "프로젝트 경험",
          "original_text": "[프로젝트명]\n• AI 자소서 파서\n\n[수행 역할]\n• 백엔드 구축\n\n[성과]\n• 속도 개선"
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
            response = groq_client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Parse this cover letter dynamically into multiple sections and dynamic columns:\n\n{raw_text}"}
                ],
                temperature=0.1,
                max_tokens=4096
            )
            raw_content = response.choices[0].message.content or ""
            clean_json_str = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_content.strip(), flags=re.MULTILINE)

            if clean_json_str:
                parsed = safe_json_parse(clean_json_str)
                # 💡 정제 로직 실행
                normalized = normalize_cover_letter_data(parsed)
                if normalized.get("sections"):
                    return normalized
        except Exception as e:
            last_error = e
            continue

    raise HTTPException(status_code=500, detail=f"Groq 파싱 실패: {str(last_error)}")


# 💡 4. 업로드 라우터 수정 (정제 함수 사용)
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
            raise HTTPException(status_code=400, detail="파일에서 텍스트를 추출할 수 없습니다.")

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
            raise HTTPException(status_code=500, detail="documents DB 저장 실패")

        created_document_id = doc_res.data[0]["id"]

        sections_data = parsed_result.get("sections", [])
        sections_payload = []

        for idx, sec in enumerate(sections_data):
            sections_payload.append({
                "document_id": created_document_id,
                "section_type": sec.get("section_type", "DYNAMIC_SECTION"),
                "section_title": sec.get("section_title", f"문항 {idx + 1}"),
                "display_order": sec.get("display_order", idx + 1),
                "columns": sec.get("columns", ["질문/항목", "작성 내용"]),
                "details": sec.get("details", [])
            })

        if sections_payload:
            supabase.table("document_sections").insert(sections_payload).execute()

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
                get_supabase().table("documents").delete().eq("id", created_document_id).execute()
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"업로드 실패: {str(e)}")