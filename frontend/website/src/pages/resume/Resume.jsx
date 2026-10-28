import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Menu, Home, FileText, UserCheck, Sparkles, Plus, 
  Search, Trash2, Calendar, CheckCircle2, ArrowRight, RefreshCw, Settings, 
  AlertCircle, CheckCircle, AlertTriangle 
} from 'lucide-react';

export default function Resume() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('resume');
  const [searchQuery, setSearchQuery] = useState('');
  
  // 사이드바 접기/펼치기 상태
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const userid = localStorage.getItem('userId');

  // DB 연동 상태 관리
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);

  // 💡 웹사이트 전용 토스트 알림 상태
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showWebAlert = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3500);
  };

  // 💡 웹사이트 전용 커스텀 확인 모달 (window.confirm 대체) 상태
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // 사이드바 메뉴
  const sidebarItems = [
    { id: 'home', label: '홈', icon: Home, path: '/' },
    { id: 'resume', label: '이력서', icon: FileText, path: '/resume' },
    { id: 'coverletter', label: '자소서', icon: UserCheck, path: '/cover-letter' },
    { id: 'ai_cover', label: '채용', icon: Sparkles, path: '/jobBoard' },
  ];

  useEffect(() => {
    fetchResumes();
  }, []);

  const fetchResumes = async () => {
    try {
      setLoading(true);
      const memberId = userid;
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const response = await fetch(`${API_URL}/api/resumes?member_id=${memberId}`);
      if (!response.ok) throw new Error('목록을 불러오지 못했습니다.');
      
      const data = await response.json();
      setResumes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 💡 window.confirm 및 alert 대신 웹 커스텀 모달과 토스트 적용
  const handleDelete = (e, id) => {
    e.stopPropagation();
    setConfirmModal({
      show: true,
      title: '이력서 삭제',
      message: '이 이력서를 정말 삭제하시겠습니까?',
      onConfirm: async () => {
        try {
          const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
          const response = await fetch(`${API_URL}/api/resumes/${id}`, { method: 'DELETE' });
          if (response.ok) {
            setResumes(prev => prev.filter(item => item.id !== id));
            showWebAlert('이력서가 성공적으로 삭제되었습니다.');
          } else {
            showWebAlert('삭제에 실패했습니다.', 'error');
          }
        } catch (err) {
          console.error(err);
          showWebAlert('삭제 중 오류가 발생했습니다.', 'error');
        }
      }
    });
  };

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

  const filteredResumes = resumes.filter(item => 
    item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#070b19] text-slate-100 font-sans overflow-hidden relative">
      
      {/* 💡 웹사이트 전용 토스트 알림 */}
      {toast.show && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 bg-[#0f1423] border border-slate-700/80 rounded-2xl shadow-2xl animate-fade-in text-sm font-medium text-white">
          {toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 💡 웹사이트 전용 커스텀 확인 모달 (window.confirm 대체) */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-[#0f1423] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-100">{confirmModal.title}</h3>
            </div>
            <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold rounded-xl text-xs transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(prev => ({ ...prev, show: false }));
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-emerald-600/30 transition"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 사이드바 */}
      <aside 
        className={`${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        } bg-[#0a1024] border-r border-emerald-950/40 flex flex-col items-center py-6 shrink-0 h-screen z-25 transition-all duration-300 relative shadow-2xl`}
      >
        <div className="w-full px-4 mb-6 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2">
              <img 
            src="/icons.svg" 
            alt="CAREER IT Logo" 
            className="w-12 h-12 rounded-2xl shadow-lg shadow-cyan-900/40 ring-1 ring-white/10 object-cover" 
          />
              <span className="font-black text-base tracking-wider text-slate-100">
                CAREER <span className="text-emerald-400">IT</span>
              </span>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`p-2.5 text-slate-400 hover:text-emerald-300 rounded-xl bg-slate-900/80 hover:bg-emerald-950/40 border border-emerald-900/30 transition ${
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
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 font-semibold'
                    : 'text-slate-400 hover:text-emerald-100 hover:bg-emerald-950/30'
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-950/60 pb-6 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              이력서 관리 
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-medium">
                Resume Management
              </span>
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1.5">
              작성 중인 이력서 목록을 확인하고 완성도를 높여보세요.
            </p>
          </div>

          <button
            onClick={() => navigate('/resume/new')}
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition transform hover:-translate-y-0.5 text-xs md:text-sm shrink-0"
          >
            <Plus size={18} />
            <span>새 이력서 만들기</span>
          </button>
        </div>

        {/* 검색바 영역 */}
        <div className="relative mb-8 max-w-2xl">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="이력서 제목 또는 직무 카테고리로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 bg-[#0f152d] border border-emerald-950/60 rounded-2xl text-white text-sm focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-500 shadow-xl"
          />
        </div>

        {/* 로딩 / 목록 / 빈 상태 처리 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <RefreshCw className="animate-spin text-emerald-400" size={32} />
            <p className="text-sm">DB에서 이력서 목록을 불러오는 중...</p>
          </div>
        ) : filteredResumes.length === 0 ? (
          <div className="bg-[#0f152d] border border-emerald-950/60 rounded-3xl p-12 text-center space-y-4 shadow-xl max-w-xl mx-auto w-full mt-6">
            <div className="w-16 h-16 rounded-2xl bg-[#0a1024] border border-emerald-950/80 flex items-center justify-center mx-auto text-emerald-400">
              <FileText size={32} />
            </div>
            <h3 className="text-lg font-bold text-white">등록된 이력서가 없습니다</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              지금 바로 새 이력서를 만들어 AI 첨삭과 함께 완성도 높은 지원서를 작성해보세요.
            </p>
            <button
              onClick={() => navigate('/resume/new')}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl text-xs transition inline-flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
            >
              <Plus size={14} />
              <span>새 이력서 작성</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
            {filteredResumes.map((doc) => {
              const formattedDate = new Date(doc.updated_at || doc.created_at).toLocaleDateString();

              return (
                <div
                  key={doc.id}
                  onClick={() => navigate(`/resume/${doc.id}`)}
                  className="group bg-[#0f152d] border border-emerald-950/60 hover:border-emerald-500/60 rounded-2xl p-6 shadow-xl hover:shadow-emerald-950/30 transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-6 relative overflow-hidden"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 bg-[#0a1024] border border-emerald-950/80 rounded-md text-[11px] text-emerald-300 font-semibold">
                        {doc.category || '일반'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/resume/${doc.id}/edit`);
                          }}
                          className="p-2 text-slate-400 hover:text-emerald-300 rounded-xl hover:bg-emerald-950/40 transition"
                          title="수정하기"
                        >
                          <Settings size={16} />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, doc.id)}
                          className="p-2 text-slate-400 hover:text-rose-400 rounded-xl hover:bg-rose-950/40 transition"
                          title="이력서 삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base md:text-lg font-bold text-white group-hover:text-emerald-300 transition line-clamp-1">
                        {doc.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1.5">
                        <Calendar size={13} />
                        <span>{formattedDate} 수정</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-emerald-950/60 flex items-center justify-between">
                    <div className="flex items-center gap-2"></div>
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
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