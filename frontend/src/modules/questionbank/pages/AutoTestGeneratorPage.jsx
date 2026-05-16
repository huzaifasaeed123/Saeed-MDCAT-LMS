// modules/questionbank/pages/AutoTestGeneratorPage.jsx
//
// SKN Academy LMS — Create Practice Test (post-redesign).
//
// Two-column layout (lg+):
//   • Main (8/12): four numbered step cards — Question Bank, Question Mode,
//     Subjects (with inline chapter/topic expansion), Test Settings
//   • Sidebar (4/12, sticky): live Test Summary + CTA button
// Below lg the sidebar drops below the main column (still sticky to viewport
// bottom-on-scroll? no — plain stacked, simpler on phones).
//
// Functional behaviour preserved 1:1 from the prior page:
//   • Same QB load, same per-topic counts, same user history scoping.
//   • Same `questionMode` filtering (unused / incorrect / correct / omitted / marked).
//   • Same sequential rule: chapter list shows only after a subject is picked.
//   • Same max-MCQs settings cap.
//   • Same existing-test "append MCQs" branch.
//
// New behaviour:
//   • Student picks a SINGLE test mode (tutor / timer) on this page, and the
//     test starts immediately — button reads "Create & Start Test", chains
//     POST /question-banks/generate-test → POST /user-tests/start.
//   • Staff (admin/teacher) picks ONE OR MORE allowed modes (multi-select);
//     these become test.allowedModes so the student can pick at start time.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiZap, FiInfo, FiPlus, FiMinus, FiChevronRight, FiCheckCircle,
  FiBookOpen, FiClock, FiPlayCircle, FiTarget, FiActivity,
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import useAuth from '../../../core/auth/useAuth';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';

// Time multipliers — match TestStartPage exactly so a test that auto-starts
// here uses the same total-duration math as one started via the regular flow.
const TIME_MULTIPLIERS = [
  { label: 'Standard (1×)',  value: 1.0, description: '60 sec / question', secsPerQ: 60 },
  { label: 'Fast (1.5×)',    value: 1.5, description: '40 sec / question', secsPerQ: 40 },
  { label: 'Very Fast (2×)', value: 2.0, description: '30 sec / question', secsPerQ: 30 },
];

// Mode-meta lookup powers both the chip pills (step 2) and the mode card
// (step 4). countColor pairs are deliberately distinct so visual scanning
// works without reading the label.
const MODE_ORDER = ['unused', 'incorrect', 'marked', 'omitted', 'correct'];
const MODE_META  = {
  unused:    { label: 'Unused',    countColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
  incorrect: { label: 'Incorrect', countColor: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
  marked:    { label: 'Marked',    countColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  omitted:   { label: 'Omitted',   countColor: 'bg-[var(--bg-muted)] text-[var(--text-muted)]' },
  correct:   { label: 'Correct',   countColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
};

// ── Tiny re-usable bits ─────────────────────────────────────────────────────
// Step header — orange circular number tile + heading + subtitle.
const StepHeader = ({ n, title, subtitle, right }) => (
  <div className="flex items-start justify-between gap-3 mb-4">
    <div className="flex items-start gap-3 min-w-0">
      <span className="w-7 h-7 bg-primary-500 text-white rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5 shadow-[0_4px_12px_-4px_rgba(249,115,22,0.5)]">
        {n}
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-base font-bold text-[var(--text-strong)] leading-tight">{title}</h2>
        {subtitle && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
    {right && <div className="flex-shrink-0">{right}</div>}
  </div>
);

// Checkbox row — matches the screenshot's flat checkbox style.
const CheckRow = ({ checked, onChange, label, count, countColor, disabled }) => (
  <label
    className={`flex items-center gap-2.5 select-none group ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); if (!disabled) onChange(); }}
      disabled={disabled}
      className={`w-5 h-5 border-2 rounded flex-shrink-0 flex items-center justify-center transition-colors ${
        checked
          ? 'bg-primary-500 border-primary-500'
          : 'border-[var(--border-strong)] group-hover:border-primary-400 dark:group-hover:border-primary-500 bg-[var(--bg-surface)]'
      }`}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
          <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
    <span className="text-sm text-[var(--text)] truncate">{label}</span>
    {count !== undefined && count !== null && (
      <span className={`ml-auto text-[11px] px-1.5 py-0.5 rounded font-semibold ${countColor || 'bg-[var(--bg-muted)] text-[var(--text-muted)]'}`}>
        {count}
      </span>
    )}
  </label>
);

// Numbered chip for the Question Mode step (mirrors the screenshot's
// orange/red/amber/grey/green pills with prominent counts).
const ModeChip = ({ active, onClick, label, count, countColor, loading }) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative rounded-xl border-2 px-3 py-2.5 text-left transition-all ${
      active
        ? 'border-primary-400 bg-primary-50/60 dark:bg-primary-950/30 dark:border-primary-700'
        : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-primary-200 dark:hover:border-primary-800'
    }`}
  >
    <p className={`text-[11px] font-semibold uppercase tracking-wider ${countColor?.split(' ')[1] || 'text-[var(--text-muted)]'}`}>
      {label}
    </p>
    <p className={`font-display text-2xl font-extrabold mt-0.5 leading-none ${active ? 'text-primary-700 dark:text-primary-300' : 'text-[var(--text-strong)]'}`}>
      {loading ? (
        <span className="inline-block w-10 h-6 bg-[var(--bg-muted)] rounded animate-pulse" />
      ) : (
        count ?? 0
      )}
    </p>
  </button>
);

// QB card — pickable rectangle (Step 1 in the screenshot).
const QbCard = ({ bank, selected, onPick }) => (
  <button
    type="button"
    onClick={() => onPick(bank._id)}
    className={`text-left rounded-xl border-2 p-4 transition-all ${
      selected
        ? 'border-primary-400 bg-primary-50/60 dark:bg-primary-950/30 dark:border-primary-700 shadow-[0_4px_18px_-6px_rgba(249,115,22,0.35)]'
        : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-primary-200 dark:hover:border-primary-800'
    }`}
  >
    <div className="flex items-start gap-2.5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
        selected
          ? 'bg-primary-500 text-white'
          : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
      }`}>
        <FiBookOpen className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[var(--text-strong)] text-sm leading-snug line-clamp-2 break-words">{bank.title}</p>
        {bank.subjectsCount != null || bank.totalMcqs != null ? (
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            {bank.totalMcqs != null ? `${bank.totalMcqs.toLocaleString()} questions` : ''}
          </p>
        ) : (
          <p className="text-[11px] text-[var(--text-muted)] mt-1">Question bank</p>
        )}
      </div>
    </div>
  </button>
);

// ─── Page ───────────────────────────────────────────────────────────────────
const AutoTestGeneratorPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAdmin, isTeacher } = useAuth();
  const isStudent = !isAdmin && !isTeacher;

  const initQbId   = searchParams.get('qbId')   || '';
  const initTestId = searchParams.get('testId') || '';

  // ── State (identical shape to the prior page) ────────────────────────────
  const [banks, setBanks]               = useState([]);
  const [qbId, setQbId]                 = useState(initQbId);
  const [selectedBank, setSelectedBank] = useState(null);

  const [existingTest, setExistingTest] = useState(null);

  const [selectedSubjectIds, setSelectedSubjectIds] = useState(new Set());
  const [selectedChapterIds, setSelectedChapterIds] = useState(new Set());
  const [selectedTopicIds,   setSelectedTopicIds]   = useState(new Set());
  const [expandedChapters,   setExpandedChapters]   = useState(new Set());

  const [topicCounts, setTopicCounts] = useState({});
  const [modeCounts,   setModeCounts]   = useState({ total: null, unused: null, incorrect: null, correct: null, omitted: null, marked: null });
  const [byTopic,      setByTopic]      = useState({});
  const [countLoading, setCountLoading] = useState(false);

  // Question-mode filter (history-based). Students only — staff don't have
  // per-user MCQ history to filter against.
  const [selectedModes, setSelectedModes] = useState(new Set(['unused']));

  // Test config
  const [mcqCount,     setMcqCount]     = useState('');
  const [testTitle,    setTestTitle]    = useState('');
  const [generating,   setGenerating]   = useState(false);
  const [maxMcqsLimit, setMaxMcqsLimit] = useState(null);

  // Test-mode picker (NEW). Student = single-select radio; staff = multi-select.
  // Defaults:
  //   Student → ['tutor']                  (creates a locked test, picker auto-starts)
  //   Staff   → ['tutor', 'timer']         (both allowed, student picks at start)
  const [allowedModes, setAllowedModes] = useState(isStudent ? ['tutor'] : ['tutor', 'timer']);
  const [timeMultiplier, setTimeMultiplier] = useState(1.0);

  // ── Bootstrap ────────────────────────────────────────────────────────────
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

  // ── Fetch QB structure + user history — ONE call each per QB ─────────────
  const fetchFullBank = async (id) => {
    setCountLoading(true);
    try {
      const [bankRes, countsRes, histRes] = await Promise.all([
        apiClient.get(`/question-banks/${id}`),
        apiClient.get(`/mcqs/question-bank/${id}/topic-counts`),
        apiClient.get(`/question-banks/${id}/user-mcq-counts`),
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

  const handleBankPick = (id) => {
    if (id === qbId) return;
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

  // ── Derived: subjects/chapters hierarchy ─────────────────────────────────
  const subjects = selectedBank?.subjects || [];

  // Chapters only appear after ≥1 subject is selected. Same enforcement as
  // the legacy page so behaviour matches existing user expectations.
  const visibleChapters = useMemo(
    () => selectedSubjectIds.size > 0
      ? subjects
          .filter((s) => selectedSubjectIds.has(s._id))
          .flatMap((s) => (s.chapters || []).map((c) => ({ ...c, subjectId: s._id })))
      : [],
    [subjects, selectedSubjectIds],
  );

  // ── Count math — all client-side derivations from already-fetched data ──
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

  // The headline "available MCQs" number — drives the Create button enable
  // state, the validation toast on click, and the sidebar summary.
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
    if (!isStudent || selectedModes.size === 0) return modeCounts.total;
    return [...selectedModes].reduce((sum, m) => sum + (modeCounts[m] || 0), 0);
  }, [selectedTopicIds, selectedChapterIds, selectedSubjectIds, selectedModes,
      modeCounts, topicModeCount, chapterModeCount, subjectModeCount, subjects, isStudent]);

  const totalQbMcqs = useMemo(
    () => Object.values(topicCounts).reduce((a, b) => a + b, 0),
    [topicCounts],
  );

  // ── Toggle helpers — identical semantics to the legacy page ──────────────
  const toggleSubject = (id) => {
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
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

  const toggleMode = (mode) => {
    setSelectedModes((prev) => {
      const next = new Set(prev);
      next.has(mode) ? next.delete(mode) : next.add(mode);
      return next;
    });
  };

  // Test-mode toggle — student is single-select (radio behaviour), staff is
  // multi-select (checkbox behaviour with a "never empty" guard).
  const toggleAllowedMode = (mode) => {
    if (isStudent) {
      setAllowedModes([mode]);
    } else {
      setAllowedModes((prev) => {
        const has = prev.includes(mode);
        const next = has ? prev.filter((m) => m !== mode) : [...prev, mode];
        return next.length > 0 ? next : prev;
      });
    }
  };

  // ── Sidebar summary derivations ──────────────────────────────────────────
  const intendedCount    = Number(mcqCount) || 0;
  const effectiveCap     = Math.min(selectedAvailable ?? Infinity, maxMcqsLimit ?? Infinity);
  const finalCount       = Math.min(intendedCount || 0, isFinite(effectiveCap) ? effectiveCap : intendedCount);
  // For staff allowing both modes, default to timer math for the duration tile
  // since timer mode is the bounded one. Student picks exactly one mode.
  const summaryMode      = allowedModes.includes('timer') ? 'timer' : 'tutor';
  const secsPerQ         = TIME_MULTIPLIERS.find((m) => m.value === timeMultiplier)?.secsPerQ ?? 60;
  const durationMin      = summaryMode === 'timer' && finalCount > 0
    ? Math.ceil((finalCount * secsPerQ) / 60)
    : null;

  // Accuracy estimate from the user's QB-wide history. Students only.
  //   accuracy% = correct / attempted (skips unattempted MCQs)
  //   est. score = round(accuracy * finalCount)
  const accuracyPct = useMemo(() => {
    if (!isStudent) return null;
    const attempted = modeCounts.total != null ? modeCounts.total - (modeCounts.unused || 0) : 0;
    const correct   = modeCounts.correct || 0;
    return attempted > 0 ? Math.round((correct / attempted) * 100) : null;
  }, [modeCounts, isStudent]);
  const estScore = accuracyPct != null && finalCount > 0
    ? Math.round((accuracyPct / 100) * finalCount)
    : null;
  // "Weak topic hits" = sum of incorrect+omitted in the current scope. Cap to
  // intended MCQ count so it never reads higher than the test itself.
  const weakHits = useMemo(() => {
    if (!isStudent) return null;
    const inScope = [...selectedTopicIds];
    const counts = inScope.length > 0
      ? inScope.reduce((s, tid) => s + ((byTopic[tid]?.incorrect || 0) + (byTopic[tid]?.omitted || 0)), 0)
      : (modeCounts.incorrect || 0) + (modeCounts.omitted || 0);
    return Math.min(counts, finalCount || counts);
  }, [byTopic, selectedTopicIds, modeCounts, finalCount, isStudent]);

  // Sidebar tag-line — QB · Mode · Subjects, eg. "MDCAT 2025 · Unused · Bio + Chem"
  const summaryTagline = useMemo(() => {
    const parts = [];
    if (selectedBank?.title) parts.push(selectedBank.title);
    if (isStudent && selectedModes.size > 0) {
      const m = [...selectedModes].map((x) => MODE_META[x]?.label || x).join(' + ');
      parts.push(m);
    }
    if (selectedSubjectIds.size > 0) {
      const names = subjects
        .filter((s) => selectedSubjectIds.has(s._id))
        .map((s) => s.title)
        .slice(0, 2)
        .join(' + ');
      if (names) parts.push(names + (selectedSubjectIds.size > 2 ? ' + …' : ''));
    }
    return parts.join(' · ') || 'Pick a question bank to begin';
  }, [selectedBank, selectedModes, selectedSubjectIds, subjects, isStudent]);

  // ── Page header (top bar) ────────────────────────────────────────────────
  usePageHeader({
    title:    existingTest ? `Add MCQs to "${existingTest.title}"` : 'Create Practice Test',
    subtitle: existingTest ? 'Append more MCQs to your existing test' : 'Build a custom drill in under 30 seconds',
    action:   null,
  });

  // ── Generate (and, for students, start) ─────────────────────────────────
  const handleGenerate = async (e) => {
    e?.preventDefault?.();
    if (!qbId)                              { toast.error('Select a Question Bank'); return; }
    if (!mcqCount || Number(mcqCount) < 1) { toast.error('Enter number of MCQs'); return; }
    if (!existingTest && !isStudent && !testTitle.trim()) { toast.error('Enter a test title'); return; }
    if (selectedAvailable !== null && Number(mcqCount) > selectedAvailable) {
      toast.error(`Only ${selectedAvailable} MCQs available for the selected filter`); return;
    }
    if (maxMcqsLimit !== null && Number(mcqCount) > maxMcqsLimit) {
      toast.error(`Max ${maxMcqsLimit} MCQs allowed per test`); return;
    }
    if (!isStudent && !existingTest && allowedModes.length === 0) {
      toast.error('Pick at least one allowed test mode'); return;
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
      // Only send allowedModes when creating a NEW test (not when appending).
      if (!existingTest) payload.allowedModes = allowedModes;

      const res = await apiClient.post('/question-banks/generate-test', payload);
      if (!res.data.success) throw new Error(res.data.message || 'Failed');
      const testData = res.data.data;

      // ── Branch on role ────────────────────────────────────────────────
      if (existingTest) {
        toast.success(`Added ${testData.totalQuestions} MCQs to test!`);
        navigate(isStudent ? `/student/tests/${testData._id}` : `/tests/${testData._id}`,
          isStudent ? { state: { testData } } : undefined);
        return;
      }

      if (!isStudent) {
        // Staff: same destination as before — admin test-detail page.
        toast.success(`Test "${testData.title}" created with ${testData.totalQuestions} MCQs!`);
        navigate(`/tests/${testData._id}`);
        return;
      }

      // Student: chain start immediately so the test goes straight into play.
      // The locked single mode in allowedModes drives which mode we start in.
      const mode = allowedModes[0] || 'tutor';
      const totalDurationSec = mode === 'timer'
        ? Math.max(1, finalCount) * secsPerQ
        : null;
      const startRes = await apiClient.post('/user-tests/start', {
        testId: testData._id,
        mode,
        totalDurationSec,
      });
      if (!startRes.data.success) throw new Error(startRes.data.message || 'Could not start test');
      const attempt = startRes.data.data;
      toast.success('Test started!');
      navigate(
        `/student/tests/${testData._id}/play?attemptId=${attempt._id}`,
        { state: { attemptData: attempt } }
      );
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to generate test');
    } finally {
      setGenerating(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const canCreate = !generating && !!qbId && intendedCount > 0 && selectedAvailable !== 0;
  // Step indices shift depending on whether the Question-Mode step exists
  // (students-only). Computed once so the badge numbers stay 1..N for each role.
  const step = { qb: 1, mode: isStudent ? 2 : null, subjects: isStudent ? 3 : 2, settings: isStudent ? 4 : 3 };

  return (
    <div className="max-w-7xl mx-auto">
      {existingTest && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-4 mb-5 flex items-start gap-3">
          <FiInfo className="w-5 h-5 text-blue-500 dark:text-blue-300 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Adding MCQs to an existing test</p>
            <p className="text-sm text-blue-700 dark:text-blue-300">&quot;{existingTest.title}&quot; — selected MCQs will be appended.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleGenerate} className="grid lg:grid-cols-12 gap-5">
        {/* ── Main column ────────────────────────────────────────────── */}
        <div className="lg:col-span-8 space-y-5">

          {/* Step 1 — Question Bank */}
          <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-4 sm:p-5">
            <StepHeader
              n={step.qb}
              title="Pick a question bank"
              subtitle="Curated by SKN Faculty"
            />
            {banks.length === 0 ? (
              <div className="text-sm text-[var(--text-muted)] py-2">Loading banks…</div>
            ) : (
              // 2 cards per row max — the QB titles can be long ("MDCAT 2025
              // Question Bank") and cramming 3 on a row truncated them at the
              // common laptop width. One col on phones, 2 on everything else.
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {banks.map((b) => (
                  <QbCard key={b._id} bank={b} selected={qbId === b._id} onPick={handleBankPick} />
                ))}
              </div>
            )}
          </section>

          {/* Step 2 — Question Mode (students only). Skipped for staff. */}
          {isStudent && selectedBank && (
            <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-4 sm:p-5">
              <StepHeader
                n={step.mode}
                title="Question mode"
                subtitle="Filter from your history"
                right={
                  <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                    Pool total
                    {countLoading ? (
                      <span className="w-10 h-5 bg-[var(--bg-muted)] rounded animate-pulse inline-block" />
                    ) : (
                      <span className="font-bold text-[var(--text-strong)] bg-[var(--bg-muted)] px-2 py-0.5 rounded-full text-[11px]">
                        {modeCounts.total ?? totalQbMcqs}
                      </span>
                    )}
                  </div>
                }
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                {MODE_ORDER.map((mode) => (
                  <ModeChip
                    key={mode}
                    active={selectedModes.has(mode)}
                    onClick={() => toggleMode(mode)}
                    label={MODE_META[mode].label}
                    count={modeCounts[mode]}
                    countColor={MODE_META[mode].countColor}
                    loading={countLoading}
                  />
                ))}
              </div>
              {selectedModes.size === 0 && (
                <p className="mt-3 text-xs text-[var(--text-faint)]">No mode selected — all MCQs in scope will be picked.</p>
              )}
            </section>
          )}

          {/* Step 3 — Subjects (with inline chapters/topics) */}
          {selectedBank && subjects.length > 0 && (
            <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-4 sm:p-5">
              <StepHeader
                n={step.subjects}
                title="Subjects"
                subtitle="Optional · narrow the scope"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {subjects.map((s) => {
                  const checked = selectedSubjectIds.has(s._id);
                  const cnt = countLoading ? null : subjectModeCount(s);
                  return (
                    <div
                      key={s._id}
                      className={`rounded-xl border-2 transition-colors ${
                        checked
                          ? 'border-primary-400 bg-primary-50/60 dark:bg-primary-950/30 dark:border-primary-700'
                          : 'border-[var(--border)] bg-[var(--bg-surface)]'
                      }`}
                    >
                      <div className="px-3.5 py-3">
                        <CheckRow
                          checked={checked}
                          onChange={() => toggleSubject(s._id)}
                          label={s.title}
                          count={cnt}
                          countColor={isStudent && selectedModes.size > 0 ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300' : undefined}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Chapters & topics — only visible after a subject is picked.
                  Inline below subjects so the screenshot's 4-step layout still
                  reads as "subjects, narrowed", instead of an extra section. */}
              {selectedSubjectIds.size > 0 && visibleChapters.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--border)]">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)]">
                      Chapters & topics (optional)
                    </p>
                    <p className="text-[11px] text-[var(--text-faint)]">Expand (+) to see topics</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                    {visibleChapters.map((chap) => {
                      const cnt        = countLoading ? null : chapterModeCount(chap);
                      const isExpanded = expandedChapters.has(chap._id);
                      return (
                        <div key={chap._id}>
                          <div className="flex items-center gap-2 py-1.5">
                            <button
                              type="button"
                              onClick={() => toggleExpandChapter(chap._id)}
                              className="w-5 h-5 flex-shrink-0 text-primary-500 hover:text-primary-600 dark:text-primary-300 transition-colors"
                              aria-label={isExpanded ? 'Collapse' : 'Expand'}
                            >
                              {isExpanded ? <FiMinus className="w-4 h-4" /> : <FiPlus className="w-4 h-4" />}
                            </button>
                            <CheckRow
                              checked={selectedChapterIds.has(chap._id)}
                              onChange={() => toggleChapter(chap)}
                              label={chap.title}
                              count={cnt}
                              countColor={isStudent && selectedModes.size > 0 ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300' : undefined}
                            />
                          </div>
                          {isExpanded && (chap.topics || []).length > 0 && (
                            <div className="ml-7 mt-1 mb-2 space-y-1 pl-2 border-l-2 border-primary-100 dark:border-primary-900/40">
                              {chap.topics.map((topic) => (
                                <CheckRow
                                  key={topic._id}
                                  checked={selectedTopicIds.has(topic._id)}
                                  onChange={() => toggleTopic(topic._id)}
                                  label={topic.title}
                                  count={countLoading ? null : topicModeCount(topic._id)}
                                  countColor={isStudent && selectedModes.size > 0 ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300' : undefined}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* "Pick a subject first" hint when nothing selected */}
              {selectedSubjectIds.size === 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-faint)] bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-3 py-2">
                  <FiChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                  Pick at least one subject to browse chapters and topics.
                </div>
              )}
            </section>
          )}

          {/* Step 4 — Test settings (count + test mode + time multiplier) */}
          <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-4 sm:p-5 space-y-4">
            <StepHeader n={step.settings} title="Test settings" subtitle="Count, mode, and timing" />

            {/* Test title (staff creating a NEW test) */}
            {!isStudent && !existingTest && (
              <div>
                <label className="block text-sm font-medium text-[var(--text-strong)] mb-1.5">
                  Test title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  placeholder="e.g. Biology Mock Test #1"
                  className="w-full px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-primary-400/40 transition-colors"
                />
              </div>
            )}

            {isStudent && !existingTest && (
              <p className="text-xs text-[var(--text-faint)] flex items-center gap-1.5">
                <FiInfo className="w-3.5 h-3.5" />
                Test name is assigned automatically.
              </p>
            )}

            {/* Number of MCQs */}
            <div>
              {(() => {
                const maxLabel = isFinite(effectiveCap) ? effectiveCap : null;
                return (
                  <>
                    <label className="block text-sm font-medium text-[var(--text-strong)] mb-1.5">
                      Number of MCQs <span className="text-rose-500">*</span>
                      {maxLabel !== null && <span className="text-[var(--text-faint)] font-normal"> (max {maxLabel})</span>}
                    </label>
                    <input
                      type="number"
                      value={mcqCount}
                      min={1}
                      max={isFinite(effectiveCap) ? effectiveCap : undefined}
                      onChange={(e) => setMcqCount(e.target.value)}
                      placeholder="e.g. 40"
                      className="w-full px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-primary-400/40 transition-colors"
                    />
                  </>
                );
              })()}
            </div>

            {/* Test mode picker. Hidden when appending to an existing test —
                the existing test already has allowedModes set. */}
            {!existingTest && (
              <div>
                <label className="block text-sm font-medium text-[var(--text-strong)] mb-1.5">
                  Test mode
                  {!isStudent && <span className="text-[var(--text-faint)] font-normal"> · pick one or both</span>}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { value: 'tutor', label: 'Tutor mode',  icon: '🎓', hint: 'Instant feedback per question' },
                    { value: 'timer', label: 'Timed mode',  icon: '⏱️',  hint: 'Single time-budgeted attempt' },
                  ].map((opt) => {
                    const active = allowedModes.includes(opt.value);
                    return (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => toggleAllowedMode(opt.value)}
                        className={`relative text-left p-3 rounded-xl border-2 transition-all ${
                          active
                            ? 'border-primary-400 bg-primary-50/60 dark:bg-primary-950/30 dark:border-primary-700'
                            : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-primary-200 dark:hover:border-primary-800'
                        }`}
                      >
                        {active && (
                          <FiCheckCircle className="absolute top-2.5 right-2.5 w-4 h-4 text-primary-500" />
                        )}
                        <div className="text-xl mb-1.5">{opt.icon}</div>
                        <p className="text-sm font-semibold text-[var(--text-strong)]">{opt.label}</p>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{opt.hint}</p>
                      </button>
                    );
                  })}
                </div>
                {!isStudent && (
                  <p className="text-[11px] text-[var(--text-faint)] mt-2">
                    {allowedModes.length === 2
                      ? 'Students choose between tutor and timed when starting this test.'
                      : `Test locked to ${allowedModes[0]} mode.`}
                  </p>
                )}
              </div>
            )}

            {/* Time multiplier — only when timer is involved AND it's the
                student-side path (where mode is single-select). For staff
                multi-select, individual students will pick a multiplier at
                start time, so we don't render the picker here. */}
            {isStudent && !existingTest && allowedModes[0] === 'timer' && (
              <div>
                <label className="block text-sm font-medium text-[var(--text-strong)] mb-1.5 flex items-center gap-1.5">
                  <FiClock className="w-4 h-4 text-primary-500" /> Time allocation
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {TIME_MULTIPLIERS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTimeMultiplier(opt.value)}
                      className={`p-2.5 rounded-xl border-2 text-center transition-all ${
                        timeMultiplier === opt.value
                          ? 'border-primary-400 bg-primary-50/60 dark:bg-primary-950/30 dark:border-primary-700'
                          : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-primary-200 dark:hover:border-primary-800'
                      }`}
                    >
                      <p className="text-[13px] font-bold text-[var(--text-strong)]">{opt.label}</p>
                      <p className="text-[10px] text-[var(--text-faint)] mt-0.5">{opt.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ── Sidebar (sticky on lg+) ───────────────────────────────── */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="lg:sticky lg:top-4 space-y-4">
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5">
              <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)] mb-2">
                Test summary
              </p>
              <p className="font-display text-[26px] font-extrabold text-[var(--text-strong)] leading-none">
                {finalCount > 0 ? `${finalCount} MCQs` : '— MCQs'}
                {durationMin && <span className="text-[var(--text-muted)] font-bold"> · {durationMin} min</span>}
              </p>
              <p className="text-[13px] text-[var(--text-muted)] mt-2 line-clamp-2 leading-snug">
                {summaryTagline}
              </p>

              {/* Stat rows */}
              <div className="mt-4 space-y-2.5 text-sm">
                {isStudent && (
                  <SummaryRow
                    Icon={FiTarget}
                    label="Avg accuracy this pool"
                    value={accuracyPct != null ? `${accuracyPct}%` : '—'}
                    valueCls={accuracyPct == null ? 'text-[var(--text-faint)]' : 'text-[var(--text-strong)]'}
                  />
                )}
                {isStudent && (
                  <SummaryRow
                    Icon={FiActivity}
                    label="Est. score"
                    value={estScore != null ? `${estScore} / ${finalCount || '—'}` : '—'}
                    valueCls={estScore == null ? 'text-[var(--text-faint)]' : 'text-emerald-600 dark:text-emerald-300'}
                  />
                )}
                {isStudent && (
                  <SummaryRow
                    Icon={FiZap}
                    label="Weak-topic hits"
                    value={weakHits != null && weakHits > 0 ? `${weakHits} MCQs` : '—'}
                  />
                )}
                {summaryMode === 'timer' && (
                  <SummaryRow
                    Icon={FiClock}
                    label="Time budget"
                    value={durationMin ? `${durationMin} min` : '—'}
                  />
                )}
              </div>

              {/* CTA */}
              <button
                type="submit"
                disabled={!canCreate}
                className="btn-brand w-full py-3.5 mt-5 text-base rounded-xl"
              >
                {generating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    {isStudent && !existingTest ? 'Creating & starting…' : 'Creating…'}
                  </>
                ) : existingTest ? (
                  <><FiPlus className="w-5 h-5" /> Add MCQs to test</>
                ) : isStudent ? (
                  <><FiPlayCircle className="w-5 h-5" /> Create &amp; Start Test</>
                ) : (
                  <><FiZap className="w-5 h-5" /> Create Test</>
                )}
              </button>

              {/* Inline validation hints */}
              {!qbId && (
                <p className="mt-2 text-[11px] text-[var(--text-faint)] text-center">Pick a question bank to start.</p>
              )}
              {qbId && selectedAvailable === 0 && (
                <p className="mt-2 text-[11px] text-rose-500 text-center">
                  No MCQs match the current filter.
                </p>
              )}
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
};

// Row in the right-pane stat block. Kept here (not pulled into the shared
// component grab-bag) since it's only used by the summary card.
const SummaryRow = ({ Icon, label, value, valueCls }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-muted)]">
      <Icon className="w-3.5 h-3.5 text-[var(--text-faint)]" />
      {label}
    </span>
    <span className={`text-sm font-bold ${valueCls || 'text-[var(--text-strong)]'}`}>{value}</span>
  </div>
);

export default AutoTestGeneratorPage;
