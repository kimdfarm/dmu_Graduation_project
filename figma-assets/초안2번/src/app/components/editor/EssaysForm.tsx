import { Resume } from "../../mockData";
import { Plus, Trash2, Sparkles, Wand2, SpellCheck, Briefcase } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  data: Resume["essays"];
  onChange: (data: Resume["essays"]) => void;
}

export function EssaysForm({ data, onChange }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const addEssay = () => {
    onChange([
      ...data,
      {
        id: Date.now().toString(),
        title: "",
        content: "",
      },
    ]);
  };

  const updateEssay = (index: number, field: keyof Resume["essays"][0], value: string) => {
    const newData = [...data];
    newData[index] = { ...newData[index], [field]: value };
    onChange(newData);
  };

  const removeEssay = (index: number) => {
    if (confirm("이 문항을 삭제하시겠습니까?")) {
      onChange(data.filter((_, i) => i !== index));
    }
  };

  // Mock AI Processing
  const handleAIAssist = (index: number, type: "spell" | "grammar" | "business") => {
    const essay = data[index];
    if (!essay.content.trim()) {
      toast.error("내용을 먼저 작성해주세요.");
      return;
    }

    setLoadingId(essay.id);
    
    // Simulate API delay
    setTimeout(() => {
      let newContent = essay.content;
      
      switch (type) {
        case "spell":
          // Mock spell check logic (just appending a note for demonstration)
          newContent = newContent.replace(/했읍니다/g, "했습니다").replace(/않이/g, "아니");
          toast.success("맞춤법 및 띄어쓰기 교정이 완료되었습니다.");
          break;
        case "grammar":
          // Mock grammar/flow logic
          newContent = `[AI 다듬기 완료]\n${newContent}\n(문맥이 더 자연스럽게 수정되었습니다.)`;
          toast.success("문맥이 자연스럽게 다듬어졌습니다.");
          break;
        case "business":
          // Mock business context logic
          newContent = `[직무 맞춤형 변환]\n기존 내용: ${newContent.substring(0, 50)}...\n\n성과 중심의 비즈니스 언어로 재구성되었습니다.`;
          toast.success("직무에 맞는 비즈니스 문맥으로 수정되었습니다.");
          break;
      }
      
      updateEssay(index, "content", newContent);
      setLoadingId(null);
    }, 1500);
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 mb-4">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">자기소개서</h2>
          <p className="text-xs text-slate-500 mt-1">AI 도움을 받아 완성도 높은 자소서를 작성하세요.</p>
        </div>
      </div>

      <div className="space-y-6">
        {data.map((essay, index) => (
          <div key={essay.id} className="relative p-5 border border-slate-200 rounded-2xl bg-white shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <input
                type="text"
                value={essay.title}
                onChange={(e) => updateEssay(index, "title", e.target.value)}
                placeholder="예: 지원동기 및 포부"
                className="flex-1 font-bold text-slate-900 bg-transparent border-none focus:ring-0 p-0 text-base"
              />
              <button
                onClick={() => removeEssay(index)}
                className="p-2 text-slate-300 hover:text-red-500 rounded-full bg-slate-50 active:bg-slate-100 ml-2"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            <div className="relative">
              <textarea
                value={essay.content}
                onChange={(e) => updateEssay(index, "content", e.target.value)}
                placeholder="해당 문항에 대한 답변을 작성해주세요."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 h-48 resize-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
              />
              
              {loadingId === essay.id && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center">
                  <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse mb-3" />
                  <p className="text-sm font-medium text-slate-700 animate-pulse">AI가 글을 다듬고 있습니다...</p>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mt-3">
              <span className="text-xs text-slate-400 font-mono">
                {essay.content.length}자
              </span>
              
              {/* AI Action Tools for Mobile */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleAIAssist(index, "spell")}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold active:bg-blue-100 transition-colors"
                >
                  <SpellCheck className="w-3.5 h-3.5" />
                  맞춤법
                </button>
                <button
                  onClick={() => handleAIAssist(index, "grammar")}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-semibold active:bg-green-100 transition-colors"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  다듬기
                </button>
                <button
                  onClick={() => handleAIAssist(index, "business")}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-semibold active:bg-indigo-100 transition-colors"
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  직무맞춤
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addEssay}
        className="mt-6 w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 font-medium flex items-center justify-center gap-2 active:bg-slate-50 transition-colors"
      >
        <Plus className="w-5 h-5" />
        문항 추가하기
      </button>
    </div>
  );
}
