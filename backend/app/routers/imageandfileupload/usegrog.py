import os
from typing import List, Optional
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from app.core.config import SUPABASE_KEY, SUPABASE_URL
import pytesseract
# 보통 아래 경로에 설치됩니다. 경로가 다르면 본인 설치 경로로 수정하세요.
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
import io
import uuid
import base64
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException ,APIRouter
from pydantic import BaseModel, Field
from pypdf import PdfReader
from supabase import create_client, Client
from groq import Groq
import instructor

# --- Pydantic Schemas for Structured Output ---

class EducationSchema(BaseModel):
    school_name: Optional[str] = Field(None, description="학교명 (예: 서울대학교)")
    major: Optional[str] = Field(None, description="전공명 (예: 컴퓨터공학과), 고등학교 등의 이유로 전공이 없다면 비워둡니다.")
    education_level: Optional[str] = Field(None, description="학위 구분 (예: 고등학교졸업, 학사, 석사, 박사)")
    status: Optional[str] = Field(None, description="졸업 상태 (예: 졸업, 재학, 수료, 중퇴)")
    admission_date: Optional[str] = Field(None, description="입학 연월 (YYYY-MM-DD 또는 YYYY-MM 형식을 권장하나 모르면 비워둠)")
    graduation_date: Optional[str] = Field(None, description="졸업 연월 (YYYY-MM-DD 또는 YYYY-MM 형식을 권장하나 모르면 비워둠)")

class CareerSchema(BaseModel):
    company_name: Optional[str] = Field(None, description="회사명 또는 조직명")
    department: Optional[str] = Field(None, description="근무 부서 또는 팀명")
    job_title: Optional[str] = Field(None, description="직급 또는 직책")
    start_date: Optional[str] = Field(None, description="근무 시작일 (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="근무 종료일 (YYYY-MM-DD). 재직 중이거나 없으면 비워둡니다.")
    is_current: Optional[bool] = Field(False, description="현재 재직 여부 (재직 중이면 True, 퇴사했거나 기재가 없으면 False)")
    description: Optional[str] = Field(None, description="담당 업무 요약 및 주요 성과")

class CertificateSchema(BaseModel):
    certificate_name: Optional[str] = Field(None, description="자격증 이름")
    issuing_organization: Optional[str] = Field(None, description="발급 기관")
    certificate_number: Optional[str] = Field(None, description="자격증 일련번호 또는 합격 번호")
    acquisition_date: Optional[str] = Field(None, description="취득 일자 (YYYY-MM-DD)")

class LanguageScoreSchema(BaseModel):
    language_name: Optional[str] = Field(None, description="외국어 종류 (예: 영어, 일본어)")
    test_name: Optional[str] = Field(None, description="시험 종류 (예: TOEIC, OPIc)")
    score_or_level: Optional[str] = Field(None, description="취득 점수 또는 등급")
    test_date: Optional[str] = Field(None, description="응시 일자 (YYYY-MM-DD)")
    expiration_date: Optional[str] = Field(None, description="유효 기간 만료일 (YYYY-MM-DD)")

class MemberSkillSchema(BaseModel):
    skill_name: Optional[str] = Field(None, description="기술명 (예: Python, React)")
    skill_level: Optional[str] = Field(None, description="숙련도 (상/중/하 또는 상급/중급/초급)")

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
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
load_dotenv()  # .env 파일에서 환경 변수 로드
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
groq_client = instructor.from_groq(
    Groq(api_key=GROQ_API_KEY),
    mode=instructor.Mode.JSON
)

# Tesseract OCR 경로 설정 (Windows 환경 등에서 필요한 경우 지정, 리눅스 서버 등 설치 환경에 맞춰 주석 해제)
# import pytesseract
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

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
        # 'kor'와 'eng' 언어 데이터를 결합하여 텍스트를 추출합니다.
        # (로컬 PC나 서버에 tesseract-ocr 및 한국어 패키지(tessdata/kor.traineddata)가 설치되어 있어야 합니다.)
        text = pytesseract.image_to_string(image, lang='kor+eng')
        return text
    except ImportError:
        raise HTTPException(
            status_code=500, 
            detail="pytesseract 또는 Pillow 라이브러리가 설치되지 않았습니다. pip install pytesseract Pillow를 진행해주세요."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"OCR 텍스트 추출 중 오류가 발생했습니다: {str(e)}"
        )

def filter_valid_data(items: list, member_id: str, resume_id: str) -> list:
    valid_list = []
    for item in items:
        item_dict = item.dict()
        has_value = any(v is not None and str(v).strip() != "" for k, v in item_dict.items() if k != "is_current")
        if has_value:
            cleaned_item = {k: v for k, v in item_dict.items() if v is not None}
            
            # 모든 테이블의 외래키(FK) 역할로 두 ID를 같이 심어줍니다.
            cleaned_item["member_id"] = member_id
            cleaned_item["resume_id"] = resume_id  # 공통 UUID 주입
            
            valid_list.append(cleaned_item)
    return valid_list


@router.post("/analyze")
async def analyze_resume(
    file: UploadFile = File(...)
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

        # Groq 분석 실행 (Pydantic 객체로 받아옴)
        parsed_data: ParsedResume = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            response_model=ParsedResume,
            messages=[
                {
                    "role": "system", 
                    "content": (
                        "너는 이력서 비정형 텍스트를 파싱하여 인사 데이터로 구조화하는 전문가야.\n"
                        "제공된 이력서 텍스트에서 각 카테고리 정보를 찾아 매핑해줘.\n\n"
                        "[주의 사항]\n"
                        "- 모든 날짜(date) 필드는 이력서에 표기된 형식을 바탕으로 반드시 'YYYY-MM-DD' 형식으로 통일해서 추출해줘. (예: 2024.03 -> 2024-03-01)\n"
                        "- 이력서에 명시되지 않았거나 확실치 않은 정보는 절대 임의로 추측하여 채우지 말고 반드시 빈 값(None)으로 둬야 해."
                    )
                },
                {"role": "user", "content": f"다음 이력서를 분석해서 구조화된 양식으로 변환해줘:\n\n{resume_text}"}
            ]
        )

        # 분석된 원본 데이터를 그대로 JSON으로 리턴합니다.
        return {
            "message": "이력서 분석 완료. 데이터를 확인 후 수정하여 저장 API로 보내주세요.",
            "parsed_data": parsed_data.dict() # 프론트엔드가 받아서 화면에 뿌려줄 데이터
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"분석 중 오류 발생: {str(e)}")
    

    # 최종 저장을 위해 프론트엔드로부터 받을 JSON 구조 정의 (member_id 포함)
class SaveResumeRequest(ParsedResume):
    member_id: str
    resume_id: uuid

# [2단계] 사용자가 확인 및 편집을 완료한 데이터를 넘겨받아 최종 DB 저장
@router.post("/save")
async def save_edited_resume(resume_id: uuid, request_data: SaveResumeRequest):
    try:
        member_id = request_data.member_id
        resume_id = request_data.resume_id # 공통 이력서 UUID
        inserted_results = {}

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





