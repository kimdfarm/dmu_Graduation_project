# app/core/config.py
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("MAIN_URL")
SUPABASE_KEY = os.getenv("MAIN_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL 또는 SUPABASE_KEY가 .env 파일에 설정되지 않았습니다.")

# ⭕ 커넥션 재활용(Keep-Alive)을 위한 글로벌 세션 캐시
_client_instance: Client = None

def get_supabase() -> Client:
    global _client_instance
    if _client_instance is None:
        _client_instance = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client_instance

def reset_supabase():
    """DB 연결이 끊겼을 때 세션을 재설정하기 위한 유틸리티"""
    global _client_instance
    _client_instance = None

class SupabaseProxy:
    @property
    def client(self) -> Client:
        return get_supabase()

    def __getattr__(self, name):
        return getattr(self.client, name)

supabase = SupabaseProxy()

SMTP_SENDER_EMAIL = os.getenv("SMTP_SENDER_EMAIL")
SMTP_SENDER_PASSWORD = os.getenv("SMTP_SENDER_PASSWORD")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")