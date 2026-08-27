import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, Plus, Trash2, CheckCircle2, Loader2, 
  PlusCircle, X, GripVertical, Maximize2, Check, AlertTriangle 
} from 'lucide-react';

const BASE_URL = 'http://localhost:8000';

const CoverLetterEdit = () => {
  const { coverLetterId } = useParams();
  const navigate = useNavigate();

  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // 삭제된 섹션 ID 추적
  const [deletedSectionIds, setDeletedSectionIds] = useState([]);

  // 변경사항 유무 추적
  const [isDirty, setIsDirty] = useState(false);

  // 인라인 속성 추가 전용 상태
  const [addingColSectionId, setAddingColSectionId] = useState(null);
  const [newColName, setNewColName] = useState('');

  // 모달 상태 관리
  const [activeModal, setActiveModal] = useState(null);
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [showNavigationModal, setShowNavigationModal] = useState(false);

  // 드래그 Ref
  const draggedColIdx = useRef(null);
  const draggedRowIdx = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // 브라우저 이탈 방지
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

  // 1. DB 데이터를 Edit 화면 스키마로 1:1 변환 (컬럼 고정 없음)
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

// 2. Edit 화면에서 수정된 동적 컬럼/행 데이터를 DB 저장 형식으로 변환
const serializeTableToDetails = (columns, rows) => {
  return rows.map((row) => {
    const titleCol = columns.find((col) => col.includes('질문') || col.includes('항목')) || columns[0];
    const mainTitle = row.values[titleCol] || row.title || '자기소개서 항목';

    // 현재 설정된 모든 동적 컬럼을 [컬럼명] 블록으로 직렬화
    const contentLines = [];
    columns.forEach((col) => {
      const val = (row.values[col] || '').trim();
      if (!val) return;

      const formattedVal = val
        .split('\n')
        .map((line) => line.replace(/^[•\-\*\s]+/, '').trim())
        .filter(Boolean)
        .map((line) => `• ${line}`)
        .join('\n');

      contentLines.push(`[${col}]\n${formattedVal}`);
    });

    return {
      id: row.id || crypto.randomUUID(),
      title: mainTitle,
      original_text: contentLines.join('\n\n'),
      spell_checked_text: row.spell_checked_text || null,
      ai_proofread_text: row.ai_proofread_text || null,
      selected_version: row.selected_version || 'ORIGINAL'
    };
  });
};
  // 데이터 조회
  useEffect(() => {
    const fetchCoverLetterDetail = async () => {
      try {
        setIsLoading(true);
        setErrorMessage('');
        const response = await fetch(`${BASE_URL}/api/cover-letters/${coverLetterId}`);
        if (!response.ok) throw new Error('자기소개서 정보를 불러오지 못했습니다.');

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

    if (coverLetterId) fetchCoverLetterDetail();
  }, [coverLetterId]);

  // 섹션 삭제
  const handleDeleteSection = (secId) => {
    setPendingConfirm({
      title: '문항 섹션 삭제 확인',
      message: '이 자기소개서 섹션과 포함된 모든 항목을 삭제하시겠습니까? (저장 시 DB에 반영됩니다)',
      onConfirm: () => {
        setDeletedSectionIds((prev) => [...prev, secId]);
        setSections((prev) => prev.filter((sec) => sec.id !== secId));
        setIsDirty(true);
        setPendingConfirm(null);
        showToast('섹션이 삭제 목록에 추가되었습니다.');
      }
    });
  };

  // 컬럼 삭제
  const handleDeleteColumn = (sectionId, colToDelete) => {
    setPendingConfirm({
      title: '속성 삭제 확인',
      message: `'${colToDelete}' 속성을 삭제하시겠습니까? 해당 내용이 함께 제거됩니다.`,
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

  // DB 전체 저장
  const handleSaveAll = async (redirectAfter = false) => {
    try {
      setIsSaving(true);
      setErrorMessage('');

      // A. 삭제 요청
      const deletePromises = deletedSectionIds.map(async (secId) => {
        const res = await fetch(`${BASE_URL}/api/cover-letters/sections/${secId}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error(`섹션 삭제 실패 (ID: ${secId})`);
        return res.json();
      });

      // B. 업데이트 요청
      const updatePromises = sections.map(async (sec) => {
        const cleanDetails = serializeTableToDetails(sec.columns, sec.rows);
        const res = await fetch(`${BASE_URL}/api/cover-letters/sections/${sec.id}`, {
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
          throw new Error(errData.detail || `섹션 저장 실패 (${sec.section_title})`);
        }
        return res.json();
      });

      await Promise.all([...deletePromises, ...updatePromises]);

      setDeletedSectionIds([]);
      setIsDirty(false);
      showToast('성공적으로 저장되었습니다!');

      if (redirectAfter) {
        navigate(`/cover-letter/${coverLetterId}`);
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackToDetail = () => {
    if (isDirty) {
      setShowNavigationModal(true);
    } else {
      navigate(`/cover-letter/${coverLetterId}`);
    }
  };

  // 컬럼 Drag & Drop
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

  // 행 Drag & Drop
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

  // 속성 추가 및 변경
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

  // 행(문항) 조작
  const handleAddRow = (sectionId) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id === sectionId) {
          const newRow = {
            id: crypto.randomUUID(),
            title: '',
            spell_checked_text: null,
            ai_proofread_text: null,
            selected_version: 'ORIGINAL',
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
        <p className="text-sm">자기소개서 불러오는 중...</p>
      </div>
    );
  }

const handleAddSection = async () => {
    try {
      setIsSaving(true);
      const newDisplayOrder = sections.length + 1;
      const defaultColumns = ['질문', '답변'];

      // API를 호출하여 백엔드 DB에 새 섹션 등록
      const res = await fetch(`${BASE_URL}/api/cover-letters/${coverLetterId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_type: 'CUSTOM',
          section_title: `${newDisplayOrder}. 새 섹션 항목`,
          display_order: newDisplayOrder,
          columns: defaultColumns,
          details: [
            {
              id: crypto.randomUUID(),
              title: '새 항목',
              original_text: '[질문]\n• 질문 내용을 입력하세요.\n\n[답변]\n• 답변 내용을 입력하세요.',
              selected_version: 'ORIGINAL'
            }
          ]
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || '새 섹션을 추가하지 못했습니다.');
      }

      const createdSection = await res.json();

      // 서버 응답 데이터를 화면 테이블 스키마에 맞게 파싱
      const { columns, rows } = parseDetailsToTableSchema(
        createdSection.details, 
        createdSection.columns
      );

      const formattedNewSec = {
        ...createdSection,
        columns,
        rows
      };

      // 화면 상태 업데이트
      setSections((prev) => [...prev, formattedNewSec]);
      showToast('새 섹션이 추가되었습니다!');
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#07051E] text-slate-100 p-6 md:p-10 font-sans relative pb-28">
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-indigo-600/90 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-indigo-400/40 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-300" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      <div className="max-w-[95%] mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-indigo-950 pb-6 gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToDetail}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-900/60 hover:bg-indigo-600/90 text-indigo-100 hover:text-white border border-indigo-500/50 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 group shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-indigo-300 group-hover:text-white group-hover:-translate-x-0.5 transition-transform" />
              <span>상세 보기로 돌아가기</span>
            </button>

            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                자기소개서 편집기
                {isDirty && (
                  <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full">
                    수정 중
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
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/50 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 rounded-xl text-xs font-semibold transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>섹션 삭제</span>
                </button>
              </div>

              {/* 동적 컬럼(속성) 설정 */}
              <div className="bg-[#07051E] border border-indigo-900/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    📌 문항 속성 (드래그하여 순서 변경)
                  </span>

                  {addingColSectionId === sec.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        autoFocus
                        value={newColName}
                        onChange={(e) => setNewColName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirmAddColumn(sec.id)}
                        placeholder="속성명 (예: 질문 항목, 작성 내용)"
                        className="bg-[#130E3D] text-xs text-indigo-100 border border-indigo-500 rounded px-2 py-1 focus:outline-none w-40"
                      />
                      <button
                        onClick={() => handleConfirmAddColumn(sec.id)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white p-1 rounded"
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
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> + 속성 추가
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
                      className="flex items-center bg-[#130E3D] hover:bg-[#1A144E] border border-indigo-800/60 rounded-lg px-2.5 py-1.5 gap-1.5 text-xs text-indigo-200 cursor-grab active:cursor-grabbing"
                    >
                      <GripVertical className="w-3.5 h-3.5 text-indigo-400/70" />
                      <input
                        type="text"
                        value={col}
                        onChange={(e) => handleRenameColumn(sec.id, col, e.target.value)}
                        className="bg-transparent font-semibold border-b border-transparent focus:border-indigo-400 focus:outline-none w-28 text-xs text-indigo-200"
                      />
                      <button
                        onClick={() => handleDeleteColumn(sec.id, col)}
                        className="text-slate-500 hover:text-rose-400 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 항목(Detail) 편집 카드 */}
              <div className="space-y-6">
                {sec.rows && sec.rows.length > 0 ? (
                  sec.rows.map((row, rIdx) => (
                    <div
                      key={row.id}
                      draggable
                      onDragStart={(e) => handleRowDragStart(e, rIdx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleRowDrop(e, sec.id, rIdx)}
                      className="bg-[#07051E] border border-indigo-900/60 hover:border-indigo-700/80 rounded-xl p-5 space-y-4 shadow-md group"
                    >
                      <div className="flex items-center justify-between border-b border-indigo-950 pb-2">
                        <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5 cursor-grab active:cursor-grabbing">
                          <GripVertical className="w-4 h-4 text-indigo-400/70" />
                          문항 #{rIdx + 1}
                        </span>

                        <button
                          onClick={() => handleDeleteRow(sec.id, row.id)}
                          className="text-slate-500 hover:text-rose-400 text-xs flex items-center gap-1 p-1 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> 삭제
                        </button>
                      </div>

                      <div className="overflow-x-auto pb-2">
                        <div className="flex gap-4 min-w-max">
                          {sec.columns.map((col) => {
                            const val = row.values[col] || '';
                            const isMultiLine = col.includes('내용') || col.includes('작성') || val.includes('\n');

                            return (
                              <div
                                key={col}
                                className="w-80 bg-[#0B0826] p-3 rounded-lg border border-indigo-950/80 flex flex-col gap-2 shrink-0"
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
                                    className="text-xs text-indigo-400 hover:text-indigo-200 flex items-center gap-1 bg-indigo-950/70 px-2 py-0.5 rounded border border-indigo-800/50"
                                  >
                                    <Maximize2 className="w-3 h-3" />
                                    <span className="text-[11px]">확대</span>
                                  </button>
                                </div>

                                {isMultiLine ? (
                                  <textarea
                                    rows={5}
                                    value={val}
                                    onChange={(e) => handleCellChange(sec.id, row.id, col, e.target.value)}
                                    placeholder={`${col} 입력...`}
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
                  <p className="text-xs text-slate-500 italic py-2">등록된 문항이 없습니다.</p>
                )}
              </div>

              <button
                onClick={() => handleAddRow(sec.id)}
                className="w-full py-2.5 border border-dashed border-indigo-900/80 hover:border-indigo-500/60 rounded-xl text-xs text-indigo-400 flex items-center justify-center gap-1.5 transition-all bg-indigo-950/20"
              >
                <Plus className="w-4 h-4" /> + 새 문항 추가
              </button>
            </div>
          ))}
        </div>

        <button
            onClick={handleAddSection}
            disabled={isSaving}
            className="w-full py-4 border-2 border-dashed border-indigo-700/60 hover:border-indigo-500 bg-indigo-950/30 hover:bg-indigo-900/40 text-indigo-300 font-bold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.99] disabled:opacity-50"
          >
            <PlusCircle className="w-5 h-5 text-indigo-400" />
            <span>+ 새 자기소개서 섹션 추가</span>
          </button>
      </div>
      
      {/* 하단 저장 버튼 */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => handleSaveAll(false)}
          disabled={isSaving}
          className="flex items-center gap-2.5 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-sm rounded-2xl shadow-2xl border border-indigo-400/30 transition-all disabled:opacity-50"
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

      {/* 확대 작성 모달 */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0E0B2D] border border-indigo-800/80 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-indigo-900/60 bg-[#07051E]">
              <div>
                <span className="text-xs text-indigo-400">문항 #{activeModal.rowIdx} / {activeModal.colName}</span>
                <h3 className="text-lg font-bold text-white">{activeModal.colName} 상세 내용 작성</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white p-1">
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
                className="w-full flex-1 min-h-[350px] bg-[#07051E] text-sm text-slate-100 border border-indigo-900/80 rounded-xl p-4 focus:border-indigo-500 focus:outline-none resize-none leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end px-6 py-4 border-t border-indigo-900/60 bg-[#07051E]">
              <button
                onClick={() => setActiveModal(null)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-xl flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> 적용 및 닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 확인 모달 */}
      {pendingConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0E0B2D] border border-indigo-800/80 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">{pendingConfirm.title}</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{pendingConfirm.message}</p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPendingConfirm(null)}
                className="px-4 py-2 bg-indigo-950 text-slate-300 text-xs font-semibold rounded-xl"
              >
                취소
              </button>
              <button
                onClick={pendingConfirm.onConfirm}
                className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl"
              >
                삭제 진행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 페이지 이동 확인 모달 */}
      {showNavigationModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0E0B2D] border border-indigo-800/80 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">저장되지 않은 변경사항</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              수정 중인 내용이 있습니다. 저장하고 이동하시겠습니까?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowNavigationModal(false)}
                className="px-4 py-2 bg-indigo-950 text-slate-400 text-xs font-semibold rounded-xl"
              >
                취소
              </button>
              <button
                onClick={() => {
                  setShowNavigationModal(false);
                  navigate(`/cover-letter/${coverLetterId}`);
                }}
                className="px-4 py-2 bg-slate-800 text-rose-300 text-xs font-bold rounded-xl"
              >
                저장 안 함
              </button>
              <button
                onClick={async () => {
                  setShowNavigationModal(false);
                  await handleSaveAll(true);
                }}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl"
              >
                저장 후 이동
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoverLetterEdit;