import pandas as pd
from kiwipiepy import Kiwi
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
from sklearn.decomposition import TruncatedSVD, LatentDirichletAllocation

class TopicModeler:
    """
    Kiwi 형태소 분석기 + LSI / LDA 모델을 활용한 기술 스택 키워드 및 토픽 추출 클래스
    """
    def __init__(self, n_topics: int = 5):
        self.kiwi = Kiwi()
        self.n_topics = n_topics
        self.tfidf_vectorizer = None
        self.count_vectorizer = None
        self.lsi_model = None
        self.lda_model = None

    def kiwi_tokenizer(self, text: str) -> list:
        """
        Kiwi 분석기로 일반명사(NNG), 전유명사(NNP), 외국어/기술스택(SL)만 추출
        """
        if not text or not isinstance(text, str):
            return []
        
        tokens = self.kiwi.tokenize(text)
        # NNG: 일반명사, NNP: 고유명사, SL: 외국어(Python, React, Docker 등)
        keywords = [
            t.form for t in tokens 
            if t.tag in ['NNG', 'NNP', 'SL'] and len(t.form) > 1
        ]
        return keywords

    def fit_lsi(self, text_list: list):
        """LSI (Latent Semantic Indexing) 모델 학습 - TF-IDF 기반"""
        print("\n🔮 [LSI 모델] 토픽 분석 학습 중...")
        self.tfidf_vectorizer = TfidfVectorizer(
            tokenizer=self.kiwi_tokenizer,
            max_df=0.85,
            min_df=2,
            token_pattern=None
        )
        tfidf_matrix = self.tfidf_vectorizer.fit_transform(text_list)
        
        self.lsi_model = TruncatedSVD(n_components=self.n_topics, random_state=42)
        self.lsi_model.fit(tfidf_matrix)
        print("✅ LSI 모델 학습 완료")

    def fit_lda(self, text_list: list):
        """LDA (Latent Dirichlet Allocation) 모델 학습 - CountVectorizer 기반"""
        print("\n🔮 [LDA 모델] 토픽 분석 학습 중...")
        self.count_vectorizer = CountVectorizer(
            tokenizer=self.kiwi_tokenizer,
            max_df=0.85,
            min_df=2,
            token_pattern=None
        )
        count_matrix = self.count_vectorizer.fit_transform(text_list)
        
        self.lda_model = LatentDirichletAllocation(n_components=self.n_topics, random_state=42)
        self.lda_model.fit(count_matrix)
        print("✅ LDA 모델 학습 완료")

    def print_top_words(self, model_type: str = "LSI", n_top_words: int = 10):
        """추출된 토픽별 주요 키워드 출력"""
        if model_type == "LSI":
            model = self.lsi_model
            feature_names = self.tfidf_vectorizer.get_feature_names_out()
        else:
            model = self.lda_model
            feature_names = self.count_vectorizer.get_feature_names_out()

        print(f"\n==================== [{model_type} 주요 토픽 & 키워드] ====================")
        for topic_idx, topic in enumerate(model.components_):
            top_features_ind = topic.argsort()[:-n_top_words - 1:-1]
            top_features = [feature_names[i] for i in top_features_ind]
            print(f"📌 토픽 #{topic_idx + 1}: {', '.join(top_features)}")
        print("=======================================================================")


if __name__ == "__main__":
    from data_loader import RecruitDataLoader

    # 1. 데이터 샘플 로드 (빠른 검증용 1,000건)
    loader = RecruitDataLoader()
    df_sample = loader.preprocess_for_analysis(sample_size=1000)

    # 2. LSI / LDA 토픽 모델링 실행
    modeler = TopicModeler(n_topics=5)
    
    # LSI 학습 및 키워드 출력
    modeler.fit_lsi(df_sample['full_jd_text'].tolist())
    modeler.print_top_words(model_type="LSI", n_top_words=8)

    # LDA 학습 및 키워드 출력
    modeler.fit_lda(df_sample['full_jd_text'].tolist())
    modeler.print_top_words(model_type="LDA", n_top_words=8)
