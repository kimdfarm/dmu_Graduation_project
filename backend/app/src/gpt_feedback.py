import os
import json
import re
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
import os
import json
import re
from openai import OpenAI
from groq import Groq
from google import genai
from google.genai import types
from dotenv import load_dotenv
from app.core.config import get_supabase  # 유저 DB 연결용

load_dotenv()

def fetch_and_parse_cover_letter(document_id: str) -> str:
    """
    Supabase의 documents와 document_sections 테이블에서 
    해당 자소서의 문항별 질문과 답변(선택된 버전 반영)을 가져와 완벽한 자소서 텍스트로 조합합니다.
    """
    try:
        supabase = get_supabase()
        
        # 1. 문서 메타데이터 조회
        doc_res = supabase.table("documents").select("*").eq("id", document_id).execute()
        if not doc_res.data:
            return ""
        
        doc_title = doc_res.data[0].get("title", "자기소개서")

        # 2. 하위 문항(document_sections) 조회 (display_order 정렬)
        sec_res = supabase.table("document_sections") \
            .select("*") \
            .eq("document_id", document_id) \
            .order("display_order", desc=False) \
            .execute()
        
        sections = sec_res.data or []
        if not sections:
            return ""

        parsed_lines = [f"[자기소개서 제목: {doc_title}]\n"]

        # 3. 문항별, 카드별 텍스트 정교하게 추출
        for sec in sections:
            sec_title = sec.get("section_title", "문항")
            sec_version = sec.get("selected_version") or "ORIGINAL"
            details = sec.get("details") or []
            
            parsed_lines.append(f"\n--- [{sec_title}] ---")

            for d in details:
                if not isinstance(d, dict):
                    continue
                
                card_title = d.get("title", "")
                card_version = d.get("selected_version") or sec_version
                
                # 사용자가 선택한 버전에 따라 텍스트 분기 채택 (AI 교정본 -> 맞춤법 검사본 -> 원본 순)
                target_text = ""
                if card_version == 'AI' and d.get("ai_proofread_text"):
                    target_text = d.get("ai_proofread_text")
                elif card_version == 'SPELL' and d.get("spell_checked_text"):
                    target_text = d.get("spell_checked_text")
                else:
                    target_text = d.get("original_text") or ""

                # values 객체(동적 컬럼 매핑)가 있는 경우 추가 병합
                if not target_text and d.get("values"):
                    values_dict = d.get("values")
                    target_text = " ".join([f"{k}: {v}" for k, v in values_dict.items() if v])

                if card_title:
                    parsed_lines.append(f"• 항목명: {card_title}")
                if target_text:
                    # 개조식 기호 및 이스케이프 문자 정제
                    cleaned = target_text.replace("\\n", "\n").strip()
                    parsed_lines.append(cleaned)

        return "\n".join(parsed_lines)

    except Exception as e:
        print(f"❌ 자기소개서 파싱 중 오류 발생: {str(e)}")
        return ""
class ResumeFeedbackEngine:
    def __init__(self, api_key: str = None):
        raw_openai_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self.clean_openai_key = re.sub(r'[^\x00-\x7F]+', '', raw_openai_key).strip().strip('"').strip("'")
        self.clean_groq_key = re.sub(r'[^\x00-\x7F]+', '', os.getenv("GROQ_API_KEY", "")).strip().strip('"').strip("'")
        self.clean_gemini_key = re.sub(r'[^\x00-\x7F]+', '', os.getenv("GEMINI_API_KEY", "")).strip().strip('"').strip("'")

        self.client = None
        self.model = None
        self.provider = None

        if self.clean_openai_key and self.clean_openai_key.startswith("sk-"):
            try:
                self.client = OpenAI(api_key=self.clean_openai_key)
                self.model = "gpt-4o-mini"
                self.provider = "openai"
            except Exception:
                pass

        if not self.client and self.clean_groq_key:
            try:
                self.client = Groq(api_key=self.clean_groq_key)
                self.model = os.getenv("GROQ_MODEL_NAME", "openai/gpt-oss-120b")
                self.provider = "groq"
            except Exception:
                pass

        if not self.client and self.clean_gemini_key:
            self.provider = "gemini"

    def generate_feedback_from_document_id(self, document_id: str, top_jd_text: str) -> dict:
        """
        document_id를 받아 Supabase에서 문항별 구조와 버전을 파싱한 후 피드백을 생성합니다.
        """
        user_resume_text = fetch_and_parse_cover_letter(document_id)
        if not user_resume_text:
            return {"error": "해당 자기소개서 문항 데이터를 찾을 수 없거나 내용이 비어 있습니다."}
        
        return self.generate_feedback(user_resume_text, top_jd_text)

    def generate_feedback(self, user_resume: str, top_jd_text: str) -> dict:
        prompt = f"""
당신은 IT 분야 전문 커리어 코치입니다.
사용자의 자기소개서/기술스택과 채용 공고(JD)를 비교 분석하여 JSON 형식으로 피드백을 제공해 주세요.

[사용자 자소서 및 기술스택]
{user_resume}

[채용 공고 (JD)]
{top_jd_text}

[출력 요구사항]
반드시 아래 키(Key)를 가진 단일 JSON 객체로 응답하세요:
- "match_summary": 자소서와 채용 공고 간의 종합 일치도 및 총평 (2~3문장)
- "strengths": 자소서에서 채용 공고와 잘 부합하는 강점 (문항 2~3개 리스트)
- "missing_skills": 채용 공고 요구사항 대비 보완이 필요한 역량 및 키워드 (2~3개 리스트)
- "improvement_suggestions": 공고 합격률을 높이기 위한 자소서 수정/보완 제안 (2~3개 리스트)
"""

        # 1차 시도 (OpenAI 또는 Groq)
        if self.client:
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are a helpful IT career coach. Always respond in valid JSON format."},
                        {"role": "user", "content": prompt}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.3,
                    timeout=15.0
                )
                return json.loads(response.choices[0].message.content)
            except Exception as e:
                print(f"⚠️ {self.provider.upper()} API 호출 실패: {e}")

        # 2차 시도 (Groq 폴백)
        if self.provider != "groq" and self.clean_groq_key:
            try:
                fallback_client = Groq(api_key=self.clean_groq_key)
                response = fallback_client.chat.completions.create(
                    model=os.getenv("GROQ_MODEL_NAME", "openai/gpt-oss-120b"),
                    messages=[
                        {"role": "system", "content": "You are a helpful IT career coach. Always respond in valid JSON format."},
                        {"role": "user", "content": prompt}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.3,
                    timeout=15.0
                )
                return json.loads(response.choices[0].message.content)
            except Exception as groq_err:
                print(f"⚠️ Groq 폴백 실패: {groq_err}")

        # 3차 시도 (Gemini 폴백)
        if self.clean_gemini_key:
            try:
                gemini_client = genai.Client(api_key=self.clean_gemini_key)
                response = gemini_client.models.generate_content(
                    model=os.getenv("GEMINI_MODEL_NAME", "gemini-2.5-flash"),
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.3,
                    ),
                )
                return json.loads(response.text)
            except Exception as gemini_err:
                return {"error": f"모든 AI 모델 호출 실패: {str(gemini_err)}"}

        return {"error": "사용 가능한 AI API 키가 설정되지 않았습니다."}


if __name__ == "__main__":
    engine = ResumeFeedbackEngine()
    sample_resume = "Python, PyTorch, FastAPI 백엔드 엔지니어"
    sample_jd = "Python, FastAPI 기반 REST API 개발자 채용 (Docker 우대)"
    res = engine.generate_feedback(sample_resume, sample_jd)
    print(json.dumps(res, ensure_ascii=False, indent=2))
