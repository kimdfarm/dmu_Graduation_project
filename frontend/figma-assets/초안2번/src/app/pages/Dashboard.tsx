import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Plus, FileText, Calendar, MoreVertical, Trash2 } from "lucide-react";
import { getResumes, createEmptyResume, saveResume, Resume } from "../mockData";

export function Dashboard() {
  const [resumesList, setResumesList] = useState<Resume[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    setResumesList(getResumes());
  }, []);

  const handleCreateNew = () => {
    const newResume = createEmptyResume();
    saveResume(newResume);
    navigate(`/editor/${newResume.id}`);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("삭제하시겠습니까?")) {
      setResumesList(resumesList.filter((r) => r.id !== id));
      const index = getResumes().findIndex(r => r.id === id);
      if(index > -1) getResumes().splice(index, 1);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* App Header */}
      <header className="px-5 py-4 bg-white border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold text-slate-900">내 자소서</h1>
        <button
          onClick={handleCreateNew}
          className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
        >
          <Plus className="w-6 h-6" />
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {resumesList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center mt-20">
            <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mb-5">
              <FileText className="w-10 h-10 text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">작성된 자소서가 없어요</h3>
            <p className="text-sm text-slate-500 mb-8 px-4">우측 상단의 + 버튼을 눌러<br/>새로운 이력서를 작성해보세요.</p>
          </div>
        ) : (
          <div className="space-y-4 pb-20">
            {resumesList.map((resume) => (
              <Link
                to={`/editor/${resume.id}`}
                key={resume.id}
                className="block bg-white border border-slate-200 rounded-2xl p-5 shadow-sm active:scale-[0.98] transition-transform relative"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 pr-4">
                    <h3 className="text-lg font-bold text-slate-900 leading-tight mb-1">{resume.title}</h3>
                    <p className="text-sm text-indigo-600 font-medium">{resume.basicInfo.position || "직무 미지정"}</p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(resume.id, e)}
                    className="text-slate-400 p-2 -mr-2 -mt-2 active:bg-slate-100 rounded-full"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="flex items-center text-xs text-slate-400 mt-4">
                  <Calendar className="w-3.5 h-3.5 mr-1" />
                  <span>{resume.lastModified} 수정됨</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
