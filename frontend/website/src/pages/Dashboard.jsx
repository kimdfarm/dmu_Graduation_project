import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home, FileText, UserCheck, Sparkles, Settings, 
  Trash2, Plus, Menu, File, ExternalLink 
} from 'lucide-react'; // <-- Github import 완전히 제거

export default function Dashboard() {
  const navigate = useNavigate();
  // 사이드바 선택 상태
  const [activeNav, setActiveNav] = useState('home');
  // 문서 필터 탭 (전체 / 이력서 / 자소서)
  const [filter, setFilter] = useState('all');

  const sidebarItems = [
    { id: 'home', label: '홈', icon: Home, path: '/' },
    { id: 'resume', label: '이력서', icon: FileText, path: '/resume' },
    { id: 'coverletter', label: '자소서', icon: UserCheck, path: '/cover-letter' },
    { id: 'ai_cover', label: 'AI 자소서', icon: Sparkles, path: '/cover-letter' },
  ];

  const docList = [
    { id: 1, type: 'resume', title: '이력서 1', category: '개발자 직군', desc: '최종 수정일: 2026.07.25 · 백엔드/프론트엔드 역량 강조', path: '/resume' },
    { id: 2, type: 'coverletter', title: '자소서 1', category: '지원동기', desc: '최종 수정일: 2026.07.20 · AI 생성 지원동기 및 프로젝트 경험', path: '/cover-letter' },
    { id: 3, type: 'resume', title: '이력서 2', category: '인턴십용', desc: '최종 수정일: 2026.07.18 · 학부 졸업작품 프로젝트 위주', path: '/resume' },
  ];

  // 필터링 로직
  const filteredDocs = docList.filter(doc => {
    if (filter === 'resume') return doc.type === 'resume';
    if (filter === 'coverletter') return doc.type === 'coverletter';
    return true;
  });

  return (
    <div className="flex h-screen bg-[#09081e] text-slate-100 font-sans overflow-hidden">
      
      {/* 1. 좌측 사이드바 */}
      <aside className="w-20 bg-[#121033] border-r border-indigo-900/30 flex flex-col items-center py-6 gap-6 z-10">
        <button className="p-3 text-indigo-300 hover:text-white hover:bg-indigo-900/40 rounded-2xl transition">
          <Menu size={22} />
        </button>

        <nav className="flex flex-col gap-3 mt-4 w-full px-2">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isSelected = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveNav(item.id);
                  if(item.path !== '/') navigate(item.path);
                }}
                className={`flex flex-col items-center justify-center py-3.5 rounded-2xl transition-all duration-200 ${
                  isSelected
                    ? 'bg-gradient-to-b from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-indigo-950/50'
                }`}
              >
                <Icon size={20} />
                <span className="text-[11px] mt-1.5 font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 2. 메인 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col p-8 overflow-y-auto max-w-6xl mx-auto w-full">
        
        {/* 상단 프로필 헤더 */}
        <div className="flex items-center justify-between bg-gradient-to-r from-[#171544] to-[#1e1b5e] rounded-3xl p-6 mb-8 border border-indigo-800/40 shadow-xl">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-amber-300 rounded-2xl flex items-center justify-center text-xl font-bold text-slate-900 shadow-md">
              홍
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white">홍길동 님</h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">PRO</span>
              </div>
              <p className="text-slate-400 text-sm mt-0.5">AI 기반 이력서 및 자소서 통합 관리 대시보드</p>
            </div>
          </div>

          {/* 우측 액션 버튼들 */}

          <div className="flex items-center gap-3">
            {/* 로그인 페이지로 가는 버튼 */}
            <button 
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0f0d2d] hover:bg-[#1a174a] text-slate-300 text-sm font-medium rounded-xl border border-indigo-800/40 transition"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>로그인하러 가기</span>
            </button>

            <button 
              onClick={() => navigate('/resume')}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition transform hover:-translate-y-0.5"
            >
              <Plus size={18} />
              <span>새 문서 작성</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            




            
            <button 
              onClick={() => window.open('https://github.com', '_blank')}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0f0d2d] hover:bg-[#1a174a] text-slate-300 text-sm font-medium rounded-xl border border-indigo-800/40 transition"
            >
              {/* GitHub SVG 아이콘으로 구현 */}
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>GitHub 연동</span>
              <ExternalLink size={12} className="text-slate-500" />
            </button>
            <button 
              onClick={() => navigate('/resume')}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition transform hover:-translate-y-0.5"
            >
              <Plus size={18} />
              <span>새 문서 작성</span>
            </button>
          </div>
        </div>

        {/* 3. 문서 리스트 헤더 & 필터 탭 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">내 문서 목록</h2>
          
          <div className="flex bg-[#121033] p-1 rounded-xl border border-indigo-900/40">
            {[
              { id: 'all', label: '전체' },
              { id: 'resume', label: '이력서' },
              { id: 'coverletter', label: '자기소개서' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${
                  filter === tab.id
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. 문서 카드 리스트 */}
        <div className="flex flex-col gap-3">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              onClick={() => navigate(doc.path)}
              className="group bg-[#121033]/60 hover:bg-[#171442] border border-indigo-900/30 hover:border-indigo-600/50 rounded-2xl p-5 flex items-center justify-between cursor-pointer transition-all duration-200 shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${
                  doc.type === 'resume' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-purple-500/10 text-purple-400'
                }`}>
                  <File size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition">{doc.title}</h3>
                    <span className={`px-2 py-0.5 text-[11px] font-medium rounded ${
                      doc.type === 'resume' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' : 'bg-purple-950 text-purple-300 border border-purple-800'
                    }`}>
                      {doc.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{doc.desc}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition">
                <button 
                  onClick={(e) => { e.stopPropagation(); }}
                  className="p-2 text-slate-400 hover:text-white hover:bg-indigo-900/50 rounded-lg transition"
                >
                  <Settings size={16} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); }}
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}