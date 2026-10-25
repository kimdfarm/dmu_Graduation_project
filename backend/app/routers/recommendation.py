import re
from collections import Counter
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.src.data_loader import RecruitDataLoader
from app.src.lsa_lda_model import TopicModeler
from app.src.recommender import JobRecommender

router = APIRouter(prefix="/api/recommend", tags=["Job Recommendation"])

# ------------------------------------------------------------------
# 1. DTO (Pydantic 검증 모델) 통합
# ------------------------------------------------------------------
class RecommendRequest(BaseModel):
    user_resume: str = Field(..., description="사용자 자소서 또는 보유 기술 스택 텍스트")
    top_n: Optional[int] = Field(default=3, ge=1, le=10, description="추천받을 공고 수")
    sample_size: Optional[int] = Field(default=300, description="학습용 공고 샘플 수")

class RecommendedJobItem(BaseModel):
    rank: int
    company: str
    title: str
    similarity_score: float
    tfidf_sim: float
    lsi_sim: float
    matched_keywords: List[str]
    full_jd_text: str
    job_url: str

class TopKeywordItem(BaseModel):
    keyword: str
    count: int

class RecommendResponse(BaseModel):
    total_count: int
    recommendations: List[RecommendedJobItem]
    top_tech_keywords: List[TopKeywordItem]

# ------------------------------------------------------------------
# 2. 추천 엔진 싱글톤 관리 컨테이너 (임베딩 부분 주석 처리)
# ------------------------------------------------------------------
class PipelineServiceContainer:
    def __init__(self, sample_size: int = 300):
        print("⚡ [Pipeline Init] 채용 DB 데이터 로드 및 LSI 추천 엔진 학습 중...")
        self.loader = RecruitDataLoader()
        self.df = self.loader.preprocess_for_analysis(sample_size=sample_size)
        
        self.topic_modeler = TopicModeler(n_topics=3)
        if not self.df.empty:
            self.topic_modeler.fit_lsi(self.df['full_jd_text'].tolist())
        
        self.recommender = JobRecommender(alpha=0.7)
        
        # 💡 [나중에 임베딩을 다시 쓸 때 이 주석을 해제하세요]
        # self.recommender.fit_embedding(self.df)
        
        if not self.df.empty:
            self.recommender.fit(self.df)
        print("✅ [Pipeline Init] 추천 엔진 준비 완료")

_container = None
def get_pipeline_container():
    global _container
    if _container is None:
        # 💡 샘플 수를 300개로 설정
        _container = PipelineServiceContainer(sample_size=50) 
    return _container

TECH_KEYWORDS = [
    'Python', 'PyTorch', 'TensorFlow', 'FastAPI', 'Streamlit', 'Pandas', 'NumPy', 
    'SQL', 'MySQL', 'PostgreSQL', 'Docker', 'Kubernetes', 'Git', 'GitHub', 
    'C++', 'Java', 'React', 'Vue', 'Spring', 'NLP', 'EDA', 'MLOps', 'AWS',
    'Linux', 'Kafka', 'Spark', 'Hadoop', 'Tableau', 'Scikit-learn', 'CI/CD'
]

def extract_matched_keywords(user_text: str, jd_text: str):
    matched = []
    for kw in TECH_KEYWORDS:
        if re.search(r'\b' + re.escape(kw) + r'\b', user_text, re.IGNORECASE) and \
           re.search(r'\b' + re.escape(kw) + r'\b', jd_text, re.IGNORECASE):
            matched.append(kw)
    return matched

def reload_pipeline_container():
    global _container
    print("🔄 [Pipeline Reload] 채용 DB 최신 데이터로 추천 엔진 재학습 중...")
    _container = PipelineServiceContainer(sample_size=20)
    return _container

@router.post("/reload", summary="추천 엔진 데이터 강제 갱신")
async def refresh_recommendation_engine():
    reload_pipeline_container()
    return {"message": "추천 엔진이 최신 DB 기준으로 성공적으로 갱신되었습니다."}


# ------------------------------------------------------------------
# 3. API 엔드포인트
# ------------------------------------------------------------------
@router.post("", response_model=RecommendResponse, summary="LSI 기반 맞춤 추천 및 키워드 분석")
async def recommend_jobs(
    req: RecommendRequest,
    container: PipelineServiceContainer = Depends(get_pipeline_container)
):
    if container.df.empty:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="채용 DB에 데이터가 없거나 연결에 실패했습니다."
        )

    if not req.user_resume.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자소서 또는 보유 기술 스택 텍스트를 입력해주세요."
        )

    recommendations_df = container.recommender.recommend(req.user_resume, top_n=req.top_n)
    
    recommended_items = []
    combined_jds_text = ""

    for rank, (idx, row) in enumerate(recommendations_df.iterrows(), 1):
        jd_text = str(row.get('full_jd_text', ''))
        combined_jds_text += " " + jd_text
        
        matched_kws = extract_matched_keywords(req.user_resume, jd_text)
        
        item = RecommendedJobItem(
            rank=rank,
            company=str(row.get('company', '미지정 기업')),
            title=str(row.get('title', 'IT 개발 공고')),
            similarity_score=float(row.get('similarity_score', 0.0)),
            tfidf_sim=float(row.get('tfidf_sim', 0.0)),
            lsi_sim=float(row.get('lsi_sim', 0.0)),
            matched_keywords=matched_kws,
            full_jd_text=jd_text,
            job_url=str(row.get('job_url', ''))
        )
        recommended_items.append(item)

    kw_counts = Counter()
    for kw in TECH_KEYWORDS:
        matches = len(re.findall(r'\b' + re.escape(kw) + r'\b', combined_jds_text, re.IGNORECASE))
        if matches > 0:
            kw_counts[kw] = matches
            
    top_keywords = [
        TopKeywordItem(keyword=kw, count=cnt)
        for kw, cnt in kw_counts.most_common(10)
    ]

    return RecommendResponse(
        total_count=len(recommended_items),
        recommendations=recommended_items,
        top_tech_keywords=top_keywords
    )


# 💡 [나중에 임베딩 API를 다시 활성화할 때 이 아래 전체 주석을 해제하세요]
"""
@router.post("/embedding", response_model=RecommendResponse, summary="임베딩 모델 기반 맞춤 추천")
async def recommend_jobs_by_embedding(
    req: RecommendRequest,
    container: PipelineServiceContainer = Depends(get_pipeline_container)
):
    if container.df.empty:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="채용 DB에 데이터가 없거나 연결에 실패했습니다."
        )

    if not req.user_resume.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자소서 또는 보유 기술 스택 텍스트를 입력해주세요."
        )

    recommendations_df = container.recommender.recommend_by_embedding(req.user_resume, top_n=req.top_n)
    
    recommended_items = []
    combined_jds_text = ""

    for rank, (idx, row) in enumerate(recommendations_df.iterrows(), 1):
        jd_text = str(row.get('full_jd_text', ''))
        combined_jds_text += " " + jd_text
        
        matched_kws = extract_matched_keywords(req.user_resume, jd_text)
        
        item = RecommendedJobItem(
            rank=rank,
            company=str(row.get('company', '미지정 기업')),
            title=str(row.get('title', 'IT 개발 공고')),
            similarity_score=float(row.get('similarity_score', 0.0)),
            tfidf_sim=float(row.get('tfidf_sim', 0.0)),
            lsi_sim=float(row.get('lsi_sim', 0.0)),
            matched_keywords=matched_kws,
            full_jd_text=jd_text,
            job_url=str(row.get('job_url', ''))
        )
        recommended_items.append(item)

    kw_counts = Counter()
    for kw in TECH_KEYWORDS:
        matches = len(re.findall(r'\b' + re.escape(kw) + r'\b', combined_jds_text, re.IGNORECASE))
        if matches > 0:
            kw_counts[kw] = matches
            
    top_keywords = [
        TopKeywordItem(keyword=kw, count=cnt)
        for kw, cnt in kw_counts.most_common(10)
    ]

    return RecommendResponse(
        total_count=len(recommended_items),
        recommendations=recommended_items,
        top_tech_keywords=top_keywords
    )
"""