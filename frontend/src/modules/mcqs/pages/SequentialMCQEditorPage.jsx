// modules/mcqs/pages/SequentialMCQEditorPage.jsx
// Test-context sequential MCQ editor. Uses shared SequentialMCQEditor for UI.
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiFlag, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import useAuth from '../../../core/auth/useAuth';
import SequentialMCQEditor from '../../../shared/components/SequentialMCQEditor';
import QBClassificationPicker from '../../../shared/components/QBClassificationPicker';

// ── Reports panel for the current MCQ ────────────────────────────────────────
const MCQReportsPanel = ({ mcqId }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!mcqId) return;
    setLoading(true);
    apiClient.get(`/mcq-reports/for-mcq/${mcqId}`)
      .then(res => setReports(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [mcqId]);

  const openCount = reports.filter(r => r.status !== 'closed').length;

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 mb-6">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2 w-full text-left"
      >
        <FiFlag className={`w-4 h-4 flex-shrink-0 ${openCount > 0 ? 'text-red-500 dark:text-red-400' : 'text-[var(--text-faint)]'}`} />
        <span className="font-semibold text-[var(--text-strong)] text-sm">Student Reports for this MCQ</span>
        {openCount > 0 && (
          <span className="px-2 py-0.5 bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300 rounded-full text-xs font-bold">
            {openCount} open
          </span>
        )}
        {reports.length > 0 && (
          <span className="text-xs text-[var(--text-faint)]">{reports.length} total</span>
        )}
        {loading && <div className="animate-spin h-3.5 w-3.5 border-b-2 border-[var(--text-faint)] rounded-full ml-1" />}
        {!loading && reports.length === 0 && !expanded && (
          <span className="text-xs text-[var(--text-faint)]">No reports</span>
        )}
        <div className="ml-auto text-[var(--text-faint)]">
          {expanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {reports.length === 0 && !loading && (
            <p className="text-sm text-[var(--text-faint)] italic text-center py-2">No reports for this MCQ.</p>
          )}
          {reports.map(r => (
            <div
              key={r._id}
              className={`p-3 rounded-lg border text-sm ${
                r.status === 'closed'  ? 'border-[var(--border-faint)] bg-[var(--bg-muted)]' :
                r.status === 'open'    ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30' :
                                         'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30'
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  r.status === 'open' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' :
                  r.status === 'active' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' :
                  'bg-[var(--bg-muted)] text-[var(--text-muted)]'
                }`}>{r.status}</span>
                <span className="text-xs text-[var(--text)] font-medium">{r.reason}</span>
                <span className="text-xs text-[var(--text-faint)]">by {r.reportedBy?.fullName}</span>
                {r.handledBy && <span className="text-xs text-primary-600 dark:text-primary-300">→ {r.handledBy.fullName}</span>}
              </div>
              {r.details && <p className="text-xs text-[var(--text-muted)] mt-1 italic">"{r.details}"</p>}
              {r.messages?.length > 0 && (
                <p className="text-xs text-[var(--text-faint)] mt-0.5">{r.messages.length} message{r.messages.length !== 1 ? 's' : ''}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SequentialMCQEditorPage = () => {
  const navigate = useNavigate();
  const { testId, index } = useParams();
  const currentIndex = parseInt(index, 10) || 0;
  const { user } = useAuth();

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [test, setTest]         = useState(null);
  const [mcqs, setMcqs]         = useState([]);
  const [currentMcq, setCurrentMcq] = useState(null);
  const [formLoaded, setFormLoaded] = useState(false);

  const [formData, setFormData] = useState({
    questionText: '',
    options: [
      { optionLetter: 'A', optionText: '', isCorrect: false },
      { optionLetter: 'B', optionText: '', isCorrect: false },
      { optionLetter: 'C', optionText: '', isCorrect: false },
      { optionLetter: 'D', optionText: '', isCorrect: false },
    ],
    explanationText: '',
    category: '',
    session: '',
    subject: '',
    unit: '',
    topic: '',
    subTopic: '',
    difficulty: 'Medium',
    isPublic: true,
  });

  const [revisionInfo, setRevisionInfo] = useState({ revisionCount: 0, lastRevised: null });
  const [statistics, setStatistics]     = useState(null);

  // QB classification for the current MCQ. Each MCQ may belong to a different
  // QB, so we track the questionBankId per-MCQ; the picker fetches that QB's
  // tree by id and renders only when the MCQ actually has a questionBankId.
  const [classification, setClassification] = useState({ subjectId: '', chapterId: '', topicId: '' });
  const [questionBankId, setQuestionBankId] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [testRes, mcqRes] = await Promise.all([
          apiClient.get(`/tests/${testId}`),
          apiClient.get(`/mcqs/test/${testId}`),
        ]);
        if (testRes.data.success) setTest(testRes.data.data);
        if (mcqRes.data.success)  setMcqs(mcqRes.data.data);
      } catch {
        toast.error('Failed to load test data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [testId]);

  useEffect(() => {
    if (mcqs.length > 0 && currentIndex < mcqs.length) {
      setFormLoaded(false);
      loadMcqData(mcqs[currentIndex]);
    }
  }, [mcqs, currentIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.altKey && e.key === 'ArrowLeft')  { e.preventDefault(); if (currentIndex > 0) navToIndex(currentIndex - 1); }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); if (currentIndex < mcqs.length - 1) handleSaveAndNext(); }
      if (e.altKey && e.key === 's')          { e.preventDefault(); handleSaveAndExit(); }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (window.confirm('Exit without saving?')) navigate(`/tests/${testId}`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, mcqs.length]);

  const loadMcqData = (mcq) => {
    if (!mcq) return;
    setCurrentMcq(mcq);
    const formattedOptions = Array.isArray(mcq.options) && mcq.options.length > 0
      ? mcq.options.map(opt => ({
          _id: opt._id,
          optionLetter: opt.optionLetter || '',
          optionText: opt.optionText || '',
          isCorrect: Boolean(opt.isCorrect),
          explanationText: opt.explanationText || '',
        }))
      : [
          { optionLetter: 'A', optionText: '', isCorrect: false },
          { optionLetter: 'B', optionText: '', isCorrect: false },
          { optionLetter: 'C', optionText: '', isCorrect: false },
          { optionLetter: 'D', optionText: '', isCorrect: false },
        ];

    setFormData({
      questionText: mcq.questionText || '',
      options: formattedOptions,
      explanationText: mcq.explanationText || '',
      category: mcq.category || '',
      session: mcq.session || '',
      subject: mcq.subject || '',
      unit: mcq.unit || '',
      topic: mcq.topic || '',
      subTopic: mcq.subTopic || '',
      difficulty: mcq.difficulty || 'Medium',
      isPublic: mcq.isPublic !== undefined ? mcq.isPublic : true,
    });
    setQuestionBankId(mcq.questionBankId || null);
    setClassification({
      subjectId: mcq.qbSubjectId ? String(mcq.qbSubjectId) : '',
      chapterId: mcq.qbChapterId ? String(mcq.qbChapterId) : '',
      topicId:   mcq.qbTopicId   ? String(mcq.qbTopicId)   : '',
    });
    setRevisionInfo({ revisionCount: mcq.revisionCount || 0, lastRevised: mcq.lastRevised || null });
    setStatistics(mcq.statistics || null);
    setFormLoaded(true);
  };

  const navToIndex = (i) => navigate(`/tests/${testId}/mcqs/edit-all/${i}`);

  const save = async () => {
    if (!currentMcq) return false;
    setSaving(true);
    setError('');
    try {
      const submitData = {
        ...formData,
        testId,
        // Preserve the MCQ's QB link + carry any classification edits made via
        // the picker. Empty strings are omitted so Mongoose doesn't cast '' to
        // an ObjectId.
        ...(questionBankId && { questionBankId }),
        ...(classification.subjectId && { qbSubjectId: classification.subjectId }),
        ...(classification.chapterId && { qbChapterId: classification.chapterId }),
        ...(classification.topicId   && { qbTopicId:   classification.topicId   }),
      };
      await apiClient.put(`/mcqs/${currentMcq._id}`, submitData);
      toast.success('Saved', { autoClose: 900 });
      return true;
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || 'Failed to save';
      setError(msg);
      toast.error(msg);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndNext = async () => {
    const ok = await save();
    if (!ok) return;
    if (currentIndex < mcqs.length - 1) {
      navToIndex(currentIndex + 1);
    } else {
      toast.success('All questions reviewed!', { autoClose: 1200 });
      navigate(`/tests/${testId}`);
    }
  };

  const handleSaveAndExit = async () => {
    const ok = await save();
    if (ok) navigate(`/tests/${testId}`);
  };

  const handleOptionChange = (idx, field, value) => {
    const newOptions = [...formData.options];
    newOptions[idx] = { ...newOptions[idx], [field]: value };
    if (field === 'isCorrect' && value === true) {
      newOptions.forEach((opt, i) => { if (i !== idx) opt.isCorrect = false; });
    }
    setFormData({ ...formData, options: newOptions });
  };

  const addOption = () => {
    if (formData.options.length < 5) {
      const letter = String.fromCharCode(65 + formData.options.length);
      setFormData({ ...formData, options: [...formData.options, { optionLetter: letter, optionText: '', isCorrect: false }] });
    }
  };

  const removeOption = (idx) => {
    if (formData.options.length > 2) {
      const opts = formData.options.filter((_, i) => i !== idx).map((o, i) => ({ ...o, optionLetter: String.fromCharCode(65 + i) }));
      setFormData({ ...formData, options: opts });
    }
  };

  const infoBlock = (
    <>
      {test && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 mb-6">
          <h2 className="font-semibold text-[var(--text-strong)]">Test: {test.title}</h2>
        </div>
      )}
      {/* QB classification — renders only when this MCQ belongs to a QB. */}
      {currentMcq && (
        <QBClassificationPicker
          questionBankId={questionBankId}
          subjectId={classification.subjectId}
          chapterId={classification.chapterId}
          topicId={classification.topicId}
          onChange={setClassification}
        />
      )}
      {currentMcq && <MCQReportsPanel mcqId={currentMcq._id} />}
    </>
  );

  return (
    <SequentialMCQEditor
      mcqs={mcqs}
      currentIndex={currentIndex}
      formData={formData}
      setFormData={setFormData}
      revisionInfo={revisionInfo}
      statistics={statistics}
      currentMcq={currentMcq}
      user={user}
      loading={loading}
      saving={saving}
      error={error}
      formLoaded={formLoaded}
      handleOptionChange={handleOptionChange}
      addOption={addOption}
      removeOption={removeOption}
      onNavigate={navToIndex}
      onSaveAndNext={handleSaveAndNext}
      onSaveAndExit={handleSaveAndExit}
      onCancel={() => navigate(`/tests/${testId}`)}
      title="Edit Test MCQs"
      infoBlock={infoBlock}
    />
  );
};

export default SequentialMCQEditorPage;
