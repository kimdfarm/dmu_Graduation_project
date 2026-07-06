from fastapi import FastAPI
from contextlib import asynccontextmanager  # 🎯 추가 필요
from utils.scheduler import scheduler

# 🚀 서버 시작(Startup)과 종료(Shutdown)를 한 번에 관리하는 최신 lifespan 설계
@asynccontextmanager
async def lifespan(app: FastAPI):
    # [Startup 영역] 서버가 켜질 때 실행될 로직
    if not scheduler.running:
        scheduler.start()
        print("📡 [시스템 가동] 백그라운드 실시간 수집 및 3개월 만료 삭제 엔진이 정상 시작되었습니다.")
        
    yield  # 💡 서버가 가동 중인 동안은 여기서 대기합니다 (다른 API들 정상 작동)
    
    # [Shutdown 영역] 서버가 꺼질 때 실행될 로직
    if scheduler.running:
        scheduler.shutdown()
        print("🛑 [시스템 종료] 백그라운드 스케줄러가 안전하게 종료되었습니다.")

# FastAPI를 선언할 때 lifespan을 매개변수로 넣어줍니다.
app = FastAPI(title="Graduation Project AI App API", lifespan=lifespan)

# ... 기존 로그인 및 recommend API 코드들 ...