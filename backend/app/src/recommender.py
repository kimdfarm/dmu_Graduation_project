import pandas as pd
import numpy as np
# from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from sklearn.metrics.pairwise import cosine_similarity
import re

class JobRecommender:
    """
    TF-IDF (키워드 매칭) + LSI (주제/맥락 매칭) 하이브리드 추천 엔진
    """
    def __init__(self, n_components: int = 500, alpha: float = 0.7):
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

        # self.embedder = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
        # self.jd_embeddings = None

    def fit(self, df: pd.DataFrame, text_column: str = 'full_jd_text'):
            """TF-IDF 및 LSI 행렬 학습"""
            self.df = df.reset_index(drop=True)
            texts = self.df[text_column].fillna('').tolist()
            
            print("📊 [TF-IDF] 공고 텍스트 벡터화 중...")
            self.tfidf_matrix = self.vectorizer.fit_transform(texts)
            
            print("📉 [LSI] 차원 축소 및 SVD 학습 중...")
            self.lsi_matrix = self.svd.fit_transform(self.tfidf_matrix)
            return self

    '''
    def fit_embedding(self, df: pd.DataFrame, text_column: str = 'full_jd_text'):
        """임베딩 기반 추천을 위한 공고 벡터화 학습"""
        from sentence_transformers import SentenceTransformer
        self.embedder = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
        jd_texts = df[text_column].fillna('').tolist()
        print("🔮 [Embedding 모델] 공고 텍스트 임베딩 생성 중...")
        self.jd_embeddings = self.embedder.encode(jd_texts, show_progress_bar=True)
        return self
    
    def recommend_by_embedding(self, user_resume: str, top_n: int = 3) -> pd.DataFrame:
        """문장 의미 기반 임베딩 코사인 유사도 추천"""
        user_embedding = self.embedder.encode([user_resume])
        sims = cosine_similarity(user_embedding, self.jd_embeddings).flatten()

        result_df = self.df.copy()
        # 💡 파이썬 내장 round()를 사용하여 부동소수점 오차를 없애고 소수점 2자리로 고정
        result_df['similarity_score'] = [round(float(s) * 100, 2) for s in sims]
        
        return result_df.sort_values(by='similarity_score', ascending=False).head(top_n)
    '''

    def recommend(self, user_resume: str, top_n: int = 3) -> pd.DataFrame:
        """
        사용자 자소서 기반 하이브리드 코사인 유사도 추천
        """
        if self.tfidf_matrix is None or self.lsi_matrix is None:
            raise ValueError("Recommender가 학습되지 않았습니다. fit()을 먼저 실행해 주세요.")

        user_tfidf = self.vectorizer.transform([user_resume])
        user_lsi = self.svd.transform(user_tfidf)
        
        tfidf_sim = cosine_similarity(user_tfidf, self.tfidf_matrix).flatten()
        lsi_sim = cosine_similarity(user_lsi, self.lsi_matrix).flatten()
        
        hybrid_sim = (self.alpha * tfidf_sim) + ((1 - self.alpha) * lsi_sim)
        
        result_df = self.df.copy()
        # 💡 동일하게 파이썬 내장 round() 적용
        result_df['similarity_score'] = [round(float(s) * 100, 2) for s in hybrid_sim]
        result_df['tfidf_sim'] = [round(float(s) * 100, 2) for s in tfidf_sim]
        result_df['lsi_sim'] = [round(float(s) * 100, 2) for s in lsi_sim]
        
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
