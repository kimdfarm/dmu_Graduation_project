import streamlit as st
import pandas as pd
import json
import os
import re
from collections import Counter
import matplotlib.pyplot as plt
from wordcloud import WordCloud
from dotenv import load_dotenv

# 내부 모듈 임포트
from src.data_loader import RecruitDataLoader
from src.lsi_lda_model import TopicModeler
from src.recommender import JobRecommender
from src.gpt_feedback import ResumeFeedbackEngine

# .env 파일 로드
load_dotenv()

# 페이지 기본 설정
st.set_page_config(
    page_title="IT 채용 공고 추천 & 자소서 AI 분석",
    page_icon="🚀",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
<style>
    .main-header {
        font-size: 2.1rem;
        font-weight: 800;
        color: #0F172A;
        margin-bottom: 0.3rem;
    }
    .sub-header {
        font-size: 1.0rem;
        color: #475569;
        margin-bottom: 1.8rem;
    }
    .keyword-chip {
        display: inline-block;
        background-color: #EFF6FF;
        color: #1D4ED8;
        border: 1px solid #BFDBFE;
        padding: 0.15rem 0.5rem;
        font-size: 0.8rem;
        font-weight: 600;
        border-radius: 12px;
        margin-right: 0.3rem;
        margin-top: 0.3rem;
    }
    .stButton>button {
        width: 100%;
        background-color: #2563EB;
        color: white;
        font-weight: 700;
        border-radius: 8px;
        height: 3.2rem;
        font-size: 1.05rem;
    }
</style>
""", unsafe_allow_html=True)

# Data & Model Caching
@st.cache_resource
def load_pipeline_data(sample_size=3000):
    loader = RecruitDataLoader()
    df = loader.preprocess_for_analysis(sample_size=sample_size)
    
    topic_modeler = TopicModeler(n_topics=3)
    topic_modeler.fit_lsi(df['full_jd_text'].tolist())
    
    recommender = JobRecommender(alpha=0.7)
    recommender.fit(df)
    
    return df, topic_modeler, recommender

# 기술 키워드 추출 전용 사전 및 추출 함수
TECH_KEYWORDS = [
    'Python', 'PyTorch', 'TensorFlow', 'FastAPI', 'Streamlit', 'Pandas', 'NumPy', 
    'SQL', 'MySQL', 'PostgreSQL', 'Docker', 'Kubernetes', 'Git', 'GitHub', 
    'C++', 'Java', 'React', 'Vue', 'Spring', 'NLP', 'EDA', 'MLOps', 'AWS',
    'Linux', 'Kafka', 'Spark', 'Hadoop', 'Tableau', 'Scikit-learn', 'CI/CD'
]

def extract_matched_keywords(user_text, jd_text):
    matched = []
    for kw in TECH_KEYWORDS:
        if re.search(r'\b' + re.escape(kw) + r'\b', user_text, re.IGNORECASE) and \
           re.search(r'\b' + re.escape(kw) + r'\b', jd_text, re.IGNORECASE):
            matched.append(kw)
    return matched

def generate_wordcloud_from_jds(jd_series):
    """추천 공고들 텍스트에서 주요 기술 키워드 빈도수를 기반으로 WordCloud 생성"""
    combined_text = " ".join(jd_series.astype(str).tolist())
    
    # 주요 기술 키워드 카운트
    kw_counts = Counter()
    for kw in TECH_KEYWORDS:
        matches = len(re.findall(r'\b' + re.escape(kw) + r'\b', combined_text, re.IGNORECASE))
        if matches > 0:
            kw_counts[kw] = matches
            
    if not kw_counts:
        kw_counts = {"Python": 5, "SQL": 4, "Git": 3, "MLOps": 2, "FastAPI": 2}
        
    wc = WordCloud(
        width=800,
        height=400,
        background_color='white',
        colormap='Blues',
        prefer_horizontal=0.9
    ).generate_from_frequencies(kw_counts)
    
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.imshow(wc, interpolation='bilinear')
    ax.axis('off')
    plt.tight_layout(pad=0)
    return fig, kw_counts

# 헤더 영역
st.markdown("<div class='main-header'>🚀 IT 채용 공고 추천 & 자소서 AI 컨설팅</div>", unsafe_allow_html=True)
st.markdown("<div class='sub-header'>사용자의 역량 및 자소서를 분석하여 적합한 IT 채용 공고를 추천하고 GPT 맞춤 피드백 및 워드클라우드 시각화를 제공합니다.</div>", unsafe_allow_html=True)

# 사이드바 설정
with st.sidebar:
    st.header("⚙️ 파이프라인 설정")
    sample_size = st.slider("분석할 공고 데이터 수", min_value=1000, max_value=10000, value=3000, step=1000)
    
    st.divider()
    
    st.header("🔑 API 키 설정")
    env_key = os.getenv("OPENAI_API_KEY", "")
    api_key_input = st.text_input("OpenAI API Key", value=env_key, type="password", help=".env 파일에 설정하지 않은 경우 직접 입력하세요.")
    if api_key_input:
        os.environ["OPENAI_API_KEY"] = api_key_input

    st.divider()
    st.markdown("<b>📊 적용된 AI 모델 및 시각화</b>", unsafe_allow_html=True)
    st.caption("- **NLP Tokenizer:** Kiwi (한국어 형태소 분석기)")
    st.caption("- **Topic Modeling:** LSI (Latent Semantic Indexing)")
    st.caption("- **Hybrid Recommender:** TF-IDF (70%) + LSI (30%)")
    st.caption("- **Visualizer:** WordCloud Key Tech Chart")
    st.caption("- **AI Coach:** OpenAI GPT-4o-mini")

# 파이프라인 로드
with st.spinner("채용 공고 데이터셋 및 하이브리드 추천 엔진 로딩 중..."):
    df, topic_modeler, recommender = load_pipeline_data(sample_size=sample_size)

# 메인 레이아웃 (좌측 입력, 우측 결과)
col_left, col_right = st.columns([1, 1.2])

default_resume = """[기술 스택]
Python, PyTorch, Scikit-learn, Pandas, FastAPI, SQL, Git

[자기소개 및 주요 경험]
데이터 분석 및 머신러닝 모델 개발에 열정을 가진 신입 엔지니어입니다.
대학교에서 빅데이터를 전공하며 TF-IDF와 자연어 처리(NLP) 기법을 활용한 추천 시스템 프로젝트를 진행했습니다.
Streamlit을 이용한 대시보드 구축 경험이 있으며, 공공 데이터 기반의 데이터 전처리 및 EDA에 강점이 있습니다.
FastAPI를 활용한 간단한 RESTful API 구축 경험이 있으며, 협업을 위해 Git/GitHub을 적극 활용합니다."""

with col_left:
    st.subheader("📝 자소서 및 기술 스택 입력")
    user_resume = st.text_area(
        "사용자의 이력서, 자소서 또는 보유 기술 스택을 입력하세요:",
        value=default_resume,
        height=380
    )
    
    run_btn = st.button("🔍 맞춤 공고 추천 & 분석 실행")

# 결과 출력 영역
if run_btn:
    if not user_resume.strip():
        st.warning("자소서 내용을 입력해 주세요.")
    else:
        with col_right:
            st.subheader("🏆 맞춤 추천 공고 Top 3 (하이브리드 엔진)")
            
            # 하이브리드 추천 알고리즘 실행
            recommendations = recommender.recommend(user_resume, top_n=3)
            
            for rank, (idx, row) in enumerate(recommendations.iterrows(), 1):
                comp = row.get('company', '미지정 기업')
                title = row.get('title', 'IT 개발 공고')
                similarity_score = float(row.get('similarity_score', 0.0))
                tfidf_score = float(row.get('tfidf_sim', 0.0))
                lsi_score = float(row.get('lsi_sim', 0.0))
                jd_text = str(row.get('full_jd_text', ''))
                
                matched_kws = extract_matched_keywords(user_resume, jd_text)
                title_prefix = "🥇 " if rank == 1 else f"[{rank}위] "
                
                with st.expander(f"{title_prefix}**{comp}** - {title} (종합 일치도: {similarity_score}%)", expanded=(rank==1)):
                    st.write(f"**🏢 기업명:** {comp}")
                    st.write(f"**📌 공고 제목:** {title}")
                    
                    st.write("**🎯 종합 역량 매칭 일치도:**")
                    st.progress(min(similarity_score / 100.0, 1.0))
                    st.caption(f"📊 **종합 {similarity_score}%** (키워드 매칭: {tfidf_score}% | 도메인 맥락: {lsi_score}%)")
                    
                    if matched_kws:
                        st.write("**🏷️ 매칭된 주요 기술 키워드:**")
                        chips_html = "".join([f"<span class='keyword-chip'>#{kw}</span>" for kw in matched_kws])
                        st.markdown(chips_html, unsafe_allow_html=True)
                        st.write("")
                    
                    st.markdown("**📄 공고 요약 (JD):**")
                    st.caption(jd_text[:280] + "..." if len(jd_text) > 280 else jd_text)

            st.divider()
            
            # 탭 레이아웃: [WordCloud 키워드 시각화] & [GPT 맞춤 피드백]
            tab_wc, tab_gpt = st.tabs(["📊 추천 공고 키워드 분석 (WordCloud)", "💡 GPT 자소서 AI 피드백"])
            
            # 1. WordCloud 탭 (API 없이 즉시 확인 가능)
            with tab_wc:
                st.markdown("##### 🏷️ 추천 공고군 핵심 기술 스택 워드클라우드")
                fig, kw_counts = generate_wordcloud_from_jds(recommendations['full_jd_text'])
                st.pyplot(fig)
                
                st.write("**🔥 추천 공고들에서 가장 많이 등장한 핵심 기술 Top 5:**")
                top5_kws = kw_counts.most_common(5)
                cols = st.columns(len(top5_kws))
                for i, (kw_name, count) in enumerate(top5_kws):
                    with cols[i]:
                        st.metric(label=kw_name, value=f"{count}회 빈도")

            # 2. GPT 피드백 탭
            with tab_gpt:
                top_1_jd = str(recommendations.iloc[0]['full_jd_text'])
                
                with st.spinner("GPT가 자소서와 Top 1 공고를 분석 중입니다..."):
                    feedback_engine = ResumeFeedbackEngine()
                    feedback = feedback_engine.generate_feedback(user_resume, top_1_jd)
                
                if "notice" in feedback:
                    st.info(f"ℹ️ {feedback['notice']}")
                    st.write(f"**요약:** {feedback.get('match_summary', '')}")
                    
                    col_f1, col_f2 = st.columns(2)
                    with col_f1:
                        st.success("✅ **현재 강점**")
                        for s in feedback.get('strengths', []):
                            st.write(f"- {s}")
                    with col_f2:
                        st.warning("⚡ **보완 필요 키워드**")
                        for m in feedback.get('missing_skills', []):
                            st.write(f"- {m}")
                elif "error" in feedback:
                    st.error(f"오류 발생: {feedback['error']}")
                else:
                    st.success(f"**[종합 분석 평가]** {feedback.get('match_summary', '')}")
                    
                    sub_tab1, sub_tab2, sub_tab3 = st.tabs(["💪 주요 강점", "🔍 보완 필요 역량", "🚀 개선 제안"])
                    with sub_tab1:
                        for s in feedback.get('strengths', []):
                            st.write(f"• {s}")
                    with sub_tab2:
                        for m in feedback.get('missing_skills', []):
                            st.write(f"• {m}")
                    with sub_tab3:
                        for p in feedback.get('improvement_suggestions', []):
                            st.write(f"• {p}")

else:
    with col_right:
        st.info("👈 왼쪽 영역에서 자소서 내용을 입력하고 **[맞춤 공고 추천 & 분석 실행]** 버튼을 클릭하세요.")
