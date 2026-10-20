import os
import json
import re
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

class ResumeFeedbackEngine:
    def __init__(self, api_key: str = None):
        # 1. API 키 취득 및 비-ASCII 문자가 섞이는 현상 완벽 정제 (Sanitization)
        raw_key = api_key or os.getenv("OPENAI_API_KEY", "")
        # ASCII 범위를 벗어나는 문자 및 제어문자/양쪽 공백 제거
        clean_key = re.sub(r'[^\x00-\x7F]+', '', raw_key).strip().strip('"').strip("'")
        
        self.api_key = clean_key
        self.client = None
        
        if self.api_key and self.api_key.startswith("sk-"):
            # httpx/requests 헤더 인코딩 오류 방지용 안전한 client 생성
            self.client = OpenAI(api_key=self.api_key)

    def generate_feedback(self, user_resume: str, top_jd_text: str) -> dict:
        """
        사용자 자소서와 Top 1 공고 JD를 비교하여 GPT-4o-mini 기반 맞춤 피드백(JSON) 생성
        """
        if not self.client:
            return {
                "notice": "OpenAI API 키가 설정되지 않았거나 유효하지 않습니다.",
                "match_summary": "API 키를 설정하시면 GPT 기반의 정밀 분석 결과를 받아보실 수 있습니다.",
                "strengths": ["입력된 자소서 기반 기본 역량 보유"],
                "missing_skills": ["API 키 입력 후 상세 분석 지원"],
                "improvement_suggestions": ["사이드바에 올바른 sk- 형식의 OpenAI API 키를 입력해 주세요."]
            }

        # JSON 포맷 규격 프롬프트 작성
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
- "strengths": 자소서에서 채용 공고와 잘 부합하는 강점 (문약 2~3개 리스트)
- "missing_skills": 채용 공고 요구사항 대비 보완이 필요한 역량 및 키워드 (2~3개 리스트)
- "improvement_suggestions": 공고 합격률을 높이기 위한 자소서 수정/보완 제안 (2~3개 리스트)
"""

        try:
            # gpt-4o-mini 모델 및 JSON mode 강제 설정
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a helpful IT career coach. Always respond in valid JSON format."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
                timeout=15.0  # 타임아웃 15초 설정
            )
            
            result_text = response.choices[0].message.content
            feedback_data = json.loads(result_text)
            return feedback_data

        except UnicodeEncodeError as e:
            return {"error": f"문자 인코딩 오류 (API 키 정제 필요): {str(e)}"}
        except Exception as e:
            return {"error": f"GPT API 호출 중 오류 발생: {str(e)}"}


if __name__ == "__main__":
    engine = ResumeFeedbackEngine()
    sample_resume = "Python, PyTorch, FastAPI 백엔드 엔지니어"
    sample_jd = "Python, FastAPI 기반 REST API 개발자 채용 (Docker 우대)"
    res = engine.generate_feedback(sample_resume, sample_jd)
    print(json.dumps(res, ensure_ascii=False, indent=2))
