// modules/questionbank/pages/QuestionBankDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiDatabase, FiArrowLeft, FiUpload, FiChevronDown, FiChevronRight,
  FiLayers, FiBookOpen, FiTag, FiEdit2, FiList,
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';

// ─── Topic row ────────────────────────────────────────────────────────────────
const TopicRow = ({ topic, qbId, topicCounts }) => {
  const navigate = useNavigate();
  const count = topicCounts[topic._id] ?? '…';

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50 border border-violet-100">
      <FiTag className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
      <span className="flex-1 text-sm font-medium text-violet-700">{topic.title}</span>
      <span className="text-xs text-violet-400 mr-2">
        {typeof count === 'number' ? `${count} MCQ${count !== 1 ? 's' : ''}` : count}
      </span>
      <button
        onClick={() => navigate(`/admin/question-banks/${qbId}/mcqs?topicId=${topic._id}&topicTitle=${encodeURIComponent(topic.title)}`)}
        className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 border border-violet-300 rounded-full px-3 py-1 hover:bg-violet-100 transition-colors"
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
    <div className="border border-sky-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-sky-50 hover:bg-sky-100 transition-colors text-left"
      >
        {open ? <FiChevronDown className="w-4 h-4 text-sky-500" /> : <FiChevronRight className="w-4 h-4 text-sky-500" />}
        <FiBookOpen className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
        <span className="flex-1 text-sm font-semibold text-sky-800">{chapter.title}</span>
        <span className="text-xs text-sky-400">{topicCount} topic{topicCount !== 1 ? 's' : ''}</span>
      </button>
      {open && (
        <div className="p-3 space-y-2 bg-white">
          {topicCount === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No topics in this chapter.</p>
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
    <div className="border-2 border-indigo-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-left"
      >
        {open ? <FiChevronDown className="w-4 h-4 text-indigo-200" /> : <FiChevronRight className="w-4 h-4 text-indigo-200" />}
        <FiLayers className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 font-bold text-base">{subject.title}</span>
        <span className="text-xs text-indigo-200">{chapterCount} chapter{chapterCount !== 1 ? 's' : ''}</span>
      </button>
      {open && (
        <div className="p-4 space-y-3 bg-indigo-50/40">
          {chapterCount === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No chapters in this subject.</p>
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!qb) return null;

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <button onClick={() => navigate('/admin/question-banks')}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-5 group">
        <FiArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Question Banks
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <FiDatabase className="w-6 h-6 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-800">{qb.title}</h1>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${qb.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {qb.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            {qb.description && <p className="text-gray-500 text-sm">{qb.description}</p>}
            <div className="flex gap-4 mt-3 text-sm text-gray-600">
              <span><strong className="text-gray-800">{qb.subjects?.length || 0}</strong> Subjects</span>
              <span><strong className="text-gray-800">{totalMcqs}</strong> Total MCQs</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => navigate(`/admin/question-banks/${id}/edit`)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors">
              <FiEdit2 className="w-3.5 h-3.5" /> Edit Structure
            </button>
            <button onClick={() => navigate(`/admin/question-banks/${id}/import`)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-emerald-600 border border-emerald-200 rounded-xl hover:bg-emerald-50 transition-colors">
              <FiUpload className="w-3.5 h-3.5" /> Import MCQs
            </button>
          </div>
        </div>
      </div>

      {/* Hierarchy */}
      <div className="space-y-4">
        {(qb.subjects?.length || 0) === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border">
            <FiLayers className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">No subjects defined yet. Edit the structure to add subjects.</p>
            <button onClick={() => navigate(`/admin/question-banks/${id}/edit`)}
              className="mt-3 text-sm text-indigo-600 hover:underline font-medium">
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
