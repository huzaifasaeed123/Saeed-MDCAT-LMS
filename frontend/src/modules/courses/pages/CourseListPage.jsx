// modules/courses/pages/CourseListPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff, FiBookOpen } from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';

const STATIC_BASE = 'http://localhost:5000';

const CourseListPage = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/courses');
      if (res.data.success) setCourses(res.data.data);
    } catch (err) {
      toast.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (course) => {
    if (!window.confirm(`Delete "${course.title}"? This cannot be undone.`)) return;
    setDeletingId(course._id);
    try {
      await apiClient.delete(`/courses/${course._id}`);
      toast.success('Course deleted');
      setCourses((prev) => prev.filter((c) => c._id !== course._id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-3xl font-bold">Courses</h1>
          <p className="text-gray-500 text-sm mt-1">{courses.length} course{courses.length !== 1 ? 's' : ''} total</p>
        </div>
        <button
          onClick={() => navigate('/admin/courses/create')}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg font-medium"
        >
          <FiPlus className="w-5 h-5" /> Add New Course
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl shadow-sm">
          <FiBookOpen className="w-14 h-14 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-1">No courses yet</h3>
          <p className="text-gray-400 text-sm mb-5">Create your first course to get started.</p>
          <button
            onClick={() => navigate('/admin/courses/create')}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg"
          >
            Create Course
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div
              key={course._id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow"
            >
              {/* Feature Image */}
              <div className="relative h-44 bg-gray-100">
                {course.featureImage ? (
                  <img
                    src={`${STATIC_BASE}${course.featureImage}`}
                    alt={course.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <FiBookOpen className="w-12 h-12" />
                  </div>
                )}
                {/* Public/Private badge */}
                <span
                  className={`absolute top-2 right-2 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                    course.isPublic
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {course.isPublic ? (
                    <><FiEye className="w-3 h-3" /> Public</>
                  ) : (
                    <><FiEyeOff className="w-3 h-3" /> Draft</>
                  )}
                </span>
              </div>

              {/* Info */}
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-semibold text-gray-800 text-base leading-snug mb-1 line-clamp-2">
                  {course.title}
                </h3>
                {course.shortDescription && (
                  <p className="text-gray-500 text-sm line-clamp-2 mb-3 flex-1">
                    {course.shortDescription}
                  </p>
                )}
                <div className="text-xs text-gray-400 mt-auto mb-3">
                  Created {formatDate(course.createdAt)}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/admin/courses/${course._id}/edit`)}
                    className="flex-1 flex items-center justify-center gap-1.5 border border-primary-500 text-primary-600 hover:bg-primary-50 rounded-lg py-1.5 text-sm font-medium transition-colors"
                  >
                    <FiEdit2 className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(course)}
                    disabled={deletingId === course._id}
                    className="flex items-center justify-center gap-1.5 border border-red-300 text-red-500 hover:bg-red-50 rounded-lg px-3 py-1.5 text-sm transition-colors"
                  >
                    <FiTrash2 className="w-4 h-4" />
                    {deletingId === course._id ? '…' : ''}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CourseListPage;
