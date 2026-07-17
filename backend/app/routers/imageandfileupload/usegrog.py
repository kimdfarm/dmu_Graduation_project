import os
from typing import List, Optional
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from app.core.config import SUPABASE_KEY, SUPABASE_URL

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

def filter_valid_data(items: list, member_id: str) -> list:
    """추출된 정보 중 핵심 내용이 존재하는 유효한 데이터만 필터링하여 member_id와 결합"""
    valid_list = []
    for item in items:
        item_dict = item.dict()
        # is_current를 제외한 유효한 다른 텍스트 입력값이나 수치 정보가 하나라도 포함되어 있는지 검증
        has_value = any(v is not None and str(v).strip() != "" for k, v in item_dict.items() if k != "is_current")
        if has_value:
            # None 값을 제외한 키-값 쌍만 필터링하여 DB Null Default 작동 보장
            cleaned_item = {k: v for k, v in item_dict.items() if v is not None}
            cleaned_item["member_id"] = member_id
            valid_list.append(cleaned_item)
    return valid_list


@router.post("/resumes/analyze-and-save")
async def analyze_and_save_resume(
    member_id: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        file_content = await file.read()
        file_extension = file.filename.split(".")[-1].lower()
        
        resume_text = ""
        
        # 1. 파일 확장자에 맞는 텍스트 추출 (PDF vs 이미지)
        if file_extension == "pdf":
            resume_text = extract_text_from_pdf(file_content)
            # 만약 스캔본 PDF 등의 이유로 텍스트가 안 뽑힐 경우 이미지 OCR 유도 또는 PDF 내 이미지 OCR 연동 가능
            if not resume_text.strip():
                raise HTTPException(
                    status_code=400, 
                    detail="PDF에서 텍스트를 추출할 수 없습니다. 스캔된 PDF라면 이미지 파일(JPG, PNG)로 업로드해 주세요."
                )
                
        elif file_extension in ["png", "jpg", "jpeg"]:
            # pytesseract 호출하여 이미지에서 한글/영어 텍스트 추출
            resume_text = extract_text_from_image(file_content)
            
        else:
            raise HTTPException(status_code=400, detail="지원하지 않는 파일 형식입니다. (pdf, png, jpg, jpeg만 지원)")

        if not resume_text.strip():
            raise HTTPException(status_code=400, detail="추출된 이력서 내용이 비어있습니다.")

        # 2. Groq Llama 3를 활용하여 추출한 비정형 텍스트를 Pydantic 구조로 변환
        parsed_data: ParsedResume = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            response_model=ParsedResume,
            messages=[
                {
                    "role": "system", 
                    "content": (
    "너는 이력서 비정형 텍스트를 파싱하여 인사 데이터로 구조화하는 전문가야.\n"
    "제공된 이력서 텍스트에서 아래 5가지 카테고리의 정보를 찾아 매핑해줘:\n\n"
    
    "1. 학력(educations): school_name(학교명), major(전공), education_level(학위구분), status(졸업상태), admission_date(입학일), graduation_date(졸업일)\n"
    "2. 경력(careers): company_name(회사명), department(부서), job_title(직급/직책), start_date(시작일), end_date(종료일), is_current(재직여부), description(업무요약)\n"
    "3. 자격증(certificates): certificate_name(자격증명), issuing_organization(발급기관), certificate_number(일련번호), acquisition_date(취득일)\n"
    "4. 어학 성적(language_scores): language_name(외국어종류), test_name(시험종류), score_or_level(점수/등급), test_date(응시일), expiration_date(만료일)\n"
    "5. 기술 스택(member_skills): skill_name(기술명), skill_level(숙련도)\n\n"
    
    " [주의 사항]\n"
    "- 모든 날짜(date) 필드는 이력서에 표기된 형식을 바탕으로 반드시 'YYYY-MM-DD' 형식으로 통일해서 추출해줘. (예: 2024.03 -> 2024-03-01)\n"
    "- 이력서에 명시되지 않았거나 확실치 않은 정보는 절대 임의로 추측하여 채우지 말고 반드시 빈 값(None)으로 둬야 해."
)
                },
                {"role": "user", "content": f"다음 이력서 텍스트를 분석해서 유연하게 구조화해줘:\n\n{resume_text}"}
            ]
        )

        # 3. 유효 데이터 체크 후 Supabase 각각의 테이블에 유연하게 Insert
        inserted_results = {}

        # 학력 저장
        valid_edus = filter_valid_data(parsed_data.educations, member_id)
        if valid_edus:
            edu_res = supabase.table("educations").insert(valid_edus).execute()
            inserted_results["educations"] = edu_res.data

        # 경력 저장
        valid_careers = filter_valid_data(parsed_data.careers, member_id)
        if valid_careers:
            career_res = supabase.table("careers").insert(valid_careers).execute()
            inserted_results["careers"] = career_res.data

        # 자격증 저장
        valid_certs = filter_valid_data(parsed_data.certificates, member_id)
        if valid_certs:
            cert_res = supabase.table("certificates").insert(valid_certs).execute()
            inserted_results["certificates"] = cert_res.data

        # 어학 성적 저장
        valid_languages = filter_valid_data(parsed_data.language_scores, member_id)
        if valid_languages:
            lang_res = supabase.table("language_scores").insert(valid_languages).execute()
            inserted_results["language_scores"] = lang_res.data

        # 기술 스택 저장
        valid_skills = filter_valid_data(parsed_data.member_skills, member_id)
        if valid_skills:
            skill_res = supabase.table("member_skills").insert(valid_skills).execute()
            inserted_results["member_skills"] = skill_res.data

        return {
            "message": "이력서 분석 및 맞춤형 저장이 성공적으로 완료되었습니다.",
            "extracted_text_preview": resume_text[:200] + "...", # 디버깅용 텍스트 프리뷰
            "inserted_tables": list(inserted_results.keys()),
            "inserted_data": inserted_results
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"처리 중 예상치 못한 오류 발생: {str(e)}")