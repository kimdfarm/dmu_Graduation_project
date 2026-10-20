import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from sklearn.metrics.pairwise import cosine_similarity
import re

class JobRecommender:
    """
    TF-IDF (키워드 매칭) + LSI (주제/맥락 매칭) 하이브리드 추천 엔진
    """
    def __init__(self, n_components: int = 50, alpha: float = 0.7):
        """
        :param n_components: LSI 잠재 토픽 차원 수
        :param alpha: TF-IDF 유사도 가중치 (1-alpha는 LSI 유사도 가중치)
        """
        self.alpha = alpha
        self.n_components = n_components
        
        # TF-IDF 모델
        self.vectorizer = TfidfVectorizer(max_features=15000, stop_words=None)
        # LSI (SVD) 모델
        self.svd = TruncatedSVD(n_components=n_components, random_state=42)
        
        self.df = None
        self.tfidf_matrix = None
        self.lsi_matrix = None

    def fit(self, df: pd.DataFrame, text_column: str = 'full_jd_text'):
        """
        채용 공고 데이터셋 학습 및 TF-IDF / LSI 행렬 구축
        """
        self.df = df.copy().reset_index(drop=True)
        jd_texts = self.df[text_column].fillna('').tolist()
        
        # 1. TF-IDF 행렬 생성
        self.tfidf_matrix = self.vectorizer.fit_transform(jd_texts)
        
        # 2. LSI (TruncatedSVD) 행렬 생성
        self.lsi_matrix = self.svd.fit_transform(self.tfidf_matrix)
        
        return self

    def recommend(self, user_resume: str, top_n: int = 3) -> pd.DataFrame:
        """
        사용자 자소서 기반 하이브리드 코사인 유사도 추천
        """
        if self.tfidf_matrix is None or self.lsi_matrix is None:
            raise ValueError("Recommender가 학습되지 않았습니다. fit()을 먼저 실행해 주세요.")

        # 1. 사용자 입력 텍스트 벡터화
        user_tfidf = self.vectorizer.transform([user_resume])
        user_lsi = self.svd.transform(user_tfidf)
        
        # 2. TF-IDF 코사인 유사도 계산
        tfidf_sim = cosine_similarity(user_tfidf, self.tfidf_matrix).flatten()
        
        # 3. LSI 코사인 유사도 계산
        lsi_sim = cosine_similarity(user_lsi, self.lsi_matrix).flatten()
        
        # 4. 하이브리드 유사도 결합 (0~100 퍼센트 스케일링)
        hybrid_sim = (self.alpha * tfidf_sim) + ((1 - self.alpha) * lsi_sim)
        
        # 유사도 점수를 DataFrame에 결합
        result_df = self.df.copy()
        result_df['similarity_score'] = np.round(hybrid_sim * 100, 2)
        result_df['tfidf_sim'] = np.round(tfidf_sim * 100, 2)
        result_df['lsi_sim'] = np.round(lsi_sim * 100, 2)
        
        # 상위 top_n개 추출
        top_recommendations = result_df.sort_values(by='similarity_score', ascending=False).head(top_n)
        
        return top_recommendations


if __name__ == "__main__":
    from src.data_loader import RecruitDataLoader
    
    loader = RecruitDataLoader()
    df_sample = loader.preprocess_for_analysis(sample_size=1000)
    
    recommender = JobRecommender(alpha=0.7)
    recommender.fit(df_sample)
    
    sample_resume = "Python, PyTorch, FastAPI 데이터 분석 및 머신러닝 엔지니어"
    res = recommender.recommend(sample_resume, top_n=3)
    print("\n--- 하이브리드 추천 결과 ---")
    print(res[['company', 'title', 'similarity_score', 'tfidf_sim', 'lsi_sim']])
