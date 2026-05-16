// modules/questionbank/pages/QuestionBankDetailPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiArrowLeft, FiUpload, FiChevronDown, FiChevronRight,
  FiLayers, FiBookOpen, FiTag, FiEdit2, FiList, FiLoader,
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';

// ─── Topic row ────────────────────────────────────────────────────────────────
const TopicRow = ({ topic, qbId, topicCounts }) => {
  const navigate = useNavigate();
  const count = topicCounts[topic._id] ?? '…';

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary-50 dark:bg-secondary-950/30 border border-secondary-100 dark:border-secondary-900/50">
      <FiTag className="w-3.5 h-3.5 text-secondary-500 dark:text-secondary-300 flex-shrink-0" />
      <span className="flex-1 text-sm font-medium text-secondary-700 dark:text-secondary-200">{topic.title}</span>
      <span className="text-xs text-secondary-500 dark:text-secondary-300 mr-2">
        {typeof count === 'number' ? `${count} MCQ${count !== 1 ? 's' : ''}` : count}
      </span>
      <button
        onClick={() => navigate(`/admin/question-banks/${qbId}/mcqs?topicId=${topic._id}&topicTitle=${encodeURIComponent(topic.title)}`)}
        className="inline-flex items-center gap-1 text-xs font-semibold text-secondary-600 dark:text-secondary-200 border border-secondary-300 dark:border-secondary-800 rounded-full px-3 py-1 hover:bg-secondary-100 dark:hover:bg-secondary-900/40 transition-colors"
      >
        <FiList className="w-3 h-3" /> Manage MCQs
      </button>
    </div>
  );
};

// ─── Chapter accordion ────────────────────────────────────────────────────────
const ChapterRow = ({ chapter, qbId, topicCounts }) => {
  const [open, setOpen] = useState(false);
  const topicCount = chapter.topics?.length || 0;

  return (
    <div className="border border-sky-200 dark:border-sky-900/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-sky-50 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-950/50 transition-colors text-left"
      >
        {open ? <FiChevronDown className="w-4 h-4 text-sky-500 dark:text-sky-300" /> : <FiChevronRight className="w-4 h-4 text-sky-500 dark:text-sky-300" />}
        <FiBookOpen className="w-3.5 h-3.5 text-sky-500 dark:text-sky-300 flex-shrink-0" />
        <span className="flex-1 text-sm font-semibold text-sky-800 dark:text-sky-200">{chapter.title}</span>
        <span className="text-xs text-sky-500 dark:text-sky-300">{topicCount} topic{topicCount !== 1 ? 's' : ''}</span>
      </button>
      {open && (
        <div className="p-3 space-y-2 bg-[var(--bg-surface)]">
          {topicCount === 0 ? (
            <p className="text-xs text-[var(--text-faint)] text-center py-2">No topics in this chapter.</p>
          ) : (
            chapter.topics.map((topic) => (
              <TopicRow key={topic._id} topic={topic} qbId={qbId} topicCounts={topicCounts} />
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ─── Subject accordion ────────────────────────────────────────────────────────
const SubjectRow = ({ subject, qbId, topicCounts }) => {
  const [open, setOpen] = useState(true);
  const chapterCount = subject.chapters?.length || 0;

  return (
    <div className="border-2 border-primary-200 dark:border-primary-900/50 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white text-left"
      >
        {open ? <FiChevronDown className="w-4 h-4 text-primary-100" /> : <FiChevronRight className="w-4 h-4 text-primary-100" />}
        <FiLayers className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 font-bold text-base">{subject.title}</span>
        <span className="text-xs text-primary-100">{chapterCount} chapter{chapterCount !== 1 ? 's' : ''}</span>
      </button>
      {open && (
        <div className="p-4 space-y-3 bg-primary-50/40 dark:bg-primary-950/20">
          {chapterCount === 0 ? (
            <p className="text-sm text-[var(--text-faint)] text-center py-4">No chapters in this subject.</p>
          ) : (
            subject.chapters.map((chapter) => (
              <ChapterRow key={chapter._id} chapter={chapter} qbId={qbId} topicCounts={topicCounts} />
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ─── QuestionBankDetailPage ───────────────────────────────────────────────────
const QuestionBankDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [qb, setQb] = useState(null);
  const [topicCounts, setTopicCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [qbRes, countsRes] = await Promise.all([
        apiClient.get(`/question-banks/${id}`),
        apiClient.get(`/mcqs/question-bank/${id}/topic-counts`),
      ]);
      if (qbRes.data.success) setQb(qbRes.data.data);
      if (countsRes.data.success) setTopicCounts(countsRes.data.data);
    } catch {
      toast.error('Failed to load question bank');
      navigate('/admin/question-banks');
    } finally {
      setLoading(false);
    }
  };

  const totalMcqs = Object.values(topicCounts).reduce((a, b) => a + b, 0);

  // Header action — back button only (Edit/Import live in the header card on
  // the page itself for context).
  const headerAction = useMemo(() => (
    <button
      onClick={() => navigate('/admin/question-banks')}
      className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] group"
    >
      <FiArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
      Back to Question Banks
    </button>
  ), [navigate]);

  const subtitle = qb
    ? `${qb.subjects?.length || 0} subject${(qb.subjects?.length || 0) === 1 ? '' : 's'} · ${totalMcqs} MCQ${totalMcqs === 1 ? '' : 's'}`
    : '';

  usePageHeader({
    title:    qb?.title || 'Question Bank',
    subtitle,
    action:   headerAction,
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <FiLoader className="animate-spin w-8 h-8 text-[var(--text-faint)]" />
        <span className="ml-3 text-sm text-[var(--text-muted)]">Loading question bank…</span>
      </div>
    );
  }

  if (!qb) return null;

  return (
    <div>
      {/* Mobile-only back button */}
      <div className="md:hidden mb-4">
        <button
          onClick={() => navigate('/admin/question-banks')}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <FiArrowLeft className="w-4 h-4" />
          Back to Question Banks
        </button>
      </div>

      {/* Header card */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h1 className="font-display text-xl sm:text-2xl font-extrabold text-[var(--text-strong)] tracking-[-0.01em]">
                {qb.title}
              </h1>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  qb.isActive
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
                }`}
              >
                {qb.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            {qb.description && <p className="text-[var(--text-muted)] text-sm">{qb.description}</p>}
            <div className="flex gap-4 mt-3 text-sm text-[var(--text-muted)]">
              <span><strong className="text-[var(--text-strong)]">{qb.subjects?.length || 0}</strong> Subjects</span>
              <span><strong className="text-[var(--text-strong)]">{totalMcqs}</strong> Total MCQs</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => navigate(`/admin/question-banks/${id}/edit`)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-primary-600 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/40 hover:bg-primary-100 dark:hover:bg-primary-950/60 rounded-xl transition-colors"
            >
              <FiEdit2 className="w-3.5 h-3.5" /> Edit Structure
            </button>
            <button
              onClick={() => navigate(`/admin/question-banks/${id}/import`)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 rounded-xl transition-colors"
            >
              <FiUpload className="w-3.5 h-3.5" /> Import MCQs
            </button>
          </div>
        </div>
      </div>

      {/* Hierarchy */}
      <div className="space-y-4">
        {(qb.subjects?.length || 0) === 0 ? (
          <div className="text-center py-16 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)]">
            <FiLayers className="w-12 h-12 text-[var(--text-faint)] mx-auto mb-3" />
            <p className="text-[var(--text-muted)]">No subjects defined yet. Edit the structure to add subjects.</p>
            <button
              onClick={() => navigate(`/admin/question-banks/${id}/edit`)}
              className="mt-3 text-sm text-primary-600 dark:text-primary-300 hover:underline font-medium"
            >
              Edit Structure
            </button>
          </div>
        ) : (
          qb.subjects.map((subject) => (
            <SubjectRow key={subject._id} subject={subject} qbId={id} topicCounts={topicCounts} />
          ))
        )}
      </div>
    </div>
  );
};

export default QuestionBankDetailPage;
