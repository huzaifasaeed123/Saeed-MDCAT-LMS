// modules/courses/pages/student/CourseCatalogPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiBookOpen, FiSearch, FiArrowRight, FiLock } from 'react-icons/fi';
import apiClient from '../../../../core/api/axiosConfig';
import useAuth from '../../../../core/auth/useAuth';

const STATIC_BASE = 'http://localhost:5000';

const CourseCatalogPage = () => {
  const navigate = useNavigate();
  const { hasCourseAccess } = useAuth();
  const [courses, setCourses] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q
        ? courses.filter(
            (c) =>
              c.title.toLowerCase().includes(q) ||
              (c.shortDescription || '').toLowerCase().includes(q)
          )
        : courses
    );
  }, [search, courses]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/courses');
      if (res.data.success) {
        // Students only see public courses
        const publicCourses = res.data.data.filter((c) => c.isPublic);
        setCourses(publicCourses);
        setFiltered(publicCourses);
      }
    } catch {
      toast.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        <span className="ml-3 text-gray-600">Loading courses…</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* ── Header — SKN style with mono eyebrow ────────────────────────── */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-gray-400">Learn</div>
          <h1 className="text-3xl font-extrabold tracking-[-0.025em] text-gray-900 mt-0.5">
            My <span className="text-brand-gradient">Courses</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">Browse the catalog and pick up where you left off.</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search courses…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 transition"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border">
          <FiBookOpen className="w-14 h-14 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500 mb-1">
            {search ? 'No courses match your search' : 'No courses available'}
          </h3>
          {search && (
            <button onClick={() => setSearch('')} className="text-sm text-primary-600 hover:underline mt-2">
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((course) => {
            const unlocked = hasCourseAccess(course._id);
            return (
              <div
                key={course._id}
                onClick={() => navigate(`/student/courses/${course._id}`)}
                className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer group transition-all duration-200 ${
                  unlocked ? 'hover:shadow-lg hover:-translate-y-0.5' : 'hover:shadow-md'
                }`}
              >
                {/* Feature image */}
                <div className="relative h-44 bg-gradient-to-br from-indigo-100 to-sky-100 overflow-hidden">
                  {course.featureImage ? (
                    <img
                      src={`${STATIC_BASE}${course.featureImage}`}
                      alt={course.title}
                      className={`w-full h-full object-cover transition-transform duration-300 ${
                        unlocked ? 'group-hover:scale-105' : 'grayscale opacity-80'
                      }`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FiBookOpen className="w-14 h-14 text-indigo-200" />
                    </div>
                  )}
                  {!unlocked && (
                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                      <span className="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur text-amber-700 border border-amber-200 text-xs font-bold uppercase tracking-wider rounded-full px-2.5 py-1 shadow-sm">
                        <FiLock className="w-3.5 h-3.5" /> Locked
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-bold text-gray-800 text-base leading-snug line-clamp-2 mb-2">
                    {course.title}
                  </h3>
                  {course.shortDescription && (
                    <p className="text-gray-500 text-sm line-clamp-2 mb-4">
                      {course.shortDescription}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      {new Date(course.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold transition-all ${
                      unlocked ? 'text-primary-600 group-hover:gap-2' : 'text-amber-600'
                    }`}>
                      {unlocked ? <>View Course <FiArrowRight className="w-3.5 h-3.5" /></> : <>Unlock <FiLock className="w-3.5 h-3.5" /></>}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CourseCatalogPage;
