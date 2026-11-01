// src/templates/githubTemplates.ts

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

// 🐙 GitHub 심층 분석 특화 템플릿 전용 정의
export const GITHUB_FRAME_TEMPLATES: Record<string, FrameTemplate> = {
  GITHUB_DEEP_DIVE: {
    id: 'GITHUB_DEEP_DIVE',
    name: '🐙 GitHub 심층 분석 프로필 (Single Repo Deep-Dive)',
    category: 'IT 백엔드/프론트엔드',
    desc: '단 하나의 핵심 GitHub 저장소의 아키텍처, 기술 스택, 커밋 및 문제 해결 성과를 극대화하여 출력',
    sections: [
      {
        type: 'GITHUB_ANALYSIS',
        title: 'GitHub 핵심 프로젝트 심층 분석',
        columns: [
          '프로젝트 개요 및 역할 (Overview & Role)',
          '사용 기술 및 라이브러리 (Tech Stack)',
          '핵심 구현 내용 및 커밋 성과 (Key Features & Commits)',
          '트러블슈팅 및 아키텍처 개선 (Troubleshooting & Impact)'
        ]
      }
    ]
  },

  GITHUB_SYS_ARCHITECTURE: {
    id: 'GITHUB_SYS_ARCHITECTURE',
    name: '🏗️ 시스템 아키텍처 및 백엔드 심층 분석',
    category: 'IT 백엔드/프론트엔드',
    desc: '대규모 트래픽, DB 설계, 서버 아키텍처 및 인프라 구조 중심의 단일 저장소 심층 분석',
    sections: [
      {
        type: 'SYS_ARCHITECTURE',
        title: '시스템 설계 및 아키텍처 심층 분석',
        columns: [
          'System Overview & Purpose (시스템 개요 및 목적)',
          'Architecture & Data Flow (아키텍처 및 데이터 흐름 구조)',
          'Core Backend Implementation (핵심 백엔드 로직 및 API 구현)',
          'Performance Tuning & Scalability (성능 최적화 및 확장성 고려사항)'
        ]
      }
    ]
  },

  GITHUB_TROUBLESHOOTING: {
    id: 'GITHUB_TROUBLESHOOTING',
    name: '⚡ 문제 해결 및 성능 최적화 심층 분석',
    category: 'IT 백엔드/프론트엔드',
    desc: '버그 수정, 코드 리팩토링, 트러블슈팅 및 성능 최적화 경험에 초점을 맞춘 단일 저장소 분석',
    sections: [
      {
        type: 'TROUBLESHOOTING',
        title: '트러블슈팅 및 성능 개선 리포트',
        columns: [
          'Project Background (프로젝트 배경 및 목표)',
          'Technical Challenges & Bottlenecks (마주한 기술적 한계 및 병목 구간)',
          'Troubleshooting Steps (문제 해결 과정 및 접근 방식)',
          'Results & Quantifiable Improvements (개선 결과 및 수치적 성과)'
        ]
      }
    ]
  },

  GITHUB_LIBRARY_DEV: {
    id: 'GITHUB_LIBRARY_DEV',
    name: '🧩 라이브러리 / SDK / 모듈 심층 분석',
    category: 'IT 백엔드/프론트엔드',
    desc: '오픈소스 패키지, SDK, 재사용 가능한 모듈 및 공통 컴포넌트 설계 중심의 심층 분석',
    sections: [
      {
        type: 'LIBRARY_DEV',
        title: '라이브러리 및 모듈 심층 분석',
        columns: [
          'Library Overview & Target (라이브러리 개요 및 타겟 사용자)',
          'Core API Design & Interface (핵심 API 설계 및 인터페이스 구조)',
          'Design Patterns & Modularity (적용된 디자인 패턴 및 모듈화 전략)',
          'Usage Example & Extensibility (사용 예시 및 확장성 검토)'
        ]
      }
    ]
  },

  GITHUB_RESUME_ALIGNED: {
    id: 'GITHUB_RESUME_ALIGNED',
    name: '🎯 이력서 밀착형 GitHub 성과 리포트 (Resume-Aligned)',
    category: 'IT 백엔드/프론트엔드',
    desc: '실제 이력서 프로젝트 항목에 그대로 복사·붙여넣기 할 수 있도록 STAR 기법 및 수치화된 성과 중심으로 요약',
    sections: [
      {
        type: 'RESUME_PROJECT',
        title: 'GitHub 핵심 프로젝트 성과 요약',
        columns: [
          'Project Title & Overview (프로젝트 명 및 핵심 소개)',
          'Tech Stack & Architecture (사용 기술 및 시스템 구조)',
          'Key Contributions & Features (주요 기여 및 구현 기능)',
          'Quantitative Impact & Troubleshooting (정량적 성과 및 문제 해결)'
        ]
      }
    ]
  }
};