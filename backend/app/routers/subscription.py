from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime, timedelta
from app.core.config import get_supabase 

router = APIRouter(
    prefix="/api/subscription",
    tags=["Subscription & Credit"]
)

# --- 요청 데이터 스키마 (Pydantic) ---
class CheckoutRequest(BaseModel):
    member_id: str
    plan_type: str = "PRO"  # 기본 PRO 플랜

class UseCreditRequest(BaseModel):
    member_id: str
    amount: int = 1         # 기본 1크레딧 차감


# 1. 유저의 현재 구독 및 크레딧 정보 조회
@router.get("/{member_id}")
def get_user_subscription_info(member_id: str, supabase = Depends(get_supabase)):
    # 구독 정보 조회
    sub_res = supabase.table("subscriptions").select("*").eq("member_id", member_id).order("created_at", desc=True).limit(1).execute()
    
    # 크레딧 정보 조회
    credit_res = supabase.table("user_credits").select("balance").eq("member_id", member_id).execute()
    
    current_credit = credit_res.data[0]["balance"] if credit_res.data else 50 # 기본값 50
    active_subscription = sub_res.data[0] if sub_res.data else None

    return {
        "member_id": member_id,
        "credit_balance": current_credit,
        "subscription": active_subscription
    }


# 2. 결제 완료 후 구독 활성화 및 크레딧 충전 (웹훅 또는 결제 성공 API)
@router.post("/checkout-success")
def handle_checkout_success(data: CheckoutRequest, supabase = Depends(get_supabase)):
    now = datetime.utcnow()
    expires_at = now + timedelta(days=30) # 30일간 구독 유지
    
    # 💡 플랜 종류에 따른 고정 토큰 지급량 설정 (FREE: 50, PRO: 500)
    target_balance = 500 if data.plan_type == "PRO" else 50
    
    try:
        # A. subscriptions 테이블에 새 구독 정보 추가 (또는 기존 활성 구독 갱신)
        # 기존 구독을 취소/만료 처리하거나 최신 구독으로 쌓는 방식 중 선택
        supabase.table("subscriptions").insert({
            "member_id": data.member_id,
            "status": "active",
            "plan_type": data.plan_type,
            "started_at": now.isoformat(),
            "expires_at": expires_at.isoformat()
        }).execute()

        # B. user_credits 테이블 업데이트 (누적 방식이 아닌 플랜별 고정 토큰으로 덮어씌우기)
        credit_check = supabase.table("user_credits").select("balance").eq("member_id", data.member_id).execute()
        
        if credit_check.data:
            # 💡 기존에 더하기(+) 하던 방식을 버리고 선택한 플랜의 정해진 토큰 수량으로 고정
            supabase.table("user_credits").update({
                "balance": target_balance, 
                "updated_at": now.isoformat()
            }).eq("member_id", data.member_id).execute()
        else:
            supabase.table("user_credits").insert({
                "member_id": data.member_id, 
                "balance": target_balance
            }).execute()

        # C. 토큰 지급/변경 내역 로그 기록
        supabase.table("credit_transactions").insert({
            "member_id": data.member_id,
            "amount": target_balance,
            "transaction_type": "PLAN_CHANGE",
            "description": f"{data.plan_type} 플랜 적용에 따른 AI 토큰 설정"
        }).execute()

        return {
            "success": True, 
            "message": f"[{data.plan_type}] 플랜이 적용되었습니다. (AI 토큰: {target_balance}개)"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 3. AI 기능 사용 시 크레딧 차감 API (서버 단에서 안전하게 호출)
@router.post("/use-credit")
def use_credit(data: UseCreditRequest, supabase = Depends(get_supabase)):
    # 1. 현재 남은 크레딧 확인
    credit_res = supabase.table("user_credits").select("balance").eq("member_id", data.member_id).execute()
    
    if not credit_res.data:
        raise HTTPException(status_code=404, detail="유저 크레딧 정보를 찾을 수 없습니다.")
    
    current_balance = credit_res.data[0]["balance"]
    
    # 2. 잔액 부족 검증
    if current_balance < data.amount:
        raise HTTPException(status_code=402, detail="크레딧이 부족합니다. 충전 후 이용해주세요.")
    
    new_balance = current_balance - data.amount
    
    try:
        # 3. 크레딧 차감 업데이트
        supabase.table("user_credits").update({"balance": new_balance, "updated_at": datetime.utcnow().isoformat()}).eq("member_id", data.member_id).execute()
        
        # 4. 사용 내역 로그 기록
        supabase.table("credit_transactions").insert({
            "member_id": data.member_id,
            "amount": -data.amount,
            "transaction_type": "AI_CORRECTION",
            "description": "AI 교정 기능 사용"
        }).execute()
        
        return {"success": True, "remaining_credit": new_balance}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class AddCreditRequest(BaseModel):
    member_id: str
    amount: int = 10

# 💡 패스(에너지) 충전 API
@router.post("/add-credit")
def add_credit(data: AddCreditRequest, supabase = Depends(get_supabase)):
    # 1. 현재 잔액 조회
    credit_res = supabase.table("user_credits").select("balance").eq("member_id", data.member_id).execute()
    
    current_balance = credit_res.data[0]["balance"] if credit_res.data else 50
    new_balance = current_balance + data.amount
    
    try:
        # 2. 잔액 업데이트
        supabase.table("user_credits").update({
            "balance": new_balance, 
            "updated_at": datetime.utcnow().isoformat()
        }).eq("member_id", data.member_id).execute()
        
        # 3. 로그 기록
        supabase.table("credit_transactions").insert({
            "member_id": data.member_id,
            "amount": data.amount,
            "transaction_type": "BONUS",
            "description": "테스트 에너지 충전"
        }).execute()
        
        return {"success": True, "remaining_credit": new_balance}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 기존 subscription.py 라우터에 추가하거나 별도 라우터로 구성
@router.post("/estimate-energy")
def estimate_energy_cost(data: dict):
    """
    분석할 데이터의 크기(예: 커밋 메시지 총 글자수 또는 선택된 저장소 개수)를 받아 
    소모될 에너지를 사전 계산하여 반환합니다.
    """
    text_length = data.get("text_length", 0)
    repo_count = data.get("repo_count", 1)
    
    # 예시 산정 로직: 저장소당 기본 5 에너지 + 텍스트 1,000자당 1에너지 추가 (상황에 맞게 조절)
    calculated_cost = (repo_count * 5) + max(1, text_length // 1000)
    
    return {
        "success": True,
        "estimated_energy": calculated_cost,
        "message": f"이 작업은 총 {calculated_cost}개의 에너지를 소모합니다."
    }