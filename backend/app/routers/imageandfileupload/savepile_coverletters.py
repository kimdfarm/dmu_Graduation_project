import re
from typing import Optional
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, status
from groq import Groq

from app.core.config import get_supabase, GROQ_API_KEY
from app.routers.imageandfileupload.file_parser import extract_text_from_file 
from app.routers.imageandfileupload.savepile_resume import  safe_json_parse, get_available_groq_models  

router = APIRouter(
    prefix="/api/cover-letters",
    tags=["Cover Letters"]
)

groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


def parse_cover_letter_with_groq(raw_text: str) -> dict:
    """Groq API를 호출하여 자기소개서 문항과 답변을 추출"""
    if not groq_client:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY가 설정되지 않았습니다.")

    SYSTEM_PROMPT = """You are an expert document parser specializing in cover letters (자기소개서).
Extract ALL questions and matching answers from the input cover letter text.

STRICT INSTRUCTIONS:
1. DO NOT fix, correct, or alter any typos or spelling errors. Preserve exact raw text.
2. Group the text into logical questions (문항/질문) and answer contents (답변/내용).

JSON Output Schema:
{
  "doc_type": "COVER_LETTER",
  "sections": [
    {
      "section_type": "QUESTION_ANSWER",
      "section_title": "지원 동기 및 포부",
      "display_order": 1,
      "columns": ["질문", "답변"],
      "details": [
        {
          "id": "card_1",
          "title": "지원 동기",
          "original_text": "[질문]\\n• 지원 동기 및 포부\\n\\n[답변]\\n• 작성 내용..."
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
                    {"role": "user", "content": f"Parse this cover letter:\n\n{raw_text}"}
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
        # 1. 파일 읽기 및 텍스트 추출 (실제 hwp/pdf/docx 지원 파서 활용)
        file_bytes = await file.read()
        raw_text = extract_text_from_file(file_bytes, file.filename)

        if not raw_text or not raw_text.strip():
            raise HTTPException(status_code=400, detail="파일에서 텍스트를 추출할 수 없습니다.")

        # 2. Groq LLM으로 문항 및 답변 파싱
        parsed_result = parse_cover_letter_with_groq(raw_text)

        # 3. Supabase documents 테이블 저장
        supabase = get_supabase()
        doc_payload = {
            "member_id": member_id,
            "title": title,
            "doc_type": "COVER_LETTER",
            "category": category
        }
        doc_res = supabase.table("documents").insert(doc_payload).execute()

        if not doc_res.data:
            raise HTTPException(status_code=500, detail="documents DB 저장 실패")

        created_document_id = doc_res.data[0]["id"]

        # 4. Supabase document_sections 테이블 저장
        sections_data = parsed_result.get("sections", [])
        sections_payload = []

        for idx, sec in enumerate(sections_data):
            sections_payload.append({
                "document_id": created_document_id,
                "section_type": sec.get("section_type", "QUESTION_ANSWER"),
                "section_title": sec.get("section_title", f"문항 {idx + 1}"),
                "display_order": idx + 1,
                "columns": sec.get("columns", ["질문", "답변"]),
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
        # 실패 시 DB 롤백 처리
        if created_document_id:
            try:
                get_supabase().table("documents").delete().eq("id", created_document_id).execute()
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"자기소개서 업로드 실패: {str(e)}")