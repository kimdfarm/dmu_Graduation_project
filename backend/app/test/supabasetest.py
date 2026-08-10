import os
import requests
from dotenv import load_dotenv

# 1. .env 파일 로드
load_dotenv()

MAIN_URL = os.getenv("MAIN_URL")
MAIN_KEY = os.getenv("MAIN_KEY")

if not MAIN_URL or not MAIN_KEY:
    print("❌ 오류: .env 파일에서 MAIN_URL 또는 MAIN_KEY를 찾을 수 없습니다.")
    exit(1)

# API 요청 헤더 설정
headers = {
    "apikey": MAIN_KEY,
    "Authorization": f"Bearer {MAIN_KEY}"
}

def inspect_supabase_database():
    try:
        # 2. Supabase OpenAPI 명세(스펙)를 요청하여 모든 테이블 및 구조 탐색
        schema_url = f"{MAIN_URL.rstrip('/')}/rest/v1/"
        response = requests.get(schema_url, headers=headers)
        response.raise_for_status()
        
        spec = response.json()
        definitions = spec.get("definitions", {})
        
        table_names = list(definitions.keys())
        print(f"🔍 총 {len(table_names)}개의 테이블을 발견했습니다.\n")
        print("=" * 60)

        # 3. 각 테이블별 컬럼 정보 및 데이터(Row) 최대 5개 조회
        for table_name in table_names:
            print(f"📂 [테이블명]: {table_name}")
            
            # OpenAPI 스펙에서 컬럼(열) 이름 목록 추출
            table_schema = definitions.get(table_name, {})
            columns = list(table_schema.get("properties", {}).keys())
            print(f" └ 📋 컬럼 목록 ({len(columns)}개): {columns}")

            # 테이블 데이터 최대 5개 요청 (?limit=5)
            data_url = f"{MAIN_URL.rstrip('/')}/rest/v1/{table_name}?limit=5"
            data_res = requests.get(data_url, headers=headers)
            
            if data_res.status_code == 200:
                rows = data_res.json()
                print(f" └ 📊 Row 데이터 (조회된 행: {len(rows)}개):")
                if rows:
                    for idx, row in enumerate(rows, 1):
                        print(f"    [{idx}] {row}")
                else:
                    print("    (데이터가 없거나 RLS 권한으로 인해 비어 있습니다)")
            else:
                print(f" └ ⚠️ 데이터 조회 실패 (상태 코드: {data_res.status_code}) - {data_res.text}")
                
            print("=" * 60)

    except requests.exceptions.RequestException as e:
        print(f"❌ API 연결 실패: {e}")

if __name__ == "__main__":
    inspect_supabase_database()