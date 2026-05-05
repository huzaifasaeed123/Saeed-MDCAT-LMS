// modules/questionbank/pages/AutoTestGeneratorPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiZap, FiInfo, FiPlus, FiMinus, FiChevronRight } from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import useAuth from '../../../core/auth/useAuth';

// ─── Checkbox row ─────────────────────────────────────────────────────────────
const CheckRow = ({ checked, onChange, label, count, countColor }) => (
  <label className="flex items-center gap-2.5 cursor-pointer select-none group">
    <div
      onClick={onChange}
      className={`w-5 h-5 border-2 rounded flex-shrink-0 flex items-center justify-center transition-colors ${
        checked ? 'bg-orange-400 border-orange-400' : 'border-gray-300 group-hover:border-orange-300'
      }`}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
          <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      )}
    </div>
    <span className="text-sm text-gray-800">{label}</span>
    {count !== undefined && count !== null && (
      <span className={`ml-1 text-xs px-1.5 py-0.5 rounded font-medium ${countColor || 'bg-gray-100 text-gray-500'}`}>
        {count}
      </span>
    )}
  </label>
);

// ─── AutoTestGeneratorPage ────────────────────────────────────────────────────
const AutoTestGeneratorPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAdmin, isTeacher } = useAuth();
  const isStudent = !isAdmin && !isTeacher;

  const initQbId   = searchParams.get('qbId')   || '';
  const initTestId = searchParams.get('testId') || '';

  // QB
  const [banks, setBanks]               = useState([]);
  const [qbId, setQbId]                 = useState(initQbId);
  const [selectedBank, setSelectedBank] = useState(null);

  // Existing test pre-fill
  const [existingTest, setExistingTest] = useState(null);

  // Selections (Set-based) — sequential: subject first, then chapter, then topic
  const [selectedSubjectIds, setSelectedSubjectIds] = useState(new Set());
  const [selectedChapterIds, setSelectedChapterIds] = useState(new Set());
  const [selectedTopicIds,   setSelectedTopicIds]   = useState(new Set());
  const [expandedChapters,   setExpandedChapters]   = useState(new Set());

  // Per-topic total MCQ count (all users)
  const [topicCounts, setTopicCounts] = useState({});

  // User's history data — fetched ONCE per QB, never re-fetched on scope change
  const [modeCounts,   setModeCounts]   = useState({ total: null, unused: null, incorrect: null, correct: null, omitted: null, marked: null });
  const [byTopic,      setByTopic]      = useState({}); // { topicId: { attempted, incorrect, correct, omitted, marked } }
  const [countLoading, setCountLoading] = useState(false);

  // Question mode — students only; default: 'unused'
  const [selectedModes, setSelectedModes] = useState(new Set(['unused']));

  // Test config
  const [mcqCount,     setMcqCount]     = useState('');
  const [testTitle,    setTestTitle]    = useState('');
  const [generating,   setGenerating]   = useState(false);
  const [maxMcqsLimit, setMaxMcqsLimit] = useState(null);

  // ── Bootstrap ────────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      apiClient.get('/question-banks'),
      apiClient.get('/settings').catch(() => ({ data: { data: {} } })),
    ]).then(([qbRes, settingsRes]) => {
      if (qbRes.data.success) {
        const bankList = qbRes.data.data;
        setBanks(bankList);
        const defaultQb = settingsRes.data.data?.defaultQuestionBankId;
        if (defaultQb && !initQbId) setQbId(defaultQb._id || defaultQb);
      }
      if (settingsRes.data.data?.maxMcqsPerAutoTest) {
        setMaxMcqsLimit(settingsRes.data.data.maxMcqsPerAutoTest);
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initTestId) {
      apiClient.get(`/tests/${initTestId}`)
        .then((r) => {
          if (r.data.success) {
            const t = r.data.data;
            setExistingTest(t);
            if (!isStudent) setTestTitle(t.title);
            const bid = t.questionBankId?._id || t.questionBankId;
            if (bid && !qbId) { setQbId(bid); fetchFullBank(bid); }
          }
        })
        .catch(() => {});
    }
  }, [initTestId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (qbId && banks.length > 0) {
      const b = banks.find((b) => b._id === qbId);
      if (b && !selectedBank) fetchFullBank(qbId);
    }
  }, [qbId, banks]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch QB structure + user history — ONE call each, no re-fetch on scope change
  const fetchFullBank = async (id) => {
    setCountLoading(true);
    try {
      const [bankRes, countsRes, histRes] = await Promise.all([
        apiClient.get(`/question-banks/${id}`),
        apiClient.get(`/mcqs/question-bank/${id}/topic-counts`),
        apiClient.get(`/question-banks/${id}/user-mcq-counts`), // no scope params — QB-level only
      ]);
      if (bankRes.data.success)   setSelectedBank(bankRes.data.data);
      if (countsRes.data.success) setTopicCounts(countsRes.data.data);
      if (histRes.data.success) {
        const d = histRes.data.data;
        setModeCounts(d);
        setByTopic(d.byTopic || {});
      }
    } catch { toast.error('Failed to load question bank'); }
    finally { setCountLoading(false); }
  };

  const handleBankChange = (e) => {
    const id = e.target.value;
    setQbId(id);
    setSelectedBank(null);
    setTopicCounts({});
    setByTopic({});
    setModeCounts({ total: null, unused: null, incorrect: null, correct: null, omitted: null, marked: null });
    setSelectedSubjectIds(new Set());
    setSelectedChapterIds(new Set());
    setSelectedTopicIds(new Set());
    setExpandedChapters(new Set());
    if (id) fetchFullBank(id);
  };

  // ── Derived hierarchy ─────────────────────────────────────────────────────────
  const subjects = selectedBank?.subjects || [];

  // Chapters only visible after ≥1 subject selected (sequential flow enforcement)
  const visibleChapters = useMemo(
    () => selectedSubjectIds.size > 0
      ? subjects
          .filter((s) => selectedSubjectIds.has(s._id))
          .flatMap((s) => (s.chapters || []).map((c) => ({ ...c, subjectId: s._id })))
      : [],
    [subjects, selectedSubjectIds],
  );

  // ── Mode-aware count functions (all client-side, zero API calls) ──────────────
  // Returns MCQ count for a topic factoring in selected modes
  const topicModeCount = useCallback((topicId) => {
    const total = topicCounts[topicId] || 0;
    if (!isStudent || selectedModes.size === 0) return total;
    const h = byTopic[topicId] || {};
    let count = 0;
    for (const mode of selectedModes) {
      if (mode === 'unused') count += Math.max(0, total - (h.attempted || 0));
      else count += h[mode] || 0;
    }
    return count;
  }, [topicCounts, byTopic, selectedModes, isStudent]);

  const chapterModeCount = useCallback(
    (chapter) => (chapter.topics || []).reduce((sum, t) => sum + topicModeCount(t._id), 0),
    [topicModeCount],
  );

  const subjectModeCount = useCallback(
    (subject) => (subject.chapters || []).reduce((sum, c) => sum + chapterModeCount(c), 0),
    [chapterModeCount],
  );

  // Total available for the current selection — drives the generate button & validation
  const selectedAvailable = useMemo(() => {
    if (modeCounts.total === null) return null;

    if (selectedTopicIds.size > 0) {
      return [...selectedTopicIds].reduce((sum, tid) => sum + topicModeCount(tid), 0);
    }
    if (selectedChapterIds.size > 0) {
      const chapMap = {};
      subjects.forEach((s) => (s.chapters || []).forEach((c) => { chapMap[c._id] = c; }));
      return [...selectedChapterIds].reduce((sum, cid) => sum + chapterModeCount(chapMap[cid] || { topics: [] }), 0);
    }
    if (selectedSubjectIds.size > 0) {
      return subjects
        .filter((s) => selectedSubjectIds.has(s._id))
        .reduce((sum, s) => sum + subjectModeCount(s), 0);
    }

    // Nothing selected — QB-level total for selected modes
    if (!isStudent || selectedModes.size === 0) return modeCounts.total;
    return [...selectedModes].reduce((sum, m) => sum + (modeCounts[m] || 0), 0);
  }, [selectedTopicIds, selectedChapterIds, selectedSubjectIds, selectedModes,
      modeCounts, topicModeCount, chapterModeCount, subjectModeCount, subjects, isStudent]);

  const totalQbMcqs = useMemo(
    () => Object.values(topicCounts).reduce((a, b) => a + b, 0),
    [topicCounts],
  );

  // ── Toggles ──────────────────────────────────────────────────────────────────
  const toggleSubject = (id) => {
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Clear chapters/topics that belonged to this subject
        const subj = subjects.find((s) => s._id === id);
        const subjChapterIds = new Set((subj?.chapters || []).map((c) => c._id));
        const subjTopicIds   = new Set((subj?.chapters || []).flatMap((c) => (c.topics || []).map((t) => t._id)));
        setSelectedChapterIds((pc) => new Set([...pc].filter((cid) => !subjChapterIds.has(cid))));
        setSelectedTopicIds((pt) => new Set([...pt].filter((tid) => !subjTopicIds.has(tid))));
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleChapter = (chapter) => {
    const id = chapter._id;
    setSelectedChapterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        const topicIds = (chapter.topics || []).map((t) => t._id);
        setSelectedTopicIds((pt) => new Set([...pt].filter((tid) => !topicIds.includes(tid))));
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleTopic = (tid) => {
    setSelectedTopicIds((prev) => {
      const next = new Set(prev);
      next.has(tid) ? next.delete(tid) : next.add(tid);
      return next;
    });
  };

  const toggleExpandChapter = (id) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAllSubjects = () => {
    if (selectedSubjectIds.size === subjects.length) {
      setSelectedSubjectIds(new Set());
      setSelectedChapterIds(new Set());
      setSelectedTopicIds(new Set());
    } else {
      setSelectedSubjectIds(new Set(subjects.map((s) => s._id)));
    }
  };

  const toggleMode = (mode) => {
    setSelectedModes((prev) => {
      const next = new Set(prev);
      next.has(mode) ? next.delete(mode) : next.add(mode);
      return next;
    });
  };

  // ── Generate ─────────────────────────────────────────────────────────────────
  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!qbId)                              { toast.error('Select a Question Bank'); return; }
    if (!mcqCount || Number(mcqCount) < 1) { toast.error('Enter number of MCQs'); return; }
    if (!existingTest && !isStudent && !testTitle.trim()) { toast.error('Enter a test title'); return; }
    if (selectedAvailable !== null && Number(mcqCount) > selectedAvailable) {
      toast.error(`Only ${selectedAvailable} MCQs available for the selected filter`); return;
    }
    if (maxMcqsLimit !== null && Number(mcqCount) > maxMcqsLimit) {
      toast.error(`Max ${maxMcqsLimit} MCQs allowed per test`); return;
    }

    setGenerating(true);
    try {
      const payload = { questionBankId: qbId, count: Number(mcqCount) };
      if (!isStudent && !existingTest) payload.testTitle = testTitle;
      if (existingTest) payload.existingTestId = existingTest._id;
      if (selectedTopicIds.size > 0)        payload.topicIds   = [...selectedTopicIds];
      else if (selectedChapterIds.size > 0) payload.chapterIds = [...selectedChapterIds];
      else if (selectedSubjectIds.size > 0) payload.subjectIds = [...selectedSubjectIds];
      if (isStudent && selectedModes.size > 0) payload.questionMode = [...selectedModes];

      const res = await apiClient.post('/question-banks/generate-test', payload);
      if (res.data.success) {
        const testData = res.data.data;
        const msg = existingTest
          ? `Added ${testData.totalQuestions} MCQs to test!`
          : `Test "${testData.title}" created with ${testData.totalQuestions} MCQs!`;
        toast.success(msg);
        if (isAdmin || isTeacher) {
          navigate(`/tests/${testData._id}`);
        } else {
          navigate(`/student/tests/${testData._id}`, { state: { testData } });
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate test');
    } finally {
      setGenerating(false);
    }
  };

  // ── Mode config ───────────────────────────────────────────────────────────────
  const MODE_ORDER = ['unused', 'incorrect', 'marked', 'omitted', 'correct'];
  const MODE_META  = {
    unused:    { label: 'Unused',    countColor: 'bg-blue-100 text-blue-700' },
    incorrect: { label: 'Incorrect', countColor: 'bg-red-100 text-red-700' },
    marked:    { label: 'Marked',    countColor: 'bg-yellow-100 text-yellow-700' },
    omitted:   { label: 'Omitted',   countColor: 'bg-gray-100 text-gray-500' },
    correct:   { label: 'Correct',   countColor: 'bg-green-100 text-green-700' },
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Test</h1>

      {existingTest && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <FiInfo className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Adding MCQs to existing test</p>
            <p className="text-sm text-blue-600">"{existingTest.title}" — selected MCQs will be appended.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleGenerate} className="space-y-5">

        {/* ── Step 0: Question Bank ── */}
        <div className="bg-white rounded-2xl border p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Question Bank</h2>
          <select value={qbId} onChange={handleBankChange}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
            <option value="">— Select Question Bank —</option>
            {banks.map((b) => <option key={b._id} value={b._id}>{b.title}</option>)}
          </select>
        </div>

        {/* ── Step 1: Question Mode (students only) ── */}
        {isStudent && selectedBank && (
          <div className="bg-white rounded-2xl border p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 bg-orange-100 text-orange-600 rounded-full text-xs font-bold flex items-center justify-center">1</span>
                <h2 className="font-semibold text-gray-800">Question Mode</h2>
                <FiInfo className="w-4 h-4 text-gray-400" title="Filter questions by your attempt history" />
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <span>Total</span>
                {countLoading ? (
                  <span className="w-10 h-5 bg-gray-100 rounded animate-pulse inline-block" />
                ) : (
                  <span className="font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-full text-xs">
                    {modeCounts.total ?? totalQbMcqs}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {MODE_ORDER.map((mode) => (
                <CheckRow
                  key={mode}
                  checked={selectedModes.has(mode)}
                  onChange={() => toggleMode(mode)}
                  label={MODE_META[mode].label}
                  count={countLoading ? undefined : modeCounts[mode]}
                  countColor={MODE_META[mode].countColor}
                />
              ))}
            </div>

            {selectedModes.size === 0 && (
              <p className="mt-3 text-xs text-gray-400">No mode selected — all MCQs in scope will be picked.</p>
            )}
          </div>
        )}

        {/* ── Step 2: Subjects ── */}
        {selectedBank && subjects.length > 0 && (
          <div className="bg-white rounded-2xl border p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {isStudent && (
                  <span className="w-6 h-6 bg-orange-100 text-orange-600 rounded-full text-xs font-bold flex items-center justify-center">2</span>
                )}
                <h2 className="font-semibold text-gray-800">Subjects</h2>
              </div>
              <span className="text-xs text-gray-400">Optional — select to narrow scope</span>
            </div>

            <div className="mb-3 pb-3 border-b border-gray-100">
              <CheckRow
                checked={selectedSubjectIds.size === subjects.length && subjects.length > 0}
                onChange={toggleSelectAllSubjects}
                label="Select All"
                count={countLoading ? undefined : (
                  !isStudent || selectedModes.size === 0
                    ? (totalQbMcqs || undefined)
                    : [...selectedModes].reduce((s, m) => s + (modeCounts[m] || 0), 0)
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {subjects.map((s) => (
                <CheckRow
                  key={s._id}
                  checked={selectedSubjectIds.has(s._id)}
                  onChange={() => toggleSubject(s._id)}
                  label={s.title}
                  count={countLoading ? undefined : subjectModeCount(s)}
                  countColor={isStudent && selectedModes.size > 0 ? 'bg-orange-50 text-orange-700' : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3: Chapters & Topics — only after subject selected ── */}
        {selectedBank && subjects.length > 0 && (
          <div className="bg-white rounded-2xl border p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                {isStudent && (
                  <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                    selectedSubjectIds.size > 0 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'
                  }`}>3</span>
                )}
                <h2 className={`font-semibold ${selectedSubjectIds.size > 0 ? 'text-gray-800' : 'text-gray-400'}`}>
                  Chapters &amp; Topics
                </h2>
              </div>
              <p className="text-xs text-gray-400">Expand (+) to see topics</p>
            </div>

            {selectedSubjectIds.size === 0 ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
                <FiChevronRight className="w-4 h-4 flex-shrink-0" />
                Select at least one subject above to browse chapters
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-400 mb-4">Optional — select chapters or topics for testing.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  {visibleChapters.map((chap) => {
                    const cnt        = chapterModeCount(chap);
                    const isExpanded = expandedChapters.has(chap._id);
                    return (
                      <div key={chap._id}>
                        <div className="flex items-center gap-2 py-1.5 group">
                          <button type="button" onClick={() => toggleExpandChapter(chap._id)}
                            className="w-5 h-5 flex-shrink-0 text-orange-400 hover:text-orange-600 transition-colors">
                            {isExpanded ? <FiMinus className="w-4 h-4" /> : <FiPlus className="w-4 h-4" />}
                          </button>
                          <CheckRow
                            checked={selectedChapterIds.has(chap._id)}
                            onChange={() => toggleChapter(chap)}
                            label={chap.title}
                            count={countLoading ? undefined : cnt}
                            countColor={isStudent && selectedModes.size > 0 ? 'bg-orange-50 text-orange-700' : undefined}
                          />
                        </div>
                        {isExpanded && (chap.topics || []).length > 0 && (
                          <div className="ml-7 mt-1 mb-2 space-y-1 pl-2 border-l-2 border-orange-100">
                            {chap.topics.map((topic) => (
                              <CheckRow
                                key={topic._id}
                                checked={selectedTopicIds.has(topic._id)}
                                onChange={() => toggleTopic(topic._id)}
                                label={topic.title}
                                count={countLoading ? undefined : topicModeCount(topic._id)}
                                countColor={isStudent && selectedModes.size > 0 ? 'bg-orange-50 text-orange-700' : undefined}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Available count */}
            {selectedSubjectIds.size > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm">
                <FiInfo className="text-orange-400 w-4 h-4" />
                {countLoading ? (
                  <span className="text-gray-400">Counting…</span>
                ) : selectedAvailable !== null ? (
                  <span className={`font-semibold ${selectedAvailable === 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {selectedAvailable} MCQ{selectedAvailable !== 1 ? 's' : ''} available
                    {isStudent && selectedModes.size > 0 && (
                      <span className="text-gray-400 font-normal"> for selected mode{selectedModes.size > 1 ? 's' : ''}</span>
                    )}
                  </span>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* ── Test settings ── */}
        <div className="bg-white rounded-2xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Test Settings</h2>

          {!isStudent && !existingTest && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Test Title <span className="text-red-500">*</span>
              </label>
              <input type="text" value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                placeholder="e.g. Biology Mock Test #1"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          )}

          {isStudent && !existingTest && (
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <FiInfo className="w-3.5 h-3.5" />
              Test name will be assigned automatically (e.g. Test10001).
            </p>
          )}

          <div>
            {(() => {
              const effectiveMax = Math.min(selectedAvailable ?? Infinity, maxMcqsLimit ?? Infinity);
              const maxLabel = isFinite(effectiveMax) ? effectiveMax : null;
              return (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of MCQs <span className="text-red-500">*</span>
                    {maxLabel !== null && <span className="text-gray-400 font-normal"> (max {maxLabel})</span>}
                  </label>
                  <input
                    type="number" value={mcqCount} min={1}
                    max={isFinite(effectiveMax) ? effectiveMax : undefined}
                    onChange={(e) => setMcqCount(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </>
              );
            })()}
          </div>
        </div>

        {/* ── Available summary (when no scope selected) ── */}
        {selectedBank && selectedSubjectIds.size === 0 && selectedAvailable !== null && (
          <div className="flex items-center gap-2 text-sm px-1">
            <FiInfo className="text-orange-400 w-4 h-4 flex-shrink-0" />
            <span className={`font-semibold ${selectedAvailable === 0 ? 'text-red-500' : 'text-emerald-600'}`}>
              {selectedAvailable} MCQ{selectedAvailable !== 1 ? 's' : ''} available across all subjects
              {isStudent && selectedModes.size > 0 && (
                <span className="text-gray-400 font-normal"> for selected mode{selectedModes.size > 1 ? 's' : ''}</span>
              )}
            </span>
          </div>
        )}

        {/* ── Generate button ── */}
        <button type="submit"
          disabled={generating || !qbId || selectedAvailable === 0}
          className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 transition-colors text-base">
          <FiZap className="w-5 h-5" />
          {generating
            ? 'Generating…'
            : existingTest
              ? `Add MCQs to "${existingTest.title}"`
              : 'Create Test'}
        </button>
      </form>
    </div>
  );
};

export default AutoTestGeneratorPage;
