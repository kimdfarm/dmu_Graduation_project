import { Resume } from "../../mockData";

interface Props {
  data: Resume["basicInfo"];
  onChange: (data: Resume["basicInfo"]) => void;
}

export function BasicInfoForm({ data, onChange }: Props) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onChange({ ...data, [name]: value });
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 mb-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">기본 정보</h2>
        <p className="text-xs text-slate-500 mt-1">이력서 상단에 표시될 연락처와 기본 프로필</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 ml-1">이름</label>
          <input
            type="text"
            name="name"
            value={data.name}
            onChange={handleChange}
            placeholder="홍길동"
            className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm font-medium"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 ml-1">희망 직무</label>
          <input
            type="text"
            name="position"
            value={data.position}
            onChange={handleChange}
            placeholder="Frontend Developer"
            className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm font-medium"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 ml-1">이메일</label>
          <input
            type="email"
            name="email"
            value={data.email}
            onChange={handleChange}
            placeholder="dev@example.com"
            className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm font-medium"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 ml-1">연락처</label>
          <input
            type="tel"
            name="phone"
            value={data.phone}
            onChange={handleChange}
            placeholder="010-1234-5678"
            className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm font-medium"
          />
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-bold text-slate-900 mb-3 ml-1">링크</h3>
        <div className="space-y-3">
          <input
            type="url"
            name="github"
            value={data.github}
            onChange={handleChange}
            placeholder="GitHub URL"
            className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm font-medium"
          />
          <input
            type="url"
            name="blog"
            value={data.blog}
            onChange={handleChange}
            placeholder="Blog URL"
            className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm font-medium"
          />
          <input
            type="url"
            name="portfolio"
            value={data.portfolio}
            onChange={handleChange}
            placeholder="Portfolio URL"
            className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm font-medium"
          />
        </div>
      </div>
    </div>
  );
}
