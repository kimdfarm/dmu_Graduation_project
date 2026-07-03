import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# 전역 객체 생성
options = ClientOptions(postgrest_client_timeout=10)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY, options=options)
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
    # 함수 안에서 전역으로 선언된 supabase 객체를 사용하겠다고 명시
    global supabase
    
    print("🚀 Selenium을 이용한 원티드 IT 채용 정보 자동 수집을 시작합니다...")
    
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
    print(f"📦 총 {len(target_urls)}개의 IT 공고를 찾았습니다. 상세 본문 수집을 시작합니다.")
    
    if len(target_urls) == 0:
        print("⚠️ 아직 공고를 찾지 못했습니다. 원티드 사이트가 구조를 바꿨거나 로딩 실패 상태입니다.")
        driver.quit()
        return
    
    for url in target_urls:
        try:
            driver.get(url)
            time.sleep(3)
            
            try:
                job_title = driver.find_element(By.CSS_SELECTOR, "h2").text
            except Exception:
                job_title = driver.title
                
            try:
                company_name = driver.find_element(By.XPATH, "//a[contains(@href, '/company/')]").text
            except Exception:
                company_name = "원티드 채용 기업"
                
            try:
                body_text = driver.find_element(By.XPATH, "//h3[contains(text(), '주요업무')]/.. | //span[contains(text(), '자격요건')]/..").text
            except Exception:
                body_text = driver.find_element(By.TAG_NAME, "body").text
            
            skills = extract_skills(body_text)
            
            refined_job = {
                "company_name": company_name if company_name.strip() else "우수 IT 기업",
                "job_title": job_title,
                "job_category": "wanted",
                "skills": skills,
                "requirements": body_text,
                "preferred": "TO_BE_PROCESSED_BY_AI",
                "benefits": "TO_BE_PROCESSED_BY_AI",
                "closing_date": "PENDING_AI_PARSING",
                "job_url": url,
                "another_data": "TO_BE_PROCESSED_BY_AI"
            }
            
            # 여기서 전역 supabase 객체 정상 갱신
            supabase.table("companies").upsert(refined_job, on_conflict="job_url").execute()
            print(f"✅ 수집 성공: {refined_job['company_name']} - {job_title} ({len(skills)}개 스택)")
            
        except Exception as e:
            print(f"⚠️ 공고({url}) 수집 패스: {e}")
            continue
            
    driver.quit()
    print("🎉 Selenium 크롤러 업무가 완전히 끝났습니다! Supabase를 확인하세요.")