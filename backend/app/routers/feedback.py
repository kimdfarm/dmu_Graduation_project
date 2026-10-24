from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from app.src.gpt_feedback import ResumeFeedbackEngine

router = APIRouter(prefix="/api/feedback", tags=["AI Resume Feedback"])

class FeedbackRequest(BaseModel):
    document_id: Optional[str] = Field(default=None, description="Supabase documents 테이블의 자소서 ID (추천 방식)")
    user_resume: Optional[str] = Field(default=None, description="직접 입력한 자소서 텍스트 (문서 ID가 없을 경우)")
    top_jd_text: str = Field(..., description="분석 기준이 될 채용 공고(JD) 텍스트")
    openai_api_key: Optional[str] = Field(default=None, description="API 키")

class FeedbackResponse(BaseModel):
    match_summary: str
    strengths: List[str]
    missing_skills: List[str]
    improvement_suggestions: List[str]

@router.post("", response_model=FeedbackResponse, summary="자소서(문서 ID 또는 텍스트) 및 JD 맞춤 분석 피드백")
async def generate_resume_feedback(req: FeedbackRequest):
    if not req.top_jd_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="채용 공고(JD) 텍스트가 필요합니다."
        )

    feedback_engine = ResumeFeedbackEngine(api_key=req.openai_api_key)

    # 1. document_id가 제공된 경우: Supabase에서 문항 구조 및 버전을 완벽히 파싱하여 분석
    if req.document_id:
        result = feedback_engine.generate_feedback_from_document_id(req.document_id, req.top_jd_text)
    # 2. 텍스트가 직접 제공된 경우
    elif req.user_resume and req.user_resume.strip():
        result = feedback_engine.generate_feedback(req.user_resume, req.top_jd_text)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="document_id 또는 user_resume 중 하나는 반드시 제공되어야 합니다."
        )

    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result["error"]
        )

    return FeedbackResponse(**result)