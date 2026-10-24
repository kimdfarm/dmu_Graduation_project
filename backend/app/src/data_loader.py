import pandas as pd
from app.core.config import get_CRAWL_supabase  # 💡 채용/크롤링 전용 Supabase 연결 함수 임포트

class RecruitDataLoader:
    """
    CRAWL_URL, CRAWL_KEY를 사용하는 채용 전용 Supabase public.companies 테이블 로더
    """
    def __init__(self):
        pass

    def load_raw_data(self) -> pd.DataFrame:
        print("[Supabase Crawl DB] public.companies 테이블에서 채용 공고 데이터 로딩 중...")
        supabase = get_CRAWL_supabase()  # 💡 채용 DB 클라이언트 호출
        response = supabase.table("companies").select("*").execute()
        
        data = response.data
        if not data:
            print("⚠️ 채용 DB(companies 테이블)에 데이터가 없습니다.")
            return pd.DataFrame()

        df = pd.DataFrame(data)
        print(f"✅ 채용 DB 원본 데이터 로드 완료: 총 {len(df)}건")
        return df

    def preprocess_for_analysis(self, sample_size: int = None) -> pd.DataFrame:
        df = self.load_raw_data()
        if df.empty:
            return df

        df_processed = df.copy()

        if sample_size and sample_size < len(df_processed):
            df_processed = df_processed.sample(n=sample_size, random_state=42).reset_index(drop=True)

        # 기존 추천 엔진 호환성을 위한 컬럼 매핑
        df_processed['company'] = df_processed['company_name'].fillna('기업명 비공개')
        df_processed['title'] = df_processed['job_title'].fillna('IT 개발자 공고')

        def list_to_str(val):
            if isinstance(val, list):
                return " ".join([str(x) for x in val])
            elif pd.isna(val):
                return ""
            return str(val)

        # 크롤링 생 데이터(body_data) 및 AI 파싱 데이터 종합 결합
        skills_str = df_processed['skills'].apply(list_to_str) if 'skills' in df_processed.columns else ''
        body_str = df_processed['body_data'].fillna('') if 'body_data' in df_processed.columns else ''
        req_str = df_processed['requirements'].fillna('') if 'requirements' in df_processed.columns else ''
        pref_str = df_processed['preferred'].fillna('') if 'preferred' in df_processed.columns else ''
        benefits_str = df_processed['benefits'].fillna('') if 'benefits' in df_processed.columns else ''
        another_str = df_processed['another_data'].fillna('') if 'another_data' in df_processed.columns else ''
        category_str = df_processed['job_category'].fillna('') if 'job_category' in df_processed.columns else ''

        df_processed['full_jd_text'] = (
            df_processed['company'] + " " +
            df_processed['title'] + " " +
            category_str + " " +
            skills_str + " " +
            req_str + " " +
            pref_str + " " +
            body_str + " " +
            benefits_str + " " +
            another_str
        ).str.strip()

        print(f"✅ 채용 공고 데이터 전처리 완료: {len(df_processed)}건 준비됨")
        return df_processed