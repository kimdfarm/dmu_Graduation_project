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

def fetch_and_parse_document(document_id: str) -> tuple[str, str]:
    """
    Supabase의 documents 테이블에서 doc_type(COVER_LETTER 또는 RESUME)을 확인하고,
    document_sections의 선택된 버전(selected) 및 ai_style의 mode 정보를 참고하여
    문서의 구조와 내용을 완벽하게 파싱하여 텍스트로 조합합니다.
    반환값: (doc_type, parsed_text)
    """
    try:
        supabase = get_supabase()
        
        # 1. 문서 메타데이터 조회
        doc_res = supabase.table("documents").select("*").eq("id", document_id).execute()
        if not doc_res.data:
            return "COVER_LETTER", ""
        
        doc_meta = doc_res.data[0]
        doc_title = doc_meta.get("title", "문서")
        
        # doc_type 컬럼 값 확인 (RESUME 또는 COVER_LETTER)
        raw_doc_type = doc_meta.get("doc_type") or doc_meta.get("type") or doc_meta.get("category") or "COVER_LETTER"
        doc_type = str(raw_doc_type).upper().strip()
        
        if "RESUME" in doc_type or "이력서" in doc_type:
            doc_type = "RESUME"
        else:
            doc_type = "COVER_LETTER"

        # 2. 하위 문항/섹션(document_sections) 조회 (display_order 정렬)
        sec_res = supabase.table("document_sections") \
            .select("*") \
            .eq("document_id", document_id) \
            .order("display_order", desc=False) \
            .execute()
        
        sections = sec_res.data or []
        if not sections:
            return doc_type, ""

        header_label = "이력서" if doc_type == "RESUME" else "자기소개서"
        parsed_lines = [f"[{header_label} 제목: {doc_title}]\n"]

        # 3. 항목별, 카드별 텍스트 및 컬럼/모드 정보 반영 파싱
        for sec in sections:
            sec_title = sec.get("section_title", "항목")
            
            # 선택된 버전(selected) 파악 ('ai', 'spell', 'original' 등)
            sec_selected = str(sec.get("selected") or sec.get("selected_version") or "ORIGINAL").upper().strip()
            
            # ai_style 내부의 mode 확인 (selected가 AI일 때 또는 기본 모드 참고용)
            ai_style = sec.get("ai_style") or {}
            if isinstance(ai_style, str):
                try:
                    ai_style = json.loads(ai_style)
                except Exception:
                    ai_style = {}
            
            section_mode = str(ai_style.get("mode") or sec.get("mode") or "").upper().strip()
            
            parsed_lines.append(f"\n--- [{sec_title}] (선택: {sec_selected}, 모드: {section_mode or '기본'}) ---")

            details = sec.get("details") or []
            for d in details:
                if not isinstance(d, dict):
                    continue
                
                card_title = d.get("title", "")
                card_version = str(d.get("selected") or d.get("selected_version") or sec_selected).upper().strip()
                
                # 컬럼 정보(ai_columns 등)가 있다면 참고 기록
                ai_columns = d.get("ai_columns") or sec.get("ai_columns") or []
                if ai_columns:
                    parsed_lines.append(f"• 참고 컬럼: {', '.join(ai_columns)}")

                # 텍스트 분기 처리 (selected가 AI인 경우 AI 교정본 우선 채택 등)
                target_text = ""
                if card_version == 'AI' or sec_selected == 'AI':
                    target_text = d.get("ai_proofread_text") or d.get("ai_text") or ""
                
                if not target_text and (card_version == 'SPELL' or sec_selected == 'SPELL'):
                    target_text = d.get("spell_checked_text") or ""
                
                if not target_text:
                    target_text = d.get("original_text") or ""

                # column_values 또는 values 객체가 있는 경우 동적 매핑 병합
                column_values = d.get("column_values") or d.get("values")
                if not target_text and column_values:
                    target_text = " ".join([f"[{k}] {v}" for k, v in column_values.items() if v])

                if card_title:
                    parsed_lines.append(f"• 항목명: {card_title}")
                
                if target_text:
                    cleaned = str(target_text).replace("\\n", "\n").strip()
                    parsed_lines.append(cleaned)
                elif column_values:
                    for k, v in column_values.items():
                        if v:
                            parsed_lines.append(f"• {k}: {v}")

        return doc_type, "\n".join(parsed_lines)

    except Exception as e:
        print(f"❌ 문서 파싱 중 오류 발생: {str(e)}")
        return "COVER_LETTER", ""

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
        document_id를 받아 Supabase에서 doc_type을 판별한 후 피드백을 생성합니다.
        """
        doc_type, user_doc_text = fetch_and_parse_document(document_id)
        if not user_doc_text:
            return {"error": "해당 문서 데이터를 찾을 수 없거나 내용이 비어 있습니다."}
        
        return self.generate_feedback(user_doc_text, top_jd_text, doc_type=doc_type)

    def generate_feedback(self, user_resume: str, top_jd_text: str, doc_type: str = "COVER_LETTER") -> dict:
        doc_label = "이력서/경력기술서" if doc_type == "RESUME" else "자기소개서"
        
        prompt = f"""
당신은 IT 분야 전문 커리어 코치입니다.
사용자의 {doc_label} (document_section의 컬럼 구조, 선택된 버전 및 모드 스타일이 반영됨)과 채용 공고(JD)를 비교 분석하여 JSON 형식으로 피드백을 제공해 주세요.

[사용자 {doc_label}]
{user_resume}

[채용 공고 (JD)]
{top_jd_text}

[출력 요구사항]
- **중요**: 피드백 출력 언어는 반드시 위 [사용자 {doc_label}]에 작성된 **원문 문서의 언어(Language)**와 동일한 언어로 작성해 주세요. (예: 문서가 한국어로 되어 있다면 한국어로, 영어로 되어 있다면 영어로 출력)
- 반드시 아래 키(Key)를 가진 단일 JSON 객체로 응답하세요:
  - "match_summary": {doc_label}와 채용 공고 간의 종합 일치도 및 총평 (2~3문장)
  - "strengths": {doc_label}에서 채용 공고와 잘 부합하는 강점 (항목 2~3개 리스트)
  - "missing_skills": 채용 공고 요구사항 대비 보완이 필요한 역량 및 키워드 (2~3개 리스트)
  - "improvement_suggestions": 공고 합격률을 높이기 위한 {doc_label} 수정/보완 제안 (2~3개 리스트)
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