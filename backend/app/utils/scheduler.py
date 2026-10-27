import os
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from supabase import create_client, Client
from dotenv import load_dotenv

# 수정된 크롤러 엔진 및 토큰 상태 변수 임포트
from app.crawlers.wanted import crawl_wanted, IS_TOKEN_EXHAUSTED as W_EXHAUSTED
from app.crawlers.jumpit import crawl_jumpit, IS_TOKEN_EXHAUSTED as J_EXHAUSTED
from app.crawlers.rallit import crawl_rallit, IS_TOKEN_EXHAUSTED as R_EXHAUSTED

# 추천 엔진 재학습 함수 임포트
from app.routers.recommendation import reload_pipeline_container

load_dotenv()

CRAWL_URL = os.getenv("CRAWL_URL")
CRAWL_KEY = os.getenv("CRAWL_KEY")
supabase: Client = create_client(CRAWL_URL, CRAWL_KEY)

def get_total_job_count() -> int:
    """Supabase companies 테이블의 현재 총 공고 개수를 조회합니다."""
    try:
        response = supabase.table("companies").select("id", count="exact").execute()
        return response.count if response.count is not None else 0
    except Exception as e:
        print(f"⚠️ 공고 개수 조회 중 에러 발생: {e}")
        return -1

def delete_expired_jobs():
    """
    🧹 [데이터 유효기간 관리]
    수집된 지 3개월(90일)이 지난 오래된 채용 공고를 Supabase에서 자동으로 삭제합니다.
    실제로 삭제된 데이터가 있는 경우에만 추천 엔진을 재학습합니다.
    """
    try:
        three_months_ago = (datetime.now() - timedelta(days=90)).isoformat()
        print(f"🧹 [데이터 정제] {three_months_ago} 이전의 오래된 공고를 찾아 삭제합니다...")
        
        # 삭제 전 총 개수 확인
        count_before = get_total_job_count()
        
        response = supabase.table("companies").delete().lt("created_at", three_months_ago).execute()
        deleted_data = response.data
        deleted_count = len(deleted_data) if deleted_data else 0
        
        print(f"🗑️ [정제 완료] 만료된 공고 {deleted_count}개가 삭제되었습니다.")
        
        # 💡 실제로 삭제된 데이터가 있을 때만 재학습 수행
        if deleted_count > 0:
            print("🔄 [엔진 동기화] 만료 공고 삭제 반영을 위해 추천 엔진을 재학습합니다...")
            reload_pipeline_container()
            print("✅ [동기화 완료] 새벽 정기 유지보수 재학습 완료")
        else:
            print("✨ [스킵] 삭제된 만료 공고가 없어 추천 엔진 재학습을 생략합니다.")
            
    except Exception as e:
        print(f"⚠️ 만료 데이터 삭제/재학습 중 에러 발생: {e}")

def run_realtime_pipeline():
    """
    🔄 [30분 주기: 수집 + 변동 감지 시 추천 엔진 동기화]
    30분마다 공고를 수집하고, 수집 전후의 데이터 개수를 비교하여 
    신규 공고가 실제로 늘어났을 때만 추천 엔진을 최신화합니다.
    """
    print("\n" + "="*50)
    print(f"🔄 [{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 30분 주기 실시간 수집 가동")
    print("="*50)
    
    try:
        # 수집 전 데이터 총 개수 측정
        count_before = get_total_job_count()
        print(f"📊 [수집 전] 현재 DB 총 공고 수: {count_before}개")

        # 1. 원티드 수집
        print("1️⃣ 원티드 수집 시작...")
        crawl_wanted(limit_count=25)
        
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

        # 수집 후 데이터 총 개수 측정
        count_after = get_total_job_count()
        print(f"📊 [수집 후] 현재 DB 총 공고 수: {count_after}개")

        # 💡 [핵심 최적화] 수집 전후 개수를 비교하여 신규 공고가 유입된 경우에만 재학습
        if count_after > count_before:
            new_jobs_count = count_after - count_before
            print(f"🚀 [신규 공고 감지] {new_jobs_count}개의 새로운 공고가 추가되었습니다. 추천 엔진을 동기화합니다...")
            reload_pipeline_container()
            print("✅ [동기화 완료] 추천 엔진 갱신이 완료되었습니다.")
        else:
            print("✨ [스킵] 새로 수집된 공고가 없으므로 자원 절약을 위해 추천 엔진 재학습을 생략합니다.")
        
    except Exception as e:
        print(f"⚠️ 실시간 수집 및 동기화 중 에러 발생: {e}")

def check_token_exhausted() -> bool:
    """모듈별 Groq API 토큰 고갈 상태 통합 확인"""
    from app.crawlers import wanted, jumpit, rallit
    return wanted.IS_TOKEN_EXHAUSTED or jumpit.IS_TOKEN_EXHAUSTED or rallit.IS_TOKEN_EXHAUSTED

# 백그라운드 스케줄러 설정
scheduler = BackgroundScheduler()

# 💡 30분 주기: 신규 수집 + 데이터 변동 시에만 추천 엔진 자동 재학습
scheduler.add_job(run_realtime_pipeline, 'interval', minutes=30, id='realtime_crawl_and_train')

# 💡 매일 새벽 3시: 3개월 지난 만료 공고 삭제 + 데이터 변동 시 모델 최신화
scheduler.add_job(delete_expired_jobs, 'cron', hour=3, minute=0, id='clean_expired_data')

# 스케줄러 시작
if __name__ == "__main__":
    scheduler.start()
    print("🚀 APScheduler 구동 완료! (30분 주기 스마트 수집&학습 + 새벽 3시 만료 청소)")
    
    try:
        while True:
            pass
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        print("👋 스케줄러 동작을 정지합니다.")