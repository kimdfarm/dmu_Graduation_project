import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Search, Briefcase, ChevronLeft, ChevronRight, RefreshCw,
  Home, FileText, UserCheck, Sparkles, Menu 
} from 'lucide-react';
import JobCard from './JobCard';

const JobBoard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  // 사이드바 접기/펼치기 상태
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // 1. 사이드바 메뉴 정의 및 현재 경로 기반 activeNav 상태 초기화
  const sidebarItems = [
    { id: 'home', label: '홈', icon: Home, path: '/' },
    { id: 'resume', label: '이력서', icon: FileText, path: '/resume' },
    { id: 'coverletter', label: '자소서', icon: UserCheck, path: '/cover-letter' },
    { id: 'ai_cover', label: '채용', icon: Sparkles, path: '/jobBoard' },
  ];

  const currentItem = sidebarItems.find(item => item.path === location.pathname);
  const [activeNav, setActiveNav] = useState(currentItem ? currentItem.id : 'ai_cover');

  // 2. JobBoard 상태 관리
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // 3. API 데이터 페칭
  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '9',
        ...(search && { search }),
      });

      const res = await fetch(`${API_URL}/api/jobs?${params}`);
      const result = await res.json();

      setJobs(result.data || []);
      setTotalPages(result.total_pages || 1);
      setTotalCount(result.total || 0);
    } catch (err) {
      console.error('채용 데이터 로딩 중 에러:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [page, search]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="flex h-screen bg-[#07051a] text-slate-100 font-sans overflow-hidden">
      
      {/* ===== 왼쪽 사이드바 ===== */}
      <aside 
        className={`${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        } bg-[#090724] border-r border-amber-950/40 flex flex-col items-center py-6 shrink-0 h-screen z-25 transition-all duration-300 relative shadow-2xl`}
      >
        <div className="w-full px-4 mb-6 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2">
              <span className="font-black text-base tracking-wider text-slate-100">
                CAREER <span className="text-amber-400">IT</span>
              </span>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`p-2.5 text-slate-400 hover:text-amber-300 rounded-xl bg-slate-900/80 hover:bg-amber-950/40 border border-amber-900/30 transition ${
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
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25 font-semibold'
                    : 'text-slate-400 hover:text-amber-100 hover:bg-amber-950/30'
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

      {/* ===== 메인 컨텐츠 영역 ===== */}
      <main className="flex-1 flex flex-col p-6 md:p-10 overflow-y-auto max-w-7xl mx-auto w-full h-screen">
        <div className="space-y-6">
          
          {/* 💡 상단 컨트롤러 헤더 (whitespace-nowrap 및 유연한 플렉스 레이아웃 적용으로 가로 축소 시 줄바꿈/글자 깨짐 방지) */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-amber-950/60 pb-6 bg-[#0e0b2d] px-6 md:px-8 py-6 rounded-3xl shadow-xl border">
            
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2 tracking-tight whitespace-nowrap">
                <Briefcase className="text-amber-400 shrink-0" /> 채용 공고 대시보드
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-medium">
                  Job Explorer
                </span>
              </h1>
              <p className="text-xs text-slate-400 whitespace-nowrap">
                전체 수집: <strong className="text-amber-400">{totalCount}</strong>개
              </p>
            </div>

            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="회사명, 직무 검색..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full bg-[#07051a] border border-amber-950/80 rounded-2xl pl-11 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors shadow-inner"
                />
              </div>
              <button 
                type="submit" 
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-2xl text-xs font-bold transition-all shadow-md shrink-0"
              >
                검색
              </button>
            </form>
          </div>

          {/* 카드 그리드 영역 */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 bg-[#0e0b2d]/50 animate-pulse rounded-3xl border border-amber-950/40"></div>
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-20 bg-[#0e0b2d] rounded-3xl border border-amber-950/60 shadow-xl">
              <p className="text-slate-400 text-sm">조회된 채용 공고가 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}

          {/* 페이지네이션 */}
          <div className="flex items-center justify-center gap-2 pt-2 pb-12">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2.5 bg-[#0e0b2d] border border-amber-950/80 rounded-xl disabled:opacity-30 hover:bg-amber-950/40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-slate-300" />
            </button>
            <span className="text-xs text-slate-300 font-semibold px-4">
              {page} / {totalPages} 페이지
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2.5 bg-[#0e0b2d] border border-amber-950/80 rounded-xl disabled:opacity-30 hover:bg-amber-950/40 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </button>
          </div>

        </div>
      </main>

    </div>
  );
};

export default JobBoard;