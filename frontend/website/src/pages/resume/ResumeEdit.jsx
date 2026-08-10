import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, Plus, Trash2, CheckCircle2, Loader2, 
  PlusCircle, X, GripVertical, Maximize2, Check, AlertTriangle 
} from 'lucide-react';

const ResumeEdit = () => {
  const { resumeId } = useParams();
  const navigate = useNavigate();

  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // 삭제된 섹션 ID 추적
  const [deletedSectionIds, setDeletedSectionIds] = useState([]);

  // 변경사항 유무 추적 (저장 안 함 / 저장 후 이동 처리용)
  const [isDirty, setIsDirty] = useState(false);

  // 인라인 속성 추가 전용 상태
  const [addingColSectionId, setAddingColSectionId] = useState(null);
  const [newColName, setNewColName] = useState('');

  // 모달 상태 관리
  const [activeModal, setActiveModal] = useState(null); // 큰 화면 편집 모달
  const [pendingConfirm, setPendingConfirm] = useState(null); // 커스텀 삭제/확인 모달
  const [showNavigationModal, setShowNavigationModal] = useState(false); // 미저장 이탈 확인 모달

  // 드래그 중인 항목 인덱스 저장 Ref
  const draggedColIdx = useRef(null);
  const draggedRowIdx = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  // ------------------------------------------------------------------
  // 브라우저 탭 닫기 / 새로고침 시 이탈 방지
  // ------------------------------------------------------------------
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // ------------------------------------------------------------------
  // 1. DB의 secColumns 기반으로 details를 읽어 Table Schema 생성
  // ------------------------------------------------------------------
  const parseDetailsToTableSchema = (details, secColumns = []) => {
    let detectedColumns = Array.isArray(secColumns) && secColumns.length > 0 
      ? [...secColumns] 
      : [];

    if (!details) {
      return { 
        columns: detectedColumns.length > 0 ? detectedColumns : ['제목/역할', '참여 기간', '상세 업무 및 성과2'], 
        rows: [] 
      };
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
        if (cardObj.original_text) {
          const blocks = cardObj.original_text.split('\n\n');
          blocks.forEach((block) => {
            const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
            if (lines.length === 0) return;

            if (lines[0].startsWith('[') && lines[0].endsWith(']')) {
              const keyName = lines[0].slice(1, -1);
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
  // ❌ 문제 위치: 컬럼을 찾지 못하면 '상세 업무 및 성과3'을 강제로 생성
  const targetCol = detectedColumns.find(c => c.includes('성과') || c.includes('업무')) || '상세 업무 및 성과3';
  addColumn(targetCol);
  const currentVal = rowValues[targetCol] || '';
  const cleanLine = line.replace(/^[•\-\*\s]+/, '');
  rowValues[targetCol] = currentVal ? `${currentVal}\n${cleanLine}` : cleanLine;
}
              });
            }
          });
        } else {
          Object.entries(cardObj).forEach(([k, v]) => {
            if (['id', 'selected_version', 'ai_proofread_text', 'spell_checked_text', 'title', 'original_text'].includes(k)) return;
            addColumn(k);
            rowValues[k] = Array.isArray(v) ? v.join('\n') : String(v || '');
          });
        }

        if (cardObj.title && cardObj.title !== '세부 항목') {
          const cleanTitle = cardObj.title.replace(/^(제목\/역할:\s*)+/, '').trim();
          const existingKey = detectedColumns.find(c => c.includes('제목') || c.includes('역할') || c.includes('프로젝트'));
          if (existingKey && !rowValues[existingKey]) {
            rowValues[existingKey] = cleanTitle;
          }
        }
      } else {
        addColumn('내용');
        rowValues['내용'] = String(cardObj);
      }

      extractedRows.push({
        id: cardObj.id || crypto.randomUUID(),
        values: rowValues
      });
    });

    if (detectedColumns.length === 0) {
      detectedColumns = ['제목/역할', '참여 기간', '상세 업무 및 성과1'];
    }

    return { columns: detectedColumns, rows: extractedRows };
  };

  // ------------------------------------------------------------------
  // 2. 백엔드 DetailItem Pydantic 스키마와 100% 호환되는 직렬화 함수
  // ------------------------------------------------------------------
  const serializeTableToDetails = (columns, rows) => {
    return rows.map((row) => {
      let mainTitle = '';

      const titleCol = columns.find(
        (col) => col.includes('제목') || col.includes('역할') || col.includes('프로젝트') || col.includes('명')
      );
      if (titleCol && row.values[titleCol]) {
        mainTitle = row.values[titleCol].trim();
      }

      const contentLines = [];
      columns.forEach((col) => {
        const val = (row.values[col] || '').trim();
        if (!val) return;

        if (val.includes('\n') || col.includes('성과') || col.includes('업무') || col.includes('내용') || col.includes('스택')) {
          const bullets = val
            .split('\n')
            .map((l) => l.replace(/^[•\-\*\s]+/, '').trim())
            .filter(Boolean)
            .map((l) => `• ${l}`)
            .join('\n');

          contentLines.push(`[${col}]\n${bullets}`);
        } else {
          contentLines.push(`[${col}]\n• ${val}`);
        }
      });

      return {
        id: row.id || crypto.randomUUID(),
        title: mainTitle || '세부 항목',
        original_text: contentLines.join('\n\n'),
        spell_checked_text: null,
        ai_proofread_text: null,
        selected_version: 'ORIGINAL'
      };
    });
  };

  useEffect(() => {
    const fetchResumeDetail = async () => {
      try {
        setIsLoading(true);
        setErrorMessage('');
        const response = await fetch(`/api/resumes/${resumeId}`);
        if (!response.ok) throw new Error('이력서 정보를 불러오지 못했습니다.');

        const data = await response.json();

        if (data.sections && Array.isArray(data.sections)) {
          const formattedSections = data.sections.map((sec) => {
            const { columns, rows } = parseDetailsToTableSchema(sec.details, sec.columns);
            return {
              ...sec,
              columns,
              rows
            };
          });
          setSections(formattedSections);
          setIsDirty(false);
        }
      } catch (err) {
        setErrorMessage(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (resumeId) fetchResumeDetail();
  }, [resumeId]);

  // 섹션 전체 삭제
  const handleDeleteSection = (secId) => {
    setPendingConfirm({
      title: '섹션 삭제 확인',
      message: '이 섹션과 포함된 모든 항목을 삭제하시겠습니까? (저장 시 DB에 최종 반영됩니다)',
      onConfirm: () => {
        setDeletedSectionIds((prev) => [...prev, secId]);
        setSections((prev) => prev.filter((sec) => sec.id !== secId));
        setIsDirty(true);
        setPendingConfirm(null);
        showToast('섹션이 삭제 목록에 추가되었습니다.');
      }
    });
  };

  // 속성(열) 삭제
  const handleDeleteColumn = (sectionId, colToDelete) => {
    setPendingConfirm({
      title: '속성 삭제 확인',
      message: `'${colToDelete}' 속성을 삭제하시겠습니까? 관련 작성 내용이 함께 지워집니다.`,
      onConfirm: () => {
        setSections((prev) =>
          prev.map((sec) => {
            if (sec.id === sectionId) {
              const newColumns = sec.columns.filter((c) => c !== colToDelete);
              const newRows = sec.rows.map((r) => {
                const updatedVal = { ...r.values };
                delete updatedVal[colToDelete];
                return { ...r, values: updatedVal };
              });
              return { ...sec, columns: newColumns, rows: newRows };
            }
            return sec;
          })
        );
        setIsDirty(true);
        setPendingConfirm(null);
      }
    });
  };

  // ------------------------------------------------------------------
  // 3. DB 실제 저장 함수 (예외 처리 및 API 연동 수정)
  // ------------------------------------------------------------------
  const handleSaveAll = async (redirectAfter = false) => {
    try {
      setIsSaving(true);
      setErrorMessage('');

      // A. 삭제할 섹션 DB API 호출
      const deletePromises = deletedSectionIds.map(async (secId) => {
        const res = await fetch(`/api/resumes/sections/${secId}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          throw new Error(`섹션 삭제 중 오류가 발생했습니다. (ID: ${secId})`);
        }
        return res.json();
      });

      // B. 섹션 수정 및 데이터 (columns, details 통째로 덮어쓰기) DB API 호출
      const updatePromises = sections.map(async (sec) => {
        const cleanDetails = serializeTableToDetails(sec.columns, sec.rows);
        const res = await fetch(`/api/resumes/sections/${sec.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section_title: sec.section_title,
            display_order: sec.display_order,
            columns: sec.columns,
            details: cleanDetails
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `섹션 저장 중 오류가 발생했습니다. (${sec.section_title})`);
        }
        return res.json();
      });

      // 삭제 및 업데이트 동시 병렬 처리
      await Promise.all([...deletePromises, ...updatePromises]);

      setDeletedSectionIds([]);
      setIsDirty(false);
      showToast('모든 변경사항이 성공적으로 DB에 저장되었습니다!');

      if (redirectAfter) {
        navigate(`/resume/${resumeId}`);
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 상세 보기로 돌아가기 버튼 클릭 시
  const handleBackToDetail = () => {
    if (isDirty) {
      setShowNavigationModal(true);
    } else {
      navigate(`/resume/${resumeId}`);
    }
  };

  // 드래그 앤 드롭: 컬럼 순서 변경
  const handleColDragStart = (e, index) => {
    draggedColIdx.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleColDrop = (e, targetSectionId, dropIndex) => {
    e.preventDefault();
    const startIndex = draggedColIdx.current;
    if (startIndex === null || startIndex === dropIndex) return;

    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id === targetSectionId) {
          const newCols = [...sec.columns];
          const [movedCol] = newCols.splice(startIndex, 1);
          newCols.splice(dropIndex, 0, movedCol);
          return { ...sec, columns: newCols };
        }
        return sec;
      })
    );
    setIsDirty(true);
    draggedColIdx.current = null;
  };

  // 드래그 앤 드롭: 행(카드) 순서 변경
  const handleRowDragStart = (e, index) => {
    draggedRowIdx.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleRowDrop = (e, targetSectionId, dropIndex) => {
    e.preventDefault();
    const startIndex = draggedRowIdx.current;
    if (startIndex === null || startIndex === dropIndex) return;

    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id === targetSectionId) {
          const newRows = [...sec.rows];
          const [movedRow] = newRows.splice(startIndex, 1);
          newRows.splice(dropIndex, 0, movedRow);
          return { ...sec, rows: newRows };
        }
        return sec;
      })
    );
    setIsDirty(true);
    draggedRowIdx.current = null;
  };

  // 속성(열) 추가
  const handleConfirmAddColumn = (sectionId) => {
    const trimmed = newColName.trim();
    if (!trimmed) {
      setAddingColSectionId(null);
      return;
    }

    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id === sectionId) {
          if (sec.columns.includes(trimmed)) {
            showToast('이미 존재하는 속성명입니다.');
            return sec;
          }
          return {
            ...sec,
            columns: [...sec.columns, trimmed]
          };
        }
        return sec;
      })
    );

    setIsDirty(true);
    setNewColName('');
    setAddingColSectionId(null);
  };

  const handleRenameColumn = (sectionId, oldCol, newCol) => {
    if (!newCol.trim() || oldCol === newCol) return;

    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id === sectionId) {
          const newColumns = sec.columns.map((c) => (c === oldCol ? newCol : c));
          const newRows = sec.rows.map((r) => {
            const updatedVal = { ...r.values };
            if (oldCol in updatedVal) {
              updatedVal[newCol] = updatedVal[oldCol];
              delete updatedVal[oldCol];
            }
            return { ...r, values: updatedVal };
          });
          return { ...sec, columns: newColumns, rows: newRows };
        }
        return sec;
      })
    );
    setIsDirty(true);
  };

  // 행(Row) 및 셀 제어
  const handleAddRow = (sectionId) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id === sectionId) {
          const newRow = {
            id: crypto.randomUUID(),
            values: {}
          };
          return { ...sec, rows: [...sec.rows, newRow] };
        }
        return sec;
      })
    );
    setIsDirty(true);
  };

  const handleDeleteRow = (sectionId, targetRowId) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id === sectionId) {
          return {
            ...sec,
            rows: sec.rows.filter((r) => r.id !== targetRowId)
          };
        }
        return sec;
      })
    );
    setIsDirty(true);
  };

  const handleCellChange = (sectionId, rowId, colName, value) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id === sectionId) {
          const updatedRows = sec.rows.map((row) => {
            if (row.id === rowId) {
              return {
                ...row,
                values: { ...row.values, [colName]: value }
              };
            }
            return row;
          });
          return { ...sec, rows: updatedRows };
        }
        return sec;
      })
    );
    setIsDirty(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#07051E] flex flex-col items-center justify-center text-slate-300 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm">데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07051E] text-slate-100 p-6 md:p-10 font-sans relative pb-28">
      
      {/* 커스텀 토스트 알림 */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-indigo-600/90 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-indigo-400/40 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-300" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      <div className="max-w-[95%] mx-auto space-y-8">
        
        {/* 상단 헤더 영역 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-indigo-950 pb-6 gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToDetail}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-900/60 hover:bg-indigo-600/90 text-indigo-100 hover:text-white border border-indigo-500/50 rounded-xl text-xs font-bold transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-95 group shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-indigo-300 group-hover:text-white group-hover:-translate-x-0.5 transition-transform" />
              <span>상세 보기로 돌아가기</span>
            </button>

            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                이력서 구성 편집기
                {isDirty && (
                  <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full">
                    변경사항 작성 중
                  </span>
                )}
              </h1>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-xl text-xs text-rose-300 flex items-center justify-between">
            <span>⚠️ {errorMessage}</span>
            <button onClick={() => setErrorMessage('')} className="text-rose-400 hover:text-rose-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="space-y-10">
          {sections.map((sec) => (
            <div key={sec.id} className="bg-[#0E0B2D] border border-indigo-950 rounded-2xl p-6 shadow-xl space-y-6">
              
              <div className="flex items-center justify-between border-b border-indigo-900/40 pb-4 gap-2">
                <input
                  type="text"
                  value={sec.section_title || ''}
                  onChange={(e) => {
                    const newTitle = e.target.value;
                    setSections((prev) =>
                      prev.map((s) => (s.id === sec.id ? { ...s, section_title: newTitle } : s))
                    );
                    setIsDirty(true);
                  }}
                  className="bg-transparent text-lg font-bold text-indigo-200 border-b border-transparent hover:border-indigo-700 focus:border-indigo-500 focus:outline-none transition-all px-1 flex-1"
                />
                
                <button
                  onClick={() => handleDeleteSection(sec.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/50 hover:bg-rose-900/80 text-rose-300 hover:text-rose-100 border border-rose-800/50 rounded-xl text-xs font-semibold transition-all shadow-sm"
                  title="섹션과 포함된 모든 항목을 삭제합니다"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>섹션 전체 삭제</span>
                </button>
              </div>

              {/* 속성(열) 편집 영역 */}
              <div className="bg-[#07051E] border border-indigo-900/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    📌 섹션 공통 속성 필드 (마우스 드래그로 순서 변경)
                  </span>

                  {addingColSectionId === sec.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        autoFocus
                        value={newColName}
                        onChange={(e) => setNewColName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirmAddColumn(sec.id)}
                        placeholder="속성명 (예: 위치, 기술)"
                        className="bg-[#130E3D] text-xs text-indigo-100 border border-indigo-500 rounded px-2 py-1 focus:outline-none w-36"
                      />
                      <button
                        onClick={() => handleConfirmAddColumn(sec.id)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white p-1 rounded transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setAddingColSectionId(null)}
                        className="text-slate-400 hover:text-slate-200 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setAddingColSectionId(sec.id);
                        setNewColName('');
                      }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold transition-all hover:scale-105"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> + 속성(열) 추가
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-1 items-center">
                  {sec.columns.map((col, cIdx) => (
                    <div
                      key={col}
                      draggable
                      onDragStart={(e) => handleColDragStart(e, cIdx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleColDrop(e, sec.id, cIdx)}
                      className="flex items-center bg-[#130E3D] hover:bg-[#1A144E] border border-indigo-800/60 rounded-lg px-2.5 py-1.5 gap-1.5 text-xs text-indigo-200 shadow-sm cursor-grab active:cursor-grabbing transition-all"
                    >
                      <GripVertical className="w-3.5 h-3.5 text-indigo-400/70 shrink-0" />
                      <input
                        type="text"
                        value={col}
                        onChange={(e) => handleRenameColumn(sec.id, col, e.target.value)}
                        className="bg-transparent font-semibold border-b border-transparent focus:border-indigo-400 focus:outline-none w-28 text-xs text-indigo-200"
                      />
                      <button
                        onClick={() => handleDeleteColumn(sec.id, col)}
                        className="text-slate-500 hover:text-rose-400 transition-colors p-0.5"
                        title="속성 삭제"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 항목 카드 리스트 */}
              <div className="space-y-6">
                {sec.rows && sec.rows.length > 0 ? (
                  sec.rows.map((row, rIdx) => (
                    <div
                      key={row.id}
                      draggable
                      onDragStart={(e) => handleRowDragStart(e, rIdx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleRowDrop(e, sec.id, rIdx)}
                      className="bg-[#07051E] border border-indigo-900/60 hover:border-indigo-700/80 rounded-xl p-5 space-y-4 shadow-md group transition-all"
                    >
                      <div className="flex items-center justify-between border-b border-indigo-950 pb-2">
                        <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5 select-none cursor-grab active:cursor-grabbing">
                          <GripVertical className="w-4 h-4 text-indigo-400/70 group-hover:text-indigo-300 transition-colors" />
                          항목 #{rIdx + 1} <span className="text-[11px] font-normal text-slate-500">(드래그하여 위치 이동)</span>
                        </span>

                        <button
                          onClick={() => handleDeleteRow(sec.id, row.id)}
                          className="text-slate-500 hover:text-rose-400 text-xs flex items-center gap-1 transition-all p-1 rounded hover:bg-rose-950/40"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" /> 항목 삭제
                        </button>
                      </div>

                      <div className="overflow-x-auto pb-2">
                        <div className="flex gap-4 min-w-max">
                          {sec.columns.map((col) => {
                            const val = row.values[col] || '';
                            const isMultiLine = col.includes('성과') || col.includes('업무') || col.includes('내용') || val.includes('\n');

                            return (
                              <div
                                key={col}
                                className="w-80 bg-[#0B0826] p-3 rounded-lg border border-indigo-950/80 flex flex-col gap-2 shrink-0 relative"
                              >
                                <div className="flex items-center justify-between border-b border-indigo-950 pb-1">
                                  <span className="text-xs font-bold text-indigo-300 truncate max-w-[180px]">
                                    {col}
                                  </span>

                                  <button
                                    onClick={() => {
                                      setActiveModal({
                                        sectionId: sec.id,
                                        rowId: row.id,
                                        rowIdx: rIdx + 1,
                                        colName: col,
                                        value: val
                                      });
                                    }}
                                    className="text-xs text-indigo-400 hover:text-indigo-200 flex items-center gap-1 bg-indigo-950/70 hover:bg-indigo-900/90 px-2 py-0.5 rounded border border-indigo-800/50 transition-all"
                                  >
                                    <Maximize2 className="w-3 h-3" />
                                    <span className="text-[11px] font-medium">크게 보기</span>
                                  </button>
                                </div>

                                {isMultiLine ? (
                                  <textarea
                                    rows={4}
                                    value={val}
                                    onChange={(e) => handleCellChange(sec.id, row.id, col, e.target.value)}
                                    placeholder={`${col} 내용 입력...`}
                                    className="w-full bg-slate-950 text-xs text-slate-200 border border-indigo-950 rounded p-2 focus:border-indigo-500 focus:outline-none resize-none leading-relaxed flex-1"
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    value={val}
                                    onChange={(e) => handleCellChange(sec.id, row.id, col, e.target.value)}
                                    placeholder={`${col} 입력...`}
                                    className="w-full bg-slate-950 text-xs text-slate-200 border border-indigo-950 rounded p-2 focus:border-indigo-500 focus:outline-none"
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic py-2">등록된 항목이 없습니다.</p>
                )}
              </div>

              <button
                onClick={() => handleAddRow(sec.id)}
                className="w-full py-2.5 border border-dashed border-indigo-900/80 hover:border-indigo-500/60 rounded-xl text-xs text-indigo-400 flex items-center justify-center gap-1.5 transition-all bg-indigo-950/20 font-medium"
              >
                <Plus className="w-4 h-4" /> + 새 항목 카드 추가
              </button>

            </div>
          ))}
        </div>

      </div>

      {/* 하단 고정 전체 저장 버튼 */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => handleSaveAll(false)}
          disabled={isSaving}
          className="flex items-center gap-2.5 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-sm rounded-2xl shadow-2xl border border-indigo-400/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>저장 중...</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>전체 변경사항 저장</span>
            </>
          )}
        </button>
      </div>

      {/* 1. 항목 상세 편집 모달 */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-fadeIn">
          <div className="bg-[#0E0B2D] border border-indigo-800/80 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-indigo-900/60 bg-[#07051E]">
              <div>
                <span className="text-xs font-semibold text-indigo-400">
                  항목 #{activeModal.rowIdx} / {activeModal.colName}
                </span>
                <h3 className="text-lg font-bold text-white">
                  {activeModal.colName} 상세 내용 작성
                </h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-indigo-950 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex-1 flex flex-col space-y-3 bg-[#0B0826] overflow-y-auto">
              <textarea
                value={activeModal.value}
                onChange={(e) => {
                  const newVal = e.target.value;
                  setActiveModal((prev) => ({ ...prev, value: newVal }));
                  handleCellChange(activeModal.sectionId, activeModal.rowId, activeModal.colName, newVal);
                }}
                className="w-full flex-1 min-h-[350px] bg-[#07051E] text-sm text-slate-100 border border-indigo-900/80 rounded-xl p-4 focus:border-indigo-500 focus:outline-none resize-none leading-relaxed font-sans shadow-inner"
              />
            </div>

            <div className="flex items-center justify-end px-6 py-4 border-t border-indigo-900/60 bg-[#07051E]">
              <button
                onClick={() => setActiveModal(null)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-xl flex items-center gap-1.5 transition-all shadow-lg"
              >
                <Check className="w-4 h-4" /> 적용 및 닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. 커스텀 삭제 / 확인 모달 */}
      {pendingConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0E0B2D] border border-indigo-800/80 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">{pendingConfirm.title}</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{pendingConfirm.message}</p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPendingConfirm(null)}
                className="px-4 py-2 bg-indigo-950 hover:bg-indigo-900 text-slate-300 text-xs font-semibold rounded-xl transition-all"
              >
                취소
              </button>
              <button
                onClick={pendingConfirm.onConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg"
              >
                삭제 진행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. 미저장 이탈 확인 모달 (예 / 아니오 / 취소) */}
      {showNavigationModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0E0B2D] border border-indigo-800/80 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">저장되지 않은 변경사항</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              수정된 내용이나 삭제된 섹션이 있습니다.<br />
              이동하기 전에 변경사항을 저장하시겠습니까?
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowNavigationModal(false)}
                className="w-full sm:w-auto px-4 py-2 bg-indigo-950 hover:bg-indigo-900 text-slate-400 text-xs font-semibold rounded-xl transition-all order-3 sm:order-1"
              >
                취소 (페이지 유지)
              </button>
              <button
                onClick={() => {
                  setShowNavigationModal(false);
                  navigate(`/resume/${resumeId}`);
                }}
                className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-900/40 text-xs font-bold rounded-xl transition-all order-2"
              >
                아니오 (저장 안 함)
              </button>
              <button
                onClick={async () => {
                  setShowNavigationModal(false);
                  await handleSaveAll(true);
                }}
                className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg order-1 sm:order-3"
              >
                예 (저장 후 이동)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ResumeEdit;