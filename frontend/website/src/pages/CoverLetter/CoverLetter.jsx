import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Menu, Home, FileText, UserCheck, Sparkles, Plus, 
  Search, Trash2, Calendar, CheckCircle2, ArrowRight, RefreshCw, Settings 
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function CoverLetter() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('coverletter');
  const [searchQuery, setSearchQuery] = useState('');
  
  // 사이드바 접기/펼치기 상태
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const userid = localStorage.getItem('userId'); // 로그인된 사용자 ID

  // 💡 DB 연동 상태 관리
  const [coverLetters, setCoverLetters] = useState([]);
  const [loading, setLoading] = useState(true);

  // 사이드바 메뉴
  const sidebarItems = [
    { id: 'home', label: '홈', icon: Home, path: '/' },
    { id: 'resume', label: '이력서', icon: FileText, path: '/resume' },
    { id: 'coverletter', label: '자소서', icon: UserCheck, path: '/cover-letter' },
    { id: 'ai_cover', label: '채용', icon: Sparkles, path: '/jobBoard' },
  ];

  // 1. DB에서 자기소개서 목록 조회
  useEffect(() => {
    fetchCoverLetters();
  }, []);

  const fetchCoverLetters = async () => {
    try {
      setLoading(true);
      const memberId = userid;
      const response = await fetch(`${API_URL}/api/cover-letters?member_id=${memberId}`);
      if (!response.ok) throw new Error('목록을 불러오지 못했습니다.');
      
      const data = await response.json();
      setCoverLetters(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 2. 자기소개서 삭제
  const handleDelete = async (e, id) => {
    e.stopPropagation(); // 카드 클릭 이동 방지
    if (!window.confirm('이 자기소개서를 정말 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`${API_URL}/api/cover-letters/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setCoverLetters(prev => prev.filter(item => item.id !== id));
      } else {
        alert('삭제 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 3. completeness(완성도) 동적 계산 함수
  const calculateCompleteness = (sections = []) => {
    if (!sections || sections.length === 0) return 0;

    let totalDetailsCount = 0;
    let filledDetailsCount = 0;

    sections.forEach(sec => {
      const details = Array.isArray(sec.details) ? sec.details : [];
      totalDetailsCount += details.length;

      details.forEach(item => {
        const selectedVer = item.selected_version || 'ORIGINAL';
        let text = '';

        if (selectedVer === 'ORIGINAL') text = item.original_text;
        else if (selectedVer === 'SPELL') text = item.spell_checked_text;
        else if (selectedVer === 'AI') text = item.ai_proofread_text;

        if (text && text.trim().length > 0) {
          filledDetailsCount++;
        }
      });
    });

    if (totalDetailsCount === 0) return 0;
    return Math.round((filledDetailsCount / totalDetailsCount) * 100);
  };

  // 검색 필터링
  const filteredCoverLetters = coverLetters.filter(item => 
    item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#07051a] text-slate-100 font-sans overflow-hidden">
      
      {/* 사이드바 */}
      <aside 
        className={`${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        } bg-[#0a0724] border-r border-indigo-950/60 flex flex-col items-center py-6 shrink-0 h-screen z-25 transition-all duration-300 relative shadow-2xl`}
      >
        <div className="w-full px-4 mb-6 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2">
              <span className="font-black text-base tracking-wider text-slate-100">
                CAREER <span className="text-indigo-400">IT</span>
              </span>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`p-2.5 text-slate-400 hover:text-indigo-300 rounded-xl bg-slate-900/80 hover:bg-indigo-950/40 border border-indigo-900/30 transition ${
              isSidebarCollapsed ? 'mx-auto' : ''
            }`}
            title={isSidebarCollapsed ? "메뉴 펼치기" : "메뉴 접기"}
          >
            <Menu size={20} />
          </button>
        </div>

        <nav className="flex flex-col gap-2 mt-2 w-full px-3">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isSelected = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveNav(item.id);
                  navigate(item.path);
                }}
                className={`flex items-center gap-3.5 px-3.5 py-3.5 rounded-xl transition-all duration-200 w-full ${
                  isSelected
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 font-semibold'
                    : 'text-slate-400 hover:text-indigo-100 hover:bg-indigo-950/40'
                } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <Icon size={20} className="shrink-0" />
                {!isSidebarCollapsed && (
                  <span className="text-xs font-medium">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 메인 콘텐츠 영역 */}
      <main className="flex-1 flex flex-col p-6 md:p-10 overflow-y-auto max-w-7xl mx-auto w-full h-screen">
        
        {/* 상단 타이틀 섹션 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-950/80 pb-6 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              자기소개서 관리 
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-medium">
                Cover Letter
              </span>
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1.5">
              작성 중인 자기소개서 목록을 확인하고 AI 첨삭을 받아보세요.
            </p>
          </div>

          <button
            onClick={() => navigate('/cover-letter/new')}
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition transform hover:-translate-y-0.5 text-xs md:text-sm shrink-0"
          >
            <Plus size={18} />
            <span>새 자소서 만들기</span>
          </button>
        </div>

        {/* 검색바 영역 */}
        <div className="relative mb-8 max-w-2xl">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="자소서 제목 또는 지원 직무로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 bg-[#100c36] border border-indigo-950/80 rounded-2xl text-white text-sm focus:outline-none focus:border-indigo-500 transition placeholder:text-slate-500 shadow-xl"
          />
        </div>

        {/* 로딩 / 목록 / 빈 상태 처리 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <RefreshCw className="animate-spin text-indigo-500" size={32} />
            <p className="text-sm">DB에서 자기소개서 목록을 불러오는 중...</p>
          </div>
        ) : filteredCoverLetters.length === 0 ? (
          <div className="bg-[#100c36] border border-indigo-950/80 rounded-3xl p-12 text-center space-y-4 shadow-xl max-w-xl mx-auto w-full mt-6">
            <div className="w-16 h-16 rounded-2xl bg-[#0a0724] border border-indigo-950 flex items-center justify-center mx-auto text-indigo-400">
              <UserCheck size={32} />
            </div>
            <h3 className="text-lg font-bold text-white">등록된 자기소개서가 없습니다</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              새 자기소개서를 작성하고 AI 첨삭 기능을 통해 합격률을 한층 더 높여보세요.
            </p>
            <button
              onClick={() => navigate('/cover-letter/new')}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-xs transition inline-flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
            >
              <Plus size={14} />
              <span>새 자소서 작성</span>
            </button>
          </div>
        ) : (
          /* 자기소개서 카드 그리드 */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
            {filteredCoverLetters.map((doc) => {
              const completeness = calculateCompleteness(doc.document_sections);
              const formattedDate = new Date(doc.updated_at || doc.created_at).toLocaleDateString();

              return (
                <div
                  key={doc.id}
                  onClick={() => navigate(`/cover-letter/${doc.id}`)}
                  className="group bg-[#100c36] border border-indigo-950/80 hover:border-indigo-500/80 rounded-2xl p-6 shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-6 relative overflow-hidden"
                >
                  <div className="space-y-4">
                    {/* 상단 뱃지 및 설정/삭제 버튼 */}
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 bg-[#0a0724] border border-indigo-950 rounded-md text-[11px] text-indigo-300 font-semibold">
                        {doc.category || '일반'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/cover-letter/${doc.id}/edit`);
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-300 rounded-xl hover:bg-indigo-950/40 transition"
                          title="수정하기"
                        >
                          <Settings size={16} />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, doc.id)}
                          className="p-2 text-slate-400 hover:text-rose-400 rounded-xl hover:bg-rose-950/40 transition"
                          title="자기소개서 삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* 제목 및 수정일 */}
                    <div>
                      <h3 className="text-base md:text-lg font-bold text-white group-hover:text-indigo-300 transition line-clamp-1">
                        {doc.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1.5">
                        <Calendar size={13} />
                        <span>{formattedDate} 수정</span>
                      </div>
                    </div>
                  </div>

                  {/* 하단 완성도 및 상세보기 안내 */}
                  <div className="pt-4 border-t border-indigo-950/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400">작성 완성도: <strong className="text-indigo-400">{completeness}%</strong></span>
                    <span className="font-semibold text-indigo-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      상세보기 <ArrowRight size={13} />
                    </span>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}