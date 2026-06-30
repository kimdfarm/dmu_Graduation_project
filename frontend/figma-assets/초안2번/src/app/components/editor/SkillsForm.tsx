import { useState } from "react";
import { Resume } from "../../mockData";
import { Plus, X } from "lucide-react";

interface Props {
  data: Resume["skills"];
  onChange: (data: Resume["skills"]) => void;
}

export function SkillsForm({ data, onChange }: Props) {
  const [newItem, setNewItem] = useState<{ [key: number]: string }>({});

  const addCategory = () => {
    onChange([...data, { category: "새 카테고리", items: [] }]);
  };

  const updateCategory = (index: number, value: string) => {
    const newData = [...data];
    newData[index].category = value;
    onChange(newData);
  };

  const removeCategory = (index: number) => {
    onChange(data.filter((_, i) => i !== index));
  };

  const addItem = (index: number) => {
    if (!newItem[index]?.trim()) return;
    const newData = [...data];
    newData[index].items.push(newItem[index].trim());
    onChange(newData);
    setNewItem({ ...newItem, [index]: "" });
  };

  const removeItem = (catIndex: number, itemIndex: number) => {
    const newData = [...data];
    newData[catIndex].items = newData[catIndex].items.filter((_, i) => i !== itemIndex);
    onChange(newData);
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 mb-4">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">기술 스택</h2>
        </div>
      </div>

      <div className="space-y-4">
        {data.map((category, catIndex) => (
          <div key={catIndex} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 relative group">
            <button
              onClick={() => removeCategory(catIndex)}
              className="absolute top-4 right-4 text-slate-300 hover:text-red-500"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="mb-3 pr-8">
              <input
                type="text"
                value={category.category}
                onChange={(e) => updateCategory(catIndex, e.target.value)}
                className="text-sm font-bold text-slate-800 bg-transparent border-b border-slate-300 focus:border-indigo-500 outline-none w-2/3"
                placeholder="카테고리명"
              />
            </div>
            
            <div className="flex flex-wrap gap-1.5 mb-3">
              {category.items.map((item, itemIndex) => (
                <span
                  key={itemIndex}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-white border border-slate-200 text-slate-700 shadow-sm"
                >
                  {item}
                  <button
                    onClick={() => removeItem(catIndex, itemIndex)}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={newItem[catIndex] || ""}
                onChange={(e) => setNewItem({ ...newItem, [catIndex]: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem(catIndex);
                  }
                }}
                placeholder="기술 추가"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-400 outline-none text-sm bg-white"
              />
              <button
                onClick={() => addItem(catIndex)}
                className="px-3 py-2 bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-sm font-bold"
              >
                추가
              </button>
            </div>
          </div>
        ))}
        
        <button
          onClick={addCategory}
          className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 font-medium flex items-center justify-center gap-2 active:bg-slate-50"
        >
          <Plus className="w-5 h-5" />
          카테고리 추가
        </button>
      </div>
    </div>
  );
}
