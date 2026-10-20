import pandas as pd
import re
from datasets import load_dataset

class RecruitDataLoader:
    """
    data-craftee/korean-it-recruit-dataset 로더 및 정제 전처리 클래스
    """
    def __init__(self, dataset_name: str = "data-craftee/korean-it-recruit-dataset"):
        self.dataset_name = dataset_name
        self.df = None

    def load_raw_data(self) -> pd.DataFrame:
        """Hugging Face에서 원본 데이터셋 로드"""
        print(f"[{self.dataset_name}] 데이터셋 로딩 중...")
        ds = load_dataset(self.dataset_name)
        self.df = pd.DataFrame(ds['train'])
        print(f"✅ 원본 데이터 로드 완료: 총 {len(self.df)}건")
        return self.df

    def _clean_title(self, row) -> str:
        """title이 NaN일 때 raw_text에서 핵심 포지션/제목을 추출하는 보완 함수"""
        title = row.get('title')
        if pd.notna(title) and str(title).strip() and str(title).strip().lower() != 'nan':
            return str(title).strip()
        
        # raw_text의 첫 세 줄 중에서 [모집분야] 또는 포지션 키워드 추출 시도
        raw_text = str(row.get('raw_text', ''))
        lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
        
        for line in lines[:3]:
            # [상장사_AI Engineer] 또는 모집분야 키워드 탐색
            if '모집분야' in line or '포지션' in line or '[' in line:
                cleaned_line = re.sub(r'모집분야|포지션\s*[:|]?', '', line).strip()
                if cleaned_line:
                    return cleaned_line[:40]  # 너무 길면 40자로 절삭
                    
        return "IT 기술/개발 포지션 공고"

    def _clean_company(self, row) -> str:
        """company가 NaN일 때 raw_text나 회사소개 문구에서 기업명을 추출하는 보완 함수"""
        company = row.get('company')
        if pd.notna(company) and str(company).strip() and str(company).strip().lower() != 'nan':
            return str(company).strip()

        # raw_text에서 회사명 관련 문구 탐색
        raw_text = str(row.get('raw_text', ''))
        
        # '○○ 기업', '○○ 주식회사' 패턴 탐색
        match = re.search(r'([가-힣a-zA-A0-9㈜\(株\)]+\s*(?:기업|전문기업|솔루션|테크|시스템즈|컴퍼니))', raw_text)
        if match:
            found_company = match.group(1).strip()
            if len(found_company) > 1 and "모집" not in found_company:
                return f"{found_company} (비공개/비지정)"

        return "기업명 비공개 (헤드헌팅/블라인드 공고)"

    def preprocess_for_analysis(self, sample_size: int = None) -> pd.DataFrame:
        """
        결측치 보완 및 분석/추천용 통합 텍스트 컬럼 생성
        """
        if self.df is None:
            self.load_raw_data()

        df_processed = self.df.copy()

        if sample_size and sample_size < len(df_processed):
            df_processed = df_processed.sample(n=sample_size, random_state=42).reset_index(drop=True)

        # 1. 기업명(company) 및 공고제목(title) 결측치 보완 및 정제
        df_processed['company'] = df_processed.apply(self._clean_company, axis=1)
        df_processed['title'] = df_processed.apply(self._clean_title, axis=1)

        # 2. 리스트 형태의 텍스트 컬럼 정제 함수
        def list_to_str(val):
            if isinstance(val, list):
                return " ".join([str(x) for x in val])
            elif pd.isna(val):
                return ""
            return str(val)

        # 3. 핵심 컬럼 결합하여 full_jd_text 생성
        raw_text = df_processed['raw_text'].apply(list_to_str) if 'raw_text' in df_processed.columns else ''
        hard_skills = df_processed['hard_skills'].apply(list_to_str) if 'hard_skills' in df_processed.columns else ''
        final_techs = df_processed['final_techs'].apply(list_to_str) if 'final_techs' in df_processed.columns else ''
        preferences = df_processed['preferences'].apply(list_to_str) if 'preferences' in df_processed.columns else ''

        df_processed['full_jd_text'] = (raw_text + " " + hard_skills + " " + final_techs + " " + preferences).str.strip()

        print(f"✅ 전처리 및 결측치 보완 완료: {len(df_processed)}건 준비됨")
        return df_processed


if __name__ == "__main__":
    loader = RecruitDataLoader()
    df_sample = loader.preprocess_for_analysis(sample_size=3000)
    print("\n--- 정제된 데이터 샘플 확인 ---")
    print(df_sample[['company', 'title']].head(5))
