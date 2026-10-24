import os
import json
import re
from openai import OpenAI
from groq import Groq
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

class ResumeFeedbackEngine:
    def __init__(self, api_key: str = None):
        # 1. OpenAI API 키 정제
        raw_openai_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self.clean_openai_key = re.sub(r'[^\x00-\x7F]+', '', raw_openai_key).strip().strip('"').strip("'")
        
        # 2. Groq API 키 정제
        self.clean_groq_key = re.sub(r'[^\x00-\x7F]+', '', os.getenv("GROQ_API_KEY", "")).strip().strip('"').strip("'")

        # 3. Gemini API 키 정제
        self.clean_gemini_key = re.sub(r'[^\x00-\x7F]+', '', os.getenv("GEMINI_API_KEY", "")).strip().strip('"').strip("'")

        self.client = None
        self.model = None
        self.provider = None

        # 우선순위 1: OpenAI
        if self.clean_openai_key and self.clean_openai_key.startswith("sk-"):
            try:
                self.client = OpenAI(api_key=self.clean_openai_key)
                self.model = "gpt-4o-mini"
                self.provider = "openai"
            except Exception:
                pass

        # 우선순위 2: Groq (OpenAI 실패 시)
        if not self.client and self.clean_groq_key:
            try:
                self.client = Groq(api_key=self.clean_groq_key)
                self.model = os.getenv("GROQ_MODEL_NAME", "openai/gpt-oss-120b")
                self.provider = "groq"
            except Exception:
                pass

        # 우선순위 3: Gemini (Groq까지 실패 시 최후 폴백용 키 보관)
        if not self.client and self.clean_gemini_key:
            self.provider = "gemini"

    def generate_feedback(self, user_resume: str, top_jd_text: str) -> dict:
        """
        사용자 자소서와 Top 1 공고 JD를 비교하여 LLM(OpenAI -> Groq -> Gemini 순차 폴백)으로 JSON 피드백 생성
        """
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

        # 1차 시도: OpenAI 또는 Groq 클라이언트가 이미 준비된 경우
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
                print(f"⚠️ {self.provider.upper()} API 호출 실패, 다음 폴백으로 전환합니다: {e}")

        # 2차 시도: 만약 OpenAI나 Groq에서 에러가 났거나 클라이언트가 없고 Groq 키가 살아있다면 Groq 재시도
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

        # 3차 시도 (최후의 보루): Gemini 공식 SDK (`google-genai`) 활용
        if self.clean_gemini_key:
            try:
                # 최신 google-genai SDK 초기화 방식
                gemini_client = genai.Client(api_key=self.clean_gemini_key)
                gemini_model = os.getenv("GEMINI_MODEL_NAME", "gemini-2.5-flash")
                
                # Gemini에게 명확하게 JSON 출력을 유도하는 설정
                response = gemini_client.models.generate_content(
                    model=gemini_model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.3,
                    ),
                )
                return json.loads(response.text)
            except Exception as gemini_err:
                return {"error": f"모든 AI 모델(OpenAI, Groq, Gemini) 호출 실패: {str(gemini_err)}"}

        return {
            "notice": "사용 가능한 AI API 키(GROQ_API_KEY, GEMINI_API_KEY 등)가 설정되지 않았습니다.",
            "match_summary": ".env 파일에 API 키를 설정해 주세요.",
            "strengths": ["입력된 자소서 기반 기본 역량 보유"],
            "missing_skills": ["API 키 입력 후 상세 분석 지원"],
            "improvement_suggestions": [".env 파일에 GROQ_API_KEY 또는 GEMINI_API_KEY를 추가해 주세요."]
        }