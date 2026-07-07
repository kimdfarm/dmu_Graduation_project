import os
import time
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

def crawl_rallit(limit_count: int = 10):
    global supabase
    print(f"🚀 [렐릿 고속 대체 엔진] IT 공고 딱 '{limit_count}'개 채울 때까지 무한 추적을 시작합니다...")
    
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
    
    # 이미지 차단으로 렐릿 상세페이지 진입 속도 극대화
    prefs = {"profile.managed_default_content_settings.images": 2}
    options.add_experimental_option("prefs", prefs)
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.implicitly_wait(5)
    
    saved_count = 0      
    total_scanned = 0    
    page_num = 1     

    while saved_count < limit_count:
        # 🎯 렐릿 채용 목록 페이지 (페이지 번호 파라미터 적용)
        target_url = f"https://www.rallit.com/?page={page_num}"
        print(f"\n📄 [렐릿 {page_num}페이지] 탐색 중... (현재 수집 상태: {saved_count}/{limit_count})")
        
        try:
            driver.get(target_url)
            time.sleep(3) # 데이터가 렌더링될 때까지 대기
        except Exception:
            print("⚠️ 렐릿 목록 로딩 지연 발생")

        # 렐릿의 채용 공고 상세 카드 링크들 추출 (/positions/숫자 패턴)
        all_links = driver.find_elements(By.TAG_NAME, "a")
        page_urls = []
        
        for link in all_links:
            try:
                href = link.get_attribute("href")
                if href and "/positions/" in href:
                    clean_url = href.split("?")[0]
                    if clean_url not in page_urls:
                        page_urls.append(clean_url)
            except Exception:
                continue

        # 만약 진짜로 공고가 더 이상 없는 페이지라면 종료
        if not page_urls:
            print("🏁 렐릿 플랫폼의 모든 공고 탐색이 끝났거나 더 이상 페이지가 없습니다.")
            break

        print(f"📦 후보 공고 {len(page_urls)}개를 포착했습니다. 유저 분류 알고리즘 가동!")

        # 상세 페이지 순회하며 본문 키워드 필터링 진행
        for url in page_urls:
            if saved_count >= limit_count:
                break
                
            total_scanned += 1
            
            try:
                driver.get(url)
                time.sleep(1.5)
                
                # 렐릿 상세 본문 확보
                full_body = driver.find_element(By.TAG_NAME, "body").text
                skills = extract_skills(full_body)
                
                # 💡 유저님 아이디어: 기술 스택 매칭이 안 되면 가차없이 패스!
                if not skills:
                    print(f"⏩ [스택 없음 패스] 누적 {total_scanned}번째 공고 검사 중...")
                    continue
                
                # 메타데이터 파싱
                try:
                    job_title = driver.find_element(By.CSS_SELECTOR, "h1, [class*='jobTitle'], [class*='title']").text
                except Exception:
                    job_title = driver.title
                    
                try:
                    company_name = driver.find_element(By.CSS_SELECTOR, "[class*='companyName'], [class*='employer']").text
                except Exception:
                    company_name = "렐릿 엄선 IT기업"
                    
                refined_job = {
                    "company_name": company_name.strip() if company_name.strip() else "렐릿 엄선 IT기업",
                    "job_title": job_title.strip(),
                    "job_category": "렐릿",
                    "skills": skills,
                    "body_data": full_body,
                    "requirements": "본문 참조",
                    "preferred": "렐릿 본문 통합 수집됨",
                    "benefits": "렐릿 본문 통합 수집됨",
                    "another_data": f"누적 {total_scanned}번째 렐릿 엔진에서 자동 탐색 성공",
                    "closing_date": "상시채용",
                    "job_url": url
                }
                
                # Supabase에 밀어넣기
                supabase.table("companies").upsert(refined_job, on_conflict="job_url").execute()
                saved_count += 1
                
                print(f"🎯 [IT 분류 성공 ({saved_count}/{limit_count})] 누적 {total_scanned}번째 공고 매칭!")
                print(f"   ㄴ [{company_name.strip()}] - {job_title[:15]}... | 스택: {skills}")
                
            except Exception as e:
                print(f"⚠️ 에러 발생으로 공고 패스")
                continue
                
        # 수집 갯수가 부족하면 다음 페이지로 증가하여 무한 추적 계속
        if saved_count < limit_count:
            page_num += 1

    driver.quit()
    print("\n========================================================")
    print(f"🎉 [수집 완료] 총 {total_scanned}번의 공고를 끈기 있게 추적한 끝에,")
    print(f"🎯 최종적으로 완벽한 IT 공고 '{saved_count}'개를 꽉 채워 수집해 냈습니다!")
    print("========================================================")