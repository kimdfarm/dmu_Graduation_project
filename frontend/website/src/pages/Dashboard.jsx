import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home, FileText, UserCheck, Sparkles, Settings, 
  Trash2, Plus, Menu, LogIn, LogOut, X, RefreshCw, Edit3, AlertCircle 
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('home');
  const [filter, setFilter] = useState('all'); // 문서 필터 (all / resume / coverletter)
  
  // 사이드바 토글 상태 (햄버거 버튼)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // 유저 정보 상태
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userAvatar, setUserAvatar] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // 실제 문서 목록 및 로딩 상태
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const sidebarItems = [
    { id: 'home', label: '홈', icon: Home, path: '/' },
    { id: 'resume', label: '이력서', icon: FileText, path: '/resume' },
    { id: 'coverletter', label: '자소서', icon: UserCheck, path: '/cover-letter' },
    { id: 'ai_cover', label: '채용', icon: Sparkles, path: '/jobBoard' },
  ];

  // 1. 유저 정보 및 이력서/자소서 실제 DB 데이터 로드
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
          
        // (1) 프로필 로드
        const userRes = await fetch(`${API_URL}/login/me?user_id=${userId}`);
        if (userRes.ok) {
          const userData = await userRes.json();
          setUserName(userData.name);
          setUserEmail(userData.email);
          setUserAvatar(userData.avatar_url);
          setIsLoggedIn(true);
        }

        // (2) 실제 이력서 & 자소서 병렬 로드
        const [resumeRes, coverLetterRes] = await Promise.all([
          fetch(`${API_URL}/api/resumes?member_id=${userId}`).catch(() => null),
          fetch(`${API_URL}/api/cover-letters?member_id=${userId}`).catch(() => null)
        ]);

        let resumesData = [];
        let coverLettersData = [];

        if (resumeRes && resumeRes.ok) {
          resumesData = await resumeRes.json();
        }
        if (coverLetterRes && coverLetterRes.ok) {
          coverLettersData = await coverLetterRes.json();
        }

        // (3) 이력서 데이터 포맷팅
        const formattedResumes = resumesData.map((item) => ({
          id: item.id,
          type: 'resume',
          title: item.title || '제목 없음',
          category: item.category || '일반',
          date: new Date(item.updated_at || item.created_at),
          path: `/resume/${item.id}`,
          editPath: `/resume/${item.id}/edit`
        }));

        // (4) 자소서 데이터 포맷팅
        const formattedCoverLetters = coverLettersData.map((item) => ({
          id: item.id,
          type: 'coverletter',
          title: item.title || '제목 없음',
          category: item.category || '일반',
          date: new Date(item.updated_at || item.created_at),
          path: `/cover-letter/${item.id}`,
          editPath: `/cover-letter/${item.id}/edit`
        }));

        // (5) 전체 목록 병합 및 최신순 정렬
        const combined = [...formattedResumes, ...formattedCoverLetters].sort(
          (a, b) => b.date - a.date
        );

        setDocuments(combined);
      } catch (err) {
        console.error("대시보드 데이터 로드 오류:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // 게스트 확인 및 작성 제한 안내
  const handleCreateNewDocument = (type = 'resume') => {
    if (!isLoggedIn) {
      if (window.confirm('게스트 상태에서는 새 문서를 생성하거나 저장할 수 없습니다.\n로그인 페이지로 이동하시겠습니까?')) {
        navigate('/login');
      }
      return;
    }
    navigate(type === 'resume' ? '/resume/new' : '/cover-letter/new');
  };

  // 2. 문서 실제 삭제 함수
  const handleDeleteDoc = async (e, doc) => {
    e.stopPropagation(); // 카드 이동 클릭 방지
    if (!window.confirm(`'${doc.title}' 문서를 삭제하시겠습니까?`)) return;

    try {
      const endpoint = doc.type === 'resume' 
        ? `${API_URL}/api/resumes/${doc.id}` 
        : `${API_URL}/api/cover-letters/${doc.id}`;

      const res = await fetch(endpoint, { method: 'DELETE' });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => !(d.id === doc.id && d.type === doc.type)));
      } else {
        alert('삭제 요청을 처리하지 못했습니다.');
      }
    } catch (err) {
      console.error('문서 삭제 오류:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 로그아웃 핸들러
  const handleLogout = () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      localStorage.removeItem('userId');
      localStorage.removeItem('user');
      setIsLoggedIn(false);
      setUserName('게스트');
      setUserEmail('');
      navigate('/login');
    }
  };

  // 필터링 로직
  const filteredDocs = documents.filter((doc) => {
    if (filter === 'resume') return doc.type === 'resume';
    if (filter === 'coverletter') return doc.type === 'coverletter';
    return true;
  });

  return (
    <div className="flex h-screen bg-[#070b19] text-slate-100 font-sans overflow-hidden">
      
      {/* 1. 사이드바 (차콜 딥 네이비 톤) */}
      <aside 
        className={`${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        } bg-[#0a1024] border-r border-indigo-950/60 flex flex-col items-center py-6 shrink-0 h-screen z-20 transition-all duration-300 relative shadow-2xl`}
      >
        <div className="w-full px-4 mb-6 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2">
              <span className="font-black text-base tracking-wider text-slate-100">
                CAREER <span className="text-purple-400">IT</span>
              </span>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`p-2.5 text-slate-400 hover:text-cyan-300 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-indigo-900/40 transition ${
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
                  if (item.path !== '/') navigate(item.path);
                }}
                className={`flex items-center gap-3.5 px-3.5 py-3.5 rounded-xl transition-all duration-200 w-full ${
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
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

      {/* 2. 메인 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col p-6 md:p-8 overflow-y-auto max-w-6xl mx-auto w-full">
        
        {/* 상단 로고 (보라/인디고 시그니처 톤) */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-700 via-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-purple-900/40 ring-1 ring-white/10">
            <Edit3 className="w-5 h-5 text-white" />
          </div>

          <div className="flex flex-col">
            <h1 className="text-xl md:text-2xl font-black tracking-wider text-slate-100">
              CAREER <span className="text-purple-400">IT</span>
            </h1>
            <span className="text-[10px] font-semibold tracking-widest text-purple-300/80 uppercase -mt-0.5">
              Resume & Portfolio Service
            </span>
          </div>
        </div>
        
        {/* 상단 프로필 헤더 (보라 & 딥 네이비 배경) */}
        <div className="bg-[#0f152d] border border-indigo-900/40 rounded-2xl p-5 md:p-6 shadow-lg mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              {isLoggedIn && userAvatar ? (
                <img
                  src={userAvatar}
                  alt="프로필 이미지"
                  onClick={() => setIsImageModalOpen(true)}
                  className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover shadow-md ring-2 ring-purple-500/40 cursor-pointer hover:scale-105 transition-transform duration-200"
                />
              ) : (
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-md ring-2 ring-purple-500/30">
                  {isLoggedIn ? (userName ? userName.charAt(0) : 'D') : 'G'}
                </div>
              )}
              <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#0f152d] ${isLoggedIn ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                  isLoggedIn 
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-300' 
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  {isLoggedIn ? 'Welcome Back' : 'Guest Mode'}
                </span>
              </div>

              <h2 className="text-lg md:text-xl font-bold text-slate-100 tracking-tight flex items-center gap-1.5">
                안녕하세요, <span className={isLoggedIn ? "text-purple-300 font-extrabold" : "text-rose-300 font-extrabold"}>
                  {isLoggedIn ? `${userName} 님` : '게스트 님'}
                </span>! 👋
              </h2>

              <p className="text-xs md:text-sm font-medium text-slate-400">
                {isLoggedIn 
                  ? '오늘 작성할 이력서와 자소서를 확인하고 관리해 보세요.' 
                  : '게스트 모드입니다. 기능을 온전히 이용하시려면 로그인이 필요합니다.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center">
            {isLoggedIn ? (
              <>
                <button
                  onClick={() => navigate('/ProfileSettings')}
                  title="프로필 설정"
                  className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-sm"
                >
                  <Settings className="w-5 h-5" />
                </button>
                <button
                  onClick={handleLogout}
                  title="로그아웃"
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-950/30 border border-rose-900/40 text-rose-300 hover:text-white hover:bg-rose-900/50 transition-all text-xs font-semibold shadow-sm"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">로그아웃</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white transition-all text-xs font-semibold shadow-md shadow-purple-600/20"
              >
                <LogIn className="w-4 h-4" />
                <span>로그인 하기</span>
              </button>
            )}
          </div>
        </div>

        {/* 탭 필터 및 생성 버튼 (시안 파랑 포인트) */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-[#0a1024] border border-indigo-950/80 rounded-xl w-fit">
            {[
              { label: '전체', value: 'all' },
              { label: '이력서', value: 'resume' },
              { label: '자소서', value: 'coverletter' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                  filter === tab.value
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 로그인 회원에게만 새 문서 생성 버튼 허용 */}
          {isLoggedIn && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCreateNewDocument('resume')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition shadow-md shadow-cyan-600/20"
              >
                <Plus size={16} />
                <span>새 이력서 작성</span>
              </button>
              <button
                onClick={() => handleCreateNewDocument('coverletter')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                <Plus size={16} />
                <span>새 자소서 작성</span>
              </button>
            </div>
          )}
        </div>

        {!isLoggedIn && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
            <span>게스트 모드에서는 새 문서 생성 및 저장이 제한됩니다. 모든 기능을 쓰시려면 로그인해 주세요.</span>
          </div>
        )}

        {/* 문서 목록 영역 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <RefreshCw className="animate-spin text-cyan-400" size={32} />
            <p className="text-sm">데이터베이스에서 문서를 불러오는 중...</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredDocs.length > 0 ? (
              filteredDocs.map((doc) => (
                <div
                  key={`${doc.type}-${doc.id}`}
                  onClick={() => navigate(doc.path)} // 카드 클릭 시 상세(detail) 페이지 이동
                  className="group bg-[#0f152d]/80 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 transition-all duration-200 hover:shadow-xl hover:shadow-slate-950/60 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center group-hover:bg-cyan-600 group-hover:border-cyan-400 transition-colors">
                      {doc.type === 'resume' ? (
                        <FileText className="w-6 h-6 text-slate-300 group-hover:text-white" />
                      ) : (
                        <UserCheck className="w-6 h-6 text-slate-300 group-hover:text-white" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base md:text-lg font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                          {doc.title}
                        </h3>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
                          {doc.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-medium">
                        최종 수정일: {doc.date.toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* 설정 아이콘 클릭 시 /edit 페이지로 직접 이동 */}
                  <div className="flex items-center gap-2 text-slate-400">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation(); // 카드 전체 클릭 이벤트 전파 방지
                        navigate(doc.editPath); // /edit 경로로 이동
                      }}
                      className="p-2.5 hover:bg-slate-800 hover:text-cyan-300 rounded-xl transition"
                      title="수정 화면으로 이동 (Edit)"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => handleDeleteDoc(e, doc)}
                      className="p-2.5 hover:bg-rose-950/40 hover:text-rose-400 rounded-xl transition"
                      title="삭제하기"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl bg-[#0a1024]/40 space-y-3">
                <p className="text-slate-400 text-sm">등록된 문서가 없습니다.</p>
                {isLoggedIn ? (
                  <button
                    onClick={() => handleCreateNewDocument('resume')}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold transition"
                  >
                    새 문서 작성하기
                  </button>
                ) : (
                  <p className="text-xs text-slate-500">문서를 작성하려면 로그인이 필요합니다.</p>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* 프로필 이미지 확대 모달 */}
      {isImageModalOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div 
            className="relative max-w-sm md:max-w-xl w-full p-6 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsImageModalOpen(false)}
              className="absolute top-0 right-0 p-2 text-white/70 hover:text-white transition"
            >
              <X className="w-7 h-7" />
            </button>
            <img
              src={userAvatar}
              alt="프로필 원본 이미지"
              className="max-w-[80vw] max-h-[80vh] w-auto h-auto rounded-3xl object-contain border-4 border-white/10 shadow-2xl shadow-black/50"
            />
            {userName && (
              <p className="mt-5 text-slate-100 text-xl font-bold tracking-tight bg-slate-900 px-4 py-1.5 rounded-xl border border-slate-800">
                {userName} 프로필 원본
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}