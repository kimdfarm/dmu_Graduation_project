import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit3, Loader2, Download, Briefcase, 
  CheckCircle2, ChevronDown, ChevronUp, Sparkles,
  FileText, Cpu, Search, Building2, ExternalLink,
  CheckCircle, AlertTriangle, Lightbulb, BarChart3, Tag, Check, Info, RefreshCw , 
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const generateUniqueId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11);
};

const parseDetailsToTableSchema = (details, secColumns = [], currentVersion = 'ORIGINAL') => {
  const dynamicColumns = Array.isArray(secColumns) && secColumns.length > 0
    ? [...secColumns]
    : ['질문', '답변'];

  if (!details || details.length === 0) {
    return { columns: dynamicColumns, rows: [] };
  }

  const extractedRows = details.map((detail) => {
    const rowValues = {};

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

          if (!dynamicColumns.includes(colName)) {
            dynamicColumns.push(colName);
          }
        }
      });

      if (Object.keys(rowValues).length === 0 && targetText) {
        const col1 = dynamicColumns[0] || '질문';
        const col2 = dynamicColumns[1] || '답변';
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

  return { columns: dynamicColumns, rows: extractedRows };
};



const CoverLetterDetail = () => {
  const { coverLetterId } = useParams();
  const navigate = useNavigate();

  // 메인 탭 상태 ('document' | 'analysis')
  const [activeMainTab, setActiveMainTab] = useState('document');

  const [coverLetter, setCoverLetter] = useState(null);
  const [sections, setSections] = useState([]);
  
  const [sectionVersions, setSectionVersions] = useState({});
  const [processingSections, setProcessingSections] = useState({});

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [expandedCells, setExpandedCells] = useState({});

  // 🤖 AI 추천 및 설정 상태
  const [topN, setTopN] = useState(3);
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [topKeywords, setTopKeywords] = useState([]);
  
  // 선택된 공고 및 상세 보기 토글 상태
  const [selectedJob, setSelectedJob] = useState(null);
  const [expandedJobDetails, setExpandedJobDetails] = useState({});
  const [isAnalyzingFeedback, setIsAnalyzingFeedback] = useState(false);
  const [feedbackReport, setFeedbackReport] = useState(null);
  const [analyzedJobRank, setAnalyzedJobRank] = useState(null); // 💡 피드백이 완료된 공고의 Rank 추적
  const [analysisError, setAnalysisError] = useState('');

  // 💡 추천 개수 및 추천 방식(LSI / EMBEDDING) 상태 추가
  const [recommendEngine, setRecommendEngine] = useState('lsi'); // 'lsi' 또는 'embedding'
  const [isEmbeddingLocked, setIsEmbeddingLocked] = useState(false);
  // LSI 추천 실행 함수
const handleFetchRecommendationsLsi = async () => {
  await executeRecommendation(`${API_URL}/api/recommend`);
};

// 임베딩 추천 실행 함수 (프리미엄 체크 가능)
const handleFetchRecommendationsEmbedding = async () => {
  if (isEmbeddingLocked) {
    alert("프리미엄 회원 전용 기능입니다.");
    return;
  }
  await executeRecommendation(`${API_URL}/api/recommend/embedding`);
};

// 공통 실행 로직 함수
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

    const recRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_resume: currentResumeText,
        top_n: parseInt(topN, 10)
      })
    });

    if (!recRes.ok) throw new Error('공고 추천을 불러오는 중 오류가 발생했습니다.');
    const recData = await recRes.json();
    
    setRecommendations(recData.recommendations || []);
    setTopKeywords(recData.top_tech_keywords || []);

    if (recData.recommendations && recData.recommendations.length > 0) {
      setSelectedJob(recData.recommendations[0]);
    }
  } catch (err) {
    console.error('공고 추천 실패:', err);
    setAnalysisError(err.message);
  } finally {
    setIsRecommending(false);
  }
};
  


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

  // 💡 공고 카드 선택 처리 함수 (다른 공고 선택 시 기존 피드백 리셋하여 왜곡 방지)
  const handleSelectJob = (job) => {
    if (selectedJob?.rank !== job.rank) {
      setSelectedJob(job);
      // 이전에 피드백을 받은 공고와 다른 공고를 선택하면 피드백 리포트를 리셋
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

  const handleAIProofreadSection = async (sectionId) => {
    setSectionVersions((prev) => ({ ...prev, [sectionId]: 'AI' }));

    const targetSection = sections.find((s) => s.id === sectionId);
    if (!targetSection || !targetSection.details) return;

    try {
      setProcessingSections((prev) => ({ ...prev, [sectionId]: 'AI' }));

      const response = await fetch(`${API_URL}/api/sections/${sectionId}/ai-proofread`, {
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
              const proofreadItem = Array.isArray(result)
                ? result.find((item) => item.id === detail.id)
                : null;
              return proofreadItem
                ? { ...detail, ai_proofread_text: proofreadItem.ai_proofread_text }
                : detail;
            });
            return { ...sec, details: updatedDetails };
          })
        );
      }
    } catch (err) {
      console.error('AI 교정 API 오류:', err);
    } finally {
      setProcessingSections((prev) => ({ ...prev, [sectionId]: null }));
    }
  };

  // 1단계: 커스텀 개수(topN) 기반 맞춤 공고 추천 실행
  const handleFetchRecommendations = async () => {
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

      // ✅ 올바르게 async 함수 내부에 위치한 API 호출부
      const endpoint = recommendEngine === 'embedding' 
        ? `${API_URL}/api/recommend/embedding` 
        : `${API_URL}/api/recommend`;

      const recRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_resume: currentResumeText,
          top_n: parseInt(topN, 10)
        }),
        signal: controller.signal // 👈 타임아웃 시그널 연결
      });

      // 요청이 성공하면 타이머 해제
      clearTimeout(timeoutId);

      if (!recRes.ok) {
        throw new Error(`서버 응답 오류: ${recRes.status}`);
      }

      if (!recRes.ok) throw new Error('공고 추천을 불러오는 데 실패했습니다.');
      const recData = await recRes.json();
      
      setRecommendations(recData.recommendations || []);
      setTopKeywords(recData.top_tech_keywords || []);

      if (recData.recommendations && recData.recommendations.length > 0) {
        setSelectedJob(recData.recommendations[0]);
      }
    } catch (err) {
      console.error('공고 추천 실패:', err);
      setAnalysisError(err.message);
    } finally {
      setIsRecommending(false);
    }
  };

  // 2단계: 선택된 공고 기반 AI 역량 피드백 분석 실행
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
      setAnalyzedJobRank(selectedJob.rank); // 피드백이 완료된 공고 Rank 기록

    } catch (err) {
      console.error('피드백 분석 실패:', err);
      setAnalysisError(err.message);
    } finally {
      setIsAnalyzingFeedback(false);
    }
  };

  const userId = localStorage.getItem('userId');

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

            const aiMap = {};
            if (Array.isArray(sec.ai_proofread_text)) {
              sec.ai_proofread_text.forEach((item) => {
                if (item && item.id) aiMap[item.id] = item.ai_proofread_text || '';
              });
            }

            const updatedDetails = (sec.details || []).map((detail) => ({
              ...detail,
              spell_checked_text: spellMap[detail.id] || detail.spell_checked_text || '',
              ai_proofread_text: aiMap[detail.id] || detail.ai_proofread_text || ''
            }));

            return { ...sec, details: updatedDetails };
          });

          setSections(parsedSections);

          const initialVersions = {};
          parsedSections.forEach((sec) => {
            initialVersions[sec.id] = sec.selected_version || 'ORIGINAL';
          });
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

  const getColumnWidthClass = (colName, textValue = '') => {
    const isDetail = colName.includes('내용') || colName.includes('답변') || colName.includes('작성') || colName.includes('경험');
    const isShort = colName.includes('제목') || colName.includes('문항') || colName.includes('항목');

    if (isDetail || textValue.length > 80) return 'flex-[3] min-w-[400px]';
    if (isShort || textValue.length < 20) return 'flex-[1] min-w-[180px] max-w-[260px]';
    return 'flex-[1.5] min-w-[200px]';
  };

  const formattedSections = sections.map((sec) => {
    const secVersion = sectionVersions[sec.id] || sec.selected_version || 'ORIGINAL';
    const { columns, rows } = parseDetailsToTableSchema(sec.details, sec.columns, secVersion);
    return { ...sec, columns, rows, currentVersion: secVersion };
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#07051E] flex flex-col items-center justify-center text-slate-300 gap-3 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm">자기소개서를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07051E] text-slate-100 p-4 sm:p-8 font-sans">
      <div className="w-full max-w-[3200px] mx-auto space-y-6">
        
        {/* 상단 컨트롤 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0E0B2D] p-5 rounded-2xl border border-indigo-950 shadow-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/cover-letter')}
              className="p-2 bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-800/50 rounded-xl text-slate-300 hover:text-white transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold rounded-full">
                  {coverLetter?.category || '자기소개서'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">
                {coverLetter?.title || '자기소개서 상세'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              onClick={() => navigate(`/cover-letter/${coverLetterId}/edit`)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#130E3D] hover:bg-[#1A144E] text-indigo-200 font-semibold text-xs sm:text-sm rounded-xl transition-all border border-indigo-800/60 shadow-sm"
            >
              <Edit3 className="w-4 h-4 text-indigo-400" />
              구성 편집
            </button>

            <button
              onClick={() => navigate(`/cover-letter/${coverLetterId}/download`)}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-lg transition-all"
            >
              <Download className="w-4 h-4" />
              PDF 다운로드
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-xl text-xs text-rose-300">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* 상단 메인 탭 메뉴 */}
        <div className="flex items-center gap-2 border-b border-indigo-950 pb-1">
          <button
            onClick={() => setActiveMainTab('document')}
            className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm rounded-t-xl transition-all border-t border-x ${
              activeMainTab === 'document'
                ? 'bg-[#0E0B2D] text-indigo-300 border-indigo-800/80 shadow-lg'
                : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <FileText className="w-4 h-4 text-indigo-400" />
            자기소개서 문항 및 작성본
          </button>

          <button
            onClick={() => setActiveMainTab('analysis')}
            className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm rounded-t-xl transition-all border-t border-x ${
              activeMainTab === 'analysis'
                ? 'bg-[#0E0B2D] text-amber-300 border-indigo-800/80 shadow-lg'
                : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent'
            }`}
          >
            <Cpu className="w-4 h-4 text-amber-400" />
            AI 공고 추천 & 역량 피드백 리포트
          </button>
        </div>

        {/* TAB 1: 자기소개서 문항 및 작성본 */}
        {activeMainTab === 'document' && (
          <div className="space-y-8">
            {formattedSections.map((sec) => (
              <div key={sec.id} className="bg-[#0E0B2D] border border-indigo-950 rounded-2xl p-6 shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-900/40 pb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-indigo-400" />
                      {sec.section_title || '자기소개서 문항'}
                    </h2>
                    <span className="text-xs text-indigo-400 font-semibold bg-indigo-950 px-3 py-1 rounded-full border border-indigo-900">
                      총 {sec.rows ? sec.rows.length : 0}개 질문
                    </span>
                  </div>

                  <div className="flex items-center gap-1 bg-[#07051E] p-1.5 rounded-xl border border-indigo-900/60 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleSectionVersionChange(sec.id, 'ORIGINAL')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        sec.currentVersion === 'ORIGINAL'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-indigo-950/60'
                      }`}
                    >
                      원본
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSpellCheckSection(sec.id)}
                      disabled={processingSections[sec.id] === 'SPELL'}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        sec.currentVersion === 'SPELL'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-indigo-950/60'
                      }`}
                    >
                      {processingSections[sec.id] === 'SPELL' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      ) : (
                        '맞춤법'
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAIProofreadSection(sec.id)}
                      disabled={processingSections[sec.id] === 'AI'}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        sec.currentVersion === 'AI'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-indigo-950/60'
                      }`}
                    >
                      {processingSections[sec.id] === 'AI' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          AI 교정
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {sec.rows && sec.rows.length > 0 ? (
                    sec.rows.map((row, rIdx) => (
                      <div key={row.id} className="bg-[#07051E] border border-indigo-900/60 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-indigo-950 pb-2">
                          <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 문항 #{rIdx + 1}
                          </span>
                        </div>

                        <div className="overflow-x-auto pb-2">
                          <div className="flex gap-4 min-w-full items-start">
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
                                  className={`${widthClass} bg-[#0B0826] p-3 rounded-xl border border-indigo-950 flex flex-col transition-all duration-200 ${
                                    isExpanded ? 'h-auto' : 'h-28'
                                  }`}
                                >
                                  <span className="text-[11px] font-bold text-indigo-300 border-b border-indigo-950 pb-1 mb-1.5 truncate shrink-0">
                                    {col}
                                  </span>

                                  <div className="relative flex-1 overflow-hidden">
                                    <div className={`text-xs text-slate-200 leading-snug font-sans ${!isExpanded && isLongContent ? 'max-h-10 overflow-hidden' : ''}`}>
                                      {val ? (
                                        lines.map((line, lIdx) => {
                                          const clean = line.replace(/^[•\-\*\s]+/, '').trim();
                                          if (!clean) return null;
                                          return (
                                            <div key={lIdx} className="flex items-start gap-1 my-0.5">
                                              <span className="text-indigo-400 shrink-0">•</span>
                                              <span className="break-all">{clean}</span>
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <span className="text-slate-600 italic text-[11px]">내용 없음</span>
                                      )}
                                    </div>

                                    {!isExpanded && isLongContent && (
                                      <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[#0B0826] to-transparent pointer-events-none" />
                                    )}
                                  </div>

                                  {isLongContent && (
                                    <button
                                      onClick={() => toggleCellExpand(cellKey)}
                                      className="mt-1 pt-1 border-t border-indigo-950/80 text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center justify-center gap-1 w-full shrink-0 transition-colors"
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
            ))}
          </div>
        )}

        {/* TAB 2: AI 채용 공고 추천 & 역량 피드백 분석 */}
        {activeMainTab === 'analysis' && (
          <div className="space-y-6">
            
            {/* 1단계 배너 내부 오른쪽 버튼 그룹 영역 */}
            {/* 1단계 배너 내부 오른쪽 버튼 그룹 영역 */}
<div className="flex flex-wrap items-center gap-3 self-end sm:self-auto">

  {/* 추천 개수 선택 드롭다운 */}
  <div className="flex items-center gap-2 bg-[#07051E] px-3 py-2 rounded-xl border border-indigo-900/80">
    <span className="text-xs font-semibold text-indigo-300">개수:</span>
    <select
      value={topN}
      onChange={(e) => setTopN(e.target.value)}
      className="bg-[#0B0826] text-white text-xs font-bold outline-none cursor-pointer rounded-lg px-2 py-1 border border-indigo-800"
    >
      <option value={3}>Top 3</option>
      <option value={5}>Top 5</option>
      <option value={10}>Top 10</option>
    </select>
  </div>

  {/* LSI형 추천 실행 버튼 */}
  <button
    onClick={handleFetchRecommendationsLsi}
    disabled={isRecommending}
    className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
  >
    <Search className="w-4 h-4" />
    LSI형 맞춤 공고 추천
  </button>

  {/* 임베딩형 맞춤 공고 추천 실행 버튼 (프리미엄 전용)
  아직 서버 부족으로 인한 주석처리 */}
  {/* 
  <button
    onClick={handleFetchRecommendationsEmbedding}
    disabled={isRecommending}
    className={`px-4 py-3 font-bold text-xs sm:text-sm rounded-xl shadow-lg transition-all flex items-center gap-2 shrink-0 disabled:opacity-50 ${
      isEmbeddingLocked 
        ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed' 
        : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white'
    }`}
  >
    <Sparkles className="w-4 h-4 text-amber-300" />
    임베딩형 추천 {isEmbeddingLocked && "🔒 (프리미엄)"}
  </button>
    */}
</div>

            {analysisError && (
              <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-xl text-xs text-rose-300">
                ⚠️ {analysisError}
              </div>
            )}

            {/* 추천 공고 목록 & 상세보기 & AI 피드백 영역 */}
            {recommendations.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* 좌측: 추천 공고 목록 (독립 스크롤 영역 `max-h-[520px]` 설정) */}
                <div className="lg:col-span-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-md font-bold text-indigo-300 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-400" />
                      추천 공고 Top {recommendations.length} (분석할 공고를 선택하세요)
                    </h3>
                  </div>

                  {/* 💡 커스텀 스크롤 컨테이너: 10개 이상이어도 하단 '주요 요구 기술'이 밀리지 않음 */}
                  <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2 custom-scrollbar">
                    {recommendations.map((job) => {
                      const isSelected = selectedJob?.rank === job.rank;
                      const isExpanded = !!expandedJobDetails[job.rank];

                      return (
                        <div
                          key={job.rank}
                          onClick={() => handleSelectJob(job)}
                          className={`cursor-pointer transition-all p-5 rounded-2xl border ${
                            isSelected
                              ? 'bg-[#130E3D] border-indigo-500 shadow-indigo-500/10 shadow-lg ring-1 ring-indigo-500'
                              : 'bg-[#0E0B2D] border-indigo-950 hover:border-indigo-800/60 opacity-80 hover:opacity-100'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${
                                isSelected 
                                  ? 'bg-indigo-500 text-white border-indigo-400' 
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

                            <span className="text-xs font-extrabold text-amber-400">
                              일치도 {job.similarity_score}%
                            </span>
                          </div>

                          <div>
                            <h4 className="text-sm font-bold text-white truncate">{job.title}</h4>
                            <p className="text-xs text-slate-400 mt-0.5">{job.company}</p>
                          </div>

                          {job.matched_keywords && job.matched_keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-3">
                              {job.matched_keywords.map((kw, i) => (
                                <span key={i} className="px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-900 text-[10px] font-semibold rounded-md">
                                  #{kw}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="mt-4 pt-3 border-t border-indigo-900/40 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={(e) => toggleJobDetailExpand(job.rank, e)}
                              className="text-xs font-semibold text-indigo-300 hover:text-white flex items-center gap-1 transition-colors"
                            >
                              <Info className="w-3.5 h-3.5 text-indigo-400" />
                              {isExpanded ? "공고 상세 정보 접기" : "공고 상세 자격 및 조건 보기"}
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
                                원문 사이트 <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>

                          {isExpanded && (
                            <div className="mt-3 p-4 bg-[#07051E] rounded-xl border border-indigo-900/60 text-xs text-slate-300 space-y-3 font-sans">
                              <div>
                                <strong className="text-indigo-400 block mb-1">📄 공고 본문 내용 (요약):</strong>
                                <p className="leading-relaxed bg-[#0B0826] p-3 rounded-lg border border-indigo-950 max-h-48 overflow-y-auto whitespace-pre-wrap">
                                  {job.full_jd_text || "세부 공고 내용이 제공되지 않았습니다."}
                                </p>
                              </div>
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>

                  {/* 주요 요구 기술 영역 (공고 목록 스크롤과 독립되어 항상 깔끔하게 표시됨) */}
                  {topKeywords.length > 0 && (
                    <div className="bg-[#0E0B2D] border border-indigo-950 rounded-2xl p-5 shadow-lg space-y-3">
                      <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-indigo-400" />
                        추천 공고군 주요 요구 기술
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {topKeywords.map((item, idx) => (
                          <span key={idx} className="px-2.5 py-1 bg-[#07051E] text-slate-300 border border-indigo-900/60 text-xs rounded-lg">
                            {item.keyword} <strong className="text-indigo-400">{item.count}회</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 우측: 2단계 AI 역량 피드백 분석 (선택 변경 시 자동 비움/독립 실행) */}
                <div className="lg:col-span-6 space-y-4">
                  
                  <div className="bg-[#0E0B2D] border border-indigo-950 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold text-amber-400">2단계: AI 역량 피드백 분석</span>
                      <h3 className="text-sm font-bold text-white mt-0.5">
                        {selectedJob ? (
                          <>분석 대상 공고: <span className="text-indigo-300">[{selectedJob.company}] {selectedJob.title}</span></>
                        ) : (
                          "좌측에서 분석할 공고를 선택해주세요."
                        )}
                      </h3>
                    </div>

                    <button
                      onClick={handleRunFeedbackAnalysis}
                      disabled={!selectedJob || isAnalyzingFeedback}
                      className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 shrink-0 disabled:opacity-40"
                    >
                      {isAnalyzingFeedback ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          LLM 분석 실행 중...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          {feedbackReport && analyzedJobRank === selectedJob?.rank ? "피드백 다시 실행" : "선택 공고 기반 AI 피드백 실행"}
                        </>
                      )}
                    </button>
                  </div>

                  {/* 💡 피드백 결과 카드 (선택된 공고와 일치할 때만 표시) */}
                  {feedbackReport && analyzedJobRank === selectedJob?.rank ? (
                    <div className="bg-[#0E0B2D] border border-indigo-950 rounded-2xl p-6 shadow-xl space-y-6 animate-fadeIn">
                      
                      <div className="bg-[#07051E] border border-indigo-900/60 rounded-xl p-4 space-y-2">
                        <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                          <BarChart3 className="w-4 h-4" /> [{selectedJob?.company}] 맞춤 분석 총평
                        </span>
                        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
                          {feedbackReport.match_summary}
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div className="bg-[#07051E] border border-emerald-950/80 rounded-xl p-4 space-y-2">
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

                        <div className="bg-[#07051E] border border-amber-950/80 rounded-xl p-4 space-y-2">
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

                        <div className="bg-[#07051E] border border-indigo-900/80 rounded-xl p-4 space-y-2">
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
                    <div className="bg-[#0E0B2D] border border-indigo-950 rounded-2xl p-10 text-center text-slate-400 text-xs italic flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 text-indigo-400 opacity-60" />
                      <span>
                        {selectedJob
                          ? `[${selectedJob.company}] 공고가 선택되었습니다. 위 버튼을 누르면 AI 분석이 실행됩니다.`
                          : "공고를 선택하신 후 피드백 분석 실행 버튼을 클릭해 주세요."}
                      </span>
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="bg-[#0E0B2D] border border-indigo-950 rounded-2xl p-12 text-center text-slate-400 text-xs">
                상단의 **[1단계: 맞춤 공고 추천 실행]** 버튼을 눌러 채용 DB의 맞춤 공고를 추천받아보세요.
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default CoverLetterDetail;