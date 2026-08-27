import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Edit3, Loader2, Download, Briefcase, 
  CheckCircle2, ChevronDown, ChevronUp, Sparkles 
} from 'lucide-react';

// ------------------------------------------------------------------
// Table Schema 파싱 로직 (섹션별 선택된 텍스트 버전에 맞춰 동적 파싱)
// ------------------------------------------------------------------
const parseDetailsToTableSchema = (details, secColumns = []) => {
  // DB 섹션의 columns를 그대로 사용 (없을 때만 기본값)
  const dynamicColumns = Array.isArray(secColumns) && secColumns.length > 0
    ? [...secColumns]
    : ['질문', '답변'];

  if (!details || details.length === 0) {
    return { columns: dynamicColumns, rows: [] };
  }

  const extractedRows = details.map((detail) => {
    const rowValues = {};

    // A. details 내부의 JSON 객체(또는 속성)가 직접 존재하면 1:1 매핑
    if (detail.values && typeof detail.values === 'object') {
      Object.assign(rowValues, detail.values);
    } else {
      // B. text 데이터인 경우, [태그] 기반으로 모든 동적 컬럼을 추출
      const text = detail.original_text || '';
      const blocks = text.split(/\n\n(?=\[)/);

      blocks.forEach((block) => {
        const match = block.match(/^\[(.*?)\]\n?([\s\S]*)$/);
        if (match) {
          const colName = match[1].trim();
          const content = match[2].replace(/^[•\-\*\s]+/gm, '').trim();
          rowValues[colName] = content;

          // DB에 없던 신규 컬럼 태그가 텍스트에서 발견되면 columns에 자동 추가
          if (!dynamicColumns.includes(colName)) {
            dynamicColumns.push(colName);
          }
        }
      });

      // 태그가 없는 단순 텍스트인 경우 첫 번째/두 번째 컬럼에 매핑
      if (Object.keys(rowValues).length === 0 && text) {
        const col1 = dynamicColumns[0] || '질문';
        const col2 = dynamicColumns[1] || '답변';
        rowValues[col1] = detail.title || '';
        rowValues[col2] = text.replace(/^[•\-\*\s]+/gm, '').trim();
      }
    }

    return {
      id: detail.id || crypto.randomUUID(),
      title: detail.title || '',
      spell_checked_text: detail.spell_checked_text || null,
      ai_proofread_text: detail.ai_proofread_text || null,
      selected_version: detail.selected_version || 'ORIGINAL',
      values: rowValues
    };
  });

  return { columns: dynamicColumns, rows: extractedRows };
};


const BASE_URL = 'http://localhost:8000';

const CoverLetterDetail = () => {
  const { coverLetterId } = useParams();
  const navigate = useNavigate();

  const [coverLetter, setCoverLetter] = useState(null);
  const [sections, setSections] = useState([]);
  
  // 섹션별 텍스트 선택 버전 관리 상태 ({ [sectionId]: 'ORIGINAL' | 'SPELL' | 'AI' })
  const [sectionVersions, setSectionVersions] = useState({});

  // 섹션별 로딩/교정 처리 상태 ({ [sectionId]: 'SPELL' | 'AI' | null })
  const [processingSections, setProcessingSections] = useState({});

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [expandedCells, setExpandedCells] = useState({});

  const toggleCellExpand = (cellKey) => {
    setExpandedCells((prev) => ({
      ...prev,
      [cellKey]: !prev[cellKey]
    }));
  };

  // 1. 버전 변경
  const handleSectionVersionChange = async (sectionId, version) => {
    setSectionVersions((prev) => ({
      ...prev,
      [sectionId]: version
    }));

    try {
      await fetch(`${BASE_URL}/api/sections/${sectionId}/version`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_version: version })
      });
    } catch (err) {
      console.error('버전 업데이트 실패:', err);
    }
  };

  // 2. 맞춤법 검사 실행
  const handleSpellCheckSection = async (sectionId) => {
    setSectionVersions((prev) => ({ ...prev, [sectionId]: 'SPELL' }));

    const targetSection = sections.find((s) => s.id === sectionId);
    if (!targetSection || !targetSection.details) return;

    const hasUncheckedDetails = targetSection.details.some(
      (d) => !d.spell_checked_text || !d.spell_checked_text.trim()
    );

    if (!hasUncheckedDetails) {
      await fetch(`${BASE_URL}/api/sections/${sectionId}/version`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_version: 'SPELL' })
      });
      return;
    }

    try {
      setProcessingSections((prev) => ({ ...prev, [sectionId]: 'SPELL' }));
      const response = await fetch(`${BASE_URL}/api/sections/${sectionId}/spell-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          details: targetSection.details.map((d) => ({
            id: d.id,
            original_text: d.original_text || ''
          }))
        })
      });

      if (response.ok) {
        const result = await response.json();
        setSections((prevSections) =>
          prevSections.map((sec) => {
            if (sec.id !== sectionId) return sec;
            
            const updatedDetails = sec.details.map((detail) => {
              const checkedItem = result.find((item) => item.id === detail.id);
              return checkedItem
                ? { ...detail, spell_checked_text: checkedItem.spell_checked_text }
                : detail;
            });

            return { 
              ...sec, 
              spell_checked_text: result,
              details: updatedDetails 
            };
          })
        );
      }
    } catch (err) {
      console.error('맞춤법 교정 API 오류:', err);
    } finally {
      setProcessingSections((prev) => ({ ...prev, [sectionId]: null }));
    }
  };

  // 3. AI 교정 실행
  const handleAIProofreadSection = async (sectionId) => {
    setSectionVersions((prev) => ({ ...prev, [sectionId]: 'AI' }));

    const targetSection = sections.find((s) => s.id === sectionId);
    if (!targetSection || !targetSection.details) return;

    const hasUnproofreadDetails = targetSection.details.some((d) => !d.ai_proofread_text);

    try {
      if (hasUnproofreadDetails) {
        setProcessingSections((prev) => ({ ...prev, [sectionId]: 'AI' }));

        const response = await fetch(`${BASE_URL}/api/sections/${sectionId}/ai-proofread`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            details: targetSection.details.map((d) => ({
              id: d.id,
              original_text: d.original_text || ''
            }))
          })
        });

        if (response.ok) {
          const result = await response.json();
          setSections((prevSections) =>
            prevSections.map((sec) => {
              if (sec.id !== sectionId) return sec;

              const updatedDetails = sec.details.map((detail) => {
                const proofreadItem = result.find((item) => item.id === detail.id);
                return proofreadItem
                  ? { ...detail, ai_proofread_text: proofreadItem.ai_proofread_text }
                  : detail;
              });

              return { 
                ...sec, 
                ai_proofread_text: result,
                details: updatedDetails 
              };
            })
          );
        }
      } else {
        await fetch(`${BASE_URL}/api/sections/${sectionId}/version`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ selected_version: 'AI' })
        });
      }
    } catch (err) {
      console.error('AI 교정 API 오류:', err);
    } finally {
      setProcessingSections((prev) => ({ ...prev, [sectionId]: null }));
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

        const res = await fetch(`${BASE_URL}/api/cover-letters/${coverLetterId}`);
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

            return { 
              ...sec, 
              details: updatedDetails 
            };
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

    if (isDetail || textValue.length > 80) {
      return 'flex-[3] min-w-[400px]';
    }
    if (isShort || textValue.length < 20) {
      return 'flex-[1] min-w-[180px] max-w-[260px]';
    }
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
      <div className="w-full max-w-[3200px] mx-auto space-y-8">
        
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

        {/* 자기소개서 문항 및 작성 내용 영역 */}
        <div className="space-y-8">
          {formattedSections.map((sec) => (
            <div key={sec.id} className="bg-[#0E0B2D] border border-indigo-950 rounded-2xl p-6 shadow-xl space-y-6">
              
              {/* 섹션 헤더 & 텍스트 버전을 조절하는 버튼 그룹 */}
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

                {/* 섹션별 버전 전환 버튼 */}
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
                                  <div
                                    className={`text-xs text-slate-200 leading-snug font-sans ${
                                      !isExpanded && isLongContent ? 'max-h-10 overflow-hidden' : ''
                                    }`}
                                  >
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
                                      <>
                                        <span>접기</span>
                                        <ChevronUp className="w-3 h-3" />
                                      </>
                                    ) : (
                                      <>
                                        <span>자세히 보기</span>
                                        <ChevronDown className="w-3 h-3" />
                                      </>
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

      </div>
    </div>
  );
};

export default CoverLetterDetail;