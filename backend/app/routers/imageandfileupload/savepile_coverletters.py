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


def parse_cover_letter_with_groq(raw_text: str) -> dict:
    """문서 본문의 실제 키/헤더 구조를 제한 없이 동적으로 추출하도록 개선된 프롬프트"""
    if not groq_client:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY가 설정되지 않았습니다.")

    # 고정 예시를 모두 제거하고 완전히 동적인 추출을 유도
    SYSTEM_PROMPT = """You are an ultra-flexible document parser.
Analyze the input text, detect its structural sections, and extract information dynamically without enforcing predefined key names or fixed templates.

STRICT INSTRUCTIONS:
1. DO NOT fix, correct, or alter any typos or spelling errors. Preserve exact raw text.
2. DYNAMIC COLUMNS: Look at the text structure (e.g., key-value pairs, table headers, numbered lists, subheadings) and identify the column names (`columns`) purely based on the input context.
   - You can create 2, 3, 4, or any N number of columns depending on what exists in the text.
   - Do NOT force standard names like "질문" or "답변" if the text uses different labels or implicit structures.
3. MATCHING TAGS: In `original_text`, every extracted field MUST be wrapped with `[Column Name]` matching the exact items listed in `columns`.

JSON Output Schema:
{
  "doc_type": "COVER_LETTER",
  "sections": [
    {
      "section_type": "DYNAMIC_SECTION",
      "section_title": "Section title extracted from document",
      "display_order": 1,
      "columns": ["Extracted Key 1", "Extracted Key 2", "Extracted Key 3"],
      "details": [
        {
          "id": "card_1",
          "title": "Card Summary or Title",
          "original_text": "[Extracted Key 1]\nvalue1\n\n[Extracted Key 2]\nvalue2\n\n[Extracted Key 3]\nvalue3"
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
                    {"role": "user", "content": f"Parse this document dynamically and extract exact column labels:\n\n{raw_text}"}
                ],
                temperature=0.1,
                max_tokens=4096
            )
            raw_content = response.choices[0].message.content or ""
            clean_json_str = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_content.strip(), flags=re.MULTILINE)

            if clean_json_str:
                parsed = safe_json_parse(clean_json_str)
                if parsed.get("sections"):
                    return parsed
        except Exception as e:
            last_error = e
            continue

    raise HTTPException(status_code=500, detail=f"Groq 파싱 실패: {str(last_error)}")


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
            extracted_columns = sec.get("columns")
            # 컬럼이 완전히 비어서 오는 경우에만 파싱 불량 대비 기본 2칸 처리
            if not extracted_columns or not isinstance(extracted_columns, list):
                extracted_columns = ["항목", "내용"]

            sections_payload.append({
                "document_id": created_document_id,
                "section_type": sec.get("section_type", "DYNAMIC_SECTION"),
                "section_title": sec.get("section_title", f"섹션 {idx + 1}"),
                "display_order": idx + 1,
                "columns": extracted_columns,
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