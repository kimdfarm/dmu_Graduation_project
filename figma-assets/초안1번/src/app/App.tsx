import { useState, useRef } from "react";
import {
  Github, LayoutDashboard, FileText, FolderGit2,
  Upload, Star, GitFork, CheckCircle2, AlertCircle,
  Building2, Code2, Bell, ChevronRight, Sparkles,
  Download, ExternalLink, ArrowUpRight, Activity,
  GitCommit, Zap, BarChart3, RefreshCw, Award,
} from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

type View = "dashboard" | "github" | "projects" | "resume";
type ResumeState = "upload" | "analyzing" | "results";

// ── Data ──────────────────────────────────────────────────────────────────────

const skillRadarData = [
  { subject: "FE", score: 88 },
  { subject: "BE", score: 72 },
  { subject: "DevOps", score: 55 },
  { subject: "AI/ML", score: 63 },
  { subject: "DB", score: 70 },
  { subject: "Mobile", score: 45 },
];

const commitData = [
  { month: "1월", commits: 42 },
  { month: "2월", commits: 68 },
  { month: "3월", commits: 55 },
  { month: "4월", commits: 91 },
  { month: "5월", commits: 78 },
  { month: "6월", commits: 103 },
];

const languageData = [
  { name: "TypeScript", value: 38, color: "#3B82F6" },
  { name: "Python", value: 25, color: "#10B981" },
  { name: "Java", value: 18, color: "#F59E0B" },
  { name: "Go", value: 12, color: "#06B6D4" },
  { name: "기타", value: 7, color: "#374151" },
];

const repos = [
  { name: "ai-study-planner", stars: 124, forks: 31, lang: "TypeScript", desc: "AI 기반 개인화 학습 플래너" },
  { name: "fastapi-auth-service", stars: 89, forks: 17, lang: "Python", desc: "JWT 기반 인증 마이크로서비스" },
  { name: "react-portfolio-kit", stars: 56, forks: 22, lang: "TypeScript", desc: "개발자 포트폴리오 템플릿" },
  { name: "k8s-monitoring", stars: 43, forks: 9, lang: "Go", desc: "Kubernetes 클러스터 모니터링" },
];

const projectList = [
  {
    name: "AI 학습 플래너",
    period: "2024.03 – 2024.08",
    role: "팀장 / Full-Stack",
    stack: ["Next.js", "FastAPI", "PostgreSQL"],
    metrics: [
      { label: "코드 기여도", value: "68%", bar: 68 },
      { label: "커밋 수", value: "312", bar: 75 },
      { label: "이슈 해결", value: "47건", bar: 82 },
    ],
    score: 91,
    tag: "우수",
    tagColor: "emerald",
  },
  {
    name: "실시간 협업 에디터",
    period: "2023.09 – 2024.01",
    role: "Backend 담당",
    stack: ["Node.js", "Socket.io", "Redis"],
    metrics: [
      { label: "코드 기여도", value: "41%", bar: 41 },
      { label: "커밋 수", value: "198", bar: 55 },
      { label: "이슈 해결", value: "29건", bar: 61 },
    ],
    score: 78,
    tag: "협업",
    tagColor: "cyan",
  },
  {
    name: "중고거래 플랫폼 앱",
    period: "2023.03 – 2023.07",
    role: "Frontend 담당",
    stack: ["React Native", "Expo", "Django"],
    metrics: [
      { label: "코드 기여도", value: "55%", bar: 55 },
      { label: "커밋 수", value: "241", bar: 65 },
      { label: "이슈 해결", value: "33건", bar: 70 },
    ],
    score: 83,
    tag: "모바일",
    tagColor: "amber",
  },
];

const resumeData = {
  overall: 82,
  categories: [
    { label: "직무 적합성", score: 88, color: "#5B5FEF" },
    { label: "성장 가능성", score: 85, color: "#06B6D4" },
    { label: "문제 해결력", score: 83, color: "#10B981" },
    { label: "팀워크", score: 79, color: "#F59E0B" },
    { label: "의사소통", score: 76, color: "#EC4899" },
  ],
  strengths: [
    "오픈소스 기여 경험이 구체적으로 서술되어 직무 연관성이 높습니다.",
    "문제→분석→해결 논리 흐름이 일관되게 유지됩니다.",
    "팀 리더십 발휘 사례가 설득력 있게 작성되었습니다.",
  ],
  improvements: [
    "지원 직무 관련 기술 스택(Spring Boot, K8s) 언급이 부족합니다.",
    "수치화된 성과 지표를 추가하면 신뢰도가 높아집니다.",
    "마지막 단락의 기여 계획이 다소 모호합니다.",
  ],
  sections: [
    { section: "성장 배경", grade: "A", comment: "IT 입문 동기가 진정성 있게 전달됩니다." },
    { section: "직무 역량", grade: "B+", comment: "지원 포지션과의 연결고리를 더 명시해야 합니다." },
    { section: "프로젝트 경험", grade: "A-", comment: "트러블슈팅 경험이 특히 인상적입니다." },
    { section: "입사 후 계획", grade: "B", comment: "1년/3년 단위 마일스톤을 구체화하세요." },
  ],
  companies: [
    { name: "카카오", team: "FE개발팀", match: 91, type: "대기업", color: "#FFCD00" },
    { name: "라인플러스", team: "웹개발팀", match: 88, type: "대기업", color: "#00B900" },
    { name: "토스", team: "프로덕트팀", match: 85, type: "핀테크", color: "#0064FF" },
    { name: "당근마켓", team: "서버개발팀", match: 81, type: "스타트업", color: "#FF7B00" },
    { name: "네이버 클라우드", team: "플랫폼개발팀", match: 78, type: "대기업", color: "#03C75A" },
  ],
};

// ── Shared micro-components ───────────────────────────────────────────────────

const tagColors: Record<string, string> = {
  emerald: "bg-emerald-500/15 text-emerald-300",
  cyan: "bg-cyan-500/15 text-cyan-300",
  amber: "bg-amber-500/15 text-amber-300",
  indigo: "bg-indigo-500/15 text-indigo-300",
  slate: "bg-slate-500/15 text-slate-300",
};

function Chip({ children, color = "indigo" }: { children: React.ReactNode; color?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${tagColors[color] || tagColors.indigo}`}>
      {children}
    </span>
  );
}

function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const sw = 8;
  const r = (size - sw * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const c = size / 2;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="#1E2A4A" strokeWidth={sw} />
        <circle cx={c} cy={c} r={r} fill="none" stroke="url(#grad-score)"
          strokeWidth={sw} strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold text-foreground leading-none" style={{ fontSize: size * 0.25, fontFamily: "'JetBrains Mono', monospace" }}>{score}</span>
        <span className="text-muted-foreground" style={{ fontSize: size * 0.115 }}>/ 100</span>
      </div>
    </div>
  );
}

function GradeChip({ grade }: { grade: string }) {
  const map: Record<string, string> = {
    "A": "bg-emerald-500/20 text-emerald-300",
    "A-": "bg-emerald-500/15 text-emerald-400",
    "B+": "bg-cyan-500/20 text-cyan-300",
    "B": "bg-blue-500/20 text-blue-300",
  };
  return (
    <span className={`inline-flex items-center justify-center w-9 h-6 rounded text-xs font-bold font-mono ${map[grade] || "bg-slate-500/20 text-slate-300"}`}>
      {grade}
    </span>
  );
}

// ── Page views ────────────────────────────────────────────────────────────────

function DashboardView() {
  return (
    <div className="space-y-4 pb-2">
      {/* Hero greeting */}
      <div className="rounded-2xl p-4 bg-gradient-to-br from-indigo-600/25 via-indigo-500/10 to-transparent border border-indigo-500/20">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-indigo-300 mb-0.5">안녕하세요 👋</p>
            <h1 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-cyan-300">김지훈</span>님
            </h1>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground mb-0.5">종합 역량 등급</div>
            <div className="text-2xl font-bold text-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>A-</div>
            <div className="text-xs text-indigo-300">상위 12%</div>
          </div>
        </div>
        <button className="w-full py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-indigo-400 active:scale-95 transition-all">
          <Sparkles size={14} />
          AI 분석 시작
        </button>
      </div>

      {/* Stats grid 2×2 */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: <Star size={14} />, label: "GitHub Stars", value: "312", change: "+24", color: "text-amber-400" },
          { icon: <GitCommit size={14} />, label: "총 커밋 수", value: "1,847", change: "+103", color: "text-indigo-400" },
          { icon: <BarChart3 size={14} />, label: "기술 역량 점수", value: "87", change: "+3", color: "text-cyan-400" },
          { icon: <FileText size={14} />, label: "자소서 분석", value: "3건", change: "완료", color: "text-emerald-400" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className={s.color}>{s.icon}</span>
              <span className="text-xs text-emerald-400 font-mono flex items-center gap-0.5">
                <ArrowUpRight size={10} />{s.change}
              </span>
            </div>
            <div className="text-xl font-bold text-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Radar */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>기술 역량 개요</h2>
          <Chip color="indigo">GitHub 기반</Chip>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <RadarChart data={skillRadarData}>
            <PolarGrid stroke="rgba(255,255,255,0.07)" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748B", fontSize: 10, fontFamily: "Inter, sans-serif" }} />
            <Radar dataKey="score" stroke="#5B5FEF" fill="#5B5FEF" fillOpacity={0.25} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Quick actions */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>빠른 실행</h2>
        <div className="space-y-2">
          {[
            { icon: <Github size={15} />, label: "GitHub 연동 분석", sub: "레포지토리 재분석", ic: "bg-indigo-500/15 text-indigo-400" },
            { icon: <FolderGit2 size={15} />, label: "프로젝트 등록", sub: "새 프로젝트 추가", ic: "bg-cyan-500/15 text-cyan-400" },
            { icon: <FileText size={15} />, label: "자소서 업로드", sub: "AI 평가 받기", ic: "bg-emerald-500/15 text-emerald-400" },
          ].map((a) => (
            <button key={a.label} className="w-full flex items-center gap-3 p-2.5 rounded-lg active:bg-accent transition-colors text-left">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${a.ic}`}>{a.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>{a.label}</div>
                <div className="text-xs text-muted-foreground">{a.sub}</div>
              </div>
              <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Repos */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>주요 레포지토리</h2>
          <button className="text-xs text-primary flex items-center gap-0.5">전체 <ExternalLink size={10} /></button>
        </div>
        <div className="space-y-2">
          {repos.slice(0, 3).map((r) => (
            <div key={r.name} className="flex items-start gap-3 p-2.5 rounded-lg bg-secondary/50 border border-border">
              <div className="w-7 h-7 bg-indigo-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Code2 size={12} className="text-indigo-400" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-mono font-medium text-foreground truncate">{r.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>{r.desc}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Star size={9} className="text-amber-400" />{r.stars}</span>
                  <span className="text-xs text-blue-400 font-mono">{r.lang}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GithubView() {
  return (
    <div className="space-y-4 pb-2">
      {/* Profile */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-lg font-bold text-white flex-shrink-0">김</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">jihun-dev</span>
              <Chip color="emerald"><CheckCircle2 size={9} /> 연동</Chip>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">한국공학대학교 컴퓨터공학과 4학년</div>
          </div>
          <button className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground">
            <RefreshCw size={11} /> 재분석
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[["18", "Repos"], ["234", "Followers"], ["91", "Following"], ["312", "Stars"]].map(([v, k]) => (
            <div key={k} className="text-center">
              <div className="text-sm font-bold text-foreground font-mono">{v}</div>
              <div className="text-xs text-muted-foreground">{k}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Radar */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>기술 역량 분석</h3>
        <ResponsiveContainer width="100%" height={170}>
          <RadarChart data={skillRadarData}>
            <PolarGrid stroke="rgba(255,255,255,0.07)" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748B", fontSize: 10 }} />
            <Radar dataKey="score" stroke="#5B5FEF" fill="#5B5FEF" fillOpacity={0.3} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
        <div className="space-y-2 mt-1">
          {skillRadarData.map((s) => (
            <div key={s.subject} className="flex items-center gap-2">
              <div className="text-xs text-muted-foreground w-12 font-mono">{s.subject}</div>
              <div className="flex-1 bg-secondary rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500" style={{ width: `${s.score}%` }} />
              </div>
              <div className="text-xs font-mono text-foreground w-5 text-right">{s.score}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Commits */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>월별 커밋</h3>
          <span className="text-xs text-muted-foreground">최근 6개월</span>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={commitData} barSize={18}>
            <XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#64748B", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
            <Tooltip contentStyle={{ background: "#0C1228", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, color: "#E2E8F0", fontSize: 12 }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey="commits" fill="url(#grad-bar)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Languages */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>언어 분포</h3>
        <div className="flex h-2.5 rounded-full overflow-hidden mb-3">
          {languageData.map((l) => (
            <div key={l.name} style={{ width: `${l.value}%`, background: l.color }} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {languageData.map((l) => (
            <div key={l.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: l.color }} />
              {l.name} <span className="text-foreground font-mono ml-auto">{l.value}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tech stack */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>감지된 기술 스택</h3>
        <div className="flex flex-wrap gap-1.5">
          {["React", "Next.js", "TypeScript", "Python", "FastAPI", "Java", "Spring", "Go", "Docker", "PostgreSQL", "Redis", "AWS"].map((t) => (
            <span key={t} className="px-2 py-0.5 rounded text-xs font-mono bg-secondary border border-border text-muted-foreground">{t}</span>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-border space-y-2.5">
          {[
            { label: "코드 품질 지수", value: "A", bar: 88, color: "#10B981" },
            { label: "문서화 수준", value: "B+", bar: 73, color: "#06B6D4" },
            { label: "테스트 커버리지", value: "B", bar: 65, color: "#F59E0B" },
          ].map((m) => (
            <div key={m.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>{m.label}</span>
                <span className="text-xs font-mono font-semibold" style={{ color: m.color }}>{m.value}</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary">
                <div className="h-1.5 rounded-full" style={{ width: `${m.bar}%`, background: m.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectsView() {
  return (
    <div className="space-y-4 pb-2">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "총 프로젝트", value: "3", icon: <FolderGit2 size={14} />, color: "text-indigo-400" },
          { label: "평균 기여도", value: "55%", icon: <Activity size={14} />, color: "text-cyan-400" },
          { label: "총 커밋", value: "751", icon: <GitCommit size={14} />, color: "text-emerald-400" },
          { label: "평균 점수", value: "84", icon: <Award size={14} />, color: "text-amber-400" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>{s.label}</span>
              <span className={s.color}>{s.icon}</span>
            </div>
            <div className="text-xl font-bold text-foreground font-mono">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Project cards */}
      {projectList.map((p) => (
        <div key={p.name} className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0 mr-3">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-foreground text-sm truncate" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>{p.name}</h3>
                <Chip color={p.tagColor}>{p.tag}</Chip>
              </div>
              <div className="text-xs text-muted-foreground">{p.period}</div>
              <div className="text-xs text-muted-foreground">{p.role}</div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="text-right">
                <div className="text-xl font-bold text-foreground font-mono">{p.score}</div>
                <div className="text-xs text-muted-foreground">점수</div>
              </div>
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `conic-gradient(#5B5FEF ${p.score * 3.6}deg, #1E2A4A 0deg)` }}>
                <div className="w-6 h-6 rounded-full bg-card" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 mb-3">
            {p.stack.map((s) => (
              <span key={s} className="px-1.5 py-0.5 rounded text-xs font-mono bg-secondary border border-border text-muted-foreground">{s}</span>
            ))}
          </div>

          <div className="space-y-2">
            {p.metrics.map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>{m.label}</span>
                  <span className="text-xs font-mono text-foreground">{m.value}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary">
                  <div className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500" style={{ width: `${m.bar}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ResumeView() {
  const [state, setState] = useState<ResumeState>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<"overview" | "feedback" | "companies">("overview");
  const fileRef = useRef<HTMLInputElement>(null);

  const startAnalysis = () => {
    setState("analyzing");
    let p = 0;
    const id = setInterval(() => {
      p += Math.random() * 12 + 4;
      if (p >= 100) { p = 100; clearInterval(id); setTimeout(() => setState("results"), 400); }
      setProgress(Math.min(p, 100));
    }, 200);
  };

  const steps = ["문서 파싱 중...", "직무 관련성 분석...", "GitHub 연계 중...", "강점/개선점 추출...", "기업 매칭 중...", "점수 산출 중..."];
  const currentStep = Math.floor((progress / 100) * steps.length);

  if (state === "upload") return (
    <div className="space-y-4 pb-2">
      <div>
        <h2 className="text-base font-bold text-foreground" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>자소서 AI 평가</h2>
        <p className="text-xs text-muted-foreground mt-0.5">업로드 후 AI가 맞춤형 피드백을 제공합니다.</p>
      </div>

      <div
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all active:scale-98 ${fileName ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-card"}`}
      >
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.hwp" className="hidden" onChange={(e) => e.target.files?.[0] && setFileName(e.target.files[0].name)} />
        {fileName ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 size={20} className="text-emerald-400" />
            </div>
            <div className="text-xs font-mono text-foreground truncate max-w-full px-2">{fileName}</div>
            <div className="text-xs text-emerald-400">업로드 완료 · 분석 준비됨</div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
              <Upload size={20} className="text-indigo-400" />
            </div>
            <div className="text-sm font-medium text-foreground" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>파일을 탭하여 업로드</div>
            <div className="text-xs text-muted-foreground">PDF, DOCX, HWP, TXT · 최대 10MB</div>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <div className="text-sm font-semibold text-foreground mb-3" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>분석 옵션</div>
        <div className="space-y-2">
          {[
            { label: "GitHub 데이터 연계", desc: "레포지토리 기술 검증", checked: true },
            { label: "프로젝트 경험 매칭", desc: "등록된 프로젝트와 비교", checked: true },
            { label: "경쟁사 비교 분석", desc: "동일 직군 수준 대비", checked: false },
            { label: "면접 예상 질문 생성", desc: "자소서 기반 면접 준비", checked: true },
          ].map((o) => (
            <label key={o.label} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/50 border border-border cursor-pointer">
              <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${o.checked ? "bg-primary border-primary" : "border-border"}`}>
                {o.checked && <CheckCircle2 size={9} className="text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-foreground" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>{o.label}</div>
                <div className="text-xs text-muted-foreground">{o.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <button disabled={!fileName} onClick={startAnalysis}
        className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2 active:scale-98 transition-all"
        style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
        <Sparkles size={15} /> AI 분석 시작하기
      </button>
    </div>
  );

  if (state === "analyzing") return (
    <div className="flex flex-col items-center py-10 gap-6">
      <div className="relative w-24 h-24">
        <svg width={96} height={96} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={48} cy={48} r={40} fill="none" stroke="#1E2A4A" strokeWidth={7} />
          <circle cx={48} cy={48} r={40} fill="none" stroke="url(#grad-progress)" strokeWidth={7}
            strokeDasharray={`${(progress / 100) * (2 * Math.PI * 40)} ${2 * Math.PI * 40}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold font-mono text-foreground">{Math.round(progress)}%</span>
        </div>
      </div>
      <div className="text-center">
        <div className="font-semibold text-foreground mb-1" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>AI 분석 중</div>
        <div className="text-sm text-indigo-300 animate-pulse">{steps[Math.min(currentStep, steps.length - 1)]}</div>
      </div>
      <div className="w-full space-y-1.5">
        {steps.map((step, i) => (
          <div key={step} className={`flex items-center gap-3 text-xs px-3 py-2 rounded-lg transition-colors ${i === currentStep ? "text-foreground bg-card border border-indigo-500/20" : i < currentStep ? "text-muted-foreground" : "text-muted-foreground/30"}`}
            style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${i < currentStep ? "bg-emerald-400" : i === currentStep ? "bg-indigo-400 animate-pulse" : "bg-border"}`} />
            {step}
            {i < currentStep && <CheckCircle2 size={11} className="ml-auto text-emerald-400" />}
          </div>
        ))}
      </div>
    </div>
  );

  // Results
  return (
    <div className="space-y-4 pb-2">
      {/* Score card */}
      <div className="bg-gradient-to-br from-indigo-900/40 to-cyan-900/10 border border-indigo-500/20 rounded-2xl p-4">
        <div className="flex items-center gap-4">
          <ScoreRing score={resumeData.overall} size={88} />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground mb-1" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>종합 점수 · 상위 18%</div>
            <div className="text-lg font-bold text-foreground" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-cyan-300">{resumeData.overall}점</span>
            </div>
            <div className="grid grid-cols-3 gap-1 mt-2">
              {resumeData.categories.slice(0, 3).map((c) => (
                <div key={c.label} className="text-center">
                  <div className="text-sm font-bold font-mono" style={{ color: c.color }}>{c.score}</div>
                  <div className="text-xs text-muted-foreground leading-tight" style={{ fontFamily: "'Noto Sans KR', sans-serif", fontSize: 9 }}>{c.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={() => setState("upload")} className="flex-1 py-2 border border-border rounded-lg text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Upload size={11} /> 재업로드
          </button>
          <button className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium flex items-center justify-center gap-1">
            <Download size={11} /> 결과 저장
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-card border border-border rounded-xl">
        {(["overview", "feedback", "companies"] as const).map((t) => {
          const labels = { overview: "강점/개선점", feedback: "섹션 피드백", companies: "추천 기업" };
          return (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
              {labels[t]}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-3">
          <div className="bg-card border border-emerald-500/15 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center"><CheckCircle2 size={11} className="text-emerald-400" /></div>
              <span className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>강점</span>
            </div>
            <div className="space-y-2.5">
              {resumeData.strengths.map((s, i) => (
                <div key={i} className="flex gap-2.5 text-xs text-muted-foreground leading-relaxed" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
                  <span className="text-emerald-400 font-mono flex-shrink-0 mt-0.5">0{i + 1}</span>{s}
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card border border-amber-500/15 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded bg-amber-500/20 flex items-center justify-center"><AlertCircle size={11} className="text-amber-400" /></div>
              <span className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>개선 포인트</span>
            </div>
            <div className="space-y-2.5">
              {resumeData.improvements.map((s, i) => (
                <div key={i} className="flex gap-2.5 text-xs text-muted-foreground leading-relaxed" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
                  <span className="text-amber-400 font-mono flex-shrink-0 mt-0.5">0{i + 1}</span>{s}
                </div>
              ))}
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>항목별 점수</h3>
            <div className="space-y-2.5">
              {resumeData.categories.map((c) => (
                <div key={c.label} className="flex items-center gap-3">
                  <div className="text-xs text-muted-foreground w-20 flex-shrink-0" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>{c.label}</div>
                  <div className="flex-1 h-1.5 rounded-full bg-secondary">
                    <div className="h-1.5 rounded-full" style={{ width: `${c.score}%`, background: c.color }} />
                  </div>
                  <div className="text-xs font-mono font-semibold w-6 text-right" style={{ color: c.color }}>{c.score}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "feedback" && (
        <div className="space-y-3">
          {resumeData.sections.map((s) => (
            <div key={s.section} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start gap-3">
                <GradeChip grade={s.grade} />
                <div>
                  <div className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>{s.section}</div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>{s.comment}</div>
                </div>
              </div>
            </div>
          ))}
          <div className="bg-gradient-to-br from-indigo-900/30 to-transparent border border-indigo-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={12} className="text-indigo-400" />
              <span className="text-xs font-semibold text-indigo-300" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>AI 종합 요약</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
              탄탄한 기술 기반과 실전 프로젝트 경험을 바탕으로 설득력 있는 자소서입니다. 직무 기술 매칭 강화와 성과 수치화로 서류 통과율을 높일 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {activeTab === "companies" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>자소서 + GitHub + 기술 스택 종합 매칭 결과</p>
          {resumeData.companies.map((c, i) => (
            <div key={c.name} className="bg-card border border-border rounded-xl p-3.5 flex items-center gap-3">
              <div className="text-lg font-bold text-muted-foreground/25 font-mono w-5 flex-shrink-0 text-sm">{String(i + 1).padStart(2, "0")}</div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border border-border" style={{ background: `${c.color}20` }}>
                <Building2 size={14} style={{ color: c.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>{c.name}</span>
                  <Chip color={c.type === "대기업" ? "indigo" : c.type === "핀테크" ? "cyan" : "emerald"}>{c.type}</Chip>
                </div>
                <div className="text-xs text-muted-foreground mb-1.5">{c.team}</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-secondary">
                    <div className="h-1.5 rounded-full" style={{ width: `${c.match}%`, background: "linear-gradient(90deg,#5B5FEF,#06B6D4)" }} />
                  </div>
                  <span className="text-xs font-bold font-mono text-foreground">{c.match}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Nav items ─────────────────────────────────────────────────────────────────

const navItems = [
  { id: "dashboard" as View, icon: LayoutDashboard, label: "홈" },
  { id: "github" as View, icon: Github, label: "GitHub" },
  { id: "projects" as View, icon: FolderGit2, label: "프로젝트" },
  { id: "resume" as View, icon: FileText, label: "자소서" },
];

// ── Root App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<View>("dashboard");

  const pageTitles: Record<View, string> = {
    dashboard: "대시보드",
    github: "GitHub 분석",
    projects: "프로젝트 분석",
    resume: "자소서 평가",
  };

  return (
    // Outer canvas — centers the phone on screen
    <div className="min-h-screen bg-[#020510] flex items-center justify-center p-6"
      style={{ fontFamily: "'Noto Sans KR', 'Inter', sans-serif" }}>

      {/* Global gradient defs */}
      <svg width={0} height={0} className="absolute pointer-events-none">
        <defs>
          <linearGradient id="grad-score" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#5B5FEF" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <linearGradient id="grad-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5B5FEF" />
            <stop offset="100%" stopColor="#5B5FEF" stopOpacity={0.45} />
          </linearGradient>
          <linearGradient id="grad-progress" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#5B5FEF" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
      </svg>

      {/* Phone frame */}
      <div
        className="relative flex flex-col overflow-hidden shadow-2xl"
        style={{
          width: 390,
          height: 844,
          borderRadius: 44,
          background: "var(--background)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 0 0 8px #0c0e1a, 0 40px 80px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.05)",
        }}
      >
        {/* Status bar */}
        <div className="flex items-center justify-between px-7 pt-4 pb-1 flex-shrink-0">
          <span className="text-xs font-semibold text-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>9:41</span>
          <div className="w-28 h-6 rounded-full bg-black absolute left-1/2 -translate-x-1/2 top-0" />
          <div className="flex items-center gap-1.5">
            {/* signal bars */}
            <div className="flex items-end gap-0.5 h-3">
              {[40, 60, 80, 100].map((h, i) => (
                <div key={i} className="w-0.5 rounded-sm bg-foreground" style={{ height: `${h}%` }} />
              ))}
            </div>
            {/* wifi */}
            <svg width={13} height={10} viewBox="0 0 13 10" fill="none">
              <path d="M6.5 7.5a1 1 0 110 2 1 1 0 010-2z" fill="currentColor" className="text-foreground" />
              <path d="M3.5 5.5a4.24 4.24 0 016 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-foreground" />
              <path d="M1 3a7.5 7.5 0 0111 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-foreground" />
            </svg>
            {/* battery */}
            <div className="flex items-center gap-0.5">
              <div className="w-5 h-2.5 rounded-sm border border-foreground/60 relative overflow-hidden p-px">
                <div className="h-full rounded-sm bg-foreground" style={{ width: "78%" }} />
              </div>
              <div className="w-0.5 h-1 rounded-r-sm bg-foreground/50" />
            </div>
          </div>
        </div>

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center">
              <Zap size={12} className="text-white" />
            </div>
            <span className="font-bold text-sm text-foreground">DevProfile</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 relative flex items-center justify-center rounded-lg border border-border">
              <Bell size={14} className="text-muted-foreground" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
            </div>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-xs font-bold text-white">김</div>
          </div>
        </div>

        {/* Page title */}
        <div className="px-5 pb-2 flex-shrink-0">
          <h1 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
            {pageTitles[view]}
          </h1>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-4"
          style={{ scrollbarWidth: "none" }}>
          {view === "dashboard" && <DashboardView />}
          {view === "github" && <GithubView />}
          {view === "projects" && <ProjectsView />}
          {view === "resume" && <ResumeView />}
        </div>

        {/* Bottom nav */}
        <div
          className="flex-shrink-0 border-t border-border px-2 pt-2 pb-6"
          style={{ background: "var(--sidebar)" }}
        >
          <div className="flex">
            {navItems.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className="flex-1 flex flex-col items-center gap-1 py-1.5 rounded-xl transition-colors active:scale-95"
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${view === id ? "bg-primary/20" : ""}`}>
                  <Icon size={18} className={view === id ? "text-indigo-300" : "text-muted-foreground"} />
                </div>
                <span
                  className={`text-xs transition-colors ${view === id ? "text-indigo-300 font-medium" : "text-muted-foreground"}`}
                  style={{ fontFamily: "'Noto Sans KR', sans-serif", fontSize: 10 }}
                >
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
