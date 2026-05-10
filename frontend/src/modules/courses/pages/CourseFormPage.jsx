// modules/courses/pages/CourseFormPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiUpload, FiImage, FiEye, FiEyeOff, FiLayers, FiCalendar } from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import RichTextEditor from '../../../shared/components/RichTextEditor';
import CourseContentBuilder from '../components/CourseContentBuilder';

const STATIC_BASE = 'http://localhost:5000';

const CourseFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading,        setLoading]        = useState(false);
  const [fetching,       setFetching]       = useState(isEdit);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    title:            '',
    shortDescription: '',
    longDescription:  '',
    featureImage:     '',
    isPublic:         false,
    displayMode:      'structure',
    nodeLabels:       { level1: '', level2: '', level3: '' },
    contentSortOrder: 'upcoming_first',
    subjects:         [],
  });

  useEffect(() => {
    if (isEdit) fetchCourse();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCourse = async () => {
    try {
      const res = await apiClient.get(`/courses/${id}`);
      if (res.data.success) {
        const c = res.data.data;
        setFormData({
          title:            c.title            || '',
          shortDescription: c.shortDescription || '',
          longDescription:  c.longDescription  || '',
          featureImage:     c.featureImage     || '',
          isPublic:         c.isPublic         || false,
          displayMode:      c.displayMode      || 'structure',
          nodeLabels:       c.nodeLabels       || { level1: '', level2: '', level3: '' },
          contentSortOrder: c.contentSortOrder || 'upcoming_first',
          subjects:         c.subjects         || [],
        });
      }
    } catch (err) {
      toast.error('Failed to load course');
      navigate('/admin/courses');
    } finally {
      setFetching(false);
    }
  };

  const handleFeatureImageUpload = async (file) => {
    if (!file) return;
    setImageUploading(true);
    try {
      const data = new FormData();
      data.append('featureImage', file);
      const res = await apiClient.post('/courses/upload/feature-image', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        setFormData((prev) => ({ ...prev, featureImage: res.data.url }));
        toast.success('Feature image uploaded');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Image upload failed');
    } finally {
      setImageUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) { toast.error('Course title is required'); return; }
    setLoading(true);
    try {
      if (isEdit) {
        await apiClient.put(`/courses/${id}`, formData);
        toast.success('Course updated successfully');
      } else {
        await apiClient.post('/courses', formData);
        toast.success('Course created successfully');
      }
      navigate('/admin/courses');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save course');
    } finally {
      setLoading(false);
    }
  };

  const setLabel = (key, val) =>
    setFormData((prev) => ({ ...prev, nodeLabels: { ...prev.nodeLabels, [key]: val } }));

  if (fetching) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
        <span className="ml-3 text-gray-600">Loading course…</span>
      </div>
    );
  }

  const isDate = formData.displayMode === 'date';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">{isEdit ? 'Edit Course' : 'Create New Course'}</h1>
          <button type="button" onClick={() => navigate('/admin/courses')}
            className="text-gray-500 hover:text-gray-700 text-sm">
            ← Back to Courses
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Basic Info ── */}
          <div className="bg-white shadow-md rounded-xl p-6 space-y-5">
            <h2 className="text-lg font-semibold border-b pb-2">Basic Information</h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Course Title <span className="text-red-500">*</span>
              </label>
              <input type="text" value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Complete MDCAT Biology Preparation"
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Short Description
                <span className="ml-1 text-xs text-gray-400 font-normal">(shown on course cards)</span>
              </label>
              <textarea value={formData.shortDescription}
                onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                placeholder="A brief one-two sentence summary of the course…"
                rows={3}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Full Description
                <span className="ml-1 text-xs text-gray-400 font-normal">(shown on course detail page)</span>
              </label>
              <RichTextEditor
                key={`longDesc-${id || 'new'}`}
                value={formData.longDescription}
                onChange={(val) => setFormData({ ...formData, longDescription: val })}
                placeholder="Describe the course in detail — topics covered, prerequisites, learning outcomes…"
                showTips={false}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Feature Image */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Feature Image</label>
                <div onClick={() => fileInputRef.current?.click()}
                  className="relative cursor-pointer border-2 border-dashed border-gray-300 hover:border-primary-400 rounded-lg overflow-hidden"
                  style={{ height: 160 }}>
                  {formData.featureImage ? (
                    <img src={`${STATIC_BASE}${formData.featureImage}`} alt="Feature"
                      className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <FiImage className="w-10 h-10 mb-2" />
                      <span className="text-sm">{imageUploading ? 'Uploading…' : 'Click to upload image'}</span>
                      <span className="text-xs">JPEG, PNG, WEBP — max 5 MB</span>
                    </div>
                  )}
                  {imageUploading && (
                    <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500" />
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => handleFeatureImageUpload(e.target.files[0])} />
                {formData.featureImage && (
                  <button type="button" onClick={() => setFormData({ ...formData, featureImage: '' })}
                    className="mt-1 text-xs text-red-500 hover:underline">
                    Remove image
                  </button>
                )}
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Visibility</label>
                <div className="flex flex-col gap-3">
                  <label className="flex items-start gap-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                    <input type="radio" checked={formData.isPublic}
                      onChange={() => setFormData({ ...formData, isPublic: true })}
                      className="form-radio text-primary-600 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-1 font-medium text-sm">
                        <FiEye className="text-green-500" /> Public
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">Visible to all enrolled students</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                    <input type="radio" checked={!formData.isPublic}
                      onChange={() => setFormData({ ...formData, isPublic: false })}
                      className="form-radio text-primary-600 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-1 font-medium text-sm">
                        <FiEyeOff className="text-gray-500" /> Private (Draft)
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">Only visible to admins</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* ── Display Settings ── */}
          <div className="bg-white shadow-md rounded-xl p-6 space-y-5">
            <h2 className="text-lg font-semibold border-b pb-2">Display Settings</h2>

            {/* Mode selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Content Mode</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`flex items-start gap-3 cursor-pointer p-4 border-2 rounded-xl transition-colors ${
                  !isDate ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'
                }`}>
                  <input type="radio" checked={!isDate}
                    onChange={() => setFormData({ ...formData, displayMode: 'structure' })}
                    className="form-radio text-indigo-600 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-sm text-indigo-700">
                      <FiLayers className="w-4 h-4" /> Structured
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Organize by folders &amp; sub-folders (e.g. Subject → Chapter → Topic)
                    </p>
                  </div>
                </label>

                <label className={`flex items-start gap-3 cursor-pointer p-4 border-2 rounded-xl transition-colors ${
                  isDate ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-teal-200'
                }`}>
                  <input type="radio" checked={isDate}
                    onChange={() => setFormData({ ...formData, displayMode: 'date' })}
                    className="form-radio text-teal-600 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-sm text-teal-700">
                      <FiCalendar className="w-4 h-4" /> Date-Based
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Content organized by date — each entry unlocks on a set date &amp; time
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Custom folder names — Structure Mode only */}
            {!isDate && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Folder / Level Names
                  <span className="ml-1.5 text-xs text-gray-400 font-normal">
                    (leave blank to use defaults)
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Level 1 <span className="text-gray-400">(default: Subject)</span>
                    </label>
                    <input type="text" value={formData.nodeLabels.level1}
                      onChange={(e) => setLabel('level1', e.target.value)}
                      placeholder="Subject"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Level 2 <span className="text-gray-400">(default: Chapter)</span>
                    </label>
                    <input type="text" value={formData.nodeLabels.level2}
                      onChange={(e) => setLabel('level2', e.target.value)}
                      placeholder="Chapter"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Level 3 <span className="text-gray-400">(default: Topic)</span>
                    </label>
                    <input type="text" value={formData.nodeLabels.level3}
                      onChange={(e) => setLabel('level3', e.target.value)}
                      placeholder="Topic"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Sort order (Date Mode only) */}
            {isDate && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Student View — Sort Order
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <label className={`flex items-start gap-3 cursor-pointer p-3 border rounded-lg flex-1 ${
                    formData.contentSortOrder === 'upcoming_first'
                      ? 'border-teal-400 bg-teal-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input type="radio"
                      checked={formData.contentSortOrder === 'upcoming_first'}
                      onChange={() => setFormData({ ...formData, contentSortOrder: 'upcoming_first' })}
                      className="form-radio text-teal-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Upcoming First</p>
                      <p className="text-xs text-gray-400">Locked / future entries appear at the top</p>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 cursor-pointer p-3 border rounded-lg flex-1 ${
                    formData.contentSortOrder === 'past_first'
                      ? 'border-teal-400 bg-teal-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input type="radio"
                      checked={formData.contentSortOrder === 'past_first'}
                      onChange={() => setFormData({ ...formData, contentSortOrder: 'past_first' })}
                      className="form-radio text-teal-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Chronological (Past First)</p>
                      <p className="text-xs text-gray-400">Day 1 at top, latest / upcoming at bottom</p>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* ── Course Content ── */}
          <div className="bg-white shadow-md rounded-xl p-6">
            <CourseContentBuilder
              value={formData.subjects}
              onChange={(subjects) => setFormData({ ...formData, subjects })}
              displayMode={formData.displayMode}
              nodeLabels={formData.nodeLabels}
            />
          </div>

          {/* ── Submit ── */}
          <div className="flex justify-end gap-3 pb-8">
            <button type="button" onClick={() => navigate('/admin/courses')}
              className="px-6 py-2.5 border rounded-lg text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-8 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium">
              {loading ? 'Saving…' : isEdit ? 'Update Course' : 'Create Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourseFormPage;
