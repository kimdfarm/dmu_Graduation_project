import os
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from supabase import create_client, Client
from dotenv import load_dotenv

# 수정된 크롤러 엔진 및 토큰 상태 변수 임포트
from app.crawlers.wanted import run_selenium_crawler, IS_TOKEN_EXHAUSTED as W_EXHAUSTED
from app.crawlers.jumpit import crawl_jumpit, IS_TOKEN_EXHAUSTED as J_EXHAUSTED
from app.crawlers.rallit import crawl_rallit, IS_TOKEN_EXHAUSTED as R_EXHAUSTED

# 추천 엔진 및 임베딩 재학습 함수 임포트
from app.routers.recommendation import reload_pipeline_container

load_dotenv()

CRAWL_URL = os.getenv("CRAWL_URL")
CRAWL_KEY = os.getenv("CRAWL_KEY")
supabase: Client = create_client(CRAWL_URL, CRAWL_KEY)

def delete_expired_jobs():
    """
    🧹 [데이터 유효기간 관리]
    수집된 지 3개월(90일)이 지난 오래된 채용 공고를 Supabase에서 자동으로 삭제합니다.
    """
    try:
        three_months_ago = (datetime.now() - timedelta(days=90)).isoformat()
        print(f"🧹 [데이터 정제] {three_months_ago} 이전의 오래된 공고를 찾아 삭제합니다...")
        
        response = supabase.table("companies").delete().lt("created_at", three_months_ago).execute()
        print(f"🗑️ [정제 완료] 만료된 공고 {len(response.data)}개가 안전하게 삭제되었습니다.")
        
        # 만료 공고 삭제 후 추천 엔진 임베딩 재학습
        print("🔄 [엔진 동기화] 만료 공고 삭제 반영을 위해 추천 엔진을 재학습합니다...")
        reload_pipeline_container()
        print("✅ [동기화 완료] 새벽 정기 유지보수 재학습 완료")
    except Exception as e:
        print(f"⚠️ 만료 데이터 삭제/재학습 중 에러 발생: {e}")

def run_realtime_pipeline():
    """
    🔄 [30분 주기: 수집 + 임베딩 재학습 동기화]
    30분마다 공고를 수집하고, 수집 완료 직후 추천 엔진 임베딩을 즉시 최신화합니다.
    """
    print("\n" + "="*50)
    print(f"🔄 [{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 30분 주기 수집 및 추천 엔진 동기화 가동")
    print("="*50)
    
    try:
        # 1. 원티드 수집
        print("1️⃣ 원티드 수집 시작...")
        run_selenium_crawler(limit_count=25)
        
        # 2. 점핏 수집
        if not check_token_exhausted():
            print("2️⃣ 점핏 수집 시작...")
            crawl_jumpit(limit_count=25)
        else:
            print("🛑 [Groq 토큰 고갈 감지] 점핏 수집을 건너뜁니다.")

        # 3. 렐릿 수집
        if not check_token_exhausted():
            print("3️⃣ 렐릿 수집 시작...")
            crawl_rallit(limit_count=25)
        else:
            print("🛑 [Groq 토큰 고갈 감지] 렐릿 수집을 건너뜁니다.")

        # 4. 수집 완료 후 최신 DB 반영을 위한 임베딩 모델 자동 재학습
        print("🔮 [추천 엔진 동기화] 방금 수집된 최신 공고 반영을 위해 임베딩 모델을 재학습합니다...")
        reload_pipeline_container()
        print("✅ [동기화 완료] 30분 주기 수집 및 추천 엔진 갱신이 완료되었습니다.")
        
    except Exception as e:
        print(f"⚠️ 실시간 수집 및 동기화 중 에러 발생: {e}")

def check_token_exhausted() -> bool:
    """모듈별 Groq API 토큰 고갈 상태 통합 확인"""
    from app.crawlers import wanted, jumpit, rallit
    return wanted.IS_TOKEN_EXHAUSTED or jumpit.IS_TOKEN_EXHAUSTED or rallit.IS_TOKEN_EXHAUSTED

# 백그라운드 스케줄러 설정
scheduler = BackgroundScheduler()

# 💡 30분 주기: 신규 수집 + 추천 엔진 임베딩 자동 재학습
scheduler.add_job(run_realtime_pipeline, 'interval', minutes=30, id='realtime_crawl_and_train')

# 💡 매일 새벽 3시: 3개월 지난 만료 공고 삭제 + 모델 최신화
scheduler.add_job(delete_expired_jobs, 'cron', hour=3, minute=0, id='clean_expired_data')

# 스케줄러 시작
if __name__ == "__main__":
    scheduler.start()
    print("🚀 APScheduler 구동 완료! (30분 주기 수집&학습 + 새벽 3시 만료 청소)")
    
    try:
        while True:
            pass
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        print("👋 스케줄러 동작을 정지합니다.")