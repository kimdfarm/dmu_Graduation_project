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

load_dotenv()

CRAWL_URL = os.getenv("CRAWL_URL")
CRAWL_KEY = os.getenv("CRAWL_KEY")
GROQ_BY_CROWER = os.getenv("GROQ_BY_CROWER")

options = ClientOptions(postgrest_client_timeout=10)
supabase: Client = create_client(CRAWL_URL, CRAWL_KEY, options=options)
groq_client = Groq(api_key=GROQ_BY_CROWER)

IS_TOKEN_EXHAUSTED = False

def analyze_job_with_groq(body_text: str) -> dict:
    global IS_TOKEN_EXHAUSTED
    
    if IS_TOKEN_EXHAUSTED:
        print("🛑 [토큰 소진 상태] 추가 AI 분석 요청을 진행하지 않습니다.")
        return None

    prompt = f"""
    다음 채용 공고 텍스트를 분석하여 반드시 아래 지정된 JSON 구조로만 답변하세요. 다른 설명이나 마크다운 문법은 제외하세요.
    
    [JSON 구조]
    {{
      "company_name": "회사명 (없을 경우 '렐릿 엄선 IT기업')",
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
        print(f"⚠️ 파싱 중 일반 오류 발생: {e}")
        return {}

def crawl_rallit(limit_count: int = 10):
    global supabase, IS_TOKEN_EXHAUSTED
    print(f"🚀 [렐릿] Groq AI(gpt-oss-120b) 기반 자동 파싱 및 토큰 절약 크롤링 시작...")
    
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
    
    prefs = {"profile.managed_default_content_settings.images": 2}
    options.add_experimental_option("prefs", prefs)
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.implicitly_wait(5)
    
    saved_count = 0      
    total_scanned = 0    
    page_num = 1     

    try:
        while saved_count < limit_count:
            if IS_TOKEN_EXHAUSTED:
                print("🚨 Groq API 토큰이 고갈되어 크롤링 전체 프로세스를 멈춥니다.")
                break

            # 💡 [URL 정제] 순수 문자열 URL 구성
            target_url = f"[https://www.rallit.com/?page=](https://www.rallit.com/?page=){page_num}"
            print(f"\n📄 [렐릿 {page_num}페이지] 탐색 중... (현재 수집 상태: {saved_count}/{limit_count})")
            
            try:
                driver.get(target_url)
                time.sleep(3)
            except Exception as e:
                print(f"⚠️ 렐릿 목록 로딩 실패: {e}")
                break

            all_links = driver.find_elements(By.TAG_NAME, "a")
            page_urls = []
            
            for link in all_links:
                try:
                    href = link.get_attribute("href")
                    if href and "/positions/" in href:
                        clean_url = href.split("?")[0].strip().split("]")[0].split(")")[0]
                        if clean_url.startswith("http") and clean_url not in page_urls:
                            page_urls.append(clean_url)
                except Exception:
                    continue

            if not page_urls:
                print("🏁 렐릿 플랫폼의 모든 공고 탐색이 끝났거나 더 이상 페이지가 없습니다.")
                break

            print(f"📦 후보 공고 {len(page_urls)}개를 포착했습니다.")

            for url in page_urls:
                if saved_count >= limit_count:
                    break
                
                if IS_TOKEN_EXHAUSTED:
                    print("🚨 토큰 소진으로 인해 내부 공고 탐색 루프를 탈출합니다.")
                    break
                    
                total_scanned += 1
                
                try:
                    existing_data = supabase.table("companies").select("id").eq("job_url", url).execute()
                    if existing_data.data and len(existing_data.data) > 0:
                        print(f"⏭️ [토큰 절약] 이미 DB에 존재하는 공고입니다. AI 호출 Skip: {url}")
                        continue

                    # 💡 [페이지 이동 예외 방어]
                    try:
                        driver.get(url)
                        time.sleep(1.5)
                    except Exception as nav_e:
                        print(f"⚠️ [URL 이동 실패 패스] 잘못된 URL ({url}): {nav_e}")
                        continue

                    full_body = driver.find_element(By.TAG_NAME, "body").text
                    
                    print(f"🤖 [gpt-oss-120b 분석 중] ({saved_count + 1}/{limit_count}) - {url}")
                    ai_res = analyze_job_with_groq(full_body)
                    
                    if ai_res is None and IS_TOKEN_EXHAUSTED:
                        print("🚨 토큰이 다 소진되었습니다. 크롤러 동작을 즉시 중지합니다.")
                        break

                    if not ai_res:
                        ai_res = {}

                    skills = ai_res.get("skills", [])
                    if not skills and not ai_res.get("job_title"):
                        print(f"⏩ [유효 데이터 없음 패스] {url}")
                        continue

                    refined_job = {
                        "company_name": ai_res.get("company_name") or "렐릿 엄선 IT기업",
                        "job_title": ai_res.get("job_title") or driver.title,
                        "job_category": ai_res.get("job_category") or "렐릿",
                        "skills": skills,
                        "body_data": full_body,
                        "requirements": ai_res.get("requirements", "본문 참조"),
                        "preferred": ai_res.get("preferred", "본문 참조"),
                        "benefits": ai_res.get("benefits", "본문 참조"),
                        "another_data": ai_res.get("another_data") or f"누적 {total_scanned}번째 렐릿 탐색 성공",
                        "closing_date": ai_res.get("closing_date", "상시채용"),
                        "job_url": url,
                        "created_data": time.strftime("%Y-%m-%d %H:%M:%S")
                    }
                    
                    supabase.table("companies").upsert(refined_job, on_conflict="job_url").execute()
                    saved_count += 1
                    
                    print(f"🎯 [수집&분석 성공 ({saved_count}/{limit_count})] [{refined_job['company_name']}] - {refined_job['job_title']}")
                    
                except Exception as e:
                    print(f"⚠️ 공고 처리 중 에러 발생으로 패스: {e}")
                    continue
                    
            if saved_count < limit_count:
                page_num += 1

    finally:
        driver.quit()
        print("\n========================================================")
        print(f"🎉 [작업 종료] 총 {total_scanned}개 확인 완료 (저장 성공: {saved_count}개)")
        print("========================================================")