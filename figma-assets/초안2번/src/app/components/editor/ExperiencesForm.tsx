import { Resume } from "../../mockData";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  data: Resume["experiences"];
  onChange: (data: Resume["experiences"]) => void;
}

export function ExperiencesForm({ data, onChange }: Props) {
  const addExperience = () => {
    onChange([
      ...data,
      {
        id: Date.now().toString(),
        company: "",
        role: "",
        startDate: "",
        endDate: "",
        isCurrent: false,
        description: "",
      },
    ]);
  };

  const updateExperience = (index: number, field: keyof Resume["experiences"][0], value: any) => {
    const newData = [...data];
    newData[index] = { ...newData[index], [field]: value };
    onChange(newData);
  };

  const removeExperience = (index: number) => {
    if(confirm("이 경력을 삭제하시겠습니까?")) {
      onChange(data.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 mb-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">경력 사항</h2>
      </div>

      <div className="space-y-4">
        {data.map((exp, index) => (
          <div key={exp.id} className="relative p-5 border border-slate-200 rounded-2xl bg-slate-50">
            <button
              onClick={() => removeExperience(index)}
              className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 rounded-full bg-white shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="space-y-3 mb-3 pr-10">
              <input
                type="text"
                value={exp.company}
                onChange={(e) => updateExperience(index, "company", e.target.value)}
                placeholder="회사명"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none bg-white text-sm font-bold"
              />
              <input
                type="text"
                value={exp.role}
                onChange={(e) => updateExperience(index, "role", e.target.value)}
                placeholder="직무/역할"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none bg-white text-sm font-medium"
              />
            </div>
            
            <div className="flex gap-2 mb-3">
              <input
                type="month"
                value={exp.startDate}
                onChange={(e) => updateExperience(index, "startDate", e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none bg-white text-xs font-medium"
              />
              <input
                type="month"
                value={exp.endDate}
                disabled={exp.isCurrent}
                onChange={(e) => updateExperience(index, "endDate", e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none bg-white text-xs font-medium disabled:opacity-50"
              />
            </div>
            
            <label className="flex items-center gap-2 text-xs text-slate-600 mb-3 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={exp.isCurrent}
                onChange={(e) => updateExperience(index, "isCurrent", e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300"
              />
              재직중
            </label>

            <textarea
              value={exp.description}
              onChange={(e) => updateExperience(index, "description", e.target.value)}
              placeholder="업무 및 성과 요약"
              rows={4}
              className="w-full px-3 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none bg-white text-sm resize-none"
            />
          </div>
        ))}
        
        <button
          onClick={addExperience}
          className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 font-medium flex items-center justify-center gap-2 active:bg-slate-50"
        >
          <Plus className="w-5 h-5" />
          경력 추가
        </button>
      </div>
    </div>
  );
}
