// modules/questionbank/pages/QBManualPickPage.jsx
// Allows admin to browse a Question Bank (by subject → chapter → topic) and
// manually select MCQs to add to a specific test.
// Route: /tests/:testId/pick-mcqs
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiArrowLeft, FiCheck, FiCheckSquare, FiSquare, FiLoader,
} from 'react-icons/fi';
import { fixImageUrls } from '../../../shared/utils/fixImageUrls';
import apiClient from '../../../core/api/axiosConfig';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DiffBadge = ({ d }) => {
  const map = {
    Easy:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    Hard:   'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  };
  return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${map[d] || map.Medium}`}>{d || 'Medium'}</span>;
};

// ─── QBManualPickPage ─────────────────────────────────────────────────────────

const QBManualPickPage = () => {
  const { testId } = useParams();
  const navigate = useNavigate();

  // QB selection
  const [banks, setBanks]           = useState([]);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [bankDetail, setBankDetail] = useState(null);  // full QB doc with subjects/chapters/topics

  // Cascading filter
  const [filterSubject, setFilterSubject] = useState('');
  const [filterChapter, setFilterChapter] = useState('');
  const [filterTopic, setFilterTopic]     = useState('');

  // MCQs
  const [mcqs, setMcqs]         = useState([]);
  const [loadingMcqs, setLoadingMcqs] = useState(false);

  // Selection
  const [selected, setSelected] = useState(new Set());

  // Saving
  const [saving, setSaving] = useState(false);

  // ── Load bank list on mount ────────────────────────────────────────────────
  useEffect(() => {
    apiClient.get('/question-banks')
      .then((r) => { if (r.data.success) setBanks(r.data.data); })
      .catch(() => toast.error('Failed to load question banks'));
  }, []);

  // ── When bank changes, load full detail ───────────────────────────────────
  useEffect(() => {
    if (!selectedBankId) { setBankDetail(null); return; }
    apiClient.get(`/question-banks/${selectedBankId}`)
      .then((r) => { if (r.data.success) setBankDetail(r.data.data); })
      .catch(() => toast.error('Failed to load bank details'));
    setFilterSubject('');
    setFilterChapter('');
    setFilterTopic('');
    setMcqs([]);
    setSelected(new Set());
  }, [selectedBankId]);

  // ── Derived cascades ───────────────────────────────────────────────────────
  const subjects = bankDetail?.subjects || [];
  const chapters = subjects.find((s) => s._id === filterSubject)?.chapters || [];
  const topics   = chapters.find((c) => c._id === filterChapter)?.topics   || [];

  // ── Reset finer filters when parent changes ────────────────────────────────
  const handleSubjectChange = (val) => { setFilterSubject(val); setFilterChapter(''); setFilterTopic(''); setMcqs([]); };
  const handleChapterChange = (val) => { setFilterChapter(val); setFilterTopic(''); setMcqs([]); };
  const handleTopicChange   = (val) => { setFilterTopic(val); setMcqs([]); };

  // ── Fetch MCQs based on current filter ────────────────────────────────────
  const fetchMcqs = async () => {
    if (!selectedBankId) { toast.warning('Please select a Question Bank first'); return; }
    setLoadingMcqs(true);
    try {
      const params = new URLSearchParams();
      if (filterTopic)        params.set('topicId',   filterTopic);
      else if (filterChapter) params.set('chapterId', filterChapter);
      else if (filterSubject) params.set('subjectId', filterSubject);

      const res = await apiClient.get(`/mcqs/question-bank/${selectedBankId}?${params}`);
      if (res.data.success) {
        setMcqs(res.data.data);
        setSelected(new Set());
      }
    } catch {
      toast.error('Failed to load MCQs');
    } finally {
      setLoadingMcqs(false);
    }
  };

  // ── Select / deselect ─────────────────────────────────────────────────────
  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === mcqs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(mcqs.map((m) => m._id)));
    }
  };

  // ── Add to test ────────────────────────────────────────────────────────────
  const handleAddToTest = async () => {
    if (selected.size === 0) { toast.warning('Select at least one MCQ'); return; }
    setSaving(true);
    try {
      await apiClient.post(`/tests/${testId}/add-mcqs`, { mcqIds: [...selected] });
      toast.success(`${selected.size} MCQ${selected.size !== 1 ? 's' : ''} added to test`);
      navigate(`/tests/${testId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add MCQs');
    } finally {
      setSaving(false);
    }
  };

  // Header action — back button
  const headerAction = useMemo(() => (
    <button
      onClick={() => navigate(`/tests/${testId}`)}
      className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] group"
    >
      <FiArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
      Back to Test
    </button>
  ), [navigate, testId]);

  usePageHeader({
    title:    'Pick MCQs from Question Bank',
    subtitle: mcqs.length > 0
      ? `${selected.size} of ${mcqs.length} selected`
      : 'Browse and select MCQs to add to this test',
    action:   headerAction,
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Mobile back */}
      <div className="md:hidden mb-4">
        <button
          onClick={() => navigate(`/tests/${testId}`)}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <FiArrowLeft className="w-4 h-4" />
          Back to Test
        </button>
      </div>

      {/* ── Step 1: Select QB ── */}
      <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6 mb-5 space-y-3">
        <h2 className="font-display text-base font-bold text-[var(--text-strong)]">1. Select Question Bank</h2>
        <select
          value={selectedBankId}
          onChange={(e) => setSelectedBankId(e.target.value)}
          className="w-full px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm transition-colors"
        >
          <option value="">— Choose a Question Bank —</option>
          {banks.map((b) => (
            <option key={b._id} value={b._id}>{b.title}</option>
          ))}
        </select>
      </section>

      {/* ── Step 2: Filter scope ── */}
      {bankDetail && (
        <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6 mb-5 space-y-4">
          <h2 className="font-display text-base font-bold text-[var(--text-strong)]">2. Filter by Scope (optional)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Subject */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Subject</label>
              <select
                value={filterSubject}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="w-full px-3 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm transition-colors"
              >
                <option value="">All Subjects</option>
                {subjects.map((s) => <option key={s._id} value={s._id}>{s.title}</option>)}
              </select>
            </div>
            {/* Chapter */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Chapter</label>
              <select
                value={filterChapter}
                onChange={(e) => handleChapterChange(e.target.value)}
                disabled={!filterSubject}
                className="w-full px-3 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm disabled:opacity-40 transition-colors"
              >
                <option value="">All Chapters</option>
                {chapters.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
              </select>
            </div>
            {/* Topic */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Topic</label>
              <select
                value={filterTopic}
                onChange={(e) => handleTopicChange(e.target.value)}
                disabled={!filterChapter}
                className="w-full px-3 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm disabled:opacity-40 transition-colors"
              >
                <option value="">All Topics</option>
                {topics.map((t) => <option key={t._id} value={t._id}>{t.title}</option>)}
              </select>
            </div>
          </div>
          <button
            onClick={fetchMcqs}
            disabled={loadingMcqs}
            className="btn-brand text-sm disabled:opacity-60"
          >
            {loadingMcqs ? <FiLoader className="w-4 h-4 animate-spin" /> : null}
            {loadingMcqs ? 'Loading…' : 'Load MCQs'}
          </button>
        </section>
      )}

      {/* ── Step 3: Select MCQs ── */}
      {mcqs.length > 0 && (
        <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6 mb-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="font-display text-base font-bold text-[var(--text-strong)]">
              3. Select MCQs
              <span className="ml-2 text-primary-600 dark:text-primary-300 font-semibold">
                ({selected.size} / {mcqs.length} selected)
              </span>
            </h2>
            <button
              onClick={toggleAll}
              className="inline-flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200 font-medium"
            >
              {selected.size === mcqs.length
                ? <><FiCheckSquare className="w-4 h-4" /> Deselect All</>
                : <><FiSquare className="w-4 h-4" /> Select All</>
              }
            </button>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {mcqs.map((mcq, idx) => {
              const isSelected = selected.has(mcq._id);
              return (
                <div
                  key={mcq._id}
                  onClick={() => toggle(mcq._id)}
                  className={`rounded-xl p-4 cursor-pointer transition-colors border-2 ${
                    isSelected
                      ? 'border-primary-400 bg-primary-50/60 dark:bg-primary-950/30 dark:border-primary-700'
                      : 'border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-muted)]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox indicator */}
                    <div className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-primary-500 border-primary-500'
                        : 'border-[var(--border-strong)] bg-[var(--bg-surface)]'
                    }`}>
                      {isSelected && <FiCheck className="w-3 h-3 text-white" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Number + badges */}
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-[var(--text-faint)]">#{idx + 1}</span>
                        <DiffBadge d={mcq.difficulty} />
                      </div>

                      {/* Question text (truncated) */}
                      <div
                        className="prose prose-sm max-w-none text-[var(--text)] dark:prose-invert line-clamp-3"
                        dangerouslySetInnerHTML={{ __html: fixImageUrls(mcq.questionText) }}
                      />

                      {/* Options summary */}
                      <div className="mt-2 grid grid-cols-2 gap-1">
                        {mcq.options?.map((opt) => (
                          <div
                            key={opt._id || opt.optionLetter}
                            className={`text-xs px-2 py-1 rounded ${
                              opt.isCorrect
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-900/50'
                                : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
                            }`}
                          >
                            <span className="font-medium mr-1">{opt.optionLetter}.</span>
                            <span dangerouslySetInnerHTML={{ __html: fixImageUrls(opt.optionText) }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Add to Test button ── */}
      {mcqs.length > 0 && (
        <div className="flex justify-end gap-3">
          <button
            onClick={() => navigate(`/tests/${testId}`)}
            className="px-5 py-2.5 text-sm font-medium text-[var(--text-muted)] border border-[var(--border)] rounded-xl hover:bg-[var(--bg-muted)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAddToTest}
            disabled={saving || selected.size === 0}
            className="btn-brand text-sm disabled:opacity-60"
          >
            <FiCheckSquare className="w-4 h-4" />
            {saving ? 'Adding…' : `Add ${selected.size} MCQ${selected.size !== 1 ? 's' : ''} to Test`}
          </button>
        </div>
      )}
    </div>
  );
};

export default QBManualPickPage;
