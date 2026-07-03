# app/crawlers/jumpit.py 예시 구조
import os
import os
from dotenv import load_dotenv
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from supabase import create_client, Client, ClientOptions
from webdriver_manager.chrome import ChromeDriverManager
load_dotenv()
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
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

def crawl_jumpit(limit_count=10):  # 👈 인자를 딱 1개(기본값 포함)로 통일!
    print("🚀 점핏 IT 채용 정보 자동 수집을 시작합니다...")
    
    # 글로벌 변수로 선언된 supabase 클라이언트를 가져와 사용합니다.
    # (프로젝트 구조에 따라 상단에서 import 하거나 정의된 변수명을 맞춰주세요)
    global supabase 
    
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("user-agent=Mozilla/5.0 ...")
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    
    driver.get("https://www.jumpit.co.kr/positions")
    time.sleep(4)
    
    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
    time.sleep(2)
    
    links = driver.find_elements(By.XPATH, "//a[contains(@href, '/position/')]")
    job_urls = list(set([link.get_attribute("href") for link in links if link.get_attribute("href")]))
    
    target_urls = job_urls[:limit_count]
    print(f"📦 점핏에서 {len(target_urls)}개의 공고를 찾았습니다.")
    
    for url in target_urls:
        try:
            driver.get(url)
            
            # ⏳ 페이지가 완전히 로딩될 때까지 최대 5초 대기 (안전장치)
            wait = WebDriverWait(driver, 5)
            
            # 🎯 1. 직무 제목 추출 (h1 태그가 명확하므로 안전하게 대기 처리)
            job_title_element = wait.until(
                EC.presence_of_element_located((By.TAG_NAME, "h1"))
            )
            job_title = job_title_element.text
            
            # 🎯 2. 회사 이름 추출 (점핏의 실제 상세페이지 구조 반영)
            # 점핏은 제목 위나 아래에 회사명이 들어간 링크(a 태그)를 제공하는 경우가 많습니다.
            try:
                # 공고 타이틀 주변에 위치한 회사명 텍스트 추출 시도
                company_name = driver.find_element(By.XPATH, "//h1/preceding-sibling::a | //a[contains(@href, '/company/')]").text
                if not company_name: # 비어있다면 다른 경로 시도
                    company_name = driver.find_element(By.XPATH, "//*[@class='position_title_box']//a").text
            except Exception:
                # 위의 방식이 둘 다 실패할 경우를 대비한 가벼운 예외 처리
                company_name = "회사명 미상"
            
            # 🎯 3. 본문 전체 텍스트 추출
            body_text = driver.find_element(By.TAG_NAME, "body").text
            
            # 기술 스택 추출 함수 실행
            if 'extract_skills' in globals() and callable(globals()['extract_skills']):
                skills = extract_skills(body_text)
            else:
                skills = []
            
            refined_job = {
                "company_name": company_name,
                "job_title": job_title,
                "job_category": "jumpit",
                "skills": skills,
                "requirements": body_text,
                "preferred": "TO_BE_PROCESSED_BY_AI",
                "benefits": "TO_BE_PROCESSED_BY_AI",
                "closing_date": "PENDING_AI_PARSING",
                "job_url": url,
                "another_data": "TO_BE_PROCESSED_BY_AI"
            }
            
            supabase.table("companies").upsert(refined_job, on_conflict="job_url").execute()
            print(f"✅ [점핏] 수집 성공: {company_name} - {job_title}")
            
        except Exception as e:
            print(f"⚠️ 점핏 공고 수집 패스: {e}")
            continue
    driver.quit()