// modules/courses/pages/student/CourseDetailPage.jsx
// Orchestrator: fetches course data and delegates rendering to
// StructureCourseView (accordion) or DateCourseView (sidebar + nav).
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiLayers, FiBookOpen, FiCalendar } from 'react-icons/fi';
import apiClient from '../../../../core/api/axiosConfig';
import DrivePdfViewer   from '../../../../shared/components/DrivePdfViewer';
import DriveVideoPlayer from '../../../../shared/components/DriveVideoPlayer';
import StructureCourseView from './StructureCourseView';
import DateCourseView      from './DateCourseView';
import useAuth from '../../../../core/auth/useAuth';
import LockedFeaturePage from '../../../access/pages/LockedFeaturePage';
import { getBackendUrl } from '../../../../shared/utils/fixImageUrls';

const STATIC_BASE = getBackendUrl();

const CourseDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasCourseAccess, loading: authLoading } = useAuth();

  // Per-course allowlist gate. The master 'courses' FeatureGate is applied
  // by AppRouter, so we know the user has the master toggle. Here we block
  // students who don't have THIS specific course unlocked — the backend's
  // requireCourseAccess will 403, this gives a clean lock page client-side.
  if (!authLoading && !hasCourseAccess(id)) {
    return <LockedFeaturePage feature="courses" courseId={id} />;
  }

  const [course,    setCourse]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('content');
  // { type: 'pdf' | 'video', driveFileId, title }
  const [viewer,    setViewer]    = useState(null);

  useEffect(() => { fetchCourse(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleStartTest   = (testId) => navigate(`/student/tests/${testId}`);
  const handleOpenViewer  = (info)   => setViewer(info);
  const handleCloseViewer = ()       => setViewer(null);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
        <span className="ml-3 text-gray-600">Loading course…</span>
      </div>
    );
  }

  if (!course) return null;

  const isDateMode = course.displayMode === 'date';
  const nodeLabels = course.nodeLabels || {};
  const labels     = {
    l1: nodeLabels.level1 || 'Subject',
    l2: nodeLabels.level2 || 'Chapter',
    l3: nodeLabels.level3 || 'Topic',
  };
  const sortOrder      = course.contentSortOrder || 'upcoming_first';
  const sortedSubjects = [...(course.subjects || [])].sort((a, b) => (a.order || 0) - (b.order || 0));

  // Stats for hero bar
  const totalLevel1 = sortedSubjects.length;
  const totalLevel2 = isDateMode
    ? 0  // date mode has no sub-groups
    : sortedSubjects.reduce((s, sub) => s + (sub.chapters?.length || 0), 0);

  return (
    <>
      {/* ── Fullscreen viewers (outside page scroll) ── */}
      {viewer?.type === 'pdf' && (
        <DrivePdfViewer
          src={`https://drive.google.com/file/d/${viewer.driveFileId}/preview`}
          title={viewer.title}
          onClose={handleCloseViewer}
        />
      )}
      {viewer?.type === 'video' && (
        <DriveVideoPlayer
          src={`https://drive.google.com/file/d/${viewer.driveFileId}/preview`}
          title={viewer.title}
          onClose={handleCloseViewer}
        />
      )}

      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Back button */}
        <button onClick={() => navigate('/student/courses')}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-5 group">
          <FiArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Courses
        </button>

        {/* ── Hero card ── */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden mb-6">
          {course.featureImage && (
            <div className="h-48 sm:h-60 overflow-hidden">
              <img src={`${STATIC_BASE}${course.featureImage}`} alt={course.title}
                className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-6">
            {/* Mode badge */}
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1 mb-3 ${
              isDateMode
                ? 'bg-teal-100 text-teal-700 border border-teal-200'
                : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
            }`}>
              {isDateMode ? <FiCalendar className="w-3 h-3" /> : <FiLayers className="w-3 h-3" />}
              {isDateMode ? 'Date-Based Course' : 'Structured Course'}
            </span>

            <h1 className="text-2xl sm:text-3xl font-black text-gray-800 mb-2">{course.title}</h1>
            {course.shortDescription && (
              <p className="text-gray-500">{course.shortDescription}</p>
            )}

            {/* Stats bar */}
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100">
              {isDateMode ? (
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <FiCalendar className="text-teal-500 w-4 h-4" />
                  <span>{totalLevel1} Date Entr{totalLevel1 !== 1 ? 'ies' : 'y'}</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <FiLayers className="text-indigo-500 w-4 h-4" />
                    <span>{totalLevel1} {labels.l1}{totalLevel1 !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <FiBookOpen className="text-sky-500 w-4 h-4" />
                    <span>{totalLevel2} {labels.l2}{totalLevel2 !== 1 ? 's' : ''}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
          {[{ key: 'content', label: 'Course Content' }, { key: 'about', label: 'About' }].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Content ── */}
        {activeTab === 'content' && (
          isDateMode ? (
            <DateCourseView
              subjects={sortedSubjects}
              sortOrder={sortOrder}
              onStartTest={handleStartTest}
              onOpenViewer={handleOpenViewer}
            />
          ) : (
            <StructureCourseView
              subjects={sortedSubjects}
              onStartTest={handleStartTest}
              onOpenViewer={handleOpenViewer}
              labels={labels}
            />
          )
        )}

        {/* ── Tab: About ── */}
        {activeTab === 'about' && (
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            {course.longDescription ? (
              <div className="prose prose-sm max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: course.longDescription }} />
            ) : (
              <p className="text-gray-400 text-sm">No description available.</p>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default CourseDetailPage;
