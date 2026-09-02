import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home, FileText, UserCheck, Sparkles, Settings, 
  Trash2, Plus, Menu, LogIn, LogOut, X, RefreshCw
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('home');
  const [filter, setFilter] = useState('all'); // 문서 필터 (all / resume / coverletter)
  
  // 유저 정보 상태
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userAvatar, setUserAvatar] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // 💡 실제 문서 목록 및 로딩 상태
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
        const userRes = await fetch(`http://127.0.0.1:8000/login/me?user_id=${userId}`);
        if (userRes.ok) {
          const userData = await userRes.json();
          setUserName(userData.name);
          setUserEmail(userData.email);
          setUserAvatar(userData.avatar_url);
          setIsLoggedIn(true);
        }

        // (2) 실제 이력서 & 자소서 병렬 로드
        const [resumeRes, coverLetterRes] = await Promise.all([
          fetch(`/api/resumes?member_id=${userId}`).catch(() => null),
          fetch(`/api/cover-letters?member_id=${userId}`).catch(() => null)
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
          path: `/resume/${item.id}`
        }));

        // (4) 자소서 데이터 포맷팅
        const formattedCoverLetters = coverLettersData.map((item) => ({
          id: item.id,
          type: 'coverletter',
          title: item.title || '제목 없음',
          category: item.category || '일반',
          date: new Date(item.updated_at || item.created_at),
          path: `/cover-letter/${item.id}`
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

  // 2. 문서 실제 삭제 함수
  const handleDeleteDoc = async (e, doc) => {
    e.stopPropagation(); // 카드 이동 클릭 방지
    if (!window.confirm(`'${doc.title}' 문서를 삭제하시겠습니까?`)) return;

    try {
      const endpoint = doc.type === 'resume' 
        ? `/api/resumes/${doc.id}` 
        : `/api/cover-letters/${doc.id}`;

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
    <div className="flex h-screen bg-[#09081e] text-slate-100 font-sans overflow-hidden">
      
      {/* 1. 사이드바 */}
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
                  if (item.path !== '/') navigate(item.path);
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
        <div className="bg-[#0f0c2e]/80 border border-indigo-800/40 rounded-2xl p-5 md:p-6 shadow-xl mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              {isLoggedIn && userAvatar ? (
                <img
                  src={userAvatar}
                  alt="프로필 이미지"
                  onClick={() => setIsImageModalOpen(true)}
                  className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover shadow-md shadow-indigo-500/20 ring-2 ring-indigo-400/30 cursor-pointer hover:scale-105 transition-transform duration-200"
                />
              ) : (
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-md shadow-indigo-500/20 ring-2 ring-indigo-400/30">
                  {isLoggedIn ? (userName ? userName.charAt(0) : 'D') : 'G'}
                </div>
              )}
              <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#0f0c2e] ${isLoggedIn ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                  isLoggedIn 
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' 
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  {isLoggedIn ? 'Welcome Back' : 'Guest Mode'}
                </span>
              </div>

              <h2 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-1.5">
                안녕하세요, <span className={isLoggedIn ? "text-indigo-300 font-extrabold" : "text-rose-300 font-extrabold"}>
                  {isLoggedIn ? `${userName} 님` : '게스트 님'}
                </span>! 👋
              </h2>

              <p className="text-xs md:text-sm font-medium text-indigo-200/70">
                {isLoggedIn 
                  ? '오늘 작성할 이력서와 자소서를 확인하고 관리해 보세요.' 
                  : '모든 기능과 저장 기능을 이용하시려면 로그인이 필요합니다.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center">
            {isLoggedIn ? (
              <>
                <button
                  onClick={() => navigate('/ProfileSettings')}
                  title="프로필 설정"
                  className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-800/50 text-indigo-300 hover:text-white hover:bg-indigo-900/60 transition-all shadow-sm"
                >
                  <Settings className="w-5 h-5" />
                </button>
                <button
                  onClick={handleLogout}
                  title="로그아웃"
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-300 hover:text-white hover:bg-rose-900/50 transition-all text-xs font-semibold shadow-sm"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">로그아웃</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all text-xs font-semibold shadow-md shadow-indigo-600/30"
              >
                <LogIn className="w-4 h-4" />
                <span>로그인 하기</span>
              </button>
            )}
          </div>
        </div>

        {/* 탭 필터 및 생성 버튼 */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-[#0d0a2b] border border-indigo-900/50 rounded-xl w-fit">
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
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-indigo-200 hover:bg-indigo-950/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          
        </div>

        {/* 문서 목록 영역 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-indigo-300/70 gap-3">
            <RefreshCw className="animate-spin text-indigo-500" size={32} />
            <p className="text-sm">데이터베이스에서 문서를 불러오는 중...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDocs.length > 0 ? (
              filteredDocs.map((doc) => (
                <div
                  key={`${doc.type}-${doc.id}`}
                  onClick={() => navigate(doc.path)}
                  className="group bg-[#120d36]/70 border border-indigo-900/40 hover:border-indigo-500/50 rounded-2xl p-5 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-900/20 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-950/80 border border-indigo-800/40 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                      {doc.type === 'resume' ? (
                        <FileText className="w-6 h-6 text-indigo-300 group-hover:text-white" />
                      ) : (
                        <UserCheck className="w-6 h-6 text-indigo-300 group-hover:text-white" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                          {doc.title}
                        </h3>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-indigo-950 border border-indigo-700/50 text-indigo-300">
                          {doc.category}
                        </span>
                      </div>
                      <p className="text-xs md:text-sm text-indigo-200/60 font-medium">
                        최종 수정일: {doc.date.toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-indigo-400/60 opacity-80 group-hover:opacity-100">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(doc.path);
                      }}
                      className="p-2 hover:bg-indigo-900/40 hover:text-white rounded-lg transition"
                      title="수정하기"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => handleDeleteDoc(e, doc)}
                      className="p-2 hover:bg-rose-950/40 hover:text-rose-400 rounded-lg transition"
                      title="삭제하기"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 border border-dashed border-indigo-900/40 rounded-2xl bg-[#0d0a2b]/40 space-y-3">
                <p className="text-indigo-300/60 text-sm">등록된 문서가 없습니다.</p>
                <button
                  onClick={() => navigate('/resume/new')}
                  className="px-4 py-2 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold transition"
                >
                  새 문서 작성하기
                </button>
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
              <p className="mt-5 text-indigo-100 text-xl font-bold tracking-tight bg-black/40 px-4 py-1.5 rounded-xl">
                {userName} 프로필 원본
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}