// modules/courses/pages/student/CourseDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiChevronDown,
  FiChevronRight,
  FiYoutube,
  FiFileText,
  FiCheckSquare,
  FiArrowLeft,
  FiBookOpen,
  FiLayers,
  FiTag,
  FiExternalLink,
  FiPlay,
} from 'react-icons/fi';
import apiClient from '../../../../core/api/axiosConfig';

const STATIC_BASE = 'http://localhost:5000';

// Convert any YouTube URL to embed URL
const toEmbedUrl = (url = '') => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : url;
};

// ─── Resource type config ─────────────────────────────────────────────────────
const RES_CFG = {
  lecture: { label: 'Lecture', Icon: FiYoutube,     color: 'text-red-500',     bg: 'bg-red-50',     border: 'border-red-200'     },
  notes:   { label: 'Notes',   Icon: FiFileText,    color: 'text-orange-500',  bg: 'bg-orange-50',  border: 'border-orange-200'  },
  test:    { label: 'Test',    Icon: FiCheckSquare, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
};

// ─── ResourceCard ─────────────────────────────────────────────────────────────
const ResourceCard = ({ resource, onStartTest }) => {
  const [lectureOpen, setLectureOpen] = useState(false);
  const cfg = RES_CFG[resource.type] || RES_CFG.lecture;

  const displayTitle =
    resource.title ||
    (resource.type === 'test' && resource.testId?.title) ||
    'Untitled';

  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} overflow-hidden`}>
      {/* Row */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <cfg.Icon className={`w-4 h-4 flex-shrink-0 ${cfg.color}`} />
        <span className="flex-1 text-sm font-medium text-gray-700 truncate">{displayTitle}</span>

        {/* Action */}
        {resource.type === 'lecture' && resource.youtubeUrl && (
          <button
            onClick={() => setLectureOpen(!lectureOpen)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 border border-red-300 rounded-full px-3 py-1 hover:bg-red-100 transition-colors"
          >
            <FiPlay className="w-3 h-3" />
            {lectureOpen ? 'Close' : 'Watch'}
          </button>
        )}

        {resource.type === 'notes' && resource.fileUrl && (
          <a
            href={`${STATIC_BASE}${resource.fileUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 border border-orange-300 rounded-full px-3 py-1 hover:bg-orange-100 transition-colors"
          >
            <FiExternalLink className="w-3 h-3" /> Open PDF
          </a>
        )}

        {resource.type === 'test' && resource.testId && (
          <button
            onClick={() => onStartTest(resource.testId._id || resource.testId)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 border border-emerald-300 rounded-full px-3 py-1 hover:bg-emerald-100 transition-colors"
          >
            <FiCheckSquare className="w-3 h-3" /> Start Test
          </button>
        )}
      </div>

      {/* Embedded YouTube player */}
      {resource.type === 'lecture' && lectureOpen && resource.youtubeUrl && (
        <div className="px-4 pb-4">
          <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
            <iframe
              src={toEmbedUrl(resource.youtubeUrl)}
              title={displayTitle}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full rounded-lg border border-red-200"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── TopicAccordion ───────────────────────────────────────────────────────────
const TopicAccordion = ({ topic, onStartTest }) => {
  const [open, setOpen] = useState(false);
  const count = topic.resources?.length || 0;

  return (
    <div className="border border-violet-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-violet-50 hover:bg-violet-100 transition-colors text-left"
      >
        <FiTag className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
        <span className="flex-1 text-sm font-semibold text-violet-700">{topic.title || 'Untitled Topic'}</span>
        <span className="text-xs text-violet-400">{count} item{count !== 1 ? 's' : ''}</span>
        {open ? (
          <FiChevronDown className="w-4 h-4 text-violet-500" />
        ) : (
          <FiChevronRight className="w-4 h-4 text-violet-500" />
        )}
      </button>
      {open && (
        <div className="p-3 space-y-2 bg-white">
          {count === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No resources in this topic.</p>
          ) : (
            [...(topic.resources || [])]
              .sort((a, b) => (a.order || 0) - (b.order || 0))
              .map((r) => (
                <ResourceCard key={r._id} resource={r} onStartTest={onStartTest} />
              ))
          )}
        </div>
      )}
    </div>
  );
};

// ─── ChapterAccordion ─────────────────────────────────────────────────────────
const ChapterAccordion = ({ chapter, onStartTest }) => {
  const [open, setOpen] = useState(false);

  const topicCount = chapter.topics?.length || 0;
  const resourceCount = chapter.resources?.length || 0;
  const itemCount = chapter.useTopics ? topicCount : resourceCount;

  return (
    <div className="border border-sky-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-sky-50 hover:bg-sky-100 transition-colors text-left"
      >
        <FiBookOpen className="w-4 h-4 text-sky-500 flex-shrink-0" />
        <span className="flex-1 text-sm font-semibold text-sky-800">{chapter.title || 'Untitled Chapter'}</span>
        <span className="text-xs text-sky-400">
          {itemCount} {chapter.useTopics ? `topic${itemCount !== 1 ? 's' : ''}` : `item${itemCount !== 1 ? 's' : ''}`}
        </span>
        {open ? (
          <FiChevronDown className="w-4 h-4 text-sky-500" />
        ) : (
          <FiChevronRight className="w-4 h-4 text-sky-500" />
        )}
      </button>

      {open && (
        <div className="p-3 space-y-2 bg-white">
          {chapter.useTopics ? (
            itemCount === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">No topics in this chapter.</p>
            ) : (
              [...(chapter.topics || [])]
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((topic) => (
                  <TopicAccordion key={topic._id} topic={topic} onStartTest={onStartTest} />
                ))
            )
          ) : itemCount === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No resources in this chapter.</p>
          ) : (
            [...(chapter.resources || [])]
              .sort((a, b) => (a.order || 0) - (b.order || 0))
              .map((r) => (
                <ResourceCard key={r._id} resource={r} onStartTest={onStartTest} />
              ))
          )}
        </div>
      )}
    </div>
  );
};

// ─── SubjectAccordion ─────────────────────────────────────────────────────────
const SubjectAccordion = ({ subject, onStartTest }) => {
  const [open, setOpen] = useState(true);
  const chapterCount = subject.chapters?.length || 0;

  return (
    <div className="border-2 border-indigo-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-left"
      >
        <FiLayers className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 font-bold text-base">{subject.title || 'Untitled Subject'}</span>
        <span className="text-xs text-indigo-200">
          {chapterCount} chapter{chapterCount !== 1 ? 's' : ''}
        </span>
        {open ? (
          <FiChevronDown className="w-5 h-5 text-indigo-200" />
        ) : (
          <FiChevronRight className="w-5 h-5 text-indigo-200" />
        )}
      </button>

      {open && (
        <div className="p-4 space-y-3 bg-indigo-50/40">
          {chapterCount === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No chapters in this subject.</p>
          ) : (
            [...(subject.chapters || [])]
              .sort((a, b) => (a.order || 0) - (b.order || 0))
              .map((chapter) => (
                <ChapterAccordion key={chapter._id} chapter={chapter} onStartTest={onStartTest} />
              ))
          )}
        </div>
      )}
    </div>
  );
};

// ─── CourseDetailPage ─────────────────────────────────────────────────────────
const CourseDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('content'); // 'content' | 'about'

  useEffect(() => {
    fetchCourse();
  }, [id]);

  const fetchCourse = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/courses/${id}`);
      if (res.data.success) setCourse(res.data.data);
    } catch {
      toast.error('Failed to load course');
      navigate('/student/courses');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTest = (testId) => {
    // Navigate to test — adjust path to match your existing test-taking route
    navigate(`/student/tests/${testId}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        <span className="ml-3 text-gray-600">Loading course…</span>
      </div>
    );
  }

  if (!course) return null;

  const sortedSubjects = [...(course.subjects || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const totalChapters = sortedSubjects.reduce((s, sub) => s + (sub.chapters?.length || 0), 0);

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Back button */}
      <button
        onClick={() => navigate('/student/courses')}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-5 group"
      >
        <FiArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Courses
      </button>

      {/* Hero */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden mb-6">
        {course.featureImage && (
          <div className="h-52 sm:h-64 overflow-hidden">
            <img
              src={`${STATIC_BASE}${course.featureImage}`}
              alt={course.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="p-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">{course.title}</h1>
          {course.shortDescription && (
            <p className="text-gray-500 text-base">{course.shortDescription}</p>
          )}

          {/* Stats bar */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <FiLayers className="text-indigo-500 w-4 h-4" />
              <span>{sortedSubjects.length} Subject{sortedSubjects.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <FiBookOpen className="text-sky-500 w-4 h-4" />
              <span>{totalChapters} Chapter{totalChapters !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {[
          { key: 'content', label: 'Course Content' },
          { key: 'about',   label: 'About'          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Content */}
      {activeTab === 'content' && (
        <div className="space-y-4">
          {sortedSubjects.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border">
              <FiLayers className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No content available yet.</p>
            </div>
          ) : (
            sortedSubjects.map((subject) => (
              <SubjectAccordion key={subject._id} subject={subject} onStartTest={handleStartTest} />
            ))
          )}
        </div>
      )}

      {/* Tab: About */}
      {activeTab === 'about' && (
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          {course.longDescription ? (
            <div
              className="prose prose-sm max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: course.longDescription }}
            />
          ) : (
            <p className="text-gray-400 text-sm">No description available.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default CourseDetailPage;
