import re
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
from sklearn.decomposition import TruncatedSVD, LatentDirichletAllocation

class TopicModeler:
    """
    정규식 기반 경량 토크나이저 + LSI / LDA 모델을 활용한 기술 스택 키워드 및 토픽 추출 클래스
    (Render 512MB RAM 제약 대응을 위해 kiwipiepy 메모리 의존성을 제거함)
    """
    def __init__(self, n_topics: int = 5):
        self.n_topics = n_topics
        self.tfidf_vectorizer = None
        self.count_vectorizer = None
        self.lsi_model = None
        self.lda_model = None

    def light_tokenizer(self, text: str) -> list:
        """
        정규식을 활용해 2글자 이상의 영어 단어(기술스택) 및 한글 명사 형태를 가볍게 추출합니다.
        """
        if not text or not isinstance(text, str):
            return []
        
        # 영어(Python, React 등 2글자 이상)와 한글 단어 추출
        tokens = re.findall(r'\b[A-Za-z]{2,}\b|[가-힣]{2,}', text)
        return tokens

    def fit_lsi(self, text_list: list):
        """LSI (Latent Semantic Indexing) 모델 학습 - TF-IDF 기반"""
        print("\n🔮 [LSI 모델] 토픽 분석 학습 중...")
        self.tfidf_vectorizer = TfidfVectorizer(
            tokenizer=self.light_tokenizer,
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
            tokenizer=self.light_tokenizer,
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