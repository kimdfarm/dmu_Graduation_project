from pydantic import BaseModel, Field
from typing import List, Dict, Optional

class RecommendRequest(BaseModel):
    user_resume: str = Field(
        ..., 
        description="사용자 자소서 또는 보유 기술 스택 텍스트",
        example="Python, PyTorch, FastAPI를 활용한 백엔드 API 및 AI 서비스 구축 경험이 있습니다."
    )
    top_n: Optional[int] = Field(default=3, ge=1, le=10, description="추천받을 공고 수")
    sample_size: Optional[int] = Field(default=300, description="학습용 공고 데이터 샘플 수")

class RecommendedJobItem(BaseModel):
    rank: int
    company: str
    title: str
    similarity_score: float
    tfidf_sim: float
    lsi_sim: float
    matched_keywords: List[str]
    full_jd_text: str

class TopKeywordItem(BaseModel):
    keyword: str
    count: int

class RecommendResponse(BaseModel):
    total_count: int
    recommendations: List[RecommendedJobItem]
    top_tech_keywords: List[TopKeywordItem]