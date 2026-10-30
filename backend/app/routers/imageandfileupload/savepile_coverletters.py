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


# 💡 1. column_values 딕셔너리를 [컬럼명]\n내용 형태의 문자열로 변환하는 정제 함수
def format_text_from_column_values(ai_columns: list, column_values: dict) -> str:
    if not ai_columns or not column_values:
        return ""
    
    formatted_blocks = []
    for col in ai_columns:
        val = column_values.get(col, "")
        if val:
            formatted_blocks.append(f"[{col}]\n{val}")
            
    return "\n\n".join(formatted_blocks)


# 💡 2. 자소서 데이터를 다중 섹션 & 동적 컬럼(ai_columns, column_values) 구조로 정제하는 함수
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
        
        raw_details = sec.get("details") or sec.get("items") or []
        if isinstance(raw_details, dict):
            raw_details = [raw_details]

        normalized_details = []
        global_ai_columns = []

        for d_idx, item in enumerate(raw_details):
            if isinstance(item, dict):
                card_id = str(item.get("id") or f"card_{idx + 1}_{d_idx + 1}")
                item_title = str(item.get("title") or item.get("name") or "항목").strip()
                
                ai_columns = item.get("ai_columns") or sec.get("ai_columns") or ["컬럼1", "컬럼2"]
                column_values = item.get("column_values") or {}

                for c in ai_columns:
                    if c not in global_ai_columns:
                        global_ai_columns.append(c)

                structured_text = format_text_from_column_values(ai_columns, column_values)

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
        "doc_type": parsed_dict.get("doc_type", "COVER_LETTER"),
        "sections": normalized_sections
    }


# 💡 3. 요청하신 출력 구조 프롬프트 및 JSON Output Schema를 적용한 Groq 파싱 함수
# 💡 3. 파일의 원본 구조 및 문항 형태를 자율적으로 분석해 파싱하는 Groq 함수
def parse_cover_letter_with_groq(raw_text: str) -> dict:
    if not groq_client:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY가 설정되지 않았습니다.")

    # ✅ STAR 같은 고정 모드 대신, 파일의 실제 구조를 자율적으로 분석하도록 프롬프트 변경
    SYSTEM_PROMPT = """You are an ultra-flexible document parsing engine and expert cover letter consultant specialized in professional Korean resumes and cover letters.

    CRITICAL GOALS:
    1. DYNAMIC COLUMNS: Do NOT limit columns to generic headers like ["질문/항목", "내용"]. Analyze the text content and define custom, professional column headers matching the text's natural structure (e.g., ["핵심 경험", "문제 해결", "성과 및 임팩트"] or ["Situation", "Task", "Action", "Result"] or any relevant custom headers).
    2. TAG FORMAT: Wrap each distinct extracted section/field in `ai_proofread_text` using matching bracket tags like `[Column Name]\nContent...`.
    3. PROFESSIONAL REWRITE: Rewrite the text into smooth, professional, and impactful business prose matching the requested style/mode ("{mode}"). Keep all key numbers, keywords, and technical terms intact.
반드시 아래의 **JSON 형식**으로만 응답하세요. 다른 설명이나 인사말은 절대 포함하지 마세요.
{
  "doc_type": "COVER_LETTER",
  "sections": [
    {
      "section_type": "CUSTOM_SECTION",
      "section_title": "문항 또는 섹션 제목",
      "display_order": 1,
      "details": [
        {
          "id": "card_1",
          "title": "세부 항목 제목 또는 소제목",
          "ai_columns": ["컬럼1", "컬럼2", "컬럼3"],
          "column_values": {
            "컬럼1": "해당 컬럼에 대응하는 내용...",
            "컬럼2": "해당 컬럼에 대응하는 내용..."
          }
        }
      ]
    }
  ]
}"""

    target_models = get_available_groq_models(groq_client)
    last_error = None

    for model_name in target_models:
        try:
            response = groq_client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Analyze this document's natural structure and parse it into JSON:\n\n{raw_text}"}
                ],
                temperature=0.1,
                max_tokens=4096,
                response_format={"type": "json_object"}
            )
            raw_content = response.choices[0].message.content or ""
            clean_json_str = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_content.strip(), flags=re.MULTILINE)

            if clean_json_str:
                parsed = safe_json_parse(clean_json_str)
                normalized = normalize_cover_letter_data(parsed)
                if normalized.get("sections"):
                    return normalized
        except Exception as e:
            last_error = e
            continue

    raise HTTPException(status_code=500, detail=f"Groq 파싱 실패: {str(last_error)}")

# 💡 4. 업로드 라우터 수정 (mode 파라미터 추가 반영)
# 💡 4. 업로드 라우터 (파일 구조 자율 분석 반영)
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

        # 파일의 고유 구조를 스스로 분석하여 파싱
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
                "columns": sec.get("columns", ["컬럼1", "컬럼2"]),
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