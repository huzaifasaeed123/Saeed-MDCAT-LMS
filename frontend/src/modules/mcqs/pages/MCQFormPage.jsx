// File: modules/mcqs/pages/MCQFormPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import useAuth from '../../../core/auth/useAuth';
import { toast } from 'react-toastify';
import MCQFormFields from '../components/MCQFormFields';
import QBClassificationPicker from '../../../shared/components/QBClassificationPicker';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';

const MCQFormPage = () => {
  const navigate = useNavigate();
  // This page is mounted in TWO contexts:
  //   • test     → /tests/:testId/mcqs/:mcqId/edit   (testId present)
  //   • QB        → /admin/question-banks/:qbId/mcqs/:mcqId/edit (qbId present)
  // Only one of testId / qbId is defined at a time. The post-save redirect
  // and the submitted payload both branch on which context we're in — that's
  // what fixes the old `/tests/undefined` bug on QB single-MCQ edits.
  const { testId, qbId, mcqId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [error, setError] = useState('');

  // QB classification (only meaningful when the MCQ belongs to a QB). Seeded
  // from the loaded MCQ's qb*Id fields (edit) or the scope query params /
  // a manual QB pick (create); edited via QBClassificationPicker.
  const [classification, setClassification] = useState({
    subjectId: searchParams.get('subjectId') || '',
    chapterId: searchParams.get('chapterId') || '',
    topicId:   searchParams.get('topicId')   || '',
  });
  // In QB context the bank is fixed by the route. In test context it starts
  // null and the admin may optionally pick one (so a single MCQ added to a
  // test can also be filed into a Question Bank — mirrors bulk import).
  const [questionBankId, setQuestionBankId] = useState(qbId || null);
  // All QBs for the optional picker (test context only).
  const [qbList, setQbList] = useState([]);

  // Where to go after save / cancel. QB context returns to the filtered MCQ
  // list (preserving the subject/chapter/topic filter from the query string);
  // test context returns to the test detail page.
  const backUrl = qbId
    ? `/admin/question-banks/${qbId}/mcqs${searchParams.toString() ? `?${searchParams}` : ''}`
    : `/tests/${testId}`;

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

  // For existing MCQs
  const [revisionInfo, setRevisionInfo] = useState({
    revisionCount: 0,
    lastRevised: null
  });

  // For statistics
  const [statistics, setStatistics] = useState(null);
  // Current MCQ data (for editing)
  const [currentMcq, setCurrentMcq] = useState(null);

  useEffect(() => {
    const loadInitialData = async () => {
      setFetchingData(true);
      if (testId) await fetchTestDetails();

      if (mcqId) {
        await fetchMCQ();
      }
      setFetchingData(false);
    };

    loadInitialData();
  }, [testId, mcqId]);

  // Test context only: load the QB list so the admin can optionally file this
  // single MCQ into a Question Bank. In QB context the bank is already fixed
  // by the route, so the picker isn't needed.
  useEffect(() => {
    if (qbId) return; // QB fixed by route
    apiClient.get('/question-banks')
      .then((res) => { if (res.data?.success) setQbList(res.data.data || []); })
      .catch(() => { /* silent — selector just won't populate */ });
  }, [qbId]);

  const fetchTestDetails = async () => {
    try {
      const response = await apiClient.get(`/tests/${testId}`);
      const testData = response.data.data;
      setTest(testData);

      // Pre-fill test details
      setFormData(prev => ({
        ...prev,
        session: testData.session || prev.session,
        subject: testData.subject || prev.subject,
        unit: testData.unit || prev.unit,
        topic: testData.topic || prev.topic,
        subTopic: testData.subTopic || prev.subTopic
      }));
    } catch (error) {
      console.error('Error fetching test details:', error);
      toast.error('Failed to load test details');
    }
  };

  const fetchMCQ = async () => {
    try {
      const response = await apiClient.get(`/mcqs/${mcqId}`);

      if (response.data.success && response.data.data) {
        const mcqData = response.data.data;
        setCurrentMcq(mcqData);

        // Ensure we have options with the correct structure
        let formattedOptions = [];
        if (Array.isArray(mcqData.options) && mcqData.options.length > 0) {
          formattedOptions = mcqData.options.map(opt => ({
            _id: opt._id,
            optionLetter: opt.optionLetter || '',
            optionText: opt.optionText || '',
            isCorrect: Boolean(opt.isCorrect),
            explanationText: opt.explanationText || ''
          }));
        } else {
          // Default options if none exist
          formattedOptions = [
            { optionLetter: 'A', optionText: '', isCorrect: false },
            { optionLetter: 'B', optionText: '', isCorrect: false },
            { optionLetter: 'C', optionText: '', isCorrect: false },
            { optionLetter: 'D', optionText: '', isCorrect: false },
          ];
        }

        // Update form data with existing MCQ data
        setFormData({
          questionText: mcqData.questionText || '',
          options: formattedOptions,
          explanationText: mcqData.explanationText || '',
          category: mcqData.category || '',
          session: mcqData.session || '',
          subject: mcqData.subject || '',
          unit: mcqData.unit || '',
          topic: mcqData.topic || '',
          subTopic: mcqData.subTopic || '',
          difficulty: mcqData.difficulty || 'Medium',
          isPublic: mcqData.isPublic !== undefined ? mcqData.isPublic : true,
        });

        // Seed QB classification from the MCQ. questionBankId drives whether
        // the classification picker renders + which QB tree it fetches.
        setQuestionBankId(mcqData.questionBankId || null);
        setClassification({
          subjectId: mcqData.qbSubjectId ? String(mcqData.qbSubjectId) : '',
          chapterId: mcqData.qbChapterId ? String(mcqData.qbChapterId) : '',
          topicId:   mcqData.qbTopicId   ? String(mcqData.qbTopicId)   : '',
        });

        // Set revision info
        setRevisionInfo({
          revisionCount: mcqData.revisionCount || 0,
          lastRevised: mcqData.lastRevised || null
        });

        // Set statistics if available
        if (mcqData.statistics) {
          setStatistics(mcqData.statistics);
        }
      } else {
        setError('Failed to load MCQ data - Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching MCQ:', error);
      setError(error.response?.data?.message || 'Failed to load MCQ data');
      toast.error('Failed to load MCQ data');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const submitData = {
        ...formData,
        // Only send testId when this MCQ actually belongs to a test. QB-only
        // MCQs have no testId — sending `undefined` previously tripped the
        // backend validator and also fed the broken `/tests/undefined` redirect.
        ...(testId && { testId }),
        // Preserve / update QB classification when in QB context. Empty string
        // → omit so Mongoose doesn't try to cast '' to an ObjectId.
        ...(questionBankId && { questionBankId }),
        ...(classification.subjectId && { qbSubjectId: classification.subjectId }),
        ...(classification.chapterId && { qbChapterId: classification.chapterId }),
        ...(classification.topicId   && { qbTopicId:   classification.topicId   }),
      };

      if (mcqId) {
        await apiClient.put(`/mcqs/${mcqId}`, submitData);
        toast.success('MCQ updated successfully');
      } else {
        await apiClient.post('/mcqs', submitData);
        toast.success('MCQ created successfully');
      }
      navigate(backUrl);
    } catch (error) {
      console.error('Error saving MCQ:', error);
      const msg = error.response?.data?.errors?.[0]?.msg || error.response?.data?.message || 'Failed to save MCQ';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...formData.options];
    newOptions[index] = { ...newOptions[index], [field]: value };

    // If setting this option as correct, unset others
    if (field === 'isCorrect' && value === true) {
      newOptions.forEach((option, i) => {
        if (i !== index) option.isCorrect = false;
      });
    }

    setFormData({ ...formData, options: newOptions });
  };

  const addOption = () => {
    if (formData.options.length < 5) {
      const nextLetter = String.fromCharCode(65 + formData.options.length);
      setFormData({
        ...formData,
        options: [
          ...formData.options,
          { optionLetter: nextLetter, optionText: '', isCorrect: false }
        ]
      });
    }
  };

  const removeOption = (index) => {
    if (formData.options.length > 2) {
      const newOptions = formData.options.filter((_, i) => i !== index);
      // Reorder option letters
      newOptions.forEach((option, i) => {
        option.optionLetter = String.fromCharCode(65 + i);
      });
      setFormData({ ...formData, options: newOptions });
    }
  };

  // Push title / subtitle / Cancel button to the global top bar via context.
  // Memoise the action node so the context effect doesn't re-fire each render.
  const headerSubtitle = test
    ? `${test.title}${test.subject ? ` · ${test.subject}` : ''}${test.unit ? ` · ${test.unit}` : ''}${test.topic ? ` · ${test.topic}` : ''}`
    : '';
  const headerAction = useMemo(() => (
    <button
      type="button"
      onClick={() => navigate(backUrl)}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)] transition-colors whitespace-nowrap"
    >
      <FiX className="w-4 h-4" /> Cancel
    </button>
  ), [navigate, backUrl]);
  usePageHeader({
    title:    mcqId ? 'Edit Question' : 'Add Question',
    subtitle: headerSubtitle,
    action:   headerAction,
  });

  if (fetchingData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        <span className="ml-3 text-[var(--text-muted)]">Loading MCQ data...</span>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300 px-4 py-3 rounded-xl mb-4 text-sm">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6"
      >
        {/* QB selector — test context only. Lets the admin OPTIONALLY file
            this single MCQ into a Question Bank (and then classify it). In QB
            context the bank is fixed by the route, so this is hidden. */}
        {!qbId && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 mb-6">
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
              Question Bank <span className="font-normal text-[var(--text-faint)]">(optional)</span>
            </label>
            <select
              value={questionBankId || ''}
              onChange={(e) => {
                setQuestionBankId(e.target.value || null);
                // New bank → previous subject/chapter/topic no longer apply.
                setClassification({ subjectId: '', chapterId: '', topicId: '' });
              }}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              <option value="">— None (test only) —</option>
              {qbList.map((qb) => (
                <option key={qb._id} value={String(qb._id)}>{qb.title}</option>
              ))}
            </select>
            <p className="text-[11px] text-[var(--text-faint)] mt-1.5">
              Pick a bank to also file this question there. Subject / chapter / topic below is optional.
            </p>
          </div>
        )}

        {/* QB classification dropdowns — render only when a Question Bank is
            selected (the picker fetches that QB's tree itself). */}
        <QBClassificationPicker
          questionBankId={questionBankId}
          subjectId={classification.subjectId}
          chapterId={classification.chapterId}
          topicId={classification.topicId}
          onChange={setClassification}
        />

        <MCQFormFields
          formData={formData}
          setFormData={setFormData}
          revisionInfo={revisionInfo}
          statistics={statistics}
          currentMcq={currentMcq}
          user={user}
          handleOptionChange={handleOptionChange}
          addOption={addOption}
          removeOption={removeOption}
          readOnly={false}
        />

        <div className="flex justify-end gap-2 pt-5 mt-5 border-t border-[var(--border-faint)]">
          <button
            type="button"
            onClick={() => navigate(backUrl)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-brand text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <FiSave className="w-4 h-4" />
            {loading ? 'Saving...' : mcqId ? 'Update Question' : 'Save Question'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MCQFormPage;
