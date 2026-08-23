from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from supabase import Client
from app.core.config import get_CRAWL_supabase 

router = APIRouter(
    prefix="/api/jobs",
    tags=["jobs"]
)

@router.get("")
def get_jobs(
    page: int = Query(1, ge=1, description="페이지 번호"),
    limit: int = Query(9, ge=1, le=100, description="페이지당 개수"),
    search: Optional[str] = Query(None, description="회사명, 직무명, 요구사항 통합 검색"),
    category: Optional[str] = Query(None, description="직무 카테고리 필터"),
    supabase: Client = Depends(get_CRAWL_supabase)
):
    """
    companies 테이블의 전체 필드를 조회합니다.
    """
    offset = (page - 1) * limit

    # 전체 컬럼(*) 선택 및 count 옵션 지정
    query = supabase.table("companies").select("*", count="exact")

    # 검색어가 있을 경우 (회사명, 직무 제목, 요구사항 범위 검색)
    if search:
        query = query.or_(
            f"company_name.ilike.%{search}%,"
            f"job_title.ilike.%{search}%,"
            f"requirements.ilike.%{search}%"
        )

    # 카테고리 필터
    if category and category != "ALL":
        query = query.eq("job_category", category)

    # 최신 ID 순 정렬 및 범위 지정
    response = query.order("id", desc=True).range(offset, offset + limit - 1).execute()

    total_count = response.count if response.count is not None else 0

    return {
        "data": response.data,
        "page": page,
        "limit": limit,
        "total": total_count,
        "total_pages": (total_count + limit - 1) // limit if total_count > 0 else 1
    }


@router.get("/{job_id}")
def get_job_detail(
    job_id: int,
    supabase: Client = Depends(get_CRAWL_supabase)
):
    """
    단일 공고의 모든 컬럼 상세 데이터를 조회합니다.
    """
    response = supabase.table("companies").select("*").eq("id", job_id).single().execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="해당 ID의 채용 공고를 찾을 수 없습니다.")
        
    return response.data