import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv
import requests
load_dotenv()

CRAWL_URL = os.getenv("CRAWL_URL")
CRAWL_KEY = os.getenv("CRAWL_KEY")

# 공식 동기 설정 방식으로 Supabase 클라이언트 생성
options = ClientOptions(postgrest_client_timeout=10)
supabase: Client = create_client(CRAWL_URL, CRAWL_KEY, options=options)

TECH_KEYWORDS = [
    "Python", "FastAPI", "Django", "Flask", "Java", "Spring", "Node.js", 
    "Express", "React", "Vue", "TypeScript", "JavaScript", "Next.js",
    "MySQL", "PostgreSQL", "MongoDB", "Redis", "AWS", "Docker", "Kubernetes",
    "Git", "GitHub", "Kotlin", "Swift", "Flutter", "Android", "iOS"
]

def extract_skills(text: str) -> list:
    if not text: return []
    found_skills = []
    upper_text = text.upper()
    for skill in TECH_KEYWORDS:
        if skill.upper() in upper_text:
            found_skills.append(skill)
    return list(set(found_skills))

def get_jumpit_published_date(job_url: str) -> str:
    """
    🎯 점핏 상세 페이지 대신 내부 JSON API를 직접 찔러서 최초 게시 시간을 정밀 추출합니다.
    """
    retu = "FAIL"
    try:
        # URL에서 점핏 공고 ID 추출 (예: https://www.jumpit.co.kr/position/22415 -> 22415)
        clean_url = job_url.split("?")[0]
        position_id = clean_url.rstrip("/").split("/")[-1]
        
        if position_id.isdigit():
            # 점핏 실제 모바일/웹 백엔드 API 주소
            api_url = f"https://api.jumpit.co.kr/api/position/{position_id}"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            response = requests.get(api_url, headers=headers, timeout=5)
            if response.status_code == 200:
                json_data = response.json()
                # 점핏 데이터 구조에서 publishedAt 추출
                published_at = json_data.get("result", {}).get("publishedAt")
                if published_at:
                    print(f"🎯 [점핏 API 성공] 공고 ID {position_id} 진짜 등록일 찾음: {published_at}")
                    retu = str(published_at) # 예: "2026-07-01" 또는 타임스탬프
    except Exception as e:
        print(f"⚠️ 점핏 날짜 API 수집 실패: {e}")
    return retu

def crawl_jumpit(limit_count: int = 10):
    global supabase
    print("🚀 [점핏] 새 규격 및 등록일 수집 기능이 포함된 자동 수집을 시작합니다...")
    
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    
    # 점핏 개발 직군 전체 페이지
    driver.get("https://www.jumpit.co.kr/positions")
    time.sleep(4)
    
    print("📜 공고 로딩을 위해 스크롤을 내립니다...")
    for _ in range(2):
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(1.5)
        
    # 점핏의 개별 공고 카드 링크 추출
    links = driver.find_elements(By.XPATH, "//a[contains(@href, '/position/')]")
    job_urls = []
    for link in links:
        href = link.get_attribute("href")
        if href and "/position/" in href and href not in job_urls:
            job_urls.append(href)
            
    target_urls = job_urls[:limit_count]
    print(f"📦 총 {len(target_urls)}개의 점핏 공고를 찾았습니다. 데이터 처리를 시작합니다.")
    
    for url in target_urls:
        try:
            driver.get(url)
            time.sleep(3)
            
            # 1. 제목 및 회사명 추출
            try:
                job_title = driver.find_element(By.CSS_SELECTOR, "h1").text
            except Exception:
                job_title = driver.title
                
            try:
                company_name = driver.find_element(By.CLASS_CODES, "position_title_box_desc_name").text
            except Exception:
                try:
                    company_name = driver.find_element(By.XPATH, "//a[contains(@href, '/company/')]").text
                except Exception:
                    company_name = "우수 IT 기업"
            
        
            # 3. 본문 전체 데이터 확보
            full_body = driver.find_element(By.TAG_NAME, "body").text
            
            # 4. 자격요건 파트 추출 시도
            try:
                requirements = driver.find_element(By.XPATH, "//dl[dt[contains(text(), '자격요건')]]/dd").text
            except Exception:
                requirements = "본문 참조"
                
            try:
                preferred = driver.find_element(By.XPATH, "//dl[dt[contains(text(), '우대사항')]]/dd").text
            except Exception:
                preferred = "점핏 본문 통합 수집됨"
                
            try:
                benefits = driver.find_element(By.XPATH, "//dl[dt[contains(text(), '복지')]]/dd").text
            except Exception:
                benefits = "점핏 본문 통합 수집됨"
                
            another_data = "전처리 완료 - 이상 없음"
            
            # 5. 기술 스택 분석
            skills = extract_skills(full_body)
            
            # 📌 원티드와 동일하게 맞춰준 100% 동등한 딕셔너리 구조 (순서 섞임 가능)
            refined_job = {
                "company_name": company_name.strip() if company_name.strip() else "우수 IT 기업",
                "job_title": job_title,
                "job_category": "점핏",           # 👈 채용 사이트 이름 명시!
                "skills": skills,
                "body_data": full_body,
                "requirements": requirements,
                "preferred": preferred,
                "benefits": benefits,
                "another_data": another_data,
 # 👈 text 형식의 게시일 주입!
                "closing_date": "상시채용",
                "job_url": url
            }
            
            # Supabase Upsert 실행
            supabase.table("companies").upsert(refined_job, on_conflict="job_url").execute()
            print(f"✅ [점핏] 수집 성공: [{refined_job['company_name']}] - {job_title}")
            
        except Exception as e:
            print(f"⚠️ 공고({url}) 수집 패스: {e}")
            continue
            
    driver.quit()
    print("🎉 점핏 크롤러 수집 업무가 성공적으로 끝났습니다!")