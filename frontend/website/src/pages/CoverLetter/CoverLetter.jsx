import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Menu, Home, FileText, UserCheck, Sparkles, Plus, 
  Search, Trash2, Calendar, CheckCircle2, ArrowRight, RefreshCw 
} from 'lucide-react';

export default function CoverLetter() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('coverletter');
  const [searchQuery, setSearchQuery] = useState('');
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
      const response = await fetch(`/api/cover-letters?member_id=${memberId}`);
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
      const response = await fetch(`/api/cover-letters/${id}`, { method: 'DELETE' });
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
    <div className="min-h-screen bg-[#07051a] text-slate-100 flex font-sans">
      
      {/* 👈 사이드바 */}
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

      {/* 👉 메인 자기소개서 목록 영역 */}
      <main className="flex-1 p-8 md:p-10 max-w-6xl mx-auto space-y-8">
        
        {/* 상단 헤더 및 작성 버튼 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-900/40 pb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              자기소개서 관리
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              작성 중인 자기소개서 목록을 확인하고 AI 첨삭을 받아보세요.
            </p>
          </div>

          <button
            onClick={() => navigate('/cover-letter/new')}
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/30 transition transform hover:-translate-y-0.5 text-sm shrink-0"
          >
            <Plus size={18} />
            <span>새 자소서 만들기</span>
          </button>
        </div>

        {/* 검색바 */}
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="자소서 제목 또는 지원 직무로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 bg-[#100c36] border border-indigo-900/40 rounded-2xl text-white text-sm focus:outline-none focus:border-indigo-500 transition placeholder:text-slate-600 shadow-xl"
          />
        </div>

        {/* 로딩 / 목록 / 빈 상태 처리 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <RefreshCw className="animate-spin text-indigo-500" size={32} />
            <p className="text-sm">DB에서 자기소개서 목록을 불러오는 중...</p>
          </div>
        ) : filteredCoverLetters.length === 0 ? (
          <div className="bg-[#100c36] border border-indigo-900/40 rounded-3xl p-12 text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-indigo-950 border border-indigo-800/50 flex items-center justify-center mx-auto text-indigo-400">
              <UserCheck size={32} />
            </div>
            <h3 className="text-lg font-bold text-white">등록된 자기소개서가 없습니다</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              새 자기소개서를 작성하고 AI 첨삭 기능을 통해 합격률을 한층 더 높여보세요.
            </p>
            <button
              onClick={() => navigate('/cover-letter/new')}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-xs transition inline-flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>새 자소서 작성</span>
            </button>
          </div>
        ) : (
          /* 자기소개서 카드 그리드 */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCoverLetters.map((doc) => {
              const completeness = calculateCompleteness(doc.document_sections);
              const formattedDate = new Date(doc.updated_at || doc.created_at).toLocaleDateString();

              return (
                <div
                  key={doc.id}
                  onClick={() => navigate(`/cover-letter/${doc.id}`)}
                  className="group bg-[#100c36] border border-indigo-900/40 hover:border-indigo-500/80 rounded-3xl p-6 shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-6 relative overflow-hidden"
                >
                  <div className="space-y-4">
                    {/* 상단 뱃지 및 삭제 버튼 */}
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 bg-indigo-950 border border-indigo-800/60 rounded-full text-[11px] text-indigo-300 font-semibold">
                        {doc.category || '일반'}
                      </span>
                      <button
                        onClick={(e) => handleDelete(e, doc.id)}
                        className="p-2 text-slate-500 hover:text-rose-400 rounded-xl hover:bg-rose-950/30 transition opacity-0 group-hover:opacity-100"
                        title="자기소개서 삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* 제목 */}
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition line-clamp-1">
                        {doc.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                        <Calendar size={13} />
                        <span>{formattedDate} 수정</span>
                      </div>
                    </div>
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