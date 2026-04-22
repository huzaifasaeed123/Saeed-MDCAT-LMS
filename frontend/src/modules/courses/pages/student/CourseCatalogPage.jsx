// modules/courses/pages/student/CourseCatalogPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiBookOpen, FiSearch, FiArrowRight } from 'react-icons/fi';
import apiClient from '../../../../core/api/axiosConfig';

const STATIC_BASE = 'http://localhost:5000';

const CourseCatalogPage = () => {
  const navigate = useNavigate();
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
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-1">My Courses</h1>
        <p className="text-gray-500">Browse available courses and start learning</p>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search courses…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
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
          {filtered.map((course) => (
            <div
              key={course._id}
              onClick={() => navigate(`/student/courses/${course._id}`)}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              {/* Feature image */}
              <div className="relative h-44 bg-gradient-to-br from-indigo-100 to-sky-100 overflow-hidden">
                {course.featureImage ? (
                  <img
                    src={`${STATIC_BASE}${course.featureImage}`}
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FiBookOpen className="w-14 h-14 text-indigo-200" />
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
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 group-hover:gap-2 transition-all">
                    View Course <FiArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CourseCatalogPage;
