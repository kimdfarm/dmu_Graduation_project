import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup

def crawl_saramin_with_selenium(rec_idx):
    url = f"https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx={rec_idx}"
    
    # 브라우저 옵션 설정 (백엔드 서버에서 돌 수 있도록 창을 띄우지 않음)
    chrome_options = Options()
    chrome_options.add_argument("--headless") 
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    
    try:
        driver.get(url)
        time.sleep(3) # 자바스크립트가 화면을 다 그릴 때까지 3초 대기
        
        # 완전하게 렌더링된 HTML 소스 가져오기
        html = driver.page_source
        soup = BeautifulSoup(html, "html.parser")
        
        # 1. 회사명과 제목 추출
        # 셀레늄으로 열면 PC 버전 메인 UI가 완벽히 로드됩니다.
        company_tag = soup.select_one(".company_header .title") or soup.select_one(".company_name")
        title_tag = soup.select_one("h1.job_tit") or soup.select_one(".job_tit")
        
        company = company_tag.get_text(strip=True) if company_tag else "회사명 확인 불가"
        title = title_tag.get_text(strip=True) if title_tag else "제목 확인 불가"
        
        # 2. 본문에 포함된 정보 요약 영역 긁기 (근무지, 요일 등)
        summary_tags = soup.select(".jv_summary .meta_row strong")
        summary_items = [tag.get_text(strip=True) for tag in summary_tags]
        
        # 3. 본문 내 iframe 영역에 숨겨진 이미지나 진짜 텍스트가 있다면 추적
        # (앞서 확인했던 이미지 공고 주소 추출)
        img_tags = soup.select(".user_content img") or soup.select("iframe")
        content_sources = [img.get("src") for img in img_tags if img.get("src")]

        return {
            "status": "success",
            "company": company,
            "title": title,
            "summary": summary_items,
            "content_sources": content_sources
        }
        
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        driver.quit() # 브라우저 종료 필수

if __name__ == "__main__":
    test_id = "54486578"
    print(f"[{test_id}] Selenium 기반 가상 브라우저 구동 중...")
    data = crawl_saramin_with_selenium(test_id)
    
    print("\n" + "="*40)
    print(" 🚀 셀레늄 최종 수집 결과")
    print("="*40)
    print(f"🏢 회사명 : {data.get('company')}")
    print(f"📌 공고명 : {data.get('title')}")
    print(f"📍 요약조건: {data.get('summary')}")
    print(f"🖼️ 본문소스: {data.get('content_sources')}")
    print("="*40)