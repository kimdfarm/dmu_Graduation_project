import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Loader2, Sparkles, Search, 
  Calendar, CheckCircle2, Check, Globe
} from 'lucide-react';
import { FRAME_TEMPLATES } from '../../templates/resumeTemplates';

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const GithubIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
};

const DeveloperTestGithub = () => {
  const navigate = useNavigate();

  const [title, setTitle] = useState('GitHub 테스트 이력서');
  const [category, setCategory] = useState('신입 개발자');
  const [selectedFrame, setSelectedFrame] = useState(''); 
  const [errorMessage, setErrorMessage] = useState('');
  const [language, setLanguage] = useState('ko');

  const [testGithubId, setTestGithubId] = useState(
    getCookie('github_id') || localStorage.getItem('github_id') || 'kimdfarm'
  );

  const [repositories, setRepositories] = useState([]);
  const [repoSearchKeyword, setRepoSearchKeyword] = useState('');
  const [isFetchingRepos, setIsFetchingRepos] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState([]);
  
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimationProgress, setEstimationProgress] = useState({ current: 0, total: 0, currentRepo: '' });
  const [estimationResult, setEstimationResult] = useState(null); 

  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  
  const [searchMode, setSearchMode] = useState('relative');
  const [years, setYears] = useState(0);
  const [months, setMonths] = useState(6);

  const getInitialDates = () => {
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    return {
      start: sixMonthsAgo.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    };
  };

  const initialDates = getInitialDates();
  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);
  const [activeFilterText, setActiveFilterText] = useState('최근 6개월 기준 탐색 결과');

  useEffect(() => {
    setEstimationResult(null);
  }, [selectedRepos, startDate, endDate, testGithubId, selectedFrame]);

  const handleGithubIdChange = (newId) => {
    setTestGithubId(newId);
    if (newId.trim()) {
      localStorage.setItem('github_id', newId.trim());
      document.cookie = `github_id=${newId.trim()}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=none; secure`;
    }
  };

  const fetchUserRepositories = async (targetUser, customFilters = {}) => {
    const user = targetUser || testGithubId;
    const token = getCookie('github_access_token') || localStorage.getItem('github_access_token');

    if (!user) {
      alert("GitHub ID를 입력해 주세요.");
      return;
    }

    try {
      setIsFetchingRepos(true);
      setErrorMessage('');

      const activeStartDate = customFilters.startDate !== undefined ? customFilters.startDate : startDate;
      const activeEndDate = customFilters.endDate !== undefined ? customFilters.endDate : endDate;

      const params = new URLSearchParams({ github_id: user });
      if (activeStartDate) params.append('start_date', activeStartDate);
      if (activeEndDate) params.append('end_date', activeEndDate);

      const res = await fetch(`${BASE_URL}/api/develop/github/repositories?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });

      if (!res.ok) throw new Error('저장소 목록을 불러오지 못했습니다.');

      const data = await res.json();
      const repoList = data.repositories || (Array.isArray(data) ? data : []);

      setRepositories(repoList);
      setSelectedRepos([]);
      setEstimationResult(null);
    } catch (err) {
      console.error("저장소 조회 에러:", err);
      setErrorMessage(err.message);
    } finally {
      setIsFetchingRepos(false);
    }
  };

  const handleSearch = () => {
    let activeStart = startDate;
    let activeEnd = endDate;

    if (searchMode === 'relative') {
      const totalMonths = (parseInt(years, 10) || 0) * 12 + (parseInt(months, 10) || 0);
      const validMonths = totalMonths > 0 ? totalMonths : 1;

      const today = new Date();
      const pastDate = new Date();
      pastDate.setMonth(today.getMonth() - validMonths);

      activeEnd = today.toISOString().split('T')[0];
      activeStart = pastDate.toISOString().split('T')[0];

      setStartDate(activeStart);
      setEndDate(activeEnd);

      const label = years > 0 ? `최근 ${years}년 ${months}개월` : `최근 ${months}개월`;
      setActiveFilterText(`${label} 기준 탐색 결과`);
    } else {
      setActiveFilterText(`${startDate} ~ ${endDate} 상세 기간 탐색 결과`);
    }

    fetchUserRepositories(testGithubId, { 
      startDate: activeStart, 
      endDate: activeEnd 
    });
  };

  const handleEstimateCost = async () => {
    if (selectedRepos.length === 0) {
      alert("분석할 저장소를 1개 이상 선택해 주세요.");
      return;
    }

    const token = getCookie('github_access_token') || localStorage.getItem('github_access_token');

    try {
      setIsEstimating(true);
      setErrorMessage('');
      setEstimationProgress({ current: 0, total: selectedRepos.length, currentRepo: '' });

      const projectsData = [];

      for (let i = 0; i < selectedRepos.length; i++) {
        const repoName = selectedRepos[i];
        setEstimationProgress({ 
          current: i + 1, 
          total: selectedRepos.length, 
          currentRepo: repoName 
        });

        const res = await fetch(`${BASE_URL}/api/github/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            github_id: String(testGithubId),
            repo_name: String(repoName),
            start_date: startDate || "",
            end_date: endDate || ""
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `[${repoName}] 분석 실패`);
        }

        const data = await res.json();
        projectsData.push(data);
      }

      const estimateRes = await fetch(`${BASE_URL}/api/github/estimate-cost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis_data: { projects_data: projectsData } })
      });

      if (!estimateRes.ok) {
        const errData = await estimateRes.json().catch(() => ({}));
        throw new Error(errData.detail || '토큰 견적 계산 실패');
      }

      const estimateData = await estimateRes.json();

      setEstimationResult({
        input_tokens: estimateData.input_tokens,
        output_tokens: estimateData.output_tokens,
        total_tokens: estimateData.total_tokens,
        projects_data: projectsData
      });

    } catch (err) {
      console.error("분석량 계산 실패:", err);
      alert(err.message || "분석량 계산 중 오류가 발생했습니다.");
    } finally {
      setIsEstimating(false);
      setEstimationProgress({ current: 0, total: 0, currentRepo: '' });
    }
  };

  const handleDirectGenerateResume = async () => {
    if (!selectedFrame) {
      alert("이력서 프레임 템플릿을 선택해 주세요.");
      return;
    }

    if (!estimationResult || !estimationResult.projects_data) {
      alert("먼저 '분석량 계산하기'를 진행해 주세요.");
      return;
    }

    const userId = localStorage.getItem('userId');
    if (!userId) {
      alert('로그인 정보가 없습니다.');
      return;
    }

    try {
      setLoading(true);
      setLoadingText(`[${testGithubId}] 2단계 심층 AI 분석 및 이력서 생성 중...`);

      const currentTemplate = FRAME_TEMPLATES[selectedFrame] || {};
      const targetColumns = currentTemplate.sections?.[2]?.columns || ["프로젝트명", "담당 역할", "사용 기술", "성과"];

      const generateRes = await fetch(`${BASE_URL}/api/resumes/github-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: userId,
          title: title.trim() || `[${testGithubId}] GitHub 기술 이력서`,
          category: category,
          repo_name: selectedRepos.join(', '),
          template_columns: targetColumns,
          language: language,
          analysis_data: { projects_data: estimationResult.projects_data }
        })
      });

      if (!generateRes.ok) {
        const errorData = await generateRes.json();
        alert(errorData.detail || 'GitHub 이력서 자동 생성에 실패했습니다.');
        return;
      }

      const result = await generateRes.json();
      if (result && result.id) {
        alert(`성공! 총 토큰: ${(estimationResult?.total_tokens ?? 0).toLocaleString()} 토큰`);
        navigate(`/resume/${result.id}`);
      }

    } catch (error) {
      console.error("이력서 생성 실패:", error);
      alert(error.message || "이력서 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };

  const toggleRepoSelection = (repoName) => {
    setSelectedRepos((prev) =>
      prev.includes(repoName)
        ? prev.filter((name) => name !== repoName)
        : [...prev, repoName]
    );
  };

  const handleSelectAllRepos = () => {
    if (selectedRepos.length === filteredRepositories.length) {
      setSelectedRepos([]);
    } else {
      setSelectedRepos(filteredRepositories.map(r => r.full_name || r.name));
    }
  };

  const filteredRepositories = repositories
    .filter((repo) => {
      if (!repo || !repo.name) return false;
      const keyword = repoSearchKeyword.toLowerCase();
      const nameMatch = repo.name.toLowerCase().includes(keyword);
      const descMatch = repo.description ? repo.description.toLowerCase().includes(keyword) : false;
      return nameMatch || descMatch;
    });

  const categoryOptions = ['신입 개발자', '경력직 개발자', '인턴십 / 프로젝트', '기타 / 자유 양식'];

  return (
    <div className="min-h-screen bg-[#070b19] text-slate-100 flex items-start justify-center p-6 md:p-10 font-sans overflow-y-auto">
      <div className="w-full max-w-4xl bg-[#0f152d] border border-emerald-950/60 rounded-3xl p-6 md:p-10 shadow-2xl space-y-8 my-6 relative">
        
        {/* 상단 헤더 & 돌아가기 */}
        <div className="flex items-center justify-between border-b border-emerald-950/60 pb-5">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-emerald-300 transition-colors px-3 py-1.5 rounded-xl bg-[#0a1024] border border-emerald-950/80"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>돌아가기</span>
          </button>
          
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold px-3 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded-full">
              GitHub Token Test Mode
            </span>
          </div>
        </div>

        {/* 타이틀 영역 */}
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-2.5 tracking-tight">
            <GithubIcon className="w-7 h-7 text-emerald-400" />
            GitHub ID별 토큰 분석 테스트
          </h1>
          <p className="text-xs md:text-sm text-slate-400">
            다른 사용자의 GitHub ID를 입력하고 저장소별 정보량(토큰 수)을 비교해 보세요.
          </p>
        </div>

        {errorMessage && (
          <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="space-y-8">
          
          {/* 테스트 대상 GitHub ID 변경 영역 */}
          <div className="p-5 bg-[#0a1024] border border-emerald-900/80 rounded-2xl space-y-3 shadow-md">
            <label className="block text-xs font-bold text-slate-200">
              테스트할 GitHub ID 지정
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testGithubId}
                onChange={(e) => handleGithubIdChange(e.target.value)}
                placeholder="예: torvalds, kimdfarm 등"
                className="flex-1 px-4 py-3 text-sm text-white bg-[#070b19] border border-emerald-950 rounded-xl focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => fetchUserRepositories(testGithubId)}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition"
              >
                저장소 불러오기
              </button>
            </div>
          </div>

          {/* 기본 정보 입력 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-200">이력서 제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3.5 text-sm text-white bg-[#0a1024] border border-emerald-950/80 rounded-2xl focus:outline-none focus:border-emerald-500 transition-all shadow-md"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-200">지원 직군 / 카테고리</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3.5 text-sm text-white bg-[#0a1024] border border-emerald-950/80 rounded-2xl focus:outline-none focus:border-emerald-500 transition-all shadow-md"
              >
                {categoryOptions.map((opt) => (
                  <option key={opt} value={opt} className="bg-[#0f152d] text-white">{opt}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-emerald-400" />
                이력서 작성 언어
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-4 py-3.5 text-sm text-white bg-[#0a1024] border border-emerald-950/80 rounded-2xl focus:outline-none focus:border-emerald-500 transition-all shadow-md cursor-pointer"
              >
                <option value="ko" className="bg-[#0f152d] text-white">🇰🇷 한국어 (Korean)</option>
                <option value="en" className="bg-[#0f152d] text-white">🇺🇸 영어 (English)</option>
              </select>
            </div>
          </div>

          {/* 이력서 프레임 템플릿 선택 영역 */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-emerald-400" />
              이력서 프레임 템플릿 선택 <span className="text-emerald-400 text-[10px]">(필수 선택)</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(FRAME_TEMPLATES).map(([key, tpl]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedFrame(key)}
                  className={`p-4 text-left rounded-2xl border transition-all text-xs flex flex-col justify-between gap-3 ${
                    selectedFrame === key
                      ? 'bg-emerald-950/40 border-emerald-500 text-white ring-1 ring-emerald-500 shadow-lg shadow-emerald-500/10'
                      : 'bg-[#0a1024] border-emerald-950/80 text-slate-400 hover:border-emerald-800/60'
                  }`}
                >
                  <div className="space-y-1.5">
                    <p className="font-bold text-slate-100 text-xs leading-snug break-words flex-1">{tpl.name}</p>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">{tpl.desc}</p>
                  </div>
                  <div>
                    <span className="inline-block text-[10px] px-2.5 py-0.5 rounded-md bg-[#070b19] border border-emerald-950 text-emerald-300 font-semibold">
                      {tpl.category}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* GITHUB 활동 분석 영역 */}
          <div className="space-y-6 pt-4 border-t border-emerald-950/60">
            
              <div className="w-full bg-[#0a1024] border border-emerald-950/80 rounded-2xl p-5 md:p-6 space-y-4 text-white shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-950/60 pb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold text-slate-100">활동 분석 기간 설정</h3>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-[#070b19] border border-emerald-950 rounded-full text-[11px] text-emerald-300 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>적용 기간: <strong className="text-white">{activeFilterText}</strong></span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#070b19] rounded-xl border border-emerald-950">
                  <button
                    type="button"
                    onClick={() => setSearchMode('relative')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${searchMode === 'relative' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400'}`}
                  >
                    최근 기간 설정
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchMode('custom')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${searchMode === 'custom' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400'}`}
                  >
                    상세 날짜 직접 지정
                  </button>
                </div>

                {searchMode === 'relative' ? (
                  <div className="bg-[#070b19] border border-emerald-950 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">단축 선택</span>
                      <div className="flex gap-1.5">
                        {[{ label: '3개월', m: 3 }, { label: '6개월', m: 6 }, { label: '1년', y: 1, m: 0 }].map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => { setYears(p.y || 0); setMonths(p.m || 0); }}
                            className="px-3 py-1 rounded-xl text-xs font-semibold bg-[#0a1024] text-emerald-300 border border-emerald-900/40 hover:bg-emerald-950/40"
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#070b19] border border-emerald-950 rounded-2xl p-4 grid grid-cols-2 gap-4">
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-[#0a1024] border border-emerald-950 rounded-xl px-3 py-2 text-xs text-white" />
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-[#0a1024] border border-emerald-950 rounded-xl px-3 py-2 text-xs text-white" />
                  </div>
                )}

                <button type="button" onClick={handleSearch} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2">
                  <Search className="w-3.5 h-3.5" /> 설정한 기간으로 저장소 탐색하기
                </button>
              </div>

              {/* 저장소 검색 & 선택 */}
              <div className="flex items-center justify-between gap-2.5 pt-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="저장소 검색..."
                    value={repoSearchKeyword}
                    onChange={(e) => setRepoSearchKeyword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-xs text-white bg-[#0a1024] border border-emerald-950 rounded-xl focus:outline-none focus:border-emerald-500 shadow-md"
                  />
                </div>
                <button type="button" onClick={handleSelectAllRepos} className="px-4 py-3 bg-[#0a1024] border border-emerald-950 text-emerald-300 text-xs font-bold rounded-xl">
                  {selectedRepos.length === filteredRepositories.length ? '전체 해제' : '전체 선택'}
                </button>
              </div>

              {isFetchingRepos ? (
                <div className="p-12 text-center bg-[#0a1024] border border-emerald-950 rounded-2xl space-y-3">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mx-auto" />
                    <p className="text-xs text-slate-300 font-bold">
                    [{testGithubId}]의 저장소 목록을 탐색하는 중입니다...
                    </p>
                </div>
              ) : repositories.length === 0 ? (
                <div className="p-10 text-center bg-[#0a1024] border border-emerald-950 rounded-2xl text-slate-400 text-xs">
                  상단의 <strong className="text-emerald-400">[저장소 불러오기]</strong> 버튼을 눌러 저장소 목록을 가져와 주세요.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                  {filteredRepositories.map((repo) => {
                    const repoName = repo.full_name || repo.name;
                    const isSelected = selectedRepos.includes(repoName);
                    return (
                      <div
                        key={repo.id || repoName}
                        onClick={() => toggleRepoSelection(repoName)}
                        className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between gap-3 ${
                          isSelected ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500 shadow-md' : 'bg-[#0a1024] border-emerald-950'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold text-slate-100 truncate">{repoName}</p>
                            <p className="text-[11px] text-slate-400 line-clamp-2">{repo.description || '설명 없음'}</p>
                          </div>
                          <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${isSelected ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-700 bg-[#070b19]'}`}>
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 분석량 계산 결과 영역 */}
              {selectedRepos.length > 0 && (
                <div className="p-5 bg-[#0a1024] border border-emerald-900 rounded-2xl space-y-4 shadow-lg">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="text-xs font-bold text-slate-200">
                      선택된 저장소: <strong className="text-emerald-400">{selectedRepos.length}개</strong>
                    </span>
                    <button
                      type="button"
                      onClick={handleEstimateCost}
                      disabled={isEstimating}
                      className="w-full sm:w-auto px-5 py-3 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-md shadow-teal-600/30"
                    >
                      {isEstimating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      <span>
                        {isEstimating 
                          ? `분석 중... (${estimationProgress.current}/${estimationProgress.total})` 
                          : '분석량 계산하기'}
                      </span>
                    </button>
                  </div>

                  {isEstimating && (
                    <div className="p-4 bg-[#070b19] border border-teal-500/40 rounded-xl text-xs space-y-2 text-teal-300 animate-pulse">
                      <div className="flex items-center justify-between font-semibold">
                        <span>🔍 저장소 분석 진행 중...</span>
                        <span>{estimationProgress.current} / {estimationProgress.total} 완료</span>
                      </div>
                      <p className="text-slate-300 text-[11px] truncate">
                        현재 분석 중인 저장소: <strong className="text-white font-mono">{estimationProgress.currentRepo}</strong>
                      </p>
                      <div className="w-full bg-[#0a1024] h-2 rounded-full overflow-hidden border border-teal-900">
                        <div 
                          className="bg-teal-500 h-full transition-all duration-300"
                          style={{ width: `${(estimationProgress.current / estimationProgress.total) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {estimationResult && (
                    <div className="p-4 rounded-xl text-xs space-y-2 border bg-[#070b19] border-emerald-500/40 text-emerald-300">
                      <p className="flex items-center justify-between">
                        <span>📥 입력 토큰 (소스 정제 데이터):</span>
                        <strong className="text-white font-bold">{(estimationResult.input_tokens ?? 0).toLocaleString()} 토큰</strong>
                      </p>
                      <p className="flex items-center justify-between">
                        <span>📤 출력 토큰 (AI 이력서 생성 예측):</span>
                        <strong className="text-teal-300 font-bold">{(estimationResult.output_tokens ?? 0).toLocaleString()} 토큰</strong>
                      </p>
                      <p className="flex items-center justify-between border-t border-emerald-950 pt-2">
                        <span>📊 총 토큰 (Input + Output):</span>
                        <strong className="text-yellow-400 font-bold">{(estimationResult.total_tokens ?? 0).toLocaleString()} 토큰</strong>
                      </p>
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* 최종 생성 버튼 */}
          <button
            type="button"
            onClick={handleDirectGenerateResume}
            disabled={loading || !selectedFrame || !estimationResult || selectedRepos.length === 0}
            className={`
              w-full py-4 px-6 rounded-2xl font-black text-sm md:text-base transition-all duration-200 
              flex items-center justify-center gap-2 mt-8 cursor-pointer
              ${
                loading || !selectedFrame || !estimationResult || selectedRepos.length === 0
                  ? 'bg-[#0a1024] text-slate-500 border border-emerald-950/60 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/30 border border-emerald-400/30'
              }
            `}
          >
            {loading ? (
              <span className="flex items-center gap-2 text-white">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-300" />
                <span>{loadingText || '처리 중...'}</span>
              </span>
            ) : !selectedFrame ? (
              <span className="text-slate-400 font-medium text-xs md:text-sm">
                ⚠️ 상단에서 이력서 프레임 템플릿을 선택해 주세요
              </span>
            ) : estimationResult ? (
              <span className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-300 fill-yellow-300 animate-bounce" />
                <span>[{testGithubId}] 2단계 심층 AI 분석 후 이력서 생성하기</span>
              </span>
            ) : (
              <span className="text-slate-400 font-medium text-xs md:text-sm">
                ⚠️ 위에서 [분석량 계산하기]를 먼저 진행해 주세요
              </span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default DeveloperTestGithub;