import os
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from supabase import create_client, Client
from dotenv import load_dotenv

# 수정된 크롤러 엔진 및 토큰 상태 변수 임포트
from app.crawlers.wanted import run_selenium_crawler, IS_TOKEN_EXHAUSTED as W_EXHAUSTED
from app.crawlers.jumpit import crawl_jumpit, IS_TOKEN_EXHAUSTED as J_EXHAUSTED
from app.crawlers.rallit import crawl_rallit, IS_TOKEN_EXHAUSTED as R_EXHAUSTED

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
    except Exception as e:
        print(f"⚠️ 만료 데이터 삭제 중 에러 발생: {e}")

def run_realtime_pipeline():
    """
    🔄 [실시간 수집 릴레이]
    10분마다 실행되며, Groq 토큰 상태를 체크하여 공고를 순환 수집합니다.
    """
    print("\n" + "="*50)
    print(f"🔄 [{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 10분 주기 채용 공고 수집 파이프라인 가동")
    print("="*50)
    
    try:
        # 1. 원티드 수집
        print("1️⃣ 원티드 수집 시작...")
        run_selenium_crawler(limit_count=25)
        
        # 2. 점핏 수집 (원티드 작업 중 토큰이 소진되었는지 체크)
        if check_token_exhausted():
            print("🛑 [Groq 토큰 고갈 감지] 점핏/렐릿 수집을 건너뛰고 다음 주기에 재시도합니다.")
            return
            
        print("2️⃣ 점핏 수집 시작...")
        crawl_jumpit(limit_count=25)
        
        # 3. 렐릿 수집 (점핏 작업 중 토큰이 소진되었는지 체크)
        if check_token_exhausted():
            print("🛑 [Groq 토큰 고갈 감지] 렐릿 수집을 건너뛰고 다음 주기에 재시도합니다.")
            return

        print("3️⃣ 렐릿 수집 시작...")
        crawl_rallit(limit_count=25)
        
    except Exception as e:
        print(f"⚠️ 실시간 수집 중 에러 발생: {e}")

def check_token_exhausted() -> bool:
    """모듈별 Groq API 토큰 고갈 상태 통합 확인"""
    from app.crawlers import wanted, jumpit, rallit
    return wanted.IS_TOKEN_EXHAUSTED or jumpit.IS_TOKEN_EXHAUSTED or rallit.IS_TOKEN_EXHAUSTED

# 백그라운드 스케줄러 설정
scheduler = BackgroundScheduler()

# 💡 실시간 수집: 10분마다 파이프라인가동 (minutes=10)
scheduler.add_job(run_realtime_pipeline, 'interval', minutes=10, id='realtime_crawl')

# 💡 유효기간 관리: 매일 새벽 3시에 3개월 지난 만료 데이터 청소
scheduler.add_job(delete_expired_jobs, 'cron', hour=3, minute=0, id='clean_expired_data')

# 스케줄러 시작 (메인 백엔드 애플리케이션 실행 시 구동)
if __name__ == "__main__":
    scheduler.start()
    print("🚀 APScheduler가 성공적으로 구동되었습니다. (수집 주기: 10분)")
    
    # 프로세스 유지용
    try:
        while True:
            pass
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        print("👋 스케줄러 동작을 정지합니다.")