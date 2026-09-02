import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import html2canvas from 'html2canvas';
import { 
  ArrowLeft, Image as ImageIcon, Code, Printer, 
  GripVertical, ChevronUp, ChevronDown, Loader2, Globe2,
  FileText, Layout, Award, CheckCircle2, ChevronDown as ChevronIcon
} from 'lucide-react';

const BASE_URL = 'http://localhost:8000';

const parseDetailsToTableSchema = (details, secColumns = [], secVersion = 'ORIGINAL') => {
  const dynamicColumns = Array.isArray(secColumns) && secColumns.length > 0
    ? [...secColumns]
    : ['질문', '답변'];

  if (!details || details.length === 0) {
    return { columns: dynamicColumns, rows: [] };
  }

  const extractedRows = details.map((detail) => {
    const rowValues = {};

    let textToParse = detail.original_text || '';
    if (secVersion === 'SPELL' && detail.spell_checked_text) {
      textToParse = detail.spell_checked_text;
    } else if (secVersion === 'AI' && detail.ai_proofread_text) {
      textToParse = detail.ai_proofread_text;
    }

    if (detail.values && typeof detail.values === 'object') {
      Object.assign(rowValues, detail.values);
    } else if (textToParse) {
      const blocks = textToParse.split(/\n\n(?=\[)/);
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

      if (Object.keys(rowValues).length === 0 && textToParse) {
        const col1 = dynamicColumns[0] || '질문';
        const col2 = dynamicColumns[1] || '답변';
        rowValues[col1] = detail.title || '';
        rowValues[col2] = textToParse.replace(/^[•\-\*\s]+/gm, '').trim();
      }
    }

    return {
      id: detail.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString()),
      title: detail.title || '',
      values: rowValues
    };
  });

  return { columns: dynamicColumns, rows: extractedRows };
};

const CoverLetterDownload = () => {
  const { coverLetterId } = useParams();
  const navigate = useNavigate();
  const printRef = useRef(null);

  const [coverLetter, setCoverLetter] = useState(null);
  const [orderedSections, setOrderedSections] = useState([]);
  const [selectedStyle, setSelectedStyle] = useState('US_ATS');
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone_number: '',
    birth_date: '',
    gender: 'M',
    address: '',
    detail_address: ''
  });

  const [isLoading, setIsLoading] = useState(true);
  const [downloadingFormat, setDownloadingFormat] = useState(null);

  const userId = localStorage.getItem('userId');

  const mainStyleOptions = [
    {
      id: 'US_ATS',
      country: '미국 / 북미',
      flag: '🇺🇸',
      name: '미국 ATS 최적화 Cover Letter',
      desc: '단일 칼럼, 흑백 중심의 깔끔하고 가독성 높은 미국 표준',
      icon: FileText,
      badge: 'ATS'
    },
    {
      id: 'UK_EU',
      country: '영국 / 유럽',
      flag: '🇬🇧',
      name: '유럽형 2단 Curriculum Vitae',
      desc: '신뢰감을 주는 네이비 포인트와 체계적인 라이너 구획',
      icon: Layout,
      badge: 'CV'
    },
    {
      id: 'DE_CV',
      country: '독일',
      flag: '🇩🇪',
      name: '독일 Lebenslauf 스타일',
      desc: '2열 분할 레이아웃으로 직관적이고 정확성을 강조',
      icon: Globe2,
      badge: '표준'
    },
    {
      id: 'JP_MODERN',
      country: '일본',
      flag: '🇯🇵',
      name: '일본 모던 자기소개서',
      desc: '전통 격자 구조를 렌더링한 정갈하고 격식 있는 서식',
      icon: Award,
      badge: '정규'
    }
  ];

  useEffect(() => {
    if (!userId) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    const fetchAllData = async () => {
      try {
        setIsLoading(true);

        const profileRes = await fetch(`${BASE_URL}/users/${userId}`);
        if (profileRes.ok) {
          const result = await profileRes.json();
          const data = result.data ? result.data : result;
          setProfile({
            name: data.name || '',
            email: data.email || '',
            phone_number: data.phone_number || '',
            birth_date: data.birth_date || '',
            gender: data.gender || 'M',
            address: data.address || '',
            detail_address: data.detail_address || ''
          });
        }

        const coverRes = await fetch(`${BASE_URL}/api/cover-letters/${coverLetterId}`);
        if (!coverRes.ok) throw new Error('자기소개서 정보를 불러오는데 실패했습니다.');

        const coverData = await coverRes.json();
        setCoverLetter(coverData);

        if (coverData.sections && Array.isArray(coverData.sections)) {
          const parsedSections = coverData.sections.map((sec) => {
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

            const secVersion = sec.selected_version || 'ORIGINAL';
            const { columns, rows } = parseDetailsToTableSchema(updatedDetails, sec.columns, secVersion);

            return {
              ...sec,
              details: updatedDetails,
              columns,
              rows,
              currentVersion: secVersion
            };
          });

          setOrderedSections(parsedSections);
        }
      } catch (err) {
        console.error('데이터 로딩 실패:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (coverLetterId) fetchAllData();
  }, [coverLetterId, userId, navigate]);

  const handleOnDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(orderedSections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setOrderedSections(items);
  };

  const moveUp = (index) => {
    if (index === 0) return;
    const items = [...orderedSections];
    const temp = items[index];
    items[index] = items[index - 1];
    items[index - 1] = temp;
    setOrderedSections(items);
  };

  const moveDown = (index) => {
    if (index === orderedSections.length - 1) return;
    const items = [...orderedSections];
    const temp = items[index];
    items[index] = items[index + 1];
    items[index + 1] = temp;
    setOrderedSections(items);
  };

  const downloadPNG = async () => {
    if (!printRef.current) return;
    setDownloadingFormat('png');
    try {
      const canvas = await html2canvas(printRef.current, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#ffffff' 
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `${profile.name || 'Application'}_${selectedStyle}_CoverLetter.png`;
      link.click();
    } catch (err) {
      console.error('PNG 저장 실패:', err);
      alert('PNG 저장 중 오류가 발생했습니다.');
    } finally {
      setDownloadingFormat(null);
    }
  };

  const downloadHTML = () => {
    if (!printRef.current) return;
    setDownloadingFormat('html');
    const content = printRef.current.innerHTML;
    const fileName = `${profile.name || 'Application'}_${selectedStyle}_CoverLetter`;
    const fullHtml = `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <title>${fileName}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page { size: A4 portrait; margin: 8mm; }
          @media print {
            html, body {
              width: 210mm;
              background: #ffffff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .section-block { 
              page-break-inside: avoid !important; 
              break-inside: avoid !important; 
            }
          }
          td, div { word-break: keep-all !important; overflow-wrap: break-word !important; }
        </style>
      </head>
      <body style="background-color: #f3f4f6; padding: 1rem; display: flex; justify-content: center; font-family: sans-serif;">
        <div style="background-color: #ffffff; color: #000000; width: 210mm; padding: 8mm; box-sizing: border-box;">
          ${content}
        </div>
      </body>
      </html>
    `;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.html`;
    link.click();
    setDownloadingFormat(null);
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `${profile.name || 'Application'}_${selectedStyle}_CoverLetter`;
    window.print();
    document.title = originalTitle;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#07051E] flex flex-col items-center justify-center text-slate-300 gap-3 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm">글로벌 양식을 불러오는 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07051E] text-slate-100 p-4 sm:p-8 font-sans">
      
      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm;
        }

        @media print {
          body { background: #ffffff !important; }
          .no-print { display: none !important; }
          .print-area { 
            width: 100% !important; 
            padding: 0 !important; 
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .section-block {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }

        .cover-paper {
          background-color: #ffffff !important;
          color: #111827 !important;
        }
        
        .cover-paper td, .cover-paper div {
          word-break: keep-all !important;
          word-wrap: break-word !important;
        }
      `}</style>

      {/* 헤더 */}
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-6 no-print">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>뒤로가기</span>
        </button>
        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          4대 국가별 이력서 커스텀 & 내보내기
        </h1>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 좌측 제어 패널 */}
        <div className="lg:col-span-5 space-y-6 no-print">
          
          {/* 국가별 양식 선택 패널 */}
          <div className="bg-[#0f0c31] border border-indigo-900/50 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-indigo-900/40 pb-3">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Globe2 className="w-5 h-5 text-indigo-400" />
                국가별 양식 선택 (4종)
              </h2>
            </div>

            {/* 빠른 선택 드롭다운 */}
            <div className="relative">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">템플릿 빠른 선택</label>
              <div className="relative">
                <select
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  className="w-full bg-slate-900 border border-indigo-500/50 rounded-lg px-3.5 py-2.5 text-xs text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10 font-medium"
                >
                  {mainStyleOptions.map((style) => (
                    <option key={style.id} value={style.id} className="bg-slate-900 text-slate-200">
                      {style.flag} {style.name} ({style.country})
                    </option>
                  ))}
                </select>
                <ChevronIcon className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            
            {/* 카드 선택 리스트 */}
            <div className="grid grid-cols-1 gap-2.5 pt-1">
              {mainStyleOptions.map((style) => {
                const IconComponent = style.icon;
                const isSelected = selectedStyle === style.id;
                return (
                  <div
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`relative p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'bg-gradient-to-r from-indigo-950/90 to-purple-950/60 border-indigo-500 shadow-md shadow-indigo-950/50 ring-1 ring-indigo-500'
                        : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className={`p-2 rounded-lg border mt-0.5 shrink-0 ${
                      isSelected 
                        ? 'bg-indigo-600 border-indigo-400 text-white' 
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}>
                      <IconComponent className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className={`text-xs font-bold truncate flex items-center gap-1.5 ${isSelected ? 'text-indigo-200' : 'text-slate-200'}`}>
                          <span className="text-base">{style.flag}</span> {style.name}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${
                          isSelected
                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {style.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {style.desc}
                      </p>
                    </div>

                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-1" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 저장 & 내보내기 버튼 */}
          <div className="bg-[#0f0c31] border border-indigo-900/50 rounded-xl p-5 shadow-xl space-y-3">
            <h2 className="text-base font-semibold text-white">이력서 저장 & 내보내기</h2>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={downloadPNG}
                disabled={downloadingFormat !== null}
                className="flex flex-col items-center justify-center gap-1.5 p-3 bg-purple-600/90 hover:bg-purple-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                {downloadingFormat === 'png' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                <span>PNG 이미지</span>
              </button>

              <button
                onClick={downloadHTML}
                disabled={downloadingFormat !== null}
                className="flex flex-col items-center justify-center gap-1.5 p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 border border-slate-700"
              >
                {downloadingFormat === 'html' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Code className="w-4 h-4" />}
                <span>HTML 코드</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex flex-col items-center justify-center gap-1.5 p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>PDF / 인쇄</span>
              </button>
            </div>
          </div>

          {/* 문항 순서 관리 */}
          <div className="bg-[#0f0c31] border border-indigo-900/50 rounded-xl p-5 shadow-xl space-y-4">
            <h2 className="text-base font-semibold text-white">문항 순서 조정</h2>
            <DragDropContext onDragEnd={handleOnDragEnd}>
              <Droppable droppableId="sections">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {orderedSections.map((sec, index) => (
                      <Draggable key={sec.id} draggableId={String(sec.id)} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                              snapshot.isDragging 
                                ? 'bg-indigo-950 border-indigo-500 shadow-lg' 
                                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div {...provided.dragHandleProps} className="text-slate-500 hover:text-slate-300 cursor-grab">
                                <GripVertical className="w-4 h-4" />
                              </div>
                              <span className="text-xs font-medium text-slate-200 truncate">
                                {sec.section_title || `문항 ${index + 1}`}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => moveUp(index)}
                                disabled={index === 0}
                                className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => moveDown(index)}
                                disabled={index === orderedSections.length - 1}
                                className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>

        </div>

        {/* 우측 뷰어 영역 */}
        <div className="lg:col-span-7 flex justify-center overflow-x-auto p-2">
          
          {/* 1.🇺🇸 미국 / 북미 스타일 (US ATS-Friendly) */}
          {selectedStyle === 'US_ATS' && (
            <div 
              ref={printRef}
              className="print-area cover-paper w-[210mm] !bg-white !text-black shadow-2xl border border-gray-300 p-[12mm] text-left leading-normal flex flex-col justify-start space-y-5 font-serif"
            >
              <div className="text-center border-b border-black pb-3 space-y-1">
                <h1 className="text-2xl font-bold uppercase tracking-widest">{profile.name || 'APPLICANT NAME'}</h1>
                <p className="text-xs text-gray-700 font-sans">
                  {profile.email} | {profile.phone_number} | {profile.address}
                </p>
              </div>

              <div className="text-center py-1">
                <h2 className="text-sm font-bold uppercase tracking-wider underline">{coverLetter?.title || 'COVER LETTER STATEMENT'}</h2>
              </div>

              <div className="space-y-5 font-sans">
                {orderedSections.map((sec) => (
                  <div key={sec.id} className="section-block space-y-2">
                    <h3 className="text-xs font-bold text-black uppercase border-b border-black pb-0.5 tracking-wider">
                      {sec.section_title || 'SECTION'}
                    </h3>
                    {sec.rows && sec.rows.map((row) => (
                      <div key={row.id} className="text-xs space-y-2">
                        {(sec.columns || []).map((col) => {
                          const val = row.values[col] || '';
                          if (!val) return null;
                          return (
                            <div key={col} className="space-y-1">
                              <span className="font-semibold text-black block text-[11px] underline">
                                {col}
                              </span>
                              <div className="whitespace-pre-line text-gray-900 leading-relaxed text-[11px] pl-2">{val}</div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. 🇬🇧 영국 / 유럽 스타일 (UK & EU Europass-inspired) */}
          {selectedStyle === 'UK_EU' && (
            <div 
              ref={printRef}
              className="print-area cover-paper w-[210mm] !bg-white !text-slate-900 shadow-2xl border border-gray-300 p-[10mm] text-left leading-normal flex flex-col justify-start space-y-6 font-sans"
            >
              <div className="flex justify-between items-start border-b-2 border-blue-900 pb-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-blue-800 uppercase tracking-widest">CURRICULUM VITAE</span>
                  <h1 className="text-2xl font-bold text-slate-900">{profile.name}</h1>
                  <p className="text-xs text-slate-600">{coverLetter?.title || 'Personal Statement'}</p>
                </div>
                <div className="text-right text-[11px] text-slate-600 space-y-0.5 border-l-2 border-blue-900 pl-3">
                  <div>{profile.email}</div>
                  <div>{profile.phone_number}</div>
                  <div>{profile.address}</div>
                </div>
              </div>

              <div className="space-y-5">
                {orderedSections.map((sec) => (
                  <div key={sec.id} className="section-block space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-blue-900"></div>
                      <h3 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                        {sec.section_title || 'Section'}
                      </h3>
                    </div>
                    <div className="pl-3.5 space-y-2 border-l border-slate-200 ml-0.5">
                      {sec.rows && sec.rows.map((row) => (
                        <div key={row.id} className="text-xs space-y-2">
                          {(sec.columns || []).map((col) => {
                            const val = row.values[col] || '';
                            if (!val) return null;
                            return (
                              <div key={col} className="space-y-1">
                                <span className="font-semibold text-blue-900 text-[11px] block">
                                  [{col}]
                                </span>
                                <div className="whitespace-pre-line text-slate-800 leading-relaxed text-[11px]">{val}</div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. 🇩🇪 독일 스타일 (German Lebenslauf) */}
          {selectedStyle === 'DE_CV' && (
            <div 
              ref={printRef}
              className="print-area cover-paper w-[210mm] !bg-white !text-gray-900 shadow-2xl border border-gray-300 p-[12mm] text-left leading-normal flex flex-col justify-start space-y-6 font-sans"
            >
              <div className="border-b-2 border-gray-800 pb-3 flex justify-between items-baseline">
                <h1 className="text-xl font-bold text-gray-900 tracking-wider">LEBENSLAUF / APPLICATION</h1>
                <span className="text-xs font-medium text-gray-600">{profile.name}</span>
              </div>

              {/* 기본 지원 정보 박스 */}
              <div className="bg-gray-100 p-3 rounded text-xs grid grid-cols-2 gap-2 text-gray-700">
                <div><span className="font-bold">Contact:</span> {profile.email} / {profile.phone_number}</div>
                <div><span className="font-bold">Document:</span> {coverLetter?.title || 'Cover Letter'}</div>
              </div>

              <div className="space-y-6">
                {orderedSections.map((sec) => (
                  <div key={sec.id} className="section-block grid grid-cols-12 gap-4 border-b border-gray-200 pb-4">
                    <div className="col-span-4 text-xs font-bold text-gray-800 uppercase tracking-tight">
                      {sec.section_title || 'Angaben'}
                    </div>
                    <div className="col-span-8 space-y-3">
                      {sec.rows && sec.rows.map((row) => (
                        <div key={row.id} className="text-xs space-y-2">
                          {(sec.columns || []).map((col) => {
                            const val = row.values[col] || '';
                            if (!val) return null;
                            return (
                              <div key={col} className="space-y-1">
                                <span className="font-semibold text-gray-900 text-[11px] block bg-gray-200/60 px-1.5 py-0.5 rounded w-fit">
                                  {col}
                                </span>
                                <div className="whitespace-pre-line text-gray-800 leading-relaxed text-[11px] pl-1">{val}</div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. 🇯🇵 일본 스타일 (Japanese Modern Rirekisho Style) */}
          {selectedStyle === 'JP_MODERN' && (
            <div 
              ref={printRef}
              className="print-area cover-paper w-[210mm] !bg-white !text-gray-900 shadow-2xl border border-gray-300 p-[10mm] text-left leading-normal flex flex-col justify-start space-y-4 font-sans"
            >
              <div className="border-2 border-gray-900 p-3 flex justify-between items-center bg-gray-50">
                <div>
                  <h1 className="text-lg font-bold text-gray-900 tracking-widest">志望動機・自己PR (자기소개서)</h1>
                  <p className="text-xs text-gray-600 mt-0.5">{coverLetter?.title || '지원 서류'}</p>
                </div>
                <div className="text-right text-xs text-gray-800 border-l border-gray-400 pl-3">
                  <div><span className="font-bold">氏名:</span> {profile.name}</div>
                  <div><span className="font-bold">連絡先:</span> {profile.email}</div>
                </div>
              </div>

              <div className="space-y-3">
                {orderedSections.map((sec) => (
                  <div key={sec.id} className="section-block border-2 border-gray-900">
                    <div className="bg-gray-200 border-b-2 border-gray-900 px-3 py-1.5 text-xs font-bold text-gray-900">
                      ■ {sec.section_title || '項目'}
                    </div>
                    <div className="p-3 space-y-3">
                      {sec.rows && sec.rows.map((row) => (
                        <div key={row.id} className="text-xs space-y-2">
                          {(sec.columns || []).map((col) => {
                            const val = row.values[col] || '';
                            if (!val) return null;
                            return (
                              <div key={col} className="space-y-1">
                                <span className="font-bold text-gray-900 text-[11px] block border-b border-gray-300 pb-0.5">
                                  【 {col} 】
                                </span>
                                <div className="whitespace-pre-line text-gray-800 leading-relaxed text-[11px] p-1">{val}</div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default CoverLetterDownload;