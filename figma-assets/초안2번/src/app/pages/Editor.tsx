import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { getResumeById, saveResume, Resume } from "../mockData";
import { 
  User, 
  Code, 
  Briefcase, 
  FolderGit2, 
  PenTool, 
  ChevronLeft,
  Eye,
  Check
} from "lucide-react";
import { toast } from "sonner";
import { BasicInfoForm } from "../components/editor/BasicInfoForm";
import { SkillsForm } from "../components/editor/SkillsForm";
import { ExperiencesForm } from "../components/editor/ExperiencesForm";
import { ProjectsForm } from "../components/editor/ProjectsForm";
import { EssaysForm } from "../components/editor/EssaysForm";

type TabType = "basic" | "skills" | "experience" | "projects" | "essays";

export function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [resume, setResume] = useState<Resume | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("essays"); // Default to essays to show off AI feature
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (id) {
      const data = getResumeById(id);
      if (data) {
        setResume(JSON.parse(JSON.stringify(data)));
      } else {
        navigate("/");
      }
    }
  }, [id, navigate]);

  const handleSave = () => {
    if (resume) {
      setIsSaving(true);
      setTimeout(() => {
        saveResume({ ...resume, lastModified: new Date().toISOString().split("T")[0] });
        setIsSaving(false);
        toast.success("저장되었습니다.");
      }, 500);
    }
  };

  const updateResumeData = (key: keyof Resume, data: any) => {
    if (resume) {
      setResume({ ...resume, [key]: data });
    }
  };

  if (!resume) return <div className="p-8 text-center text-slate-500">불러오는 중...</div>;

  const tabs = [
    { id: "basic", label: "기본", icon: User },
    { id: "skills", label: "스택", icon: Code },
    { id: "experience", label: "경력", icon: Briefcase },
    { id: "projects", label: "프로젝트", icon: FolderGit2 },
    { id: "essays", label: "자소서", icon: PenTool },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* Header */}
      <header className="bg-white px-4 py-3 flex items-center justify-between border-b border-slate-200 z-10 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Link to="/" className="p-2 -ml-2 text-slate-500 active:bg-slate-100 rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <input
            type="text"
            value={resume.title}
            onChange={(e) => setResume({ ...resume, title: e.target.value })}
            className="text-lg font-bold text-slate-900 bg-transparent border-none focus:ring-0 p-0 w-full truncate"
            placeholder="자소서 제목"
          />
        </div>
        <Link
          to={`/preview/${resume.id}`}
          className="p-2 ml-2 text-indigo-600 bg-indigo-50 active:bg-indigo-100 rounded-full"
        >
          <Eye className="w-5 h-5" />
        </Link>
      </header>

      {/* Mobile Tab Scroll */}
      <div className="bg-white border-b border-slate-200 shrink-0 shadow-sm z-10">
        <div className="flex overflow-x-auto px-4 py-2 gap-2 no-scrollbar">
           {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 bg-slate-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="space-y-4">
          {activeTab === "basic" && (
            <BasicInfoForm data={resume.basicInfo} onChange={(data) => updateResumeData("basicInfo", data)} />
          )}
          {activeTab === "skills" && (
            <SkillsForm data={resume.skills} onChange={(data) => updateResumeData("skills", data)} />
          )}
          {activeTab === "experience" && (
            <ExperiencesForm data={resume.experiences} onChange={(data) => updateResumeData("experiences", data)} />
          )}
          {activeTab === "projects" && (
            <ProjectsForm data={resume.projects} onChange={(data) => updateResumeData("projects", data)} />
          )}
          {activeTab === "essays" && (
            <EssaysForm data={resume.essays} onChange={(data) => updateResumeData("essays", data)} />
          )}
        </div>
      </main>

      {/* Floating Save Button */}
      <div className="absolute bottom-6 left-0 right-0 px-4 z-20">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 active:bg-indigo-700 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-80"
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Check className="w-5 h-5" />
          )}
          {isSaving ? "저장 중..." : "저장하기"}
        </button>
      </div>
    </div>
  );
}
