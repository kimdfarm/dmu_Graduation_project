import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import html2canvas from 'html2canvas';
import { 
  ArrowLeft, Image as ImageIcon, Code, Printer, 
  GripVertical, ChevronUp, ChevronDown, Loader2, Mail, Phone, MapPin,
  CheckCircle2, Globe2, FileText, Layout, Award, ChevronDown as ChevronIcon, User
} from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const parseDetailsToTableSchema = (details, secColumns = [], defaultVersion = 'ORIGINAL') => {
  let detectedColumns = Array.isArray(secColumns) && secColumns.length > 0 
    ? [...secColumns] 
    : [];

  if (!details) {
    return { columns: detectedColumns.length > 0 ? detectedColumns : ['상세 내용'], rows: [] };
  }

  const rawList = Array.isArray(details) ? details : [details];
  const extractedRows = [];

  const addColumn = (colName) => {
    if (colName && !detectedColumns.includes(colName)) {
      detectedColumns.push(colName);
    }
  };

  rawList.forEach((cardObj) => {
    const rowValues = {};

    if (typeof cardObj === 'object' && cardObj !== null) {
      const versionToUse = cardObj.selected_version || defaultVersion;
      
      let textToParse = '';
      if (versionToUse === 'AI') {
        textToParse = cardObj.ai_proofread_text || cardObj.original_text || '';
      } else if (versionToUse === 'SPELL') {
        textToParse = cardObj.spell_checked_text || cardObj.original_text || '';
      } else {
        textToParse = cardObj.original_text || '';
      }

      if (textToParse && typeof textToParse === 'string') {
        const blocks = textToParse.split('\n\n');
        
        blocks.forEach((block) => {
          const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
          if (lines.length === 0) return;

          if (lines[0].startsWith('[') && lines[0].endsWith(']')) {
            const keyName = lines[0].slice(1, -1).trim();
            addColumn(keyName);
            rowValues[keyName] = lines
              .slice(1)
              .map((l) => l.replace(/^[•\-\*\s]+/, ''))
              .join('\n');
          } else {
            lines.forEach((line) => {
              const colonIdx = line.indexOf(':');
              if (colonIdx !== -1 && !line.startsWith('•') && !line.startsWith('-')) {
                const k = line.slice(0, colonIdx).trim();
                const v = line.slice(colonIdx + 1).trim();
                addColumn(k);
                rowValues[k] = v;
              } else {
                const cleanLine = line.replace(/^[•\-\*\s]+/, '').trim();
                if (!cleanLine) return;

                const targetCol = detectedColumns.find(c => c.includes('내용') || c.includes('답변') || c.includes('질문')) || detectedColumns[0] || '상세 내용';
                addColumn(targetCol);
                
                const currentVal = rowValues[targetCol] || '';
                rowValues[targetCol] = currentVal ? `${currentVal}\n${cleanLine}` : cleanLine;
              }
            });
          }
        });
      } else {
        Object.entries(cardObj).forEach(([k, v]) => {
          if (['id', 'selected_version', 'ai_proofread_text', 'spell_checked_text', 'original_text'].includes(k)) return;
          
          if (k === 'title') {
            const titleCol = '문항 제목';
            addColumn(titleCol);
            rowValues[titleCol] = String(v || '').replace(/^(제목\/역할:\s*)+/, '').trim();
            return;
          }

          addColumn(k);
          let formattedValue = Array.isArray(v) ? v.join('\n') : String(v || '');
          if (formattedValue.startsWith('•')) {
            formattedValue = formattedValue.replace(/^•\s*/, '');
          }
          rowValues[k] = formattedValue;
        });
      }
    } else {
      addColumn('상세 내용');
      let valStr = String(cardObj);
      if (valStr.startsWith('•')) valStr = valStr.replace(/^•\s*/, '');
      rowValues['상세 내용'] = valStr;
    }

    extractedRows.push({
      id: cardObj.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString()),
      values: rowValues
    });
  });

  if (detectedColumns.length === 0) detectedColumns = ['상세 내용'];

  return { columns: detectedColumns, rows: extractedRows };
};

const CoverLetterDownload = () => {
  const { coverLetterId } = useParams();
  const navigate = useNavigate();
  const printRef = useRef(null);
  const location = useLocation();

  const [coverLetter, setCoverLetter] = useState(null);
  const [orderedSections, setOrderedSections] = useState([]);
  const [selectedStyle, setSelectedStyle] = useState('KR');
  const [accentColor, setAccentColor] = useState('indigo'); // 💡 자기소개서 기본 강조 색상 (인디고)

  const colorThemes = {
    indigo: { name: '모던 인디고', hex: '#4f46e5' },
    emerald: { name: '에메랄드 그린', hex: '#059669' },
    slate: { name: '프로페셔널 블랙', hex: '#0f172a' },
    blue: { name: '클래식 블루', hex: '#2563eb' },
    burgundy: { name: '와인 버건디', hex: '#9f1239' },
  };

  const currentTheme = colorThemes[accentColor] || colorThemes.indigo;

  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone_number: '',
    birth_date: '',
    gender: 'M',
    avatar_url: '',
    address: '',
    detail_address: ''
  });

  const [isLoading, setIsLoading] = useState(true);
  const [downloadingFormat, setDownloadingFormat] = useState(null);

  const userId = localStorage.getItem('userId');

  const mainStyleOptions = [
    { id: 'KR', country: '대한민국', flag: '🇰🇷', name: '한국 모던 자기소개서', desc: '깔끔한 구분선과 구조화된 프로페셔널 서식', icon: Globe2, badge: '표준' },
    { id: 'US', country: '미국 / 북미', flag: '🇺🇸', name: '미국 ATS 최적화 Cover Letter', desc: '텍스트 파싱 및 불릿포인트 중심의 ATS 최적화 서식', icon: FileText, badge: 'ATS' },
    { id: 'EU', country: '유럽 연합', flag: '🇪🇺', name: '유럽형 2단 Cover Letter', desc: '좌측 프로필 사이드바와 우측 문항 분리 2단 레이아웃', icon: Layout, badge: 'CV' },
    { id: 'JP', country: '일본', flag: '🇯🇵', name: '일본 정규 志望動機서', desc: '격자 그리드 형태의 규격화된 테이블 레이아웃', icon: Award, badge: '정규' }
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
            avatar_url: data.avatar_url || '',
            address: data.address || '',
            detail_address: data.detail_address || ''
          });
        }

        const coverRes = await fetch(`${BASE_URL}/api/cover-letters/${coverLetterId}`);
        if (!coverRes.ok) throw new Error('자기소개서 정보를 불러오는 데 실패했습니다.');

        const coverData = await coverRes.json();
        setCoverLetter(coverData);

        const queryParams = new URLSearchParams(location.search);

        if (coverData.sections && Array.isArray(coverData.sections)) {
          const parsedSections = coverData.sections.map((sec) => {
            const queryVer = queryParams.get(`ver_${sec.id}`);
            const queryMode = queryParams.get(`mode_${sec.id}`) || sec.ai_style || 'STAR';
            const secVersion = queryVer || sec.selected_version || 'ORIGINAL';

            const spellMap = {};
            if (Array.isArray(sec.spell_checked_text)) {
              sec.spell_checked_text.forEach((item) => {
                if (item && item.id) spellMap[item.id] = item.spell_checked_text || item.text || '';
              });
            }

            const modeItemMap = {};
            if (Array.isArray(sec.ai_proofread_text)) {
              sec.ai_proofread_text.forEach((group) => {
                if (group && group.mode === queryMode && Array.isArray(group.items)) {
                  group.items.forEach((it) => {
                    if (it && it.id !== undefined) {
                      modeItemMap[String(it.id)] = it.ai_proofread_text || '';
                    }
                  });
                }
              });
            }

            const updatedDetails = (sec.details || []).map((detail) => {
              const detailIdStr = detail.id !== undefined ? String(detail.id) : '';
              return {
                ...detail,
                selected_version: secVersion,
                spell_checked_text: detail.spell_checked_text || spellMap[detailIdStr] || '',
                ai_proofread_text: modeItemMap[detailIdStr] || detail.ai_proofread_text || ''
              };
            });

            return {
              ...sec,
              details: updatedDetails,
              selected_version: secVersion
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
  }, [coverLetterId, userId, navigate, location.search]);

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
      link.download = `${profile.name || '자기소개서'}_${selectedStyle}_CoverLetter.png`;
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
    const fileName = `${profile.name || '자기소개서'}_${selectedStyle}_CoverLetter`;
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
          }
          .cover-section { page-break-inside: avoid; break-inside: avoid; }
          td, div { word-break: keep-all !important; overflow-wrap: break-word !important; }
        </style>
      </head>
      <body style="background-color: #f3f4f6; padding: 1rem; display: flex; justify-content: center; font-family: sans-serif;">
        <div style="background-color: #ffffff; color: #000000; width: 210mm; padding: 10mm; box-sizing: border-box;">
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
    document.title = `${profile.name || '자기소개서'}_${selectedStyle}_CoverLetter`;
    window.print();
    document.title = originalTitle;
  };

  const activeSections = orderedSections.map((sec) => {
    const defaultVersion = sec.selected_version || 'ORIGINAL';
    const { columns, rows } = parseDetailsToTableSchema(sec.details, sec.columns, defaultVersion);
    return {
      ...sec,
      columns,
      rows
    };
  });

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
      
      <style>{`
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          body { background: #ffffff !important; }
          .no-print { display: none !important; }
          .print-area { width: 100% !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; border: none !important; }
        }
        .cover-paper { background-color: #ffffff !important; color: #111827 !important; }
        .cover-section { page-break-inside: avoid !important; break-inside: avoid !important; }
        .cover-paper td, .cover-paper div, .cover-paper p { word-break: keep-all !important; word-wrap: break-word !important; }
      `}</style>

      {/* 상단 헤더 */}
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-6 no-print bg-[#0f0c31] px-6 py-4 rounded-xl border border-indigo-900/50 shadow-xl">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>뒤로가기</span>
        </button>
        <h1 className="text-base md:text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          국가별 자기소개서 커스텀 & 내보내기
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
                      isSelected ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className={`text-xs font-bold truncate flex items-center gap-1.5 ${isSelected ? 'text-indigo-200' : 'text-slate-200'}`}>
                          <span className="text-base">{style.flag}</span> {style.name}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${
                          isSelected ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {style.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{style.desc}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-1" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 💡 문서 강조 색상 선택 패널 추가 */}
          <div className="bg-[#0f0c31] border border-indigo-900/50 rounded-xl p-5 shadow-xl space-y-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <span>🎨 문서 강조 색상 선택 (제출용)</span>
            </h2>
            <p className="text-[11px] text-slate-400">회사 제출용 문서의 포인트 색상을 자유롭게 변경하세요.</p>
            <div className="grid grid-cols-5 gap-2 pt-1">
              {Object.entries(colorThemes).map(([key, theme]) => (
                <button
                  key={key}
                  onClick={() => setAccentColor(key)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                    accentColor === key ? 'bg-slate-900 border-white shadow-md ring-2 ring-white/50' : 'bg-slate-900/50 border-indigo-950 hover:border-indigo-800'
                  }`}
                  title={theme.name}
                >
                  <div className="w-5 h-5 rounded-full shadow-inner" style={{ backgroundColor: theme.hex }} />
                  <span className="text-[10px] text-slate-300 font-medium truncate w-full text-center">{theme.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 저장 & 내보내기 버튼 */}
          <div className="bg-[#0f0c31] border border-indigo-900/50 rounded-xl p-5 shadow-xl space-y-3">
            <h2 className="text-base font-semibold text-white">자기소개서 저장 & 내보내기</h2>
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
            <h2 className="text-base font-semibold text-white">자기소개서 문항 순서 관리</h2>
            <DragDropContext onDragEnd={handleOnDragEnd}>
              <Droppable droppableId="sections">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {activeSections.map((sec, index) => (
                      <Draggable key={sec.id} draggableId={String(sec.id)} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                              snapshot.isDragging ? 'bg-indigo-950 border-indigo-500 shadow-lg' : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
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
                              <button onClick={() => moveUp(index)} disabled={index === 0} className="p-1 text-slate-400 hover:text-white disabled:opacity-30">
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button onClick={() => moveDown(index)} disabled={index === activeSections.length - 1} className="p-1 text-slate-400 hover:text-white disabled:opacity-30">
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

        {/* 뷰어 영역 (4종 템플릿에 동적 색상 테마 적용) */}
        <div className="lg:col-span-7 flex justify-center overflow-x-auto p-2">
          
          {/* 1. 한국 모던 자기소개서 (KR) */}
          {selectedStyle === 'KR' && (
            <div 
              ref={printRef}
              className="print-area cover-paper w-[210mm] !bg-white !text-gray-900 shadow-2xl border border-gray-300 p-[12mm] text-left leading-relaxed flex flex-col space-y-6 font-sans"
            >
              <div className="pb-5 flex justify-between items-start gap-4" style={{ borderBottom: `2px solid ${currentTheme.hex}` }}>
                <div className="space-y-2 flex-1">
                  <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{profile.name || '김동혁'}</h1>
                  <p className="text-sm font-semibold" style={{ color: currentTheme.hex }}>{coverLetter?.title || '자기소개서'}</p>
                  
                  <div className="text-xs text-gray-600 space-y-1 pt-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {profile.birth_date && <span>생년월일: {profile.birth_date} ({profile.gender === 'M' ? '남' : '여'})</span>}
                      {profile.phone_number && <span>연락처: {profile.phone_number}</span>}
                      {profile.email && <span>이메일: {profile.email}</span>}
                    </div>
                    {profile.address && <p>주소: {profile.address} {profile.detail_address}</p>}
                  </div>
                </div>

                <div className="w-24 h-32 bg-gray-100 rounded border border-gray-300 shadow-sm shrink-0 flex items-center justify-center overflow-hidden">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="프로필" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-gray-400" />
                  )}
                </div>
              </div>

              <div className="space-y-5">
                <h2 className="text-sm font-bold uppercase tracking-wider pb-1" style={{ color: currentTheme.hex, borderBottom: `2px solid ${currentTheme.hex}30` }}>자기소개서 세부 문항</h2>
                
                {activeSections.map((sec) => (
                  <div key={sec.id} className="space-y-3 cover-section">
                    <h3 className="text-xs font-bold px-2.5 py-1.5 rounded" style={{ color: currentTheme.hex, backgroundColor: `${currentTheme.hex}10`, borderLeft: `4px solid ${currentTheme.hex}` }}>
                      {sec.section_title || '문항 내용'}
                    </h3>

                    {sec.rows && sec.rows.map((row) => (
                      <div key={row.id} className="pl-3 space-y-2 mb-4" style={{ borderLeft: `2px solid ${currentTheme.hex}30` }}>
                        {(sec.columns || []).map((col) => {
                          const val = row.values[col] || '';
                          if (!val) return null;

                          return (
                            <div key={col} className="space-y-1">
                              <span className="text-xs font-bold text-gray-800 block">[{col}]</span>
                              <div className="text-xs text-gray-700 space-y-1 pl-2 whitespace-pre-line leading-relaxed">
                                {val}
                              </div>
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

          {/* 2. 미국 ATS 최적화 (US) */}
          {selectedStyle === 'US' && (
            <div 
              ref={printRef}
              className="print-area cover-paper w-[210mm] !bg-white !text-black shadow-2xl border border-gray-300 p-[12mm] text-left leading-normal flex flex-col space-y-4 font-serif"
            >
              <div className="text-center pb-3 space-y-1" style={{ borderBottom: `2px solid ${currentTheme.hex}` }}>
                <h1 className="text-2xl font-bold uppercase tracking-widest text-black">{profile.name || 'APPLICANT'}</h1>
                <p className="text-xs text-gray-800 font-sans tracking-tight">
                  {[profile.email, profile.phone_number, `${profile.address || ''} ${profile.detail_address || ''}`.trim()].filter(Boolean).join(' • ')}
                </p>
                <p className="text-xs font-bold pt-1 uppercase tracking-wider" style={{ color: currentTheme.hex }}>{coverLetter?.title || 'Cover Letter'}</p>
              </div>

              <div className="space-y-4 pt-2">
                {activeSections.map((sec) => (
                  <div key={sec.id} className="space-y-2 font-sans cover-section">
                    <h3 className="text-xs font-bold uppercase tracking-wide border-b border-gray-300 pb-0.5" style={{ color: currentTheme.hex }}>
                      {sec.section_title || 'Cover Letter Statement'}
                    </h3>

                    {sec.rows && sec.rows.map((row) => (
                      <div key={row.id} className="text-xs space-y-2">
                        {(sec.columns || []).map((col) => {
                          const val = row.values[col] || '';
                          if (!val) return null;
                          return (
                            <div key={col} className="space-y-1">
                              <span className="font-bold text-[11px] underline block" style={{ color: currentTheme.hex }}>{col}</span>
                              <div className="text-gray-900 text-[11px] leading-relaxed whitespace-pre-line pl-1">{val}</div>
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

          {/* 3. 유럽 2단 커버레터 (EU) */}
          {selectedStyle === 'EU' && (
            <div 
              ref={printRef}
              className="print-area cover-paper w-[210mm] !bg-white !text-slate-800 shadow-2xl border border-gray-300 p-[10mm] text-left leading-normal flex flex-col space-y-5 font-sans"
            >
              <div className="text-white p-5 rounded-lg flex justify-between items-center shadow-sm" style={{ backgroundColor: currentTheme.hex }}>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">COVER LETTER</span>
                  <h1 className="text-2xl font-bold tracking-tight text-white">{profile.name || '김동혁'}</h1>
                  <div className="text-xs text-white/90 space-y-1">
                    {profile.email && <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5"/> {profile.email}</p>}
                    {profile.phone_number && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5"/> {profile.phone_number}</p>}
                    {profile.address && <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5"/> {profile.address} {profile.detail_address}</p>}
                  </div>
                </div>

                <div className="w-20 h-24 bg-black/25 rounded border border-white/25 shadow-inner shrink-0 flex items-center justify-center overflow-hidden">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-white/60" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-4 space-y-4 border-r border-slate-200 pr-4">
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider pb-0.5" style={{ color: currentTheme.hex, borderBottom: `1px solid ${currentTheme.hex}40` }}>Information</h3>
                    <div className="text-xs text-slate-600 space-y-1">
                      {profile.birth_date && <p><span className="font-semibold text-slate-800">DOB:</span> {profile.birth_date}</p>}
                      <p><span className="font-semibold text-slate-800">Gender:</span> {profile.gender === 'M' ? 'Male' : 'Female'}</p>
                      <p className="pt-2 text-[11px] text-slate-500">{coverLetter?.title}</p>
                    </div>
                  </div>
                </div>

                <div className="col-span-8 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider pb-0.5" style={{ color: currentTheme.hex, borderBottom: `1px solid ${currentTheme.hex}40` }}>Motivation & Statements</h3>
                  {activeSections.map((sec) => (
                    <div key={sec.id} className="space-y-2 p-3 rounded border cover-section" style={{ backgroundColor: `${currentTheme.hex}08`, borderColor: `${currentTheme.hex}30` }}>
                      <h4 className="text-xs font-bold" style={{ color: currentTheme.hex }}>{sec.section_title || 'Section Title'}</h4>
                      {sec.rows && sec.rows.map((row) => (
                        <div key={row.id} className="text-xs space-y-1.5 pl-1">
                          {(sec.columns || []).map((col) => {
                            const val = row.values[col] || '';
                            if (!val) return null;
                            return (
                              <div key={col} className="space-y-0.5">
                                <span className="font-bold text-[11px]" style={{ color: currentTheme.hex }}>[{col}]</span>
                                <div className="text-slate-700 pl-2 leading-relaxed text-[11px] whitespace-pre-line" style={{ borderLeft: `2px solid ${currentTheme.hex}60` }}>
                                  {val}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. 일본 정규 志望動機 (JP) */}
          {selectedStyle === 'JP' && (
            <div 
              ref={printRef}
              className="print-area cover-paper w-[210mm] !bg-white !text-black shadow-2xl border border-gray-300 p-[8mm] text-left leading-normal flex flex-col space-y-4 font-sans"
            >
              <div className="border-b-2 border-black pb-1 flex justify-between items-center">
                <h1 className="text-lg font-bold tracking-widest text-black">志望動機書 (자기소개서)</h1>
                <span className="text-[11px] text-gray-600">작성일자: {new Date().toLocaleDateString('ko-KR')}</span>
              </div>

              <div className="cover-section">
                <table className="w-full border-collapse border border-black text-xs text-center !bg-white" style={{ tableLayout: 'fixed' }}>
                  <tbody>
                    <tr>
                      <td className="border border-black bg-gray-100 font-bold w-[65px] py-1.5">성 명</td>
                      <td className="border border-black font-semibold text-left px-2">{profile.name}</td>
                      <td className="border border-black bg-gray-100 font-bold w-[60px]">성 별</td>
                      <td className="border border-black w-[40px]">{profile.gender === 'M' ? '남' : '여'}</td>
                      <td rowSpan={3} className="border border-black w-[80px] h-[95px] p-1 align-middle">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="사진" className="w-full h-full object-cover max-h-[90px]" />
                        ) : (
                          <div className="w-full h-full bg-gray-50 flex items-center justify-center text-gray-400 text-[10px]">사진</div>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black bg-gray-100 font-bold py-1.5">생년월일</td>
                      <td className="border border-black text-left px-2">{profile.birth_date}</td>
                      <td className="border border-black bg-gray-100 font-bold">연락처</td>
                      <td className="border border-black text-left px-1">{profile.phone_number}</td>
                    </tr>
                    <tr>
                      <td className="border border-black bg-gray-100 font-bold py-1.5">주 소</td>
                      <td colSpan={3} className="border border-black text-left px-2">
                        {profile.address} {profile.detail_address}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="space-y-2">
                <h2 className="text-xs font-bold text-black border-l-2 pl-1.5 py-0.5" style={{ borderColor: currentTheme.hex }}>志望動機 및 자기소개 상세</h2>
                {activeSections.map((sec) => (
                  <div key={sec.id} className="space-y-1 cover-section">
                    <div className="bg-gray-100 font-bold border border-black p-1 text-xs">
                      ■ {sec.section_title || '세부사항'}
                    </div>
                    {sec.rows && sec.rows.length > 0 && (
                      <div className="border border-black p-3 space-y-2 text-xs">
                        {sec.rows.map((row) => (
                          <div key={row.id} className="space-y-1 border-b border-gray-200 pb-2 last:border-0 last:pb-0">
                            {(sec.columns || []).map((col) => {
                              const val = row.values[col] || '';
                              if (!val) return null;
                              return (
                                <div key={col} className="space-y-0.5">
                                  <span className="font-bold text-black block">【 {col} 】</span>
                                  <p className="whitespace-pre-line leading-relaxed pl-2 text-gray-800">{val}</p>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
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