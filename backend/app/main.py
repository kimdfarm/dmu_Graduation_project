import os
import sys
import time# 1. 터미널 위치가 어디든 backend/app 안에서 정상 작동하도록 경로 보정
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.append(CURRENT_DIR)
from fastapi import FastAPI, BackgroundTasks
from supabase import create_client, Client
from dotenv import load_dotenv

# 브라우저 자동화를 위한 라이브러리
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager

from crawlers.wanted import run_selenium_crawler
from crawlers.jumpit import crawl_jumpit

load_dotenv()
app = FastAPI()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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

# main.py에서 분기 처리 예시
@app.post("/api/v1/crawl", response_model=None)
def trigger_crawling(background_tasks: BackgroundTasks, site: str = "all", limit: int = 10):
    """
    🎯 원하는 채용 사이트(wanted, jumpit, all)를 골라 자동 수집을 백그라운드에서 실행합니다.
    """
    if site == "wanted" or site == "all":
        background_tasks.add_task(run_selenium_crawler, limit)
    if site == "jumpit" or site == "all":
        # jumpit도 내부적으로 처리되도록 단순 limit만 넘겨줍니다.
        background_tasks.add_task(crawl_jumpit, limit)
        
    return {"status": "success", "message": f"{site} 플랫폼의 수집을 백그라운드에서 시작합니다. 터미널을 확인하세요!"}