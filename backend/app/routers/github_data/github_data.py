import os
import requests
from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID") or os.getenv("YOUR_GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET") or os.getenv("YOUR_GITHUB_CLIENT_SECRET")
GITHUB_REDIRECT_URI = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:5173/auth/github/callback")

router = APIRouter(
    prefix="/api/auth/github",
    tags=["GitHub Auth"]
)

class GithubAuthRequest(BaseModel):
    code: str
    user_id: str | None = None

@router.post("/callback")
def github_callback(payload: GithubAuthRequest, response: Response): # 💡 Response 객체 추가
    # 1. GitHub Access Token 요청
    token_url = "https://github.com/login/oauth/access_token"
    headers = {"Accept": "application/json"}
    data = {
        "client_id": GITHUB_CLIENT_ID,
        "client_secret": GITHUB_CLIENT_SECRET,
        "code": payload.code,
        "redirect_uri": GITHUB_REDIRECT_URI
    }

    res = requests.post(token_url, headers=headers, data=data)
    token_data = res.json()

    if "error" in token_data or res.status_code != 200:
        raise HTTPException(
            status_code=400, 
            detail=f"GitHub Token 교환 실패: {token_data.get('error_description', '알 수 없는 오류')}"
        )

    access_token = token_data.get("access_token")

    # 2. access_token으로 GitHub 유저 정보 조회
    user_res = requests.get(
        "https://api.github.com/user",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    github_user = user_res.json()

    # 3. 💡 HTTP-Only 쿠키에 GitHub Access Token 저장
    response.set_cookie(
        key="github_access_token",
        value=access_token,
        httponly=True,       # JS에서 직접 접근 불가 (XSS 보안 강화)
        max_age=60 * 60 * 24 * 7, # 쿠키 유효기간 (7일)
        samesite="lax",      # CSRF 방지
        secure=False         # 로컬 테스트용 (운영/HTTPS 환경에서는 True로 변경)
    )

    # 4. JSON 응답 반환 (프론트엔드용)
    return {
        "status": "success",
        "github_id": github_user.get("login"),
        "github_avatar_url": github_user.get("avatar_url"),
        "access_token": access_token  # 프론트엔드 전송용
    }