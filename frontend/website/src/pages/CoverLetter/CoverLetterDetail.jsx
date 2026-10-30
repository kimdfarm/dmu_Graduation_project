import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit3, Loader2, Download, Briefcase, 
  CheckCircle2, ChevronDown, ChevronUp, Sparkles,
  FileText, Cpu, Search, Building2, ExternalLink,
  CheckCircle, AlertTriangle, Lightbulb, BarChart3, Tag, Check, Info, RefreshCw, Target, Zap, Building 
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const generateUniqueId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11);
};

const parseDetailsToTableSchema = (details, secColumns = [], secAiColumns = [], currentVersion = 'ORIGINAL') => {
  const isAi = currentVersion === 'AI';

  let defaultColumns = ['질문', '답변'];
  if (isAi && Array.isArray(secAiColumns) && secAiColumns.length > 0) {
    defaultColumns = [...secAiColumns];
  } else if (Array.isArray(secColumns) && secColumns.length > 0) {
    defaultColumns = [...secColumns];
  }

  if (!details || details.length === 0) {
    return { columns: defaultColumns, rows: [] };
  }

  const sessionColumns = [...defaultColumns];

  const extractedRows = details.map((detail) => {
    const rowValues = {};
    let rowColumns = defaultColumns;

    if (detail.values && typeof detail.values === 'object') {
      Object.assign(rowValues, detail.values);
    } else {
      let targetText = detail.original_text || '';
      if (currentVersion === 'SPELL' && detail.spell_checked_text) {
        targetText = detail.spell_checked_text;
      } else if (currentVersion === 'AI' && detail.ai_proofread_text) {
        targetText = detail.ai_proofread_text;
      }

      const blocks = targetText.split(/\n\n(?=\[)/);

      blocks.forEach((block) => {
        const match = block.match(/^\[(.*?)\]\n?([\s\S]*)$/);
        if (match) {
          const colName = match[1].trim();
          const content = match[2].replace(/^[•\-\*\s]+/gm, '').trim();
          rowValues[colName] = content;

          if (!sessionColumns.includes(colName)) {
            sessionColumns.push(colName);
          }
        }
      });

      if (Object.keys(rowValues).length === 0 && targetText) {
        const col1 = rowColumns[0] || '질문';
        const col2 = rowColumns[1] || '답변';
        rowValues[col1] = detail.title || '';
        rowValues[col2] = targetText.replace(/^[•\-\*\s]+/gm, '').trim();
      }
    }

    return {
      id: detail.id || generateUniqueId(),
      title: detail.title || '',
      spell_checked_text: detail.spell_checked_text || null,
      ai_proofread_text: detail.ai_proofread_text || null,
      selected_version: currentVersion,
      values: rowValues
    };
  });

  return { columns: sessionColumns, rows: extractedRows };
};

const CoverLetterDetail = () => {
  const { coverLetterId } = useParams();
  const navigate = useNavigate();

  const [activeMainTab, setActiveMainTab] = useState('document');

  const [coverLetter, setCoverLetter] = useState(null);
  const [sections, setSections] = useState([]);
  
  const [sectionVersions, setSectionVersions] = useState({});
  const [processingSections, setProcessingSections] = useState({});

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [expandedCells, setExpandedCells] = useState({});

  const [topN, setTopN] = useState(3);
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [topKeywords, setTopKeywords] = useState([]);
  
  const [selectedJob, setSelectedJob] = useState(null);
  const [expandedJobDetails, setExpandedJobDetails] = useState({});
  const [isAnalyzingFeedback, setIsAnalyzingFeedback] = useState(false);
  const [feedbackReport, setFeedbackReport] = useState(null);
  const [analyzedJobRank, setAnalyzedJobRank] = useState(null);
  const [analysisError, setAnalysisError] = useState('');

  const userId = localStorage.getItem('userId');

  const [activeModeSelector, setActiveModeSelector] = useState({});
  const [sectionAiModes, setSectionAiModes] = useState({});

  useEffect(() => {
    if (!userId) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    const fetchCoverLetterData = async () => {
      try {
        setIsLoading(true);

        const res = await fetch(`${API_URL}/api/cover-letters/${coverLetterId}`);
        if (!res.ok) throw new Error('자기소개서 정보를 불러오는 데 실패했습니다.');

        const data = await res.json();
        setCoverLetter(data);

        if (data.sections && Array.isArray(data.sections)) {
          const parsedSections = data.sections.map((sec) => {
            const spellMap = {};
            if (Array.isArray(sec.spell_checked_text)) {
              sec.spell_checked_text.forEach((item) => {
                if (item && item.id) spellMap[item.id] = item.spell_checked_text || '';
              });
            }

            const aiTextMap = {};
            const aiColumnsMap = {}; 
            
            if (Array.isArray(sec.ai_proofread_text)) {
              sec.ai_proofread_text.forEach((group) => {
                if (group && Array.isArray(group.items)) {
                  const groupColumns = group.ai_columns || [];
                  group.items.forEach((item) => {
                    if (item && item.id) {
                      aiTextMap[item.id] = item.ai_proofread_text || '';
                      aiColumnsMap[item.id] = groupColumns; 
                    }
                  });
                }
              });
            }

            const updatedDetails = (sec.details || []).map((detail) => ({
              ...detail,
              spell_checked_text: spellMap[detail.id] || detail.spell_checked_text || '',
              ai_proofread_text: aiTextMap[detail.id] || detail.ai_proofread_text || '',
              ai_columns: aiColumnsMap[detail.id] || detail.ai_columns || []
            }));

            return { ...sec, details: updatedDetails };
          });

          setSections(parsedSections);

          // 💡 데이터 로딩 직후 안전하게 초기 AI 모드 및 버전 상태 설정
          const initialModes = {};
          const initialVersions = {};
          
          parsedSections.forEach((sec) => {
            initialVersions[sec.id] = sec.selected_version || 'ORIGINAL';

            if (Array.isArray(sec.ai_proofread_text)) {
              sec.ai_proofread_text.forEach((group) => {
                if (group && group.mode && Array.isArray(group.items) && group.items.length > 0) {
                  initialModes[sec.id] = group.mode;
                }
              });
            }
          });

          setSectionAiModes(initialModes);
          setSectionVersions(initialVersions);
        }
      } catch (err) {
        console.error('데이터 로딩 에러:', err);
        setErrorMessage(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (coverLetterId) fetchCoverLetterData();
  }, [coverLetterId, userId, navigate]);

  const toggleCellExpand = (cellKey) => {
    setExpandedCells((prev) => ({
      ...prev,
      [cellKey]: !prev[cellKey]
    }));
  };

  const toggleJobDetailExpand = (jobRank, e) => {
    e.stopPropagation();
    setExpandedJobDetails((prev) => ({
      ...prev,
      [jobRank]: !prev[jobRank]
    }));
  };

  const handleSelectJob = (job) => {
    if (selectedJob?.rank !== job.rank) {
      setSelectedJob(job);
      if (analyzedJobRank !== job.rank) {
        setFeedbackReport(null);
      }
    }
  };

  const handleSectionVersionChange = async (sectionId, version) => {
    setSectionVersions((prev) => ({ ...prev, [sectionId]: version }));

    try {
      await fetch(`${API_URL}/api/sections/${sectionId}/version`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_version: version })
      });
    } catch (err) {
      console.error('버전 업데이트 실패:', err);
    }
  };

  const handleSpellCheckSection = async (sectionId) => {
    setSectionVersions((prev) => ({ ...prev, [sectionId]: 'SPELL' }));
    setActiveModeSelector((prev) => ({ ...prev, [sectionId]: false }));

    const targetSection = sections.find((s) => s.id === sectionId);
    if (!targetSection || !targetSection.details) return;

    try {
      setProcessingSections((prev) => ({ ...prev, [sectionId]: 'SPELL' }));
      const response = await fetch(`${API_URL}/api/sections/${sectionId}/spell-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          details: targetSection.details.map((d) => ({
            id: d.id,
            original_text: d.original_text || d.values?.답변 || d.title || ''
          }))
        })
      });

      if (response.ok) {
        const result = await response.json();
        setSections((prevSections) =>
          prevSections.map((sec) => {
            if (sec.id !== sectionId) return sec;
            const updatedDetails = sec.details.map((detail) => {
              const checkedItem = Array.isArray(result) 
                ? result.find((item) => item.id === detail.id)
                : null;
              return checkedItem
                ? { ...detail, spell_checked_text: checkedItem.spell_checked_text }
                : detail;
            });
            return { ...sec, details: updatedDetails };
          })
        );
      }
    } catch (err) {
      console.error('맞춤법 교정 API 오류:', err);
    } finally {
      setProcessingSections((prev) => ({ ...prev, [sectionId]: null }));
    }
  };

  const handleExecuteAIProofread = async (sectionId, selectedMode) => {
    setSectionVersions((prev) => ({ ...prev, [sectionId]: 'AI' }));
    setActiveModeSelector((prev) => ({ ...prev, [sectionId]: false }));
    setSectionAiModes((prev) => ({ ...prev, [sectionId]: selectedMode }));

    const targetSection = sections.find((s) => s.id === sectionId);
    if (!targetSection || !targetSection.details) return;

    try {
      setProcessingSections((prev) => ({ ...prev, [sectionId]: 'AI' }));

      const response = await fetch(`${API_URL}/api/sections/${sectionId}/coverletter-ai-proofread`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: selectedMode,
          details: targetSection.details.map((d) => ({
            id: d.id,
            original_text: d.original_text || d.values?.답변 || d.title || ''
          }))
        })
      });

      if (response.ok) {
        const updatedRes = await fetch(`${API_URL}/api/cover-letters/${coverLetterId}`);
        if (updatedRes.ok) {
          const updatedData = await updatedRes.json();
          if (updatedData.sections) {
            setSections(updatedData.sections);
          }
        }
      }
    } catch (err) {
      console.error('AI 교정 API 오류:', err);
    } finally {
      setProcessingSections((prev) => ({ ...prev, [sectionId]: null }));
    }
  };

  const executeRecommendation = async (endpoint) => {
    try {
      setIsRecommending(true);
      setAnalysisError('');
      setFeedbackReport(null);
      setAnalyzedJobRank(null);
      setSelectedJob(null);

      let currentResumeText = "";
      formattedSections.forEach((sec) => {
        currentResumeText += `[${sec.section_title}]\n`;
        sec.rows.forEach((row) => {
          Object.entries(row.values).forEach(([colName, val]) => {
            if (val) currentResumeText += `${colName}: ${val}\n`;
          });
        });
      });

      if (!currentResumeText.trim()) {
        currentResumeText = coverLetter?.title || "백엔드 소프트웨어 개발자";
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);

      const recRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_resume: currentResumeText,
          top_n: parseInt(topN, 10)
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!recRes.ok) throw new Error(`서버 응답 오류: ${recRes.status}`);
      const recData = await recRes.json();
      
      setRecommendations(recData.recommendations || []);
      setTopKeywords(recData.top_tech_keywords || []);

      if (recData.recommendations && recData.recommendations.length > 0) {
        setSelectedJob(recData.recommendations[0]);
      }
    } catch (err) {
      console.error('공고 추천 실패:', err);
      if (err.name === 'AbortError') {
        setAnalysisError('서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
      } else {
        setAnalysisError(err.message || '서버와 통신하지 못했습니다.');
      }
    } finally {
      setIsRecommending(false);
    }
  };

  const handleFetchRecommendationsLsi = async () => {
    await executeRecommendation(`${API_URL}/api/recommend`);
  };

  const handleRunFeedbackAnalysis = async () => {
    if (!selectedJob) {
      alert('분석을 진행할 공고를 먼저 선택해 주세요.');
      return;
    }

    try {
      setIsAnalyzingFeedback(true);
      setAnalysisError('');

      const fbRes = await fetch(`${API_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: coverLetterId,
          top_jd_text: selectedJob.full_jd_text
        })
      });

      if (!fbRes.ok) throw new Error('AI 피드백 리포트 생성에 실패했습니다.');
      const fbData = await fbRes.json();
      
      setFeedbackReport(fbData);
      setAnalyzedJobRank(selectedJob.rank);

    } catch (err) {
      console.error('피드백 분석 실패:', err);
      setAnalysisError(err.message);
    } finally {
      setIsAnalyzingFeedback(false);
    }
  };

  const getColumnWidthClass = (colName, textValue = '') => {
    const isDetail = colName.includes('내용') || colName.includes('답변') || colName.includes('작성') || colName.includes('경험');
    const isShort = colName.includes('제목') || colName.includes('문항') || colName.includes('항목');

    if (isDetail || textValue.length > 80) return 'flex-[3] min-w-[350px]';
    if (isShort || textValue.length < 20) return 'flex-[1] min-w-[140px] max-w-[200px]';
    return 'flex-[1.5] min-w-[180px]';
  };

  // 💡 순수하게 데이터 매핑만 수행하도록 수정 (렌더링 루프 원인 제거)
  const formattedSections = sections.map((sec) => {
    const secVersion = sectionVersions[sec.id] || sec.selected_version || 'ORIGINAL';
    
    const { columns, rows } = parseDetailsToTableSchema(
      sec.details, 
      sec.columns, 
      sec.ai_columns,  
      secVersion
    );
    
    return { ...sec, columns, rows, currentVersion: secVersion };
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070b1a] flex flex-col items-center justify-center text-slate-300 gap-3 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <p className="text-sm font-medium">자기소개서를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b1a] text-slate-100 p-6 md:p-12 font-sans overflow-y-auto">
      <div className="w-full max-w-5xl mx-auto space-y-6">
        
        {/* [1] 최상단 제어 컨트롤 바 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0a1024] px-6 py-4 rounded-2xl border border-indigo-950/80 shadow-lg">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/cover-letter')}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#07051a] hover:bg-indigo-950/40 border border-indigo-950 rounded-xl text-slate-300 hover:text-indigo-300 transition text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>이전 목록</span>
            </button>
            <div className="h-4 w-[1px] bg-indigo-950/80 hidden sm:block" />
            <div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 rounded-full">
                {coverLetter?.category || '자기소개서'}
              </span>
              <h1 className="text-lg md:text-xl font-black text-white mt-0.5 tracking-tight">
                {coverLetter?.title || '자기소개서 상세'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            <button
              onClick={() => navigate(`/cover-letter/${coverLetterId}/edit`)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[#07051a] hover:bg-indigo-950/30 text-indigo-300 font-semibold text-xs rounded-xl transition border border-indigo-950/80 shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
              <span>구성 편집</span>
            </button>

            <button
              onClick={() => navigate(`/cover-letter/${coverLetterId}/download`)}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF 다운로드</span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-2xl text-xs text-rose-300">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* 상단 메인 탭 메뉴 */}
        <div className="flex items-center gap-2 border-b border-indigo-950/80 pb-1">
          <button
            onClick={() => setActiveMainTab('document')}
            className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm rounded-t-2xl transition-all border-t border-x ${
              activeMainTab === 'document'
                ? 'bg-[#0f152d] text-indigo-300 border-indigo-900/80 shadow-lg'
                : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <FileText className="w-4 h-4 text-indigo-400" />
            자기소개서 문항 및 작성본
          </button>

          <button
            onClick={() => setActiveMainTab('analysis')}
            className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm rounded-t-2xl transition-all border-t border-x ${
              activeMainTab === 'analysis'
                ? 'bg-[#0f152d] text-amber-300 border-indigo-900/80 shadow-lg'
                : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Cpu className="w-4 h-4 text-amber-400" />
            AI 공고 추천 & 역량 피드백 리포트
          </button>
        </div>

        {/* [마스터 문서 컨테이너] */}
        <div className="bg-[#0f152d] border border-indigo-950/60 rounded-3xl p-6 md:p-10 shadow-2xl space-y-10 relative overflow-hidden">
          
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

          {/* TAB 1: 자기소개서 문항 및 작성본 */}
          {activeMainTab === 'document' && (
            <div className="space-y-8">
              {formattedSections.map((sec) => {
                const isModeSelectorOpen = !!activeModeSelector[sec.id];

                return (
                  <div key={sec.id} className="bg-[#0a1024] border border-indigo-950/80 rounded-2xl p-6 space-y-5 shadow-inner transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-950 pb-4">
                      <div className="flex items-center gap-2.5">
                        <Briefcase className="w-4 h-4 text-indigo-400" />
                        <h3 className="text-sm font-black text-white">{sec.section_title || '자기소개서 문항'}</h3>
                        <span className="text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/30">
                          {sec.rows ? sec.rows.length : 0}개 문항
                        </span>
                      </div>

                      <div className="flex items-center gap-1 bg-[#07051a] p-1 rounded-xl border border-indigo-950/85">
                        <button
                          type="button"
                          onClick={() => handleSectionVersionChange(sec.id, 'ORIGINAL')}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
                            sec.currentVersion === 'ORIGINAL'
                              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-indigo-200'
                          }`}
                        >
                          원본
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSpellCheckSection(sec.id)}
                          disabled={processingSections[sec.id] === 'SPELL'}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                            sec.currentVersion === 'SPELL'
                              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-indigo-200'
                          }`}
                        >
                          {processingSections[sec.id] === 'SPELL' ? <Loader2 className="w-3 h-3 animate-spin" /> : '맞춤법'}
                        </button>

                        {/* AI 교정 버튼 */}
                        <button
                          type="button"
                          onClick={() => setActiveModeSelector((prev) => ({ ...prev, [sec.id]: !prev[sec.id] }))}
                          disabled={processingSections[sec.id] === 'AI'}
                          className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 ${
                            sec.currentVersion === 'AI' || isModeSelectorOpen
                              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm'
                              : 'text-slate-300 hover:text-indigo-200 bg-indigo-950/40'
                          }`}
                        >
                          {processingSections[sec.id] === 'AI' ? (
                            <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                          ) : (
                            <Sparkles className="w-3 h-3 text-amber-400" />
                          )}
                          <span>AI 교정</span>
                          <ChevronDown className={`w-3 h-3 transition-transform ${isModeSelectorOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* AI 교정 모드 선택 패널 */}
                    {isModeSelectorOpen && (
                    <div className="bg-[#050914] border border-indigo-500/40 rounded-2xl p-4 shadow-xl animate-fadeIn space-y-3">
                      <div className="flex items-center justify-between border-b border-indigo-950 pb-2.5">
                        <span className="text-xs font-extrabold text-indigo-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> AI 교정 모드를 선택하세요
                        </span>
                        <span className="text-[10px] text-slate-400">문항의 목적에 맞는 최적의 윤문 엔진이 작동합니다</span>
                      </div>

                      {(() => {
                        const currentSelectedMode = sectionAiModes[sec.id] || 'STAR';

                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {/* 1. STAR 모드 버튼 */}
                            <button
                              type="button"
                              onClick={() => handleExecuteAIProofread(sec.id, 'STAR')}
                              className={`flex items-start gap-3 p-3 rounded-xl border transition text-left group ${
                                currentSelectedMode === 'STAR' 
                                  ? 'bg-indigo-950/70 border-indigo-500 shadow-md ring-1 ring-indigo-500' 
                                  : 'bg-[#0a1024] hover:bg-indigo-950/50 border-indigo-900/60'
                              }`}
                            >
                              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition shrink-0 mt-0.5">
                                <Target className="w-4 h-4" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <div className="text-xs font-bold text-white group-hover:text-indigo-300">🎯 STAR 기법 강조 모드</div>
                                  {currentSelectedMode === 'STAR' && <Check className="w-3.5 h-3.5 text-indigo-400 font-bold" />}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">상황-과제-행동-결과 흐름이 선명하게 드러나도록 구조화</div>
                              </div>
                            </button>

                            {/* 2. IMPACT 모드 버튼 */}
                            <button
                              type="button"
                              onClick={() => handleExecuteAIProofread(sec.id, 'IMPACT')}
                              className={`flex items-start gap-3 p-3 rounded-xl border transition text-left group ${
                                currentSelectedMode === 'IMPACT' 
                                  ? 'bg-amber-950/40 border-amber-500 shadow-md ring-1 ring-amber-500' 
                                  : 'bg-[#0a1024] hover:bg-indigo-950/50 border-indigo-900/60'
                              }`}
                            >
                              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-110 transition shrink-0 mt-0.5">
                                <Zap className="w-4 h-4" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <div className="text-xs font-bold text-white group-hover:text-amber-300">📊 성과/수치 중심 (Impact Booster)</div>
                                  {currentSelectedMode === 'IMPACT' && <Check className="w-3.5 h-3.5 text-amber-400 font-bold" />}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">효율성 개선율 및 기여도 수치를 강조하여 임팩트 극대화</div>
                              </div>
                            </button>

                            {/* 3. TECH 모드 버튼 */}
                            <button
                              type="button"
                              onClick={() => handleExecuteAIProofread(sec.id, 'TECH')}
                              className={`flex items-start gap-3 p-3 rounded-xl border transition text-left group ${
                                currentSelectedMode === 'TECH' 
                                  ? 'bg-purple-950/40 border-purple-500 shadow-md ring-1 ring-purple-500' 
                                  : 'bg-[#0a1024] hover:bg-indigo-950/50 border-indigo-900/60'
                              }`}
                            >
                              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 group-hover:scale-110 transition shrink-0 mt-0.5">
                                <Cpu className="w-4 h-4" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <div className="text-xs font-bold text-white group-hover:text-purple-300">🛠️ 기술 스택 & 트러블슈팅</div>
                                  {currentSelectedMode === 'TECH' && <Check className="w-3.5 h-3.5 text-purple-400 font-bold" />}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">아키텍처 및 문제 해결 과정을 전문 기술 어휘로 세련되게 윤문</div>
                              </div>
                            </button>

                            {/* 4. TONE 모드 버튼 */}
                            <button
                              type="button"
                              onClick={() => handleExecuteAIProofread(sec.id, 'TONE')}
                              className={`flex items-start gap-3 p-3 rounded-xl border transition text-left group ${
                                currentSelectedMode === 'TONE' 
                                  ? 'bg-emerald-950/40 border-emerald-500 shadow-md ring-1 ring-emerald-500' 
                                  : 'bg-[#0a1024] hover:bg-indigo-950/50 border-indigo-900/60'
                              }`}
                            >
                              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition shrink-0 mt-0.5">
                                <Building className="w-4 h-4" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <div className="text-xs font-bold text-white group-hover:text-emerald-300">🏢 기업 톤앤매너 (대기업/스타트업)</div>
                                  {currentSelectedMode === 'TONE' && <Check className="w-3.5 h-3.5 text-emerald-400 font-bold" />}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">신뢰감 주는 서술형 문어체 및 비즈니스 매너 어조로 완성</div>
                              </div>
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                    <div className="space-y-4">
                      {sec.rows && sec.rows.length > 0 ? (
                        sec.rows.map((row, rIdx) => (
                          <div key={row.id} className="bg-[#07051a] border border-indigo-950 rounded-xl p-4 space-y-3 shadow-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-indigo-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> 문항 #{rIdx + 1}
                              </span>
                            </div>

                            <div className="overflow-x-auto pb-1">
                              <div className="flex gap-3 min-w-full items-start">
                                {(sec.columns || []).map((col) => {
                                  const val = row.values[col] || '';
                                  const cellKey = `${sec.id}-${row.id}-${col}`;
                                  const isExpanded = !!expandedCells[cellKey];

                                  const lines = val ? val.split('\n').filter((l) => l.trim()) : [];
                                  const isLongContent = lines.length > 2 || val.length > 45;
                                  const widthClass = getColumnWidthClass(col, val);

                                  return (
                                    <div
                                      key={col}
                                      className={`${widthClass} bg-[#040711] p-3 rounded-xl border border-indigo-950/80 flex flex-col transition-all ${
                                        isExpanded ? 'h-auto' : 'h-28'
                                      }`}
                                    >
                                      <span className="text-[11px] font-bold text-indigo-300 border-b border-indigo-950 pb-1.5 mb-1.5 truncate shrink-0">
                                        {col}
                                      </span>

                                      <div className="relative flex-1 overflow-hidden">
                                        <div className={`text-xs text-slate-200 leading-relaxed font-sans ${!isExpanded && isLongContent ? 'max-h-10 overflow-hidden' : ''}`}>
                                          {val ? (
                                            lines.map((line, lIdx) => {
                                              const clean = line.replace(/^[•\-\*\s]+/, '').trim();
                                              if (!clean) return null;
                                              return (
                                                <div key={lIdx} className="flex items-start gap-1.5 my-0.5">
                                                  <span className="text-indigo-400 shrink-0">•</span>
                                                  <span className="break-all">{clean}</span>
                                                </div>
                                              );
                                            })
                                          ) : (
                                            <span className="text-slate-600 italic text-[10px]">내용 없음</span>
                                          )}
                                        </div>

                                        {!isExpanded && isLongContent && (
                                          <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[#040711] to-transparent pointer-events-none" />
                                        )}
                                      </div>

                                      {isLongContent && (
                                        <button
                                          onClick={() => toggleCellExpand(cellKey)}
                                          className="mt-1.5 pt-1.5 border-t border-indigo-950 text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center justify-center gap-1 w-full shrink-0 transition"
                                        >
                                          {isExpanded ? (
                                            <><span>접기</span><ChevronUp className="w-3 h-3" /></>
                                          ) : (
                                            <><span>자세히 보기</span><ChevronDown className="w-3 h-3" /></>
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500 italic py-2">등록된 작성 내용이 없습니다.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: AI 공고 추천 & 역량 피드백 분석 */}
          {activeMainTab === 'analysis' && (
            <div className="space-y-6">
              
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0a1024] p-5 rounded-2xl border border-indigo-950/80 shadow-lg">
                <div>
                  <h3 className="text-sm font-bold text-white">AI 채용 공고 매칭 및 역량 피드백</h3>
                  <p className="text-xs text-slate-400 mt-0.5">작성된 자기소개서 내용을 분석하여 최적의 채용 공고를 추천받고 맞춤형 피드백을 확인하세요.</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-[#07051a] px-3 py-2 rounded-xl border border-indigo-950">
                    <span className="text-xs font-semibold text-indigo-300">개수:</span>
                    <select
                      value={topN}
                      onChange={(e) => setTopN(e.target.value)}
                      className="bg-[#0a1024] text-white text-xs font-bold outline-none cursor-pointer rounded-lg px-2 py-1 border border-indigo-900"
                    >
                      <option value={3}>Top 3</option>
                      <option value={5}>Top 5</option>
                      <option value={10}>Top 10</option>
                    </select>
                  </div>

                  <button
                    onClick={handleFetchRecommendationsLsi}
                    disabled={isRecommending}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2 shrink-0 disabled:opacity-50"
                  >
                    {isRecommending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    맞춤 공고 추천 실행
                  </button>
                </div>
              </div>

              {analysisError && (
                <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-xl text-xs text-rose-300">
                  ⚠️ {analysisError}
                </div>
              )}

              {recommendations.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* 좌측: 추천 공고 목록 */}
                  <div className="lg:col-span-6 space-y-4">
                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                      <Building2 className="w-4 h-4" /> 추천 공고 Top {recommendations.length}
                    </h3>

                    <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                      {recommendations.map((job) => {
                        const isSelected = selectedJob?.rank === job.rank;
                        const isExpanded = !!expandedJobDetails[job.rank];

                        return (
                          <div
                            key={job.rank}
                            onClick={() => handleSelectJob(job)}
                            className={`cursor-pointer transition-all p-5 rounded-2xl border ${
                              isSelected
                                ? 'bg-[#130E3D] border-indigo-500 shadow-lg ring-1 ring-indigo-500'
                                : 'bg-[#0a1024] border-indigo-950/80 hover:border-indigo-800/60 opacity-80 hover:opacity-100'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${
                                  isSelected 
                                    ? 'bg-indigo-600 text-white border-indigo-400' 
                                    : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                                }`}>
                                  {job.rank}위 추천
                                </span>
                                {isSelected && (
                                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
                                    <Check className="w-3 h-3" /> 선택됨
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-extrabold text-amber-400">일치도 {job.similarity_score}%</span>
                            </div>

                            <div>
                              <h4 className="text-sm font-bold text-white truncate">{job.title}</h4>
                              <p className="text-xs text-slate-400 mt-0.5">{job.company}</p>
                            </div>

                            {job.matched_keywords && job.matched_keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-3">
                                {job.matched_keywords.map((kw, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-[#07051a] text-indigo-300 border border-indigo-950 text-[10px] font-semibold rounded-md">
                                    #{kw}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="mt-4 pt-3 border-t border-indigo-950 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={(e) => toggleJobDetailExpand(job.rank, e)}
                                className="text-xs font-semibold text-indigo-300 hover:text-white flex items-center gap-1"
                              >
                                <Info className="w-3.5 h-3.5 text-indigo-400" />
                                {isExpanded ? "상세 정보 접기" : "공고 상세 자격 보기"}
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>

                              {job.job_url && (
                                <a
                                  href={job.job_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                                >
                                  원문 <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>

                            {isExpanded && (
                              <div className="mt-3 p-4 bg-[#07051a] rounded-xl border border-indigo-950 text-xs text-slate-300 space-y-2">
                                <p className="leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                                  {job.full_jd_text || "세부 공고 내용이 없습니다."}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {topKeywords.length > 0 && (
                      <div className="bg-[#0a1024] border border-indigo-950/80 rounded-2xl p-5 shadow-lg space-y-3">
                        <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-indigo-400" /> 주요 요구 기술 키워드
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {topKeywords.map((item, idx) => (
                            <span key={idx} className="px-2.5 py-1 bg-[#07051a] text-slate-300 border border-indigo-950 text-xs rounded-lg">
                              {item.keyword} <strong className="text-indigo-400">{item.count}회</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 우측: 피드백 분석 영역 */}
                  <div className="lg:col-span-6 space-y-4">
                    <div className="bg-[#0a1024] border border-indigo-950/80 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold text-amber-400">AI 역량 피드백 분석</span>
                        <h3 className="text-sm font-bold text-white mt-0.5">
                          {selectedJob ? `[${selectedJob.company}] ${selectedJob.title}` : "공고를 선택해주세요."}
                        </h3>
                      </div>

                      <button
                        onClick={handleRunFeedbackAnalysis}
                        disabled={!selectedJob || isAnalyzingFeedback}
                        className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2 shrink-0 disabled:opacity-40"
                      >
                        {isAnalyzingFeedback ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        {feedbackReport && analyzedJobRank === selectedJob?.rank ? "피드백 다시 실행" : "AI 피드백 실행"}
                      </button>
                    </div>

                    {feedbackReport && analyzedJobRank === selectedJob?.rank ? (
                      <div className="bg-[#0a1024] border border-indigo-950/80 rounded-2xl p-6 shadow-xl space-y-6 animate-fadeIn">
                        <div className="bg-[#07051a] border border-indigo-950 rounded-xl p-4 space-y-2">
                          <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                            <BarChart3 className="w-4 h-4" /> 맞춤 분석 총평
                          </span>
                          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
                            {feedbackReport.match_summary}
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div className="bg-[#07051a] border border-emerald-950/80 rounded-xl p-4 space-y-2">
                            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle className="w-4 h-4" /> 자소서의 주요 강점
                            </span>
                            <ul className="space-y-1 text-xs text-slate-300">
                              {feedbackReport.strengths?.map((item, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <span className="text-emerald-400">•</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="bg-[#07051a] border border-amber-950/80 rounded-xl p-4 space-y-2">
                            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4" /> 보완이 필요한 역량 및 키워드
                            </span>
                            <ul className="space-y-1 text-xs text-slate-300">
                              {feedbackReport.missing_skills?.map((item, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <span className="text-amber-400">•</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="bg-[#07051a] border border-indigo-950/80 rounded-xl p-4 space-y-2">
                            <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                              <Lightbulb className="w-4 h-4" /> 합격률을 높이기 위한 자소서 개선 제안
                            </span>
                            <ul className="space-y-1 text-xs text-slate-300">
                              {feedbackReport.improvement_suggestions?.map((item, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <span className="text-indigo-400">•</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#0a1024] border border-indigo-950/80 rounded-2xl p-10 text-center text-slate-400 text-xs italic flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 text-indigo-400 opacity-60" />
                        <span>{selectedJob ? `[${selectedJob.company}] 공고가 선택되었습니다. 피드백 실행 버튼을 눌러주세요.` : "공고를 선택한 후 피드백을 실행해 주세요."}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-[#0a1024] border border-indigo-950/80 rounded-2xl p-12 text-center text-slate-400 text-xs">
                  상단의 **[맞춤 공고 추천 실행]** 버튼을 눌러 채용 공고를 추천받아보세요.
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default CoverLetterDetail;