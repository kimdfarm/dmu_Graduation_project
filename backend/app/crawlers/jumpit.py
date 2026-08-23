import os
import json
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
from groq import Groq, APIError, RateLimitError
from app.core.config import GROQ_BY_CROWER

load_dotenv()

CRAWL_URL = os.getenv("CRAWL_URL")
CRAWL_KEY = os.getenv("CRAWL_KEY")

options = ClientOptions(postgrest_client_timeout=10)
supabase: Client = create_client(CRAWL_URL, CRAWL_KEY, options=options)
groq_client = Groq(api_key=GROQ_BY_CROWER)

IS_TOKEN_EXHAUSTED = False

def analyze_job_with_groq(body_text: str) -> dict:
    global IS_TOKEN_EXHAUSTED
    
    if IS_TOKEN_EXHAUSTED:
        print("🛑 [토큰 소진] 더 이상 Groq API를 호출하지 않습니다.")
        return None

    prompt = f"""
    다음 채용 공고 텍스트를 분석하여 반드시 아래 지정된 JSON 구조로만 답변하세요. 다른 설명은 제외하세요.
    
    [JSON 구조]
    {{
      "company_name": "회사명 (없을 경우 '우수 IT 기업')",
      "job_title": "채용 직무/포지션 제목",
      "job_category": "직무 카테고리 (예: 백엔드, 프론트엔드, AI/ML 등)",
      "skills": ["주요 기술 스택 문자열 배열"],
      "requirements": "자격요건 내용 요약",
      "preferred": "우대사항 내용 요약 (없으면 '없음')",
      "benefits": "복리후생 및 혜택 요약 (없으면 '없음')",
      "another_data": "기타 참고 정보 (근무지, 채용 절차 등)",
      "closing_date": "마감일 (예: '상시채용' 또는 'YYYY-MM-DD')"
    }}

    [채용 공고 본문]
    {body_text[:4000]}
    """

    try:
        response = groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": "You are a precise data extractor. Always reply with valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1
        )
        
        content = response.choices[0].message.content.strip()
        if content.startswith("```json"):
            content = content.replace("```json", "").replace("```", "").strip()
        elif content.startswith("```"):
            content = content.replace("```", "").strip()

        return json.loads(content)

    except RateLimitError as e:
        print(f"🛑 [GROQ API 토큰/한도 소진] RateLimitError 발생: {e}")
        IS_TOKEN_EXHAUSTED = True
        return None

    except APIError as e:
        if e.status_code == 429 or "quota" in str(e).lower() or "rate_limit" in str(e).lower():
            print(f"🛑 [GROQ API 토큰 소진] Quota Exceeded (HTTP 429) 감지: {e}")
            IS_TOKEN_EXHAUSTED = True
            return None
        print(f"⚠️ Groq API 일반 오류 발생: {e}")
        return {}

    except Exception as e:
        print(f"⚠️ 분석 중 일반 오류 발생: {e}")
        return {}

def crawl_jumpit(limit_count: int = 10):
    global supabase, IS_TOKEN_EXHAUSTED
    print("🚀 [점핏] openai/gpt-oss-120b AI 모델을 사용한 수집을 시작합니다...")
    
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    
    try:
        # 💡 [URL 정제] 마크다운 링크 문법 제거
        driver.get("https://www.jumpit.co.kr/positions")
        time.sleep(4)
        
        for _ in range(2):
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(1.5)
            
        links = driver.find_elements(By.XPATH, "//a[contains(@href, '/position/')]")
        job_urls = []
        for link in links:
            href = link.get_attribute("href")
            if href and "/position/" in href:
                clean_url = href.strip().split("]")[0].split(")")[0]
                if clean_url.startswith("http") and clean_url not in job_urls:
                    job_urls.append(clean_url)
                
        target_urls = job_urls[:limit_count]
        print(f"📦 총 {len(target_urls)}개의 공고 URL을 체크합니다.")
        
        for url in target_urls:
            if IS_TOKEN_EXHAUSTED:
                print("🚨 Groq API 토큰이 모두 소진되어 크롤러 가동을 중단합니다.")
                break

            try:
                existing_data = supabase.table("companies").select("id").eq("job_url", url).execute()
                if existing_data.data and len(existing_data.data) > 0:
                    print(f"⏭️ [토큰 절약] 이미 존재함. AI 호출 Skip: {url}")
                    continue

                # 💡 [페이지 이동 예외 방어]
                try:
                    driver.get(url)
                    time.sleep(3)
                except Exception as nav_e:
                    print(f"⚠️ [URL 이동 실패 패스] 잘못된 URL ({url}): {nav_e}")
                    continue

                full_body = driver.find_element(By.TAG_NAME, "body").text
                
                print(f"🤖 [gpt-oss-120b 분석 시작] {url}")
                ai_res = analyze_job_with_groq(full_body)
                
                if ai_res is None and IS_TOKEN_EXHAUSTED:
                    print("🚨 토큰 소진으로 인해 추가 작업을 즉시 멈춥니다.")
                    break

                if not ai_res:
                    ai_res = {}

                refined_job = {
                    "company_name": ai_res.get("company_name") or "우수 IT 기업",
                    "job_title": ai_res.get("job_title") or driver.title,
                    "job_category": ai_res.get("job_category") or "점핏",
                    "skills": ai_res.get("skills", []),
                    "body_data": full_body,
                    "requirements": ai_res.get("requirements", "본문 참조"),
                    "preferred": ai_res.get("preferred", "본문 참조"),
                    "benefits": ai_res.get("benefits", "본문 참조"),
                    "another_data": ai_res.get("another_data", "전처리 완료"),
                    "closing_date": ai_res.get("closing_date", "상시채용"),
                    "job_url": url,
                    "created_data": time.strftime("%Y-%m-%d %H:%M:%S")
                }
                
                supabase.table("companies").upsert(refined_job, on_conflict="job_url").execute()
                print(f"✅ [저장 성공] [{refined_job['company_name']}] - {refined_job['job_title']}")
                
            except Exception as e:
                print(f"⚠️ 처리 실패 ({url}): {e}")
                continue

    finally:
        driver.quit()
        print("🎉 크롤러 작업이 종료되었습니다.")