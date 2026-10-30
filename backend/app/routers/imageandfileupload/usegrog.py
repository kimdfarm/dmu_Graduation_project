import os
from typing import List, Optional, Any, Dict
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from app.core.config import get_supabase, GROQ_API_KEY
import pytesseract
# 보통 아래 경로에 설치됩니다. 경로가 다르면 본인 설치 경로로 수정하세요.
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
import io
from uuid import UUID
import base64
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, APIRouter
from pypdf import PdfReader
from supabase import create_client, Client
from groq import Groq
import json

# --- Pydantic Schemas for Structured Output ---

class EducationSchema(BaseModel):
    school_name: Optional[str] = Field(None, description="학교명 (예: 서울대학교)")
    major: Optional[str] = Field(None, description="전공명 (예: 컴퓨터공학과)")
    education_level: Optional[str] = Field(None, description="학위 구분")
    status: Optional[str] = Field(None, description="졸업 상태")
    admission_date: Optional[str] = Field(None, description="입학 연월")
    graduation_date: Optional[str] = Field(None, description="졸업 연월")

class CareerSchema(BaseModel):
    company_name: Optional[str] = Field(None, description="회사명 또는 조직명")
    department: Optional[str] = Field(None, description="근무 부서")
    job_title: Optional[str] = Field(None, description="직급 또는 직책")
    start_date: Optional[str] = Field(None, description="근무 시작일")
    end_date: Optional[str] = Field(None, description="근무 종료일")
    is_current: Optional[bool] = Field(False, description="현재 재직 여부")
    description: Optional[str] = Field(None, description="담당 업무 요약 및 주요 성과")

class CertificateSchema(BaseModel):
    certificate_name: Optional[str] = Field(None, description="자격증 이름")
    issuing_organization: Optional[str] = Field(None, description="발급 기관")
    certificate_number: Optional[str] = Field(None, description="자격증 일련번호")
    acquisition_date: Optional[str] = Field(None, description="취득 일자")

class LanguageScoreSchema(BaseModel):
    language_name: Optional[str] = Field(None, description="외국어 종류")
    test_name: Optional[str] = Field(None, description="시험 종류")
    score_or_level: Optional[str] = Field(None, description="취득 점수 또는 등급")
    test_date: Optional[str] = Field(None, description="응시 일자")
    expiration_date: Optional[str] = Field(None, description="유효 기간 만료일")

class MemberSkillSchema(BaseModel):
    skill_name: Optional[str] = Field(None, description="기술명")
    skill_level: Optional[str] = Field(None, description="숙련도")

class ParsedResume(BaseModel):
    educations: List[EducationSchema] = []
    careers: List[CareerSchema] = []
    certificates: List[CertificateSchema] = []
    language_scores: List[LanguageScoreSchema] = []
    member_skills: List[MemberSkillSchema] = []

# --- FastAPI App ---

router = APIRouter(
    prefix="/upload",
    tags=["upload"]
)

# Supabase & Groq 설정
supabase = get_supabase()
load_dotenv()  # .env 파일에서 환경 변수 로드
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# 표준 Groq 클라이언트 초기화 (instructor 대체)
groq_client = Groq(api_key=GROQ_API_KEY)
GROQ_MODEL_NAME = "llama-3.3-70b-versatile"

def extract_text_from_pdf(file_content: bytes) -> str:
    """PDF 파일에서 텍스트 직접 추출"""
    pdf_file = io.BytesIO(file_content)
    reader = PdfReader(pdf_file)
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text

def extract_text_from_image(file_content: bytes) -> str:
    """이미지 파일(PNG, JPG, JPEG)에서 pytesseract을 사용하여 한글/영어 텍스트 추출"""
    try:
        import pytesseract
        from PIL import Image
        
        image = Image.open(io.BytesIO(file_content))
        text = pytesseract.image_to_string(image, lang='kor+eng')
        return text
    except ImportError:
        raise HTTPException(
            status_code=500, 
            detail="pytesseract 또는 Pillow 라이브러리가 설치되지 않았습니다."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"OCR 텍스트 추출 중 오류가 발생했습니다: {str(e)}"
        )

def filter_valid_data(items: list, member_id: str, resume_id: str) -> list:
    valid_list = []
    for item in items:
        # Pydantic 모델이거나 딕셔너리일 경우 처리
        item_dict = item.dict() if hasattr(item, "dict") else item
        has_value = any(v is not None and str(v).strip() != "" for k, v in item_dict.items() if k != "is_current")
        if has_value:
            cleaned_item = {k: v for k, v in item_dict.items() if v is not None}
            cleaned_item["member_id"] = member_id
            cleaned_item["resume_id"] = resume_id
            valid_list.append(cleaned_item)
    return valid_list


@router.post("/analyze")
async def analyze_resume(
    file: UploadFile = File(...),
    mode: Optional[str] = "STAR"
):
    try:
        file_content = await file.read()
        file_extension = file.filename.split(".")[-1].lower()
        
        resume_text = ""
        if file_extension == "pdf":
            resume_text = extract_text_from_pdf(file_content)
        elif file_extension in ["png", "jpg", "jpeg"]:
            resume_text = extract_text_from_image(file_content)
        else:
            raise HTTPException(status_code=400, detail="지원하지 않는 파일 형식입니다.")

        if not resume_text.strip():
            raise HTTPException(status_code=400, detail="추출된 이력서 내용이 비어있습니다.")

        # 요청하신 출력 구조 프롬프트 적용
        prompt = f"""
        다음 자기소개서/프로젝트 카드 텍스트를 "{mode}" 모드에 맞추어 전문적인 문장으로 재작성해 주세요.

        [작성 지침]
        1. 이 텍스트에 가장 잘 어울리는 분석 컬럼들(예: STAR라면 Situation, Task, Action, Result)을 선정하세요.
        2. 각 컬럼별로 작성된 내용을 아래의 **JSON 딕셔너리 형식**으로만 매핑하여 응답하세요.
        
        반드시 아래의 **JSON 형식**으로만 응답하세요. 다른 설명이나 인사말은 절대 포함하지 마세요.
        {{
          "ai_columns": ["컬럼1", "컬럼2", "컬럼3"],
          "column_values": {{
            "컬럼1": "해당 컬럼에 들어갈 내용...",
            "컬럼2": "해당 컬럼에 들어갈 내용..."
          }}
        }}

        [원문]
        {resume_text}
        """

        # Groq API 호출 (JSON 모드)
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL_NAME,
            messages=[
                {"role": "system", "content": "너는 채용 트렌드를 꿰뚫고 있는 수석 컨설턴트이며, 반드시 유효한 JSON 형식으로만 응답하는 데이터 프로세서이다."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )

        content = response.choices[0].message.content.strip()
        result_data = json.loads(content)

        return {
            "message": "이력서 분석 및 동적 컬럼 구조화 완료.",
            "parsed_data": result_data  # {"ai_columns": [...], "column_values": {...}} 구조 반환
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"분석 중 오류 발생: {str(e)}")


# 최종 저장을 위해 프론트엔드로부터 받을 JSON 구조 정의
class SaveResumeRequest(BaseModel):
    member_id: str
    resume_id: UUID
    educations: List[EducationSchema] = []
    careers: List[CareerSchema] = []
    certificates: List[CertificateSchema] = []
    language_scores: List[LanguageScoreSchema] = []
    member_skills: List[MemberSkillSchema] = []

# [2단계] 사용자가 확인 및 편집을 완료한 데이터를 넘겨받아 최종 DB 저장
@router.post("/save")
async def save_edited_resume(resume_id: UUID, request_data: SaveResumeRequest):
    try:
        member_id = request_data.member_id
        resume_id = request_data.resume_id
        inserted_results = {}

        supabase = get_supabase()

        # 1. 학력 저장
        valid_edus = filter_valid_data(request_data.educations, member_id, resume_id)
        if valid_edus:
            edu_res = supabase.table("educations").insert(valid_edus).execute()
            inserted_results["educations"] = edu_res.data

        # 2. 경력 저장
        valid_careers = filter_valid_data(request_data.careers, member_id, resume_id)
        if valid_careers:
            career_res = supabase.table("careers").insert(valid_careers).execute()
            inserted_results["careers"] = career_res.data

        # 3. 자격증 저장
        valid_certs = filter_valid_data(request_data.certificates, member_id, resume_id)
        if valid_certs:
            cert_res = supabase.table("certificates").insert(valid_certs).execute()
            inserted_results["certificates"] = cert_res.data

        # 4. 어학 성적 저장
        valid_languages = filter_valid_data(request_data.language_scores, member_id, resume_id)
        if valid_languages:
            lang_res = supabase.table("language_scores").insert(valid_languages).execute()
            inserted_results["language_scores"] = lang_res.data

        # 5. 기술 스택 저장
        valid_skills = filter_valid_data(request_data.member_skills, member_id, resume_id)
        if valid_skills:
            skill_res = supabase.table("member_skills").insert(valid_skills).execute()
            inserted_results["member_skills"] = skill_res.data

        return {
            "message": "사용자가 검토한 이력서 정보가 공통 resume_id로 묶여 최종 저장되었습니다.",
            "resume_id": resume_id,
            "inserted_tables": list(inserted_results.keys())
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB 저장 중 오류 발생: {str(e)}")