import { useState } from "react";
import { Resume } from "../../mockData";
import { Plus, Trash2, X } from "lucide-react";

interface Props {
  data: Resume["projects"];
  onChange: (data: Resume["projects"]) => void;
}

export function ProjectsForm({ data, onChange }: Props) {
  const [newTech, setNewTech] = useState<{ [key: number]: string }>({});

  const addProject = () => {
    onChange([
      ...data,
      {
        id: Date.now().toString(),
        name: "",
        role: "",
        startDate: "",
        endDate: "",
        description: "",
        techStack: [],
        link: "",
        achievements: [""],
      },
    ]);
  };

  const updateProject = (index: number, field: keyof Resume["projects"][0], value: any) => {
    const newData = [...data];
    newData[index] = { ...newData[index], [field]: value };
    onChange(newData);
  };

  const removeProject = (index: number) => {
    if(confirm("이 프로젝트를 삭제하시겠습니까?")) {
      onChange(data.filter((_, i) => i !== index));
    }
  };

  const addTech = (index: number) => {
    if (!newTech[index]?.trim()) return;
    const newData = [...data];
    if (!newData[index].techStack) newData[index].techStack = [];
    newData[index].techStack.push(newTech[index].trim());
    onChange(newData);
    setNewTech({ ...newTech, [index]: "" });
  };

  const removeTech = (projIndex: number, techIndex: number) => {
    const newData = [...data];
    newData[projIndex].techStack = newData[projIndex].techStack.filter((_, i) => i !== techIndex);
    onChange(newData);
  };

  const updateAchievement = (projIndex: number, achIndex: number, value: string) => {
    const newData = [...data];
    newData[projIndex].achievements[achIndex] = value;
    onChange(newData);
  };

  const addAchievement = (projIndex: number) => {
    const newData = [...data];
    newData[projIndex].achievements.push("");
    onChange(newData);
  };

  const removeAchievement = (projIndex: number, achIndex: number) => {
    const newData = [...data];
    newData[projIndex].achievements = newData[projIndex].achievements.filter((_, i) => i !== achIndex);
    onChange(newData);
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 mb-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">프로젝트</h2>
      </div>

      <div className="space-y-4">
        {data.map((proj, index) => (
          <div key={proj.id} className="relative p-5 border border-slate-200 rounded-2xl bg-slate-50">
            <button
              onClick={() => removeProject(index)}
              className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 rounded-full bg-white shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="space-y-3 mb-4 pr-10">
              <input
                type="text"
                value={proj.name}
                onChange={(e) => updateProject(index, "name", e.target.value)}
                placeholder="프로젝트명"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none bg-white text-sm font-bold"
              />
              <input
                type="text"
                value={proj.description}
                onChange={(e) => updateProject(index, "description", e.target.value)}
                placeholder="한 줄 설명"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none bg-white text-sm font-medium"
              />
              <input
                type="text"
                value={proj.role}
                onChange={(e) => updateProject(index, "role", e.target.value)}
                placeholder="역할 (예: Frontend)"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none bg-white text-sm font-medium"
              />
              <input
                type="url"
                value={proj.link}
                onChange={(e) => updateProject(index, "link", e.target.value)}
                placeholder="링크 URL"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none bg-white text-sm font-medium"
              />
            </div>
            
            <div className="flex gap-2 mb-4">
              <input
                type="month"
                value={proj.startDate}
                onChange={(e) => updateProject(index, "startDate", e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none bg-white text-xs font-medium"
              />
              <input
                type="month"
                value={proj.endDate}
                onChange={(e) => updateProject(index, "endDate", e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none bg-white text-xs font-medium"
              />
            </div>

            {/* Tech Stack */}
            <div className="mb-4 bg-white p-3 rounded-xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700 mb-2">사용 기술</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {proj.techStack?.map((tech, tIndex) => (
                  <span key={tIndex} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold border border-indigo-100">
                    {tech}
                    <button onClick={() => removeTech(index, tIndex)} className="text-indigo-400 hover:text-indigo-600">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTech[index] || ""}
                  onChange={(e) => setNewTech({ ...newTech, [index]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTech(index);
                    }
                  }}
                  placeholder="기술 추가"
                  className="flex-1 px-2 py-1.5 text-xs rounded border border-slate-200 focus:border-indigo-400 outline-none bg-slate-50"
                />
                <button onClick={() => addTech(index)} className="px-3 py-1.5 bg-slate-200 active:bg-slate-300 text-slate-700 rounded text-xs font-bold">추가</button>
              </div>
            </div>

            {/* Achievements */}
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-slate-700">주요 성과</label>
                <button onClick={() => addAchievement(index)} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded font-bold">항목 추가</button>
              </div>
              <div className="space-y-2">
                {proj.achievements.map((ach, aIndex) => (
                  <div key={aIndex} className="flex gap-2 relative group">
                    <span className="text-slate-300 mt-2 text-xs">•</span>
                    <textarea
                      value={ach}
                      onChange={(e) => updateAchievement(index, aIndex, e.target.value)}
                      placeholder="구현한 내용이나 성과"
                      className="flex-1 px-2 py-1.5 text-xs rounded border border-slate-200 focus:border-indigo-400 outline-none bg-slate-50 resize-none min-h-[40px]"
                      rows={2}
                    />
                    {proj.achievements.length > 1 && (
                      <button onClick={() => removeAchievement(index, aIndex)} className="absolute -right-2 -top-2 text-slate-400 hover:text-red-500 bg-white rounded-full p-1 shadow-sm border border-slate-100">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        
        <button
          onClick={addProject}
          className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 font-medium flex items-center justify-center gap-2 active:bg-slate-50"
        >
          <Plus className="w-5 h-5" />
          프로젝트 추가
        </button>
      </div>
    </div>
  );
}
