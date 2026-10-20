import os
import json
import pandas as pd
from dotenv import load_dotenv

# 우리가 만든 모듈들 임포트
from src.data_loader import RecruitDataLoader
from src.lsi_lda_model import TopicModeler
from src.recommender import JobRecommender
from src.gpt_feedback import ResumeFeedbackEngine

# .env 로드
load_dotenv()

def run_pipeline():
    print("==================================================")
    print("🚀 IT 채용 공고 추천 & 자소서 분석 시스템 파이프라인")
    print("==================================================\n")

    # 1. 데이터 로드 및 전처리
    print("1️⃣ [Data Loading] 채용 공고 데이터셋 로드 중...")
    loader = RecruitDataLoader()
    # 개발/테스트용 3,000건 샘플링 (전체 8만건 사용 시 sample_size=None 지정)
    df_jd = loader.preprocess_for_analysis(sample_size=3000)

    # 2. 토픽 모델링 (LSI / LDA)
    print("\n2️⃣ [Topic Modeling] 공고 데이터 토픽 분석 중...")
    topic_modeler = TopicModeler(n_topics=3)
    topic_modeler.fit_lsi(df_jd['full_jd_text'].tolist())
    topic_modeler.print_top_words(model_type="LSI", n_top_words=5)

    # 3. 추천 엔진 학습 및 사용자 추천
    print("\n3️⃣ [Recommendation] 사용자 자소서 맞춤 공고 추천 중...")
    recommender = JobRecommender()
    recommender.fit(df_jd)

    # 사용자 테스트 자소서 입력
    user_resume_sample = """
    Python과 PyTorch를 활용하여 딥러닝 기반 이미지 분류 및 AI 모델을 개발해 본 경험이 있습니다.
    Streamlit을 사용해 데이터 분석 대시보드를 시각화하고, FastApi를 이용해 백엔드 API를 구축했습니다.
    대용량 데이터 전처리 및 EDA 작업에 강점이 있습니다.
    """

    recommendations = recommender.recommend(user_resume_sample, top_n=3)

    print("\n==================== 🏆 [추천 공고 Top 3] ====================")
    for rank, (idx, row) in enumerate(recommendations.iterrows(), 1):
        comp = row.get('company', 'N/A')
        title = row.get('title', 'N/A')
        comp_str = str(comp) if pd.notna(comp) else '미지정 기업'
        title_str = str(title) if pd.notna(title) else 'IT 개발자 공고'

        print(f"[{rank}위] 일치도: {row['similarity_score']}% | {comp_str} - {title_str}")
    print("==============================================================")

    # 4. 상위 1위 추천 공고 기반 GPT 자소서 피드백 생성
    print("\n4️⃣ [AI Feedback] Top 1 공고 기반 GPT 자소서 피드백 생성 중...")
    top_1_jd = recommendations.iloc[0]['full_jd_text']
    
    feedback_engine = ResumeFeedbackEngine()
    feedback = feedback_engine.generate_feedback(user_resume_sample, top_1_jd)

    print("\n==================== 💡 [GPT 자소서 피드백 리포트] ====================")
    print(json.dumps(feedback, indent=2, ensure_ascii=False))
    print("=======================================================================")

if __name__ == "__main__":
    run_pipeline()
