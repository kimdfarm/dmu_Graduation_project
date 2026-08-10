// src/templates/resumeTemplates.ts

export interface SectionTemplate {
  type: string;
  title: string;
  columns: string[];
  placeholder?: string;
}

export interface FrameTemplate {
  id: string;
  name: string;
  category: 'IT 백엔드/프론트엔드' | 'IT 데이터/인프라' | 'IT 글로벌/외국계' | 'IT 학술/연구/기타';
  desc: string;
  sections: SectionTemplate[];
}

// 🌐 IT 전용 이력서 템플릿 정의
export const FRAME_TEMPLATES: Record<string, FrameTemplate> = {
  // ==========================================
  // 1. IT 백엔드 / 프론트엔드
  // ==========================================
  KR_DEV_BACKEND: {
    id: 'KR_DEV_BACKEND',
    name: '💻 백엔드 / 서버 개발자 (Backend Developer)',
    category: 'IT 백엔드/프론트엔드',
    desc: '아키텍처, 트래픽 최적화, DB 설계 및 API 개발 성과 중심 양식',
    sections: [
      { type: 'SUMMARY', title: '1. Professional Summary (전문가 요약)', columns: ['Category (구분)', 'Core Competencies (핵심 역량)'] },
      { type: 'SKILLS', title: '2. Tech Stack & Infrastructure (기술 스택 및 인프라)', columns: ['Layer (분야)', 'Technologies (기술 및 프레임워크)', 'Proficiency (숙련도 및 활용 경험)'] },
      { type: 'PROJECTS', title: '3. Backend Projects (백엔드 프로젝트)', columns: ['Project Name (프로젝트명 & 역할)', 'Timeline (기간)', 'Tech Stack (사용 기술)', 'Architecture & Impact (아키텍처 및 기술적 성과)'] },
      { type: 'EXPERIENCE', title: '4. Work Experience (직무 경력)', columns: ['Company & Role (회사명 & 직책)', 'Period (재직 기간)', 'Responsibilities (담당 업무)', 'Business Impact (비즈니스 성과)'] },
      { type: 'EDUCATION', title: '5. Education & Training (학력 및 교육)', columns: ['Institution (기관/학교명)', 'Major/Course (전공/과정)', 'Period (기간)', 'Status (상태/이수 내용)'] },
      { type: 'LINK', title: '6. Portfolio & Code (포트폴리오 및 코드)', columns: ['Platform (구분)', 'URL (링크)', 'Description (설명)'] },
    ]
  },

  KR_DEV_FRONTEND: {
    id: 'KR_DEV_FRONTEND',
    name: '🎨 프론트엔드 / 웹 개발자 (Frontend Developer)',
    category: 'IT 백엔드/프론트엔드',
    desc: '웹 성능 최적화, UI/UX 구현, 상태 관리, 컴포넌트 설계 중심 양식',
    sections: [
      { type: 'SUMMARY', title: '1. Professional Summary (전문가 요약)', columns: ['Focus Area (주요 분야)', 'Core Competencies (핵심 역량)'] },
      { type: 'SKILLS', title: '2. Frontend Tech Stack (프론트엔드 기술 스택)', columns: ['Category (구분)', 'Frameworks & Tools (프레임워크 및 도구)', 'Proficiency (숙련도)'] },
      { type: 'PROJECTS', title: '3. Frontend Projects (프론트엔드 프로젝트)', columns: ['Project & Role (프로젝트 및 역할)', 'Timeline (기간)', 'Tech Stack (사용 기술)', 'UX Improvement & Performance (UI/UX 개선 및 성능 최적화 성과)'] },
      { type: 'EXPERIENCE', title: '4. Work Experience (직무 경력)', columns: ['Company & Title (회사명 & 직책)', 'Period (재직 기간)', 'Responsibilities (담당 업무)', 'Impact (성과 및 실적)'] },
      { type: 'EDUCATION', title: '5. Education & Certifications (학력 및 자격)', columns: ['Institution (학교/기관)', 'Major (전공)', 'Period (기간)', 'Status (상태)'] },
      { type: 'LINK', title: '6. Demo & Repository (데모 및 저장소)', columns: ['Type (구분)', 'URL (링크)', 'Description (설명)'] },
    ]
  },

  KR_DEV_MOBILE: {
    id: 'KR_DEV_MOBILE',
    name: '📱 모바일 앱 개발자 (Android / iOS / Cross-Platform)',
    category: 'IT 백엔드/프론트엔드',
    desc: '앱 배포 경험, 메모리 관리, 네이티브/크로스플랫폼 개발 중심',
    sections: [
      { type: 'SUMMARY', title: '1. Mobile Dev Overview (모바일 개발 개요)', columns: ['Platform (플랫폼)', 'Core Value (핵심 가치)'] },
      { type: 'SKILLS', title: '2. Mobile Tech Stack (모바일 기술 스택)', columns: ['Category (구분)', 'Languages & SDKs (언어 및 SDK)', 'Proficiency (숙련도)'] },
      { type: 'PROJECTS', title: '3. App Projects & Store Links (앱 프로젝트 및 스토어 링크)', columns: ['App Name & Role (앱 이름 & 역할)', 'Timeline (개발 기간)', 'Tech Stack (사용 기술)', 'Store Metrics & Features (스토어 실적 및 핵심 기능)'] },
      { type: 'EXPERIENCE', title: '4. Work Experience (직무 경력)', columns: ['Company (회사명)', 'Period (기간)', 'Responsibilities (담당 업무)', 'App Achievements (앱 성과)'] },
      { type: 'EDUCATION', title: '5. Education (학력 사항)', columns: ['School (학교명)', 'Major (전공)', 'Period (기간)', 'Status (졸업 상태)'] },
    ]
  },

  // ==========================================
  // 2. IT 데이터 / 인프라
  // ==========================================
  KR_DEV_AIML: {
    id: 'KR_DEV_AIML',
    name: '🤖 AI / 머신러닝 / 데이터 엔지니어 (AI/ML & Data)',
    category: 'IT 데이터/인프라',
    desc: '모델 파이프라인, 데이터 전처리, MLOps, 성능 지표(Metrics) 중심',
    sections: [
      { type: 'SUMMARY', title: '1. AI / Data Profile (AI 및 데이터 프로필)', columns: ['Domain (연구/개발 분야)', 'Key Strengths (핵심 강점)'] },
      { type: 'SKILLS', title: '2. Frameworks & Data Tools (프레임워크 및 데이터 도구)', columns: ['Category (분류)', 'Models & Libraries (모델 및 라이브러리)', 'Proficiency (활용 수준)'] },
      { type: 'PROJECTS', title: '3. AI/ML Projects (AI/ML 프로젝트)', columns: ['Project Title (프로젝트 제목)', 'Period (기간)', 'Model/Data Tech (사용 모델/데이터 기술)', 'Performance Metrics (모델 성능 지표 및 구현 성과)'] },
      { type: 'EXPERIENCE', title: '4. Industry Experience (산업 경력)', columns: ['Company & Role (회사 및 역할)', 'Timeline (기간)', 'Projects (담당 프로젝트)', 'Metrics & Outcome (수치적 성과)'] },
      { type: 'PUBLICATIONS', title: '5. Papers & Contests (논문 및 공모전)', columns: ['Title (제목)', 'Conference/Host (학회/주최기관)', 'Date (일자)', 'Outcome (수상/게재 실적)'] },
    ]
  },

  KR_DEV_DEVOPS: {
    id: 'KR_DEV_DEVOPS',
    name: '☁️ DevOps / Cloud / SRE 엔지니어',
    category: 'IT 데이터/인프라',
    desc: 'CI/CD 파이프라인, 클라우드 인프라, IaC, 가용성 보장 성과 중심',
    sections: [
      { type: 'SUMMARY', title: '1. DevOps Philosophy (DevOps 핵심 역량)', columns: ['Focus Area (전문 분야)', 'Core Value (핵심 가치)'] },
      { type: 'SKILLS', title: '2. Cloud & Infra Tools (클라우드 및 인프라 도구)', columns: ['Domain (영역)', 'Tools & AWS/GCP (도구 및 클라우드 서비스)', 'Proficiency (숙련도)'] },
      { type: 'PROJECTS', title: '3. Infra & Pipeline Projects (인프라 구축 프로젝트)', columns: ['Project Title (프로젝트명)', 'Timeline (기간)', 'Infra Tech (인프라 기술)', 'Automation & Uptime Outcome (자동화 및 가용성 성과)'] },
      { type: 'EXPERIENCE', title: '4. Work Experience (직무 경력)', columns: ['Company (회사명)', 'Period (재직 기간)', 'Responsibilities (담당 업무)', 'Cost/Speed Optimization (비용/속도 최적화 실적)'] },
      { type: 'CERTIFICATE', title: '5. Cloud Certifications (클라우드 자격증)', columns: ['Certificate Name (자격증명)', 'Issuer (발행기관)', 'Date (취득일)'] },
    ]
  },

  // ==========================================
  // 3. IT 글로벌 / 외국계
  // ==========================================
  US_GLOBAL_TECH: {
    id: 'US_GLOBAL_TECH',
    name: '🇺🇸 Global Big Tech Resume (글로벌 빅테크 영문)',
    category: 'IT 글로벌/외국계',
    desc: 'Action Verbs 및 수치화된 성과(Impact) 중심 1페이지 영문 이력서',
    sections: [
      { type: 'SUMMARY', title: '1. Professional Summary (전문가 요약)', columns: ['Focus Area (주요 분야)', 'Core Value Proposition (핵심 가치 제안)'] },
      { type: 'SKILLS', title: '2. Technical Competencies (기술 역량)', columns: ['Category (카테고리)', 'Technologies & Tools (기술 및 도구)', 'Proficiency (숙련도)'] },
      { type: 'EXPERIENCE', title: '3. Software Engineering Experience (개발 직무 경력)', columns: ['Company & Title (회사명 및 직책)', 'Dates (기간)', 'Responsibilities & Quantified Impact (담당 업무 및 수치화된 성과)'] },
      { type: 'PROJECTS', title: '4. Key Engineering Projects (주요 엔지니어링 프로젝트)', columns: ['Project Title & Role (프로젝트명 및 역할)', 'Timeline (기간)', 'Tech Stack & Outcome (기술 스택 및 성과)'] },
      { type: 'EDUCATION', title: '5. Education & Honors (학력 및 수상)', columns: ['Institution (학교/기관)', 'Degree & Major (학위 및 전공)', 'Graduation Date (졸업일)', 'GPA / Honors (학점 및 수상)'] },
    ]
  },

  EU_GLOBAL_IT: {
    id: 'EU_GLOBAL_IT',
    name: '🇪🇺 European IT CV (유럽 IT Europass 양식)',
    category: 'IT 글로벌/외국계',
    desc: '유럽 IT 기업 제출용 (기술 스킬 및 언어 CEFR 등급 표기)',
    sections: [
      { type: 'SUMMARY', title: '1. Personal Statement (개인 소개)', columns: ['Profile (프로필)', 'Career Objective (커리어 목표)'] },
      { type: 'EXPERIENCE', title: '2. Work Experience (직무 경력)', columns: ['Occupation / Position (직책/역할)', 'Employer & Country (고용주 및 국가)', 'Dates (기간)', 'Main Responsibilities (주요 담당 업무)'] },
      { type: 'SKILLS', title: '3. Digital & IT Competencies (디지털 및 IT 역량)', columns: ['Category (분야)', 'Tools & Programming (도구 및 프로그래밍 언어)', 'Proficiency Level (숙련도)'] },
      { type: 'LANGUAGES', title: '4. Language Proficiency (언어 능력 - CEFR)', columns: ['Language (언어)', 'Listening/Reading (듣기/읽기)', 'Spoken/Writing (말하기/쓰기)', 'Certificates (자격증)'] },
      { type: 'EDUCATION', title: '5. Education and Training (학력 및 교육)', columns: ['Qualification Title (학위/과정명)', 'Organisation (기관명)', 'Dates (기간)', 'Principal Subjects (주요 이수 과목)'] },
    ]
  },

  JP_IT_ENGINEER: {
    id: 'JP_IT_ENGINEER',
    name: '🇯🇵 일본 IT エンジニア (일본 IT 엔지니어)',
    category: 'IT 글로벌/외국계',
    desc: '일본 IT 기업 및 협력사 제출용 (職務要約 및 開発スキル 포함)',
    sections: [
      { type: 'SUMMARY', title: '1. 職務要約 (직무 요약)', columns: ['要約 (요약)', 'コアスキル (핵심 스킬)'] },
      { type: 'SKILLS', title: '2. 開発スキル・言語 (개발 스킬 및 언어)', columns: ['分類 (분류)', 'スキル名 (스킬명)', '経験年数・レベル (경험 연수 및 수준)'] },
      { type: 'EXPERIENCE', title: '3. 職務経歴 (직무 경력)', columns: ['会社名・部署 (회사명 및 부서)', '期間 (기간)', '担当業務・成果 (담당 업무 및 성과)'] },
      { type: 'PROJECTS', title: '4. プロジェクト実績 (프로젝트 실적)', columns: ['プロジェクト名 (프로젝트명)', '担当フェーズ (담당 단계)', '使用技術 (사용 기술)', '実績 (성과)'] },
      { type: 'EDUCATION', title: '5. 学歴・資格 (학력 및 자격)', columns: ['学校名・資格名 (학교명/자격명)', '年月 (연월)', '状態 (상태)'] },
    ]
  },

  // ==========================================
  // 4. IT 학술 / 연구 / 기타
  // ==========================================
  IT_RESEARCH: {
    id: 'IT_RESEARCH',
    name: '🎓 Computer Science / IT Academic CV (연구원 및 석·박사)',
    category: 'IT 학술/연구/기타',
    desc: 'CS 논문, 연구 과제(Grants), 특허(Patents), 학회 발표 중심',
    sections: [
      { type: 'RESEARCH_INTERESTS', title: '1. Research Interests (연구 관심 분야)', columns: ['Field (분야)', 'Specific Topics & Methodology (세부 주제 및 연구 방법론)'] },
      { type: 'EDUCATION', title: '2. Education & Dissertation (학력 및 학위 논문)', columns: ['Degree & Institution (학위 및 기관)', 'Dates (기간)', 'Advisor (지도교수)', 'Thesis Title (논문 제목)'] },
      { type: 'PUBLICATIONS', title: '3. Publications & Patents (논문 및 특허 실적)', columns: ['Title (제목)', 'Journal/Conference (학술지/학회)', 'Publication Date (게재일)', 'Role (저자 역할 - 第1/공저)'] },
      { type: 'PROJECTS', title: '4. Research Projects (연구 프로젝트)', columns: ['Project Title (프로젝트명)', 'Funding Agency (지원 기관)', 'Period (기간)', 'Contributions (주요 기여 내용)'] },
      { type: 'TEACHING', title: '5. Teaching & Academic Services (강의 및 학술 활동)', columns: ['Course / Activity (강의/활동명)', 'Institution (기관명)', 'Dates (기간)', 'Description (설명)'] },
    ]
  },

  CUSTOM_IT: {
    id: 'CUSTOM_IT',
    name: '⚙️ IT 커스텀 프레임 (Custom Frame)',
    category: 'IT 학술/연구/기타',
    desc: '원하는 기술 섹션과 컬럼을 직접 정의하는 자유 템플릿',
    sections: [
      { type: 'SUMMARY', title: '1. Summary & Overview (요약 및 개요)', columns: ['Item (항목)', 'Details (상세 내용)'] },
      { type: 'SKILLS', title: '2. Tech Stack (기술 스택)', columns: ['Category (분야)', 'Tools (도구)', 'Level (수준)'] },
      { type: 'EXPERIENCE', title: '3. Projects & Work (프로젝트 및 경력)', columns: ['Title (제목)', 'Period (기간)', 'Impact & Tech (성과 및 사용 기술)'] },
    ]
  }
};

/**
 * 카테고리별 템플릿 반환
 */
export const getTemplatesByCategory = () => {
  const categories: Record<string, FrameTemplate[]> = {};
  
  Object.values(FRAME_TEMPLATES).forEach((tpl) => {
    if (!categories[tpl.category]) {
      categories[tpl.category] = [];
    }
    categories[tpl.category].push(tpl);
  });

  return categories;
};