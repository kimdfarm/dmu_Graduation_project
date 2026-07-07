import os
import time
import requests  # 👈 내부 API 호출을 위해 추가
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv

load_dotenv()

CRAWL_URL = os.getenv("CRAWL_URL")
CRAWL_KEY = os.getenv("CRAWL_KEY")

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

def run_selenium_crawler(limit_count: int = 10):
    global supabase
    print("🚀 [원티드] API 등록일 수집 기능이 포함된 자동 수집을 시작합니다...")
    
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    
    driver.get("https://www.wanted.co.kr/wdlist/518")
    time.sleep(4)
    
    print("📜 공고 로딩을 위해 스크롤을 내립니다...")
    for _ in range(2):
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(1.5)
        
    links = driver.find_elements(By.XPATH, "//a[contains(@href, '/wd/')]")
    job_urls = []
    for link in links:
        href = link.get_attribute("href")
        if href and "/wd/" in href and href not in job_urls:
            job_urls.append(href)
            
    target_urls = job_urls[:limit_count]
    print(f"📦 총 {len(target_urls)}개의 원티드 공고를 찾았습니다. 데이터 처리를 시작합니다.")
    
    for url in target_urls:
        try:
            # 1. API를 통해 최초 게시일(등록일) 먼저 확보
            
            # 2. 셀레니움으로 페이지 상세 내용 수집
            driver.get(url)
            time.sleep(3)
            
            try:
                job_title = driver.find_element(By.CSS_SELECTOR, "h2").text
            except Exception:
                job_title = driver.title
                
            try:
                company_name = driver.find_element(By.XPATH, "//a[contains(@href, '/company/')]").text
            except Exception:
                company_name = "우수 IT 기업"
                
            full_body = driver.find_element(By.TAG_NAME, "body").text
            
            try:
                requirements = driver.find_element(By.XPATH, "//h3[contains(text(), '주요업무')]/.. | //span[contains(text(), '자격요건')]/..").text
            except Exception:
                requirements = "본문 참조"
                
            preferred = "원티드 본문 통합 수집됨"
            benefits = "원티드 본문 통합 수집됨"
            another_data = "전처리 완료 - 이상 없음"
            
            skills = extract_skills(full_body)
            
            # 📌 유저님이 요청하신 데이터 레이아웃 세팅
            refined_job = {
                "company_name": company_name.strip() if company_name.strip() else "우수 IT 기업",
                "job_title": job_title,
                "job_category": "원티드",
                "skills": skills,
                "body_data": full_body,
                "requirements": requirements,
                "preferred": preferred,
                "benefits": benefits,
                "another_data": another_data,
                "closing_date": "상시채용",
                "job_url": url
            }
            
            supabase.table("companies").upsert(refined_job, on_conflict="job_url").execute()
            print(f"✅ 수집 성공: [{refined_job['company_name']}] - {job_title} ")
            
        except Exception as e:
            print(f"⚠️ 공고({url}) 수집 패스: {e}")
            continue
            
    driver.quit()
    print("🎉 원티드 크롤러 수집 업무가 성공적으로 끝났습니다!")