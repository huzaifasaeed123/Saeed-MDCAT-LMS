// modules/questionbank/pages/AutoTestGeneratorPage.jsx
// Auto Test Generator — accessible to all roles.
// Matches the attached screenshot: Tutor/Timer mode, subjects, chapters (flat), topics (expandable).
// Accepts ?testId= to add MCQs to an existing test instead of creating a new one.
// Accepts ?qbId= to pre-select a Question Bank.
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiZap, FiInfo, FiPlus, FiMinus } from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import useAuth from '../../../core/auth/useAuth';

// ─── Checkbox row ─────────────────────────────────────────────────────────────
const CheckRow = ({ checked, onChange, label, count }) => (
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
    {count !== undefined && (
      <span className="ml-1 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{count}</span>
    )}
  </label>
);

// ─── AutoTestGeneratorPage ────────────────────────────────────────────────────
const AutoTestGeneratorPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAdmin, isTeacher } = useAuth();

  const initQbId    = searchParams.get('qbId')    || '';
  const initTestId  = searchParams.get('testId')  || '';

  // QB
  const [banks, setBanks]           = useState([]);
  const [qbId, setQbId]             = useState(initQbId);
  const [selectedBank, setSelectedBank] = useState(null);

  // Existing test pre-fill
  const [existingTest, setExistingTest] = useState(null);

  // Selections (Set-based)
  const [selectedSubjectIds, setSelectedSubjectIds] = useState(new Set());
  const [selectedChapterIds, setSelectedChapterIds] = useState(new Set());
  const [selectedTopicIds,   setSelectedTopicIds]   = useState(new Set());
  const [expandedChapters,   setExpandedChapters]   = useState(new Set());

  // Counts
  const [mcqCount,     setMcqCount]     = useState(null);
  const [countLoading, setCountLoading] = useState(false);
  const [topicCounts,  setTopicCounts]  = useState({});

  // Test config
  const [testConfig, setTestConfig] = useState({
    testTitle: '',
    count: '',
  });

  const [generating, setGenerating] = useState(false);
  const [maxMcqsLimit, setMaxMcqsLimit] = useState(null); // from admin settings

  // ── Bootstrap ────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Load QB list and admin settings in parallel
    Promise.all([
      apiClient.get('/question-banks'),
      apiClient.get('/settings').catch(() => ({ data: { data: {} } })),
    ]).then(([qbRes, settingsRes]) => {
      if (qbRes.data.success) {
        const bankList = qbRes.data.data;
        setBanks(bankList);
        // Apply default QB from settings (only if no qbId already set)
        // defaultQuestionBankId is populated by backend → may be {_id,title} object
        const defaultQb = settingsRes.data.data?.defaultQuestionBankId;
        if (defaultQb && !initQbId) {
          setQbId(defaultQb._id || defaultQb);
        }
      }
      if (settingsRes.data.data?.maxMcqsPerAutoTest) {
        setMaxMcqsLimit(settingsRes.data.data.maxMcqsPerAutoTest);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (initTestId) {
      apiClient.get(`/tests/${initTestId}`)
        .then((r) => {
          if (r.data.success) {
            const t = r.data.data;
            setExistingTest(t);
            setTestConfig((p) => ({ ...p, testTitle: t.title }));
            // Pre-select QB if test has one
            const bid = t.questionBankId?._id || t.questionBankId;
            if (bid && !qbId) { setQbId(bid); fetchFullBank(bid); }
          }
        })
        .catch(() => {});
    }
  }, [initTestId]);

  useEffect(() => {
    if (qbId && banks.length > 0) {
      const b = banks.find((b) => b._id === qbId);
      if (b && !selectedBank) fetchFullBank(qbId);
    }
  }, [qbId, banks]);

  const fetchFullBank = async (id) => {
    try {
      const [bankRes, countsRes] = await Promise.all([
        apiClient.get(`/question-banks/${id}`),
        apiClient.get(`/mcqs/question-bank/${id}/topic-counts`),
      ]);
      if (bankRes.data.success)   setSelectedBank(bankRes.data.data);
      if (countsRes.data.success) setTopicCounts(countsRes.data.data);
    } catch { toast.error('Failed to load question bank'); }
  };

  const handleBankChange = (e) => {
    const id = e.target.value;
    setQbId(id); setSelectedBank(null); setTopicCounts({});
    setSelectedSubjectIds(new Set()); setSelectedChapterIds(new Set()); setSelectedTopicIds(new Set());
    setExpandedChapters(new Set()); setMcqCount(null);
    if (id) fetchFullBank(id);
  };

  // ── Derived hierarchy ────────────────────────────────────────────────────────
  const subjects = selectedBank?.subjects || [];

  // If any subject is selected, only show its chapters; otherwise show all
  const visibleChapters = subjects
    .filter((s) => selectedSubjectIds.size === 0 || selectedSubjectIds.has(s._id))
    .flatMap((s) => (s.chapters || []).map((c) => ({ ...c, subjectId: s._id })));

  // ── Count per chapter (sum of its topics) ────────────────────────────────────
  const chapterCount = (chapter) =>
    (chapter.topics || []).reduce((sum, t) => sum + (topicCounts[t._id] || 0), 0);

  // ── Toggles ──────────────────────────────────────────────────────────────────
  const toggleSubject = (id) => {
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Clear chapters/topics from OTHER subjects when adding a subject filter
        const subj = subjects.find((s) => s._id === id);
        const subjectChapterIds = new Set((subj?.chapters || []).map((c) => c._id));
        setSelectedChapterIds((pc) => new Set([...pc].filter((cid) => subjectChapterIds.has(cid))));
        setSelectedTopicIds((pt) => {
          const validTopicIds = new Set(
            (subj?.chapters || []).flatMap((c) => (c.topics || []).map((t) => t._id))
          );
          return new Set([...pt].filter((tid) => validTopicIds.has(tid)));
        });
      }
      return next;
    });
    setMcqCount(null);
  };

  const toggleChapter = (chapter) => {
    const id = chapter._id;
    setSelectedChapterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Also remove topics of this chapter
        const topicIds = (chapter.topics || []).map((t) => t._id);
        setSelectedTopicIds((pt) => new Set([...pt].filter((tid) => !topicIds.includes(tid))));
      } else {
        next.add(id);
      }
      return next;
    });
    setMcqCount(null);
  };

  const toggleTopic = (tid) => {
    setSelectedTopicIds((prev) => {
      const next = new Set(prev);
      next.has(tid) ? next.delete(tid) : next.add(tid);
      return next;
    });
    setMcqCount(null);
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
    setMcqCount(null);
  };

  // ── Total MCQ count ──────────────────────────────────────────────────────────
  const fetchCount = useCallback(async () => {
    if (!qbId) return;
    setCountLoading(true);
    try {
      if (selectedTopicIds.size > 0) {
        let total = 0;
        for (const id of selectedTopicIds) {
          const r = await apiClient.get(`/question-banks/${qbId}/mcq-count?topicId=${id}`);
          if (r.data.success) total += r.data.count;
        }
        setMcqCount(total);
      } else if (selectedChapterIds.size > 0) {
        let total = 0;
        for (const id of selectedChapterIds) {
          const r = await apiClient.get(`/question-banks/${qbId}/mcq-count?chapterId=${id}`);
          if (r.data.success) total += r.data.count;
        }
        setMcqCount(total);
      } else if (selectedSubjectIds.size > 0) {
        let total = 0;
        for (const id of selectedSubjectIds) {
          const r = await apiClient.get(`/question-banks/${qbId}/mcq-count?subjectId=${id}`);
          if (r.data.success) total += r.data.count;
        }
        setMcqCount(total);
      } else {
        const r = await apiClient.get(`/question-banks/${qbId}/mcq-count`);
        if (r.data.success) setMcqCount(r.data.count);
      }
    } catch { setMcqCount(null); }
    finally { setCountLoading(false); }
  }, [qbId, selectedSubjectIds, selectedChapterIds, selectedTopicIds]);

  useEffect(() => {
    const t = setTimeout(fetchCount, 400);
    return () => clearTimeout(t);
  }, [fetchCount]);

  // ── Generate ─────────────────────────────────────────────────────────────────
  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!qbId) { toast.error('Select a Question Bank'); return; }
    if (!testConfig.count || Number(testConfig.count) < 1) { toast.error('Enter number of MCQs'); return; }
    if (!existingTest && !testConfig.testTitle.trim()) { toast.error('Enter a test title'); return; }
    if (mcqCount !== null && Number(testConfig.count) > mcqCount) {
      toast.error(`Only ${mcqCount} MCQs available`); return;
    }
    if (maxMcqsLimit !== null && Number(testConfig.count) > maxMcqsLimit) {
      toast.error(`Max ${maxMcqsLimit} MCQs allowed per test`); return;
    }

    setGenerating(true);
    try {
      const payload = {
        questionBankId: qbId,
        count: Number(testConfig.count),
        testTitle: existingTest ? existingTest.title : testConfig.testTitle,
      };
      if (existingTest) payload.existingTestId = existingTest._id;
      if (selectedTopicIds.size > 0)        payload.topicIds   = [...selectedTopicIds];
      else if (selectedChapterIds.size > 0) payload.chapterIds = [...selectedChapterIds];
      else if (selectedSubjectIds.size > 0) payload.subjectIds = [...selectedSubjectIds];

      const res = await apiClient.post('/question-banks/generate-test', payload);
      if (res.data.success) {
        const msg = existingTest
          ? `Added ${res.data.data.totalQuestions} MCQs to test!`
          : `Test created with ${res.data.data.totalQuestions} MCQs!`;
        toast.success(msg);
        const newTestId = res.data.data._id;
        // Admin/teacher → manage test; student → start test
        if (isAdmin || isTeacher) {
          navigate(`/tests/${newTestId}`);
        } else {
          navigate(`/student/tests/${newTestId}`);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate test');
    } finally {
      setGenerating(false);
    }
  };

  const totalQbMcqs = Object.values(topicCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Test</h1>

      {existingTest && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <FiInfo className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Adding MCQs to existing test</p>
            <p className="text-sm text-blue-600">"{existingTest.title}" — selected MCQs will be added to this test.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleGenerate} className="space-y-5">

        {/* ── Question Bank selector ── */}
        <div className="bg-white rounded-2xl border p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Question Bank</h2>
          <select value={qbId} onChange={handleBankChange}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
            <option value="">— Select Question Bank —</option>
            {banks.map((b) => <option key={b._id} value={b._id}>{b.title}</option>)}
          </select>
        </div>

        {/* ── Subjects ── */}
        {selectedBank && subjects.length > 0 && (
          <div className="bg-white rounded-2xl border p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">Subjects</h2>
              <span className="text-xs text-gray-400">Select to filter chapters & topics</span>
            </div>

            {/* Select All */}
            <div className="mb-3 pb-3 border-b border-gray-100">
              <CheckRow
                checked={selectedSubjectIds.size === subjects.length && subjects.length > 0}
                onChange={toggleSelectAllSubjects}
                label="Select All"
                count={totalQbMcqs}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {subjects.map((s) => {
                const cnt = (s.chapters || []).flatMap((c) => c.topics || []).reduce((sum, t) => sum + (topicCounts[t._id] || 0), 0);
                return (
                  <CheckRow
                    key={s._id}
                    checked={selectedSubjectIds.has(s._id)}
                    onChange={() => toggleSubject(s._id)}
                    label={s.title}
                    count={cnt}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* ── Chapters (flat list, filtered by selected subjects) ── */}
        {selectedBank && visibleChapters.length > 0 && (
          <div className="bg-white rounded-2xl border p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-gray-800">Chapters</h2>
              <p className="text-xs text-gray-400">Select chapters and topics for testing.</p>
            </div>
            <p className="text-xs text-gray-400 mb-4">Click + to expand topics within a chapter.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
              {visibleChapters.map((chap) => {
                const cnt     = chapterCount(chap);
                const isExpanded = expandedChapters.has(chap._id);

                return (
                  <div key={chap._id}>
                    {/* Chapter row */}
                    <div className="flex items-center gap-2 py-1.5 group">
                      <button type="button" onClick={() => toggleExpandChapter(chap._id)}
                        className="w-5 h-5 flex-shrink-0 text-orange-400 hover:text-orange-600 transition-colors">
                        {isExpanded ? <FiMinus className="w-4 h-4" /> : <FiPlus className="w-4 h-4" />}
                      </button>
                      <CheckRow
                        checked={selectedChapterIds.has(chap._id)}
                        onChange={() => toggleChapter(chap)}
                        label={chap.title}
                        count={cnt}
                      />
                    </div>

                    {/* Topics (expanded) */}
                    {isExpanded && (chap.topics || []).length > 0 && (
                      <div className="ml-7 mt-1 mb-2 space-y-1 pl-2 border-l-2 border-orange-100">
                        {chap.topics.map((topic) => (
                          <CheckRow
                            key={topic._id}
                            checked={selectedTopicIds.has(topic._id)}
                            onChange={() => toggleTopic(topic._id)}
                            label={topic.title}
                            count={topicCounts[topic._id] ?? 0}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Available count */}
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm">
              <FiInfo className="text-orange-400 w-4 h-4" />
              {countLoading ? (
                <span className="text-gray-400">Counting…</span>
              ) : mcqCount !== null ? (
                <span className={`font-semibold ${mcqCount === 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                  {mcqCount} MCQ{mcqCount !== 1 ? 's' : ''} available
                </span>
              ) : null}
            </div>
          </div>
        )}

        {/* ── Test settings ── */}
        <div className="bg-white rounded-2xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Test Settings</h2>

          {!existingTest && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Title <span className="text-red-500">*</span></label>
              <input type="text" value={testConfig.testTitle}
                onChange={(e) => setTestConfig((p) => ({ ...p, testTitle: e.target.value }))}
                placeholder="e.g. Biology Mock Test #1"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          )}

          <div>
            {(() => {
              const effectiveMax = Math.min(
                mcqCount ?? Infinity,
                maxMcqsLimit ?? Infinity
              );
              const maxLabel = isFinite(effectiveMax) ? effectiveMax : null;
              return (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of MCQs <span className="text-red-500">*</span>
                    {maxLabel && (
                      <span className="text-gray-400 font-normal"> (max {maxLabel})</span>
                    )}
                  </label>
                  <input
                    type="number" value={testConfig.count} min={1}
                    max={isFinite(effectiveMax) ? effectiveMax : undefined}
                    onChange={(e) => setTestConfig((p) => ({ ...p, count: e.target.value }))}
                    placeholder="e.g. 50"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </>
              );
            })()}
          </div>
        </div>

        {/* ── Generate button ── */}
        <button type="submit"
          disabled={generating || !qbId || (mcqCount !== null && mcqCount === 0)}
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
