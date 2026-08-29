import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import html2canvas from 'html2canvas';
import { 
  ArrowLeft, Image as ImageIcon, Code, Printer, 
  GripVertical, ChevronUp, ChevronDown, Loader2, Sparkles, Briefcase
} from 'lucide-react';

const BASE_URL = 'http://localhost:8000';

// 자기소개서 상세 세부사항 파싱 함수
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
  const [selectedStyle, setSelectedStyle] = useState('KR');
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

  useEffect(() => {
    if (!userId) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    const fetchAllData = async () => {
      try {
        setIsLoading(true);

        // 유저 프로필 로드
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

        // 자기소개서 정보 로드
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
      link.download = `${profile.name || '자기소개서'}_${coverLetter?.title || ''}_CoverLetter.png`;
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
    const fileName = `${profile.name || '자기소개서'}_${coverLetter?.title || ''}_CoverLetter`;
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
    document.title = `${profile.name || '자기소개서'}_${coverLetter?.title || ''}_CoverLetter`;
    window.print();
    document.title = originalTitle;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#07051E] flex flex-col items-center justify-center text-slate-300 gap-3 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm">자기소개서를 불러오는 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07051E] text-slate-100 p-4 sm:p-8 font-sans">
      
      {/* 인쇄 스타일 제어 */}
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
          자기소개서 커스텀 & 내보내기
        </h1>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 제어 패널 */}
        <div className="lg:col-span-4 space-y-6 no-print">
          
          <div className="bg-[#0f0c31] border border-indigo-900/50 rounded-xl p-5 shadow-xl space-y-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              자기소개서 디자인 스타일 선택
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSelectedStyle('KR')}
                className={`p-2.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedStyle === 'KR' 
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                🇰🇷 한국 (표준형)
              </button>
              <button
                onClick={() => setSelectedStyle('US')}
                className={`p-2.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedStyle === 'US' 
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                🇺🇸 영문 (Cover Letter)
              </button>
              <button
                onClick={() => setSelectedStyle('EU')}
                className={`p-2.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedStyle === 'EU' 
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                🇪🇺 유럽형 (2컬럼)
              </button>
              <button
                onClick={() => setSelectedStyle('JP')}
                className={`p-2.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedStyle === 'JP' 
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                🇯🇵 일본형 (志望動機)
              </button>
              <button
                onClick={() => setSelectedStyle('CREATIVE')}
                className={`p-2.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedStyle === 'CREATIVE' 
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                🎨 크리에이티브
              </button>
              <button
                onClick={() => setSelectedStyle('EXECUTIVE')}
                className={`p-2.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedStyle === 'EXECUTIVE' 
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                💼 클래식/기업형
              </button>
              <button
                onClick={() => setSelectedStyle('TECH')}
                className={`p-2.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedStyle === 'TECH' 
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                🚀 테크/스타트업
              </button>
              <button
                onClick={() => setSelectedStyle('MINIMAL')}
                className={`p-2.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedStyle === 'MINIMAL' 
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                📄 미니멀
              </button>
              <button
                onClick={() => setSelectedStyle('GRID')}
                className={`p-2.5 rounded-lg text-xs font-medium border transition-all col-span-2 ${
                  selectedStyle === 'GRID' 
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                📑 모던 그리드
              </button>
            </div>
          </div>

          <div className="bg-[#0f0c31] border border-indigo-900/50 rounded-xl p-5 shadow-xl space-y-4">
            <h2 className="text-base font-semibold text-white">자기소개서 저장</h2>
            <div className="grid grid-cols-1 gap-2.5">
              <button
                onClick={downloadPNG}
                disabled={downloadingFormat !== null}
                className="flex items-center justify-center gap-2 p-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {downloadingFormat === 'png' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                PNG 이미지 저장
              </button>

              <button
                onClick={downloadHTML}
                disabled={downloadingFormat !== null}
                className="flex items-center justify-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {downloadingFormat === 'html' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Code className="w-4 h-4" />}
                HTML 파일 저장
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center justify-center gap-2 p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Printer className="w-4 h-4" />
                PDF/인쇄 출력하기
              </button>
            </div>
          </div>

          <div className="bg-[#0f0c31] border border-indigo-900/50 rounded-xl p-5 shadow-xl space-y-4">
            <h2 className="text-base font-semibold text-white">문항 순서 관리</h2>
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

        {/* 뷰어 영역 */}
        <div className="lg:col-span-8 flex justify-center overflow-x-auto p-2">
          
          {/* 1. 한국 (KR) */}
          {selectedStyle === 'KR' && (
            <div 
              ref={printRef}
              className="print-area cover-paper w-[210mm] !bg-white !text-gray-900 shadow-2xl border border-gray-300 p-[10mm] text-left leading-normal flex flex-col justify-start space-y-6 font-sans"
            >
              <div className="border-b-2 border-gray-900 pb-4">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
                  {coverLetter?.title || '자기소개서'}
                </h1>
                <div className="text-xs text-gray-600 flex items-center gap-2">
                  <span className="font-semibold text-gray-800">{profile.name}</span>
                  <span>•</span>
                  <span>{profile.email}</span>
                  <span>•</span>
                  <span>{profile.phone_number}</span>
                </div>
              </div>

              <div className="space-y-6">
                {orderedSections.map((sec, sIdx) => (
                  <div key={sec.id} className="section-block space-y-2">
                    <h2 className="text-sm font-bold text-indigo-900 border-b border-indigo-900/30 pb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                      {sec.section_title || `문항 ${sIdx + 1}`}
                    </h2>
                    {sec.rows && sec.rows.map((row) => (
                      <div key={row.id} className="text-xs space-y-2 pl-2">
                        {(sec.columns || []).map((col) => {
                          const val = row.values[col] || '';
                          if (!val) return null;
                          return (
                            <div key={col} className="space-y-1">
                              <span className="font-semibold text-indigo-950 block text-[12px] bg-indigo-50/50 p-1.5 rounded">
                                [{col}]
                              </span>
                              <div className="whitespace-pre-line text-gray-800 leading-relaxed pl-2 text-[11px]">{val}</div>
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

          {/* 2. 미국 (US) */}
          {selectedStyle === 'US' && (
            <div 
              ref={printRef}
              className="print-area cover-paper w-[210mm] !bg-white !text-black shadow-2xl border border-gray-300 p-[12mm] text-left leading-normal flex flex-col justify-start space-y-6 font-serif"
            >
              <div className="text-center border-b border-black pb-3 space-y-1">
                <h1 className="text-2xl font-bold uppercase tracking-widest text-black">{profile.name}</h1>
                <p className="text-xs text-gray-800 font-sans">
                  {profile.email} | {profile.phone_number}
                </p>
              </div>

              <div className="font-sans text-xs space-y-1">
                <p className="font-bold text-sm text-black">{coverLetter?.title || 'COVER LETTER'}</p>
                <p className="text-gray-500">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>

              <div className="space-y-5 font-sans">
                {orderedSections.map((sec) => (
                  <div key={sec.id} className="section-block space-y-2">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-black border-b border-black pb-0.5">
                      {sec.section_title || 'Section'}
                    </h2>
                    {sec.rows && sec.rows.map((row) => (
                      <div key={row.id} className="text-xs space-y-2">
                        {(sec.columns || []).map((col) => {
                          const val = row.values[col] || '';
                          if (!val) return null;
                          return (
                            <div key={col} className="text-gray-900 space-y-1">
                              <span className="font-semibold text-black italic">[{col}]</span>
                              <div className="whitespace-pre-line text-gray-800 text-[11px] leading-relaxed pl-2">{val}</div>
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

          {/* 3. 유럽 (EU) */}
          {selectedStyle === 'EU' && (
            <div 
              ref={printRef}
              className="print-area cover-paper w-[210mm] !bg-white !text-slate-800 shadow-2xl border border-gray-300 p-[10mm] text-left leading-normal flex flex-col justify-start space-y-4 font-sans"
            >
              <div className="bg-slate-900 text-white p-5 rounded-lg flex justify-between items-center shadow-sm">
                <div className="space-y-1">
                  <h1 className="text-xl font-bold tracking-tight text-white">{coverLetter?.title || 'COVER LETTER'}</h1>
                  <p className="text-xs text-slate-300">{profile.name} | {profile.email} | {profile.phone_number}</p>
                </div>
              </div>

              <div className="space-y-4">
                {orderedSections.map((sec) => (
                  <div key={sec.id} className="section-block space-y-2 bg-indigo-50/30 p-3 rounded border border-indigo-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 border-b border-indigo-200 pb-1">
                      {sec.section_title || 'Section Title'}
                    </h3>
                    {sec.rows && sec.rows.map((row) => (
                      <div key={row.id} className="text-xs space-y-2">
                        {(sec.columns || []).map((col) => {
                          const val = row.values[col] || '';
                          if (!val) return null;
                          return (
                            <div key={col} className="space-y-0.5">
                              <span className="font-bold text-indigo-900 text-[11px]">[{col}]</span>
                              <div className="whitespace-pre-line text-slate-700 pl-2 border-l-2 border-indigo-300 leading-relaxed text-[11px]">{val}</div>
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

          {/* 4. 일본 (JP) */}
          {selectedStyle === 'JP' && (
            <div 
              ref={printRef}
              className="print-area cover-paper w-[210mm] !bg-white !text-black shadow-2xl border border-gray-300 p-[8mm] text-left leading-normal flex flex-col justify-start space-y-3 font-sans"
            >
              <div className="border-b-2 border-black pb-1 flex justify-between items-center">
                <h1 className="text-lg font-bold tracking-widest text-black">志 望 動 機 書 (자기소개서)</h1>
                <span className="text-[11px] text-gray-600">성명: {profile.name}</span>
              </div>

              <div className="space-y-3">
                {orderedSections.map((sec) => (
                  <div key={sec.id} className="section-block space-y-1">
                    <div className="bg-gray-100 font-bold border border-black p-1 text-xs">
                      ■ {sec.section_title || '項目'}
                    </div>
                    {sec.rows && sec.rows.length > 0 && (
                      <table className="w-full border-collapse border border-black text-xs !bg-white" style={{ tableLayout: 'fixed' }}>
                        <tbody>
                          {sec.rows.map((row) => (
                            <React.Fragment key={row.id}>
                              {(sec.columns || []).map((col) => {
                                const val = row.values[col] || '';
                                if (!val) return null;
                                return (
                                  <tr key={col}>
                                    <td className="border border-black bg-gray-50 font-bold w-[100px] p-2 text-center align-middle">
                                      {col}
                                    </td>
                                    <td className="border border-black p-2 whitespace-pre-line leading-relaxed align-top">
                                      {val}
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. 크리에이티브 (CREATIVE) */}
          {selectedStyle === 'CREATIVE' && (
            <div 
              ref={printRef}
              className="print-area cover-paper w-[210mm] !bg-white !text-gray-900 shadow-2xl border border-gray-300 p-[10mm] text-left leading-normal flex flex-col justify-start space-y-5 font-sans"
            >
              <div className="bg-gradient-to-r from-purple-700 to-indigo-600 text-white p-6 rounded-xl shadow-md">
                <h1 className="text-2xl font-extrabold tracking-wide text-white">{coverLetter?.title || '자기소개서'}</h1>
                <p className="text-xs text-purple-100 mt-1">{profile.name} | {profile.email} | {profile.phone_number}</p>
              </div>

              <div className="space-y-4">
                {orderedSections.map((sec) => (
                  <div key={sec.id} className="section-block p-4 rounded-xl bg-slate-50 border-l-4 border-purple-600 shadow-sm space-y-2">
                    <h3 className="text-xs font-bold text-purple-950">{sec.section_title || '문항'}</h3>
                    {sec.rows && sec.rows.map((row) => (
                      <div key={row.id} className="text-xs space-y-2">
                        {(sec.columns || []).map((col) => {
                          const val = row.values[col] || '';
                          if (!val) return null;
                          return (
                            <div key={col} className="text-gray-800 space-y-1">
                              <span className="font-bold text-purple-800 text-[11px]">[{col}]</span>
                              <div className="whitespace-pre-line pl-2 text-gray-700 leading-relaxed text-[11px]">{val}</div>
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

          {/* 6. 클래식 / 기업형 (EXECUTIVE) */}
          {selectedStyle === 'EXECUTIVE' && (
            <div 
              ref={printRef}
              className="print-area cover-paper w-[210mm] !bg-white !text-slate-900 shadow-2xl border border-gray-300 p-[12mm] text-left leading-normal flex flex-col justify-start space-y-5 font-serif"
            >
              <div className="text-center border-b-2 border-slate-900 pb-3 space-y-1">
                <h1 className="text-2xl font-bold tracking-widest text-slate-900 uppercase">{coverLetter?.title || '자기소개서'}</h1>
                <p className="text-xs text-slate-700 font-sans">{profile.name} • {profile.email} • {profile.phone_number}</p>
              </div>

              <div className="space-y-4 font-sans">
                {orderedSections.map((sec) => (
                  <div key={sec.id} className="section-block space-y-2 border-b border-slate-100 pb-3">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{sec.section_title || '문항'}</h3>
                    {sec.rows && sec.rows.map((row) => (
                      <div key={row.id} className="text-xs space-y-2 pl-2">
                        {(sec.columns || []).map((col) => {
                          const val = row.values[col] || '';
                          if (!val) return null;
                          return (
                            <div key={col} className="text-slate-800 space-y-1">
                              <span className="font-semibold text-slate-900 underline">[{col}]</span>
                              <div className="whitespace-pre-line text-slate-700 leading-relaxed text-[11px] pl-2">{val}</div>
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

          {/* 7. 테크 / 스타트업 (TECH) */}
          {selectedStyle === 'TECH' && (
            <div 
              ref={printRef}
              className="print-area cover-paper w-[210mm] !bg-white !text-slate-900 shadow-2xl border border-gray-300 p-[10mm] text-left leading-normal flex flex-col justify-start space-y-5 font-mono text-xs"
            >
              <div className="border-b-2 border-emerald-500 pb-3 font-sans">
                <h1 className="text-2xl font-bold text-slate-900">{coverLetter?.title || 'COVER_LETTER'}</h1>
                <p className="text-xs text-emerald-600 font-mono mt-0.5">&gt; Author: {profile.name} ({profile.email})</p>
              </div>

              <div className="space-y-4 font-sans">
                {orderedSections.map((sec) => (
                  <div key={sec.id} className="section-block p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <h3 className="text-xs font-bold text-emerald-900 font-mono"># {sec.section_title || 'SECTION'}</h3>
                    {sec.rows && sec.rows.map((row) => (
                      <div key={row.id} className="text-xs space-y-2 pl-1">
                        {(sec.columns || []).map((col) => {
                          const val = row.values[col] || '';
                          if (!val) return null;
                          return (
                            <div key={col} className="text-slate-800 space-y-1">
                              <span className="font-bold text-emerald-700 font-mono text-[11px]">[{col}]</span>
                              <div className="whitespace-pre-line text-slate-700 leading-relaxed text-[11px] font-sans pl-2">{val}</div>
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

          {/* 8. 미니멀 (MINIMAL) */}
          {selectedStyle === 'MINIMAL' && (
            <div 
              ref={printRef}
              className="print-area cover-paper w-[210mm] !bg-white !text-slate-900 shadow-2xl border border-gray-300 p-[12mm] text-left leading-normal flex flex-col justify-start space-y-6 font-sans"
            >
              <div className="space-y-1 border-b border-slate-200 pb-4">
                <h1 className="text-3xl font-light text-slate-900 tracking-tight">{coverLetter?.title || '자기소개서'}</h1>
                <p className="text-xs text-slate-500">{profile.name} — {profile.email}</p>
              </div>

              <div className="space-y-5">
                {orderedSections.map((sec) => (
                  <div key={sec.id} className="section-block space-y-2">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{sec.section_title || 'Title'}</h3>
                    {sec.rows && sec.rows.map((row) => (
                      <div key={row.id} className="text-xs space-y-2">
                        {(sec.columns || []).map((col) => {
                          const val = row.values[col] || '';
                          if (!val) return null;
                          return (
                            <div key={col} className="text-slate-700 space-y-1">
                              <span className="font-semibold text-slate-900 text-[11px]">[{col}]</span>
                              <div className="whitespace-pre-line text-slate-600 leading-relaxed text-[11px] pl-2">{val}</div>
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

          {/* 9. 모던 그리드 (GRID) */}
          {selectedStyle === 'GRID' && (
            <div 
              ref={printRef}
              className="print-area cover-paper w-[210mm] !bg-white !text-slate-900 shadow-2xl border border-gray-300 p-[10mm] text-left leading-normal flex flex-col justify-start space-y-4 font-sans"
            >
              <div className="border-b-2 border-slate-800 pb-3">
                <h1 className="text-2xl font-bold text-slate-900">{coverLetter?.title || '자기소개서'}</h1>
                <p className="text-xs text-slate-600 mt-1">{profile.name} | {profile.email} | {profile.phone_number}</p>
              </div>

              <div className="space-y-4">
                {orderedSections.map((sec) => (
                  <div key={sec.id} className="section-block p-3 border border-slate-200 rounded-lg space-y-2">
                    <h3 className="text-xs font-bold text-slate-900 bg-slate-100 p-1.5 rounded">{sec.section_title || '문항'}</h3>
                    {sec.rows && sec.rows.map((row) => (
                      <div key={row.id} className="text-xs space-y-2">
                        {(sec.columns || []).map((col) => {
                          const val = row.values[col] || '';
                          if (!val) return null;
                          return (
                            <div key={col} className="text-slate-800 space-y-1">
                              <span className="font-bold text-slate-700 text-[11px]">[{col}]</span>
                              <div className="whitespace-pre-line text-slate-600 leading-relaxed text-[11px] pl-2">{val}</div>
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

        </div>

      </div>
    </div>
  );
};

export default CoverLetterDownload;