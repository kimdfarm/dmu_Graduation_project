import json
from typing import Optional
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, status
from groq import Groq, RateLimitError, AuthenticationError, APIError

# 설정 파일에서 Supabase 클라이언트 및 GROQ Key 로드
from app.core.config import get_supabase, GROQ_API_KEY

# 동일 디렉토리 내 file_parser.py에서 상대 경로로 임포트
from .file_parser import extract_text_from_file

router = APIRouter(
    prefix="/api/resumes",
    tags=["resumes"]
)

# Groq 클라이언트 초기화
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


# ------------------------------------------------------------------
# UI 친화적 한글 구조화 프롬프트 템플릿 (수정됨)
# ------------------------------------------------------------------
PROMPT_TEMPLATE = """
너는 한국어 이력서 전문 파싱 AI다.
제시된 이력서 원문(Raw Text)을 분석하여 UI 편집기 및 상세 페이지와 100% 호환되는 구조화된 JSON으로 분해해라.

[원문 텍스트]
{raw_text}

[핵심 규칙 - 절대 준수]
1. **원문 100% 유지 (Zero Modification)**: 원문에 존재하는 맞춤법 오류, 오탈자, 비문, 띄어쓰기 실수, 특수문자 등을 절대로 수정/교정/다듬지 마라.
2. **누락·요약 완전 금지 (Zero Omission)**: 원문의 모든 내용을 생략 없이 전부 JSON에 담아라.
3. **columns 정의**: 각 섹션마다 추출된 속성명들을 순서대로 담은 `columns` 문자열 배열을 반드시 생성해라 (예: ["담당 역할", "참여 기간", "프로젝트명", "상세 업무 및 성과"]).
4. **original_text 규칙**: details의 각 카드 항목은 반드시 `original_text` 필드를 포함해야 한다.
   - `original_text` 내부에는 각 속성을 `[속성명]\n• 내용1\n• 내용2` 형태의 텍스트 블록으로 만들고, 각 속성 블록 사이는 `\n\n` (줄바꿈 2번)으로 구분해라.
5. **title 규칙**: `title` 필드에는 대표 제목/역할/프로젝트명 등의 식별 문자열을 지정해라.

[JSON Schema 예시]
{{
  "doc_type": "RESUME",
  "sections": [
    {{
      "section_type": "EXPERIENCE",
      "section_title": "경력 및 주요 프로젝트",
      "display_order": 1,
      "columns": ["담당 역할", "참여 기간", "프로젝트명", "상세 업무 및 성과"],
      "details": [
        {{
          "id": "card_1",
          "title": "AI 백엔드 개발자 (FastAPI 백엔드 담당)",
          "original_text": "[담당 역할]\n• AI 백엔드 개발자 (FastAPI 백엔드 담당)\n\n[참여 기간]\n• 2026.03 - 진행중\n\n[프로젝트명]\n• 수능의 추억으로 MZ의 눈길어 다가갈러는 서비스 프로젝트 (졸업작품)\n\n[상세 업무 및 성과]\n• FastAPI 백엔드 개발: 졸업작품 ai앱 쓸러고 백엔드 연동 및 비동기 파이프라인 구성했음\n• AI 모델 연결: 문항 추천 및 대화 모델 서빙 처리, Latency 단축 작업 진행했음",
          "selected_version": "ORIGINAL"
        }}
      ]
    }},
    {{
      "section_type": "SKILLS",
      "section_title": "기술 스택",
      "display_order": 2,
      "columns": ["언어", "자동화 툴", "AI / 비전 모델", "백엔드 / 모바일"],
      "details": [
        {{
          "id": "card_1",
          "title": "기술 스택 전체",
          "original_text": "[언어]\n• 파이썬(Python)\n• 코틀린(Kotlin)\n\n[자동화 툴]\n• n8n\n• Zapier\n\n[AI / 비전 모델]\n• PyTorch\n• TensorFlow\n\n[백엔드 / 모바일]\n• FastAPI\n• REST API",
          "selected_version": "ORIGINAL"
        }}
      ]
    }}
  ]
}}
"""


def parse_resume_with_groq(raw_text: str) -> dict:
    if not groq_client:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="서버에 GROQ_API_KEY가 설정되지 않았습니다."
        )

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a JSON-only response generator specialized in Korean resumes."},
                {"role": "user", "content": PROMPT_TEMPLATE.format(raw_text=raw_text)}
            ],
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)

    except RateLimitError:
        raise HTTPException(status_code=429, detail="API 키 사용량이 모두 소진되었습니다.")
    except AuthenticationError:
        raise HTTPException(status_code=401, detail="API 키가 만료되었습니다.")
    except APIError as e:
        raise HTTPException(status_code=502, detail=f"Groq API 서비스 통신 에러: {str(e)}")


@router.post("/upload")
async def upload_resume_file(
    member_id: str = Form(...),
    title: str = Form(...),
    category: str = Form(...),
    file: UploadFile = File(...)
):
    created_document_id = None

    try:
        # Step 1: 파일 읽기 및 텍스트 추출
        file_bytes = await file.read()
        raw_text = extract_text_from_file(file_bytes, file.filename)

        # Step 2: GroQ LLM 파싱
        parsed_result = parse_resume_with_groq(raw_text)

        # Step 3: Supabase `documents` 테이블에 저장
        doc_payload = {
            "member_id": member_id,
            "title": title,
            "doc_type": parsed_result.get("doc_type", "RESUME"),
            "category": category
        }
        supabase = get_supabase()
        doc_res = supabase.table("documents").insert(doc_payload).execute()

        if not doc_res.data:
            raise HTTPException(status_code=500, detail="documents 테이블 저장 실패")

        created_document_id = doc_res.data[0]["id"]

        # Step 4: Supabase `document_sections` Bulk Insert (columns 필드 포함)
        sections_data = parsed_result.get("sections", [])
        sections_payload = []

        for idx, sec in enumerate(sections_data):
            sections_payload.append({
                "document_id": created_document_id,
                "section_type": sec.get("section_type", "CUSTOM"),
                "section_title": sec.get("section_title", "세부 정보"),
                "display_order": sec.get("display_order", idx + 1),
                "columns": sec.get("columns", []),  # 💡 [핵심] columns 배열 함께 저장
                "details": sec.get("details", [])
            })

        if sections_payload:
            supabase = get_supabase()
            sec_res = supabase.table("document_sections").insert(sections_payload).execute()
            if not sec_res.data:
                raise HTTPException(status_code=500, detail="document_sections 테이블 저장 실패")

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
                print(f"Rollback failed: {rollback_err}")

        print(f"[Upload Error]: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"이력서 업로드 및 저장 실패: {str(e)}"
        )