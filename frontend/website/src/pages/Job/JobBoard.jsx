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

      const res = await fetch(`http://localhost:8000/api/jobs?${params}`);
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
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      
      {/* ===== 왼쪽 사이드바 ===== */}
      <aside className="w-20 bg-[#090724] border-r border-indigo-950/60 flex flex-col items-center py-6 shrink-0 min-h-screen sticky top-0 h-screen z-20">
        <button className="p-3 text-slate-400 hover:text-white rounded-xl hover:bg-indigo-950/50 transition mb-6">
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
                  navigate(item.path);
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

      {/* ===== 메인 컨텐츠 영역 ===== */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* 상단 컨트롤러 헤더 */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
                <Briefcase className="text-indigo-500" /> 채용 공고 대시보드
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                전체 수집 데이터 수: <strong className="text-indigo-400">{totalCount}</strong>개
              </p>
            </div>

            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="회사명, 직무 검색..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <button 
                type="submit" 
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
              >
                검색
              </button>
            </form>
          </div>

          {/* 카드 그리드 영역 */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 bg-slate-900/50 animate-pulse rounded-xl border border-slate-800"></div>
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800/50">
              <p className="text-slate-400 text-sm">조회된 채용 공고가 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}

          {/* 페이지네이션 */}
          <div className="flex items-center justify-center gap-2 pt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-30 hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-slate-300" />
            </button>
            <span className="text-xs text-slate-400 px-3">
              {page} / {totalPages} 페이지
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-30 hover:bg-slate-800 transition-colors"
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