// src/templates/coverLetterTemplates.ts
import { FrameTemplate } from './resumeTemplates';

// 🌐 IT 전용 자기소개서(Cover Letter) 템플릿 정의
export const COVER_LETTER_TEMPLATES: Record<string, FrameTemplate> = {
  // ==========================================
  // 1. IT 백엔드 / 프론트엔드
  // ==========================================
  KR_CL_BACKEND: {
    id: 'KR_CL_BACKEND',
    name: '💻 백엔드 / 서버 개발자 자기소개서',
    category: 'IT 백엔드/프론트엔드',
    desc: '문제 해결 과정, 트래픽 최적화 경험 및 시스템 아키텍처 설계를 강조하는 양식',
    sections: [
      { type: 'MOTIVATION', title: '1. 지원 동기 및 커리어 목표', columns: ['Core Interest (주요 관심 분야)', 'Content (내용)'] },
      { type: 'PROBLEM_SOLVING', title: '2. 기술적 문제 해결 및 성능 최적화 경험', columns: ['Issue & Context (문제 상황)', 'Action & Solution (해결 방법 및 기술적 시도)', 'Result (결과 및 교훈)'] },
      { type: 'ARCHITECTURE', title: '3. 대용량 데이터 / DB / API 설계 경험', columns: ['Focus Area (설계 핵심)', 'Content (상세 경험 내용)'] },
      { type: 'COLLABORATION', title: '4. 협업 경험 및 개발 문화에 대한 지향점', columns: ['Soft Skills (역량)', 'Content (협업 및 소통 사례)'] },
    ]
  },

  KR_CL_FRONTEND: {
    id: 'KR_CL_FRONTEND',
    name: '🎨 프론트엔드 / 웹 개발자 자기소개서',
    category: 'IT 백엔드/프론트엔드',
    desc: '사용자 경험(UX) 개선, 렌더링 성능 최적화 및 컴포넌트 설계 철학 중심 양식',
    sections: [
      { type: 'MOTIVATION', title: '1. 지원 동기 및 직무 비전', columns: ['Key Focus (핵심 지향점)', 'Content (내용)'] },
      { type: 'UX_PERFORMANCE', title: '2. UI/UX 개선 및 웹 성능 최적화 경험', columns: ['Metric / Area (개선 대상 및 지표)', 'Action (적용한 기술 및 방법)', 'Outcome (개선 결과)'] },
      { type: 'COMPONENT_DESIGN', title: '3. 컴포넌트 재사용성 및 상태 관리 경험', columns: ['Architecture (설계 방식)', 'Content (상세 경험 내용)'] },
      { type: 'TEAMWORK', title: '4. 디자이너 및 백엔드 개발자와의 협업 경험', columns: ['Collaboration (협업 분야)', 'Content (상세 에피소드 및 성과)'] },
    ]
  },

  KR_CL_MOBILE: {
    id: 'KR_CL_MOBILE',
    name: '📱 모바일 앱 개발자 자기소개서',
    category: 'IT 백엔드/프론트엔드',
    desc: '사용자 반응 중심의 앱 개발, 앱 라이프사이클 관리 및 배포 경험 중심',
    sections: [
      { type: 'MOTIVATION', title: '1. 지원 동기 및 모바일 개발 철학', columns: ['Value Proposition (가치관)', 'Content (내용)'] },
      { type: 'APP_DEVELOPMENT', title: '2. 모바일 앱 개발 및 문제 해결 경험', columns: ['Platform/Feature (플랫폼 및 기능)', 'Technical Solution (기술적 해결 과정)', 'User Feedback/Impact (사용자 반응 및 성과)'] },
      { type: 'STORE_RELEASE', title: '3. 앱 성능 최적화 및 스토어 출시/운영 경험', columns: ['Area (최적화/운영 영역)', 'Content (상세 내용 및 지표)'] },
      { type: 'GROWTH', title: '4. 지속적인 기술 학습 및 성장 노력', columns: ['Learning Trajectory (학습 분야)', 'Content (적용 사례 및 성장 노하우)'] },
    ]
  },

  // ==========================================
  // 2. IT 데이터 / 인프라
  // ==========================================
  KR_CL_AIML: {
    id: 'KR_CL_AIML',
    name: '🤖 AI / 머신러닝 / 데이터 엔지니어 자기소개서',
    category: 'IT 데이터/인프라',
    desc: '데이터 기반 문제 정의, 모델 구현 및 서빙, 수치적 성과 파이프라인 강조 양식',
    sections: [
      { type: 'MOTIVATION', title: '1. 지원 동기 및 연구/개발 비전', columns: ['Research Interest (관심 영역)', 'Content (내용)'] },
      { type: 'MODEL_PIPELINE', title: '2. 데이터 전처리 및 AI/ML 모델링 경험', columns: ['Project / Task (과제 내용)', 'Methodology (사용 기술 및 모델)', 'Metrics & Results (지표 개선 결과)'] },
      { type: 'MLOPS_SERVING', title: '3. MLOps 및 파이프라인 구축/서빙 경험', columns: ['System / Pipeline (시스템 구조)', 'Content (구축 과정 및 엔지니어링 성과)'] },
      { type: 'PROBLEM_SOLVING', title: '4. 데이터 분석을 통한 실제 비즈니스 문제 해결', columns: ['Business Challenge (비즈니스 문제)', 'Data Insight & Action (데이터 인사이트 및 적용)'] },
    ]
  },

  KR_CL_DEVOPS: {
    id: 'KR_CL_DEVOPS',
    name: '☁️ DevOps / Cloud / SRE 엔지니어 자기소개서',
    category: 'IT 데이터/인프라',
    desc: '인프라 자동화, CI/CD 구축, 장애 대응 및 비용/속도 최적화 스토리 중심',
    sections: [
      { type: 'MOTIVATION', title: '1. 지원 동기 및 DevOps 철학', columns: ['Core Value (핵심 가치관)', 'Content (내용)'] },
      { type: 'INFRA_AUTOMATION', title: '2. CI/CD 및 인프라 자동화 구축 경험', columns: ['Pipeline / Tools (도구 및 영역)', 'Action (자동화/IaC 구축 방식)', 'Efficiency Gained (효율성 향상 결과)'] },
      { type: 'INCIDENT_RESPONSE', title: '3. 모니터링, 가용성 보장 및 장애 대응 경험', columns: ['Incident / Goal (목표 및 장애 상황)', 'Resolution (원인 분석 및 해결 방안)'] },
      { type: 'COST_OPTIMIZATION', title: '4. 클라우드 비용 및 인프라 성능 최적화 사례', columns: ['Optimization Area (최적화 대상)', 'Outcome (비용 절감 및 속도 개선 성과)'] },
    ]
  },

  // ==========================================
  // 3. IT 글로벌 / 외국계
  // ==========================================
  US_CL_GLOBAL_TECH: {
    id: 'US_CL_GLOBAL_TECH',
    name: '🇺🇸 Global Cover Letter (영문 자기소개서)',
    category: 'IT 글로벌/외국계',
    desc: '북미 및 글로벌 테크 기업 제출용 표준 Cover Letter 구조',
    sections: [
      { type: 'MOTIVATION', title: '1. Introduction & Motivation (지원 동기 및 관심 분야)', columns: ['Career Focus (커리어 방향)', 'Content (English Description)'] },
      { type: 'TECHNICAL_IMPACT', title: '2. Key Technical Achievements (주요 기술 성과)', columns: ['Project / Role (프로젝트/역할)', 'Action & Quantified Impact (수치화된 기술적 성과)'] },
      { type: 'PROBLEM_SOLVING', title: '3. Complex Problem Solving (복잡한 문제 해결 사례)', columns: ['Challenge (도전 과제)', 'Engineering Solution (엔지니어링 솔루션)'] },
      { type: 'CULTURAL_FIT', title: '4. Culture Fit & Closing Statement (문화적 적합성 및 마무리)', columns: ['Soft Skills (협업 및 문화)', 'Content (요약 및 포부)'] },
    ]
  },

  JP_CL_IT_ENGINEER: {
    id: 'JP_CL_IT_ENGINEER',
    name: '🇯🇵 日本 IT 志望動機・自己PR (일본 IT 지원동기 및 자기PR)',
    category: 'IT 글로벌/외국계',
    desc: '일본 IT 기업 제출용 志望動機(지원동기) 및 自己PR(자소서) 양식',
    sections: [
      { type: 'MOTIVATION', title: '1. 志望動機 (지원 동기)', columns: ['動機 (동기)', '詳細 (상세 내용)'] },
      { type: 'SELF_PR', title: '2. 自己PR 및 강점 (Self-PR)', columns: ['強み (핵심 강점)', 'エピソード・実績 (관련 에피소드 및 실적)'] },
      { type: 'TECHNICAL_EXPERIENCE', title: '3. 技術的課題の解決経験 (기술적 문제 해결 경험)', columns: ['課題 (과제)', '取り組んだ内容・成果 (시도한 내용 및 성과)'] },
      { type: 'CAREER_PLAN', title: '4. 今後のキャリアプラン (향후 커리어 플랜)', columns: ['目標 (목표)', '貢献できること (기여 방안)'] },
    ]
  },

  // ==========================================
  // 4. IT 학술 / 연구 / 기타
  // ==========================================
  IT_CL_RESEARCH: {
    id: 'IT_CL_RESEARCH',
    name: '🎓 Research Statement / Statement of Purpose (학술 및 연구계획서)',
    category: 'IT 학술/연구/기타',
    desc: '연구관심사, 학술적 성과 및 미래 연구 계획 중심 양식',
    sections: [
      { type: 'RESEARCH_INTERESTS', title: '1. Research Motivation & Background (연구 관심사 및 배경)', columns: ['Field (연구 분야)', 'Content (배경 및 동기)'] },
      { type: 'ACADEMIC_ACHIEVEMENTS', title: '2. Academic & Technical Achievements (학술적 성과 및 연구 경험)', columns: ['Project/Paper (연구/논문)', 'Methodology & Impact (연구 방법론 및 결과)'] },
      { type: 'PROPOSED_RESEARCH', title: '3. Proposed Research Plan (향후 연구 계획)', columns: ['Topic (연구 주제)', 'Plan & Expected Outcome (세부 추진 계획 및 기대 효과)'] },
    ]
  },

  CUSTOM_CL_IT: {
    id: 'CUSTOM_CL_IT',
    name: '⚙️ IT 커스텀 자기소개서 (Custom Cover Letter)',
    category: 'IT 학술/연구/기타',
    desc: '원하는 자소서 항목과 컬럼을 자유롭게 정의하는 템플릿',
    sections: [
      { type: 'MOTIVATION', title: '1. 지원 동기 및 포부', columns: ['Title (소제목)', 'Content (상세 내용)'] },
      { type: 'STRENGTHS', title: '2. 직무 관련 핵심 역량', columns: ['Category (구분)', 'Content (상세 내용)'] },
      { type: 'EXPERIENCE', title: '3. 주요 프로젝트 및 경험', columns: ['Topic (주제)', 'Content (상세 내용)'] },
    ]
  }
};

/**
 * 카테고리별 자기소개서 템플릿 반환
 */
export const getCoverLetterTemplatesByCategory = () => {
  const categories: Record<string, FrameTemplate[]> = {};
  
  Object.values(COVER_LETTER_TEMPLATES).forEach((tpl) => {
    if (!categories[tpl.category]) {
      categories[tpl.category] = [];
    }
    categories[tpl.category].push(tpl);
  });

  return categories;
};