# app/core/config.py
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("MAIN_URL")
SUPABASE_KEY = os.getenv("MAIN_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL 또는 SUPABASE_KEY가 .env 파일에 설정되지 않았습니다.")

# 어디서나 이 객체를 import해서 쓸 수 있습니다.
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

SMTP_SENDER_EMAIL = os.getenv("SMTP_SENDER_EMAIL")
SMTP_SENDER_PASSWORD = os.getenv("SMTP_SENDER_PASSWORD")