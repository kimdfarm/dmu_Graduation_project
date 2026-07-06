import os
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from supabase import create_client, Client
from dotenv import load_dotenv

# 기존에 만들어둔 크롤러 엔진 임포트 (경로에 맞게 확인해주세요)
from crawlers.wanted import run_selenium_crawler
from crawlers.jumpit import crawl_jumpit
from crawlers.rallit import crawl_rallit

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def delete_expired_jobs():
    """
    🧹 [데이터 유효기간 관리]
    수집된 지 3개월(90일)이 지난 오래된 채용 공고를 Supabase에서 자동으로 삭제합니다.
    """
    try:
        # 3개월 전 날짜 계산
        three_months_ago = (datetime.now() - timedelta(days=90)).isoformat()
        
        print(f"🧹 [데이터 정제] {three_months_ago} 이전의 오래된 공고를 찾아 삭제합니다...")
        
        # Supabase에서 created_at(또는 수집일자 필드)이 3개월 전보다 작은 데이터 삭제
        # 데이터베이스 테이블에 created_at 필드가 기본적으로 존재한다고 가정합니다.
        response = supabase.table("companies").delete().lt("created_at", three_months_ago).execute()
        
        print(f"🗑️ [정제 완료] 만료된 공고 {len(response.data)}개가 안전하게 삭제되었습니다.")
    except Exception as e:
        print(f"⚠️ 만료 데이터 삭제 중 에러 발생: {e}")

def run_realtime_pipeline():
    """
    🔄 [실시간 수집 릴레이]
    백엔드가 도는 동안 다른 플랫폼의 데이터를 실시간으로 순환 수집합니다.
    """
    print(("\n" + "="*50 + "\n🔄 [실시간 파이프라인] 최신 IT 공고 수집 주기를 시작합니다!\n" + "="*50))
    
    try:
        # 각 사이트별로 부담 없는 선(예: 25개씩)으로 실시간 동기화
        print("1️⃣ 원티드 수집 시작...")
        run_selenium_crawler(limit_count=25)
        
        print("2️⃣ 점핏 수집 시작...")
        crawl_jumpit(limit_count=25)
        
        print("3️⃣ 렐릿 수집 시작...")
        crawl_rallit(limit_count=25)
        
    except Exception as e:
        print(f"⚠️ 실시간 수집 중 에러 발생: {e}")

# 백그라운드 스케줄러 설정
scheduler = BackgroundScheduler()

# 💡 실시간 수집: 6시간마다 새로운 공고가 있는지 파이프라인 가동
scheduler.add_job(run_realtime_pipeline, 'interval', hours=6, id='realtime_crawl')

# 💡 유효기간 관리: 매일 새벽 3시에 3개월 지난 만료 데이터 청소
scheduler.add_job(delete_expired_jobs, 'cron', hour=3, minute=0, id='clean_expired_data')