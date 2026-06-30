export interface Resume {
  id: string;
  title: string;
  lastModified: string;
  basicInfo: {
    name: string;
    email: string;
    phone: string;
    github: string;
    blog: string;
    portfolio: string;
    position: string;
  };
  skills: { category: string; items: string[] }[];
  experiences: {
    id: string;
    company: string;
    role: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    description: string;
  }[];
  projects: {
    id: string;
    name: string;
    role: string;
    startDate: string;
    endDate: string;
    description: string;
    techStack: string[];
    link: string;
    achievements: string[];
  }[];
  essays: {
    id: string;
    title: string;
    content: string;
  }[];
}

export const initialResumes: Resume[] = [
  {
    id: "1",
    title: "프론트엔드 개발자 (토스 지원용)",
    lastModified: "2026-06-25",
    basicInfo: {
      name: "김코딩",
      email: "kim.coding@example.com",
      phone: "010-1234-5678",
      github: "https://github.com/kimcoding",
      blog: "https://velog.io/@kimcoding",
      portfolio: "https://kimcoding.dev",
      position: "Frontend Developer",
    },
    skills: [
      { category: "Frontend", items: ["React", "TypeScript", "Next.js", "Tailwind CSS"] },
      { category: "State Management", items: ["Zustand", "Redux", "React Query"] },
      { category: "Tools", items: ["Git", "Figma", "Storybook"] },
    ],
    experiences: [
      {
        id: "exp-1",
        company: "(주)스타트업페이",
        role: "Frontend Engineer",
        startDate: "2024-03",
        endDate: "2026-05",
        isCurrent: false,
        description: "결제 시스템 프론트엔드 개발 및 유지보수\n디자인 시스템 구축 참여",
      },
    ],
    projects: [
      {
        id: "proj-1",
        name: "DevFolio - 개발자 포트폴리오 메이커",
        role: "Frontend Lead",
        startDate: "2025-10",
        endDate: "2026-02",
        description: "마크다운 기반으로 쉽게 포트폴리오를 생성할 수 있는 서비스",
        techStack: ["React", "TypeScript", "Zustand", "Supabase"],
        link: "https://devfolio.example.com",
        achievements: [
          "초기 렌더링 속도 30% 개선 (Code Splitting 적용)",
          "월간 활성 사용자 1,000명 달성",
          "TDD 방법론 적용을 통한 결함률 감소",
        ],
      },
    ],
    essays: [
      {
        id: "essay-1",
        title: "지원동기 및 포부",
        content: "개발자로서 사용자에게 최상의 경험을 제공하는 것에 열정을 가지고 있습니다. 특히 금융 분야에서의 혁신적인 서비스에 깊은 인상을 받았으며...",
      },
      {
        id: "essay-2",
        title: "가장 큰 기술적 도전을 겪고 해결한 경험",
        content: "결제 모듈 연동 과정에서 발생한 비동기 상태 관리 문제를 React Query와 Zustand를 조합하여 성공적으로 해결한 경험이 있습니다...",
      },
    ],
  },
];

// Simple in-memory store for the prototype
export let resumes = [...initialResumes];

export const getResumes = () => resumes;
export const getResumeById = (id: string) => resumes.find((r) => r.id === id);
export const saveResume = (resume: Resume) => {
  const index = resumes.findIndex((r) => r.id === resume.id);
  if (index >= 0) {
    resumes[index] = resume;
  } else {
    resumes.push(resume);
  }
};
export const createEmptyResume = (): Resume => ({
  id: Date.now().toString(),
  title: "새로운 이력서",
  lastModified: new Date().toISOString().split("T")[0],
  basicInfo: { name: "", email: "", phone: "", github: "", blog: "", portfolio: "", position: "" },
  skills: [{ category: "Frontend", items: [] }],
  experiences: [],
  projects: [],
  essays: [],
});
