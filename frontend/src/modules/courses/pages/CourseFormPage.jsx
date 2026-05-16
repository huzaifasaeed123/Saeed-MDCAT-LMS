// modules/courses/pages/CourseFormPage.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiUpload, FiImage, FiEye, FiEyeOff, FiLayers, FiCalendar,
  FiArrowLeft, FiSave,
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import RichTextEditor from '../../../shared/components/RichTextEditor';
import CourseContentBuilder from '../components/CourseContentBuilder';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';
import { getBackendUrl } from '../../../shared/utils/fixImageUrls';

const STATIC_BASE = getBackendUrl();

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
    // Catalog-card metadata. All optional; blank values render no badge.
    startDate:        '',
    endDate:          '',
    mdcatYear:        '',
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
          // ISO → yyyy-mm-dd so <input type="date"> accepts it
          startDate:        c.startDate ? c.startDate.slice(0, 10) : '',
          endDate:          c.endDate   ? c.endDate.slice(0, 10)   : '',
          mdcatYear:        c.mdcatYear        || '',
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
    if (formData.startDate && formData.endDate && formData.endDate < formData.startDate) {
      toast.error('End date cannot be before start date');
      return;
    }
    setLoading(true);
    try {
      // Empty date strings → null so Mongoose's Date cast doesn't choke.
      const payload = {
        ...formData,
        startDate: formData.startDate || null,
        endDate:   formData.endDate   || null,
      };
      if (isEdit) {
        await apiClient.put(`/courses/${id}`, payload);
        toast.success('Course updated successfully');
      } else {
        await apiClient.post('/courses', payload);
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

  // Memoise so PageHeaderContext doesn't see a fresh JSX object every render
  // (would cause its effect to re-fire → setHeader → infinite re-render loop).
  const headerAction = useMemo(() => (
    <button
      type="button"
      onClick={() => navigate('/admin/courses')}
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)] transition-colors"
    >
      <FiArrowLeft className="w-3.5 h-3.5" /> Back to courses
    </button>
  ), [navigate]);

  usePageHeader({
    title:    isEdit ? 'Edit Course' : 'Create New Course',
    subtitle: isEdit
      ? 'Update course details, schedule and content structure'
      : 'Set up a new course with content, schedule and visibility',
    action:   headerAction,
  });

  if (fetching) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500" />
        <span className="ml-3 text-sm text-[var(--text-muted)]">Loading course…</span>
      </div>
    );
  }

  const isDate = formData.displayMode === 'date';

  return (
    <div>
      {/* ── Mobile-only back button (navbar action slot is desktop-only) ── */}
      <div className="md:hidden mb-4">
        <button
          type="button"
          onClick={() => navigate('/admin/courses')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)] transition-colors"
        >
          <FiArrowLeft className="w-3.5 h-3.5" /> Back to courses
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Basic Info ── */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6 space-y-5">
          <h2 className="text-base font-semibold text-[var(--text-strong)] border-b border-[var(--border-faint)] pb-3">
            Basic Information
          </h2>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">
              Course Title <span className="text-red-500">*</span>
            </label>
            <input type="text" value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Complete MDCAT Biology Preparation"
              className="w-full px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">
              Short Description
              <span className="ml-1 text-xs text-[var(--text-faint)] font-normal">(shown on course cards)</span>
            </label>
            <textarea value={formData.shortDescription}
              onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
              placeholder="A brief one-two sentence summary of the course…"
              rows={3}
              className="w-full px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)] resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">
              Full Description
              <span className="ml-1 text-xs text-[var(--text-faint)] font-normal">(shown on course detail page)</span>
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
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Feature Image</label>
              <div onClick={() => fileInputRef.current?.click()}
                className="relative cursor-pointer border-2 border-dashed border-[var(--border)] hover:border-primary-400 bg-[var(--bg-muted)] rounded-xl overflow-hidden transition-colors"
                style={{ height: 160 }}>
                {formData.featureImage ? (
                  <img src={`${STATIC_BASE}${formData.featureImage}`} alt="Feature"
                    className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-[var(--text-faint)]">
                    <FiImage className="w-10 h-10 mb-2" />
                    <span className="text-sm">{imageUploading ? 'Uploading…' : 'Click to upload image'}</span>
                    <span className="text-xs">JPEG, PNG, WEBP — max 5 MB</span>
                  </div>
                )}
                {imageUploading && (
                  <div className="absolute inset-0 bg-[var(--bg-surface)]/70 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500" />
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleFeatureImageUpload(e.target.files[0])} />
              {formData.featureImage && (
                <button type="button" onClick={() => setFormData({ ...formData, featureImage: '' })}
                  className="mt-1.5 text-xs text-red-500 dark:text-red-300 hover:underline">
                  Remove image
                </button>
              )}
            </div>

            {/* Visibility */}
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-3">Visibility</label>
              <div className="flex flex-col gap-3">
                <label className={`flex items-start gap-3 cursor-pointer p-3 border-2 rounded-xl transition-colors ${
                  formData.isPublic
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                    : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-primary-300 dark:hover:border-primary-700'
                }`}>
                  <input type="radio" checked={formData.isPublic}
                    onChange={() => setFormData({ ...formData, isPublic: true })}
                    className="form-radio text-primary-600 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-sm text-[var(--text)]">
                      <FiEye className="text-emerald-500 dark:text-emerald-300" /> Public
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Visible to all enrolled students</p>
                  </div>
                </label>
                <label className={`flex items-start gap-3 cursor-pointer p-3 border-2 rounded-xl transition-colors ${
                  !formData.isPublic
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                    : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-primary-300 dark:hover:border-primary-700'
                }`}>
                  <input type="radio" checked={!formData.isPublic}
                    onChange={() => setFormData({ ...formData, isPublic: false })}
                    className="form-radio text-primary-600 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-sm text-[var(--text)]">
                      <FiEyeOff className="text-[var(--text-faint)]" /> Private (Draft)
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Only visible to admins</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* ── Schedule & Tag — shown on student catalog cards ── */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6 space-y-5">
          <div className="border-b border-[var(--border-faint)] pb-3">
            <h2 className="text-base font-semibold text-[var(--text-strong)]">Schedule &amp; Tag</h2>
            <p className="text-xs text-[var(--text-faint)] mt-1">
              All fields are optional — leave blank to omit from the catalog card.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Start date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">End date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                min={formData.startDate || undefined}
                className="w-full px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">
                MDCAT year tag
                <span className="ml-1 text-xs text-[var(--text-faint)] font-normal">(e.g. MDCAT 2026)</span>
              </label>
              <input
                type="text"
                value={formData.mdcatYear}
                onChange={(e) => setFormData({ ...formData, mdcatYear: e.target.value })}
                placeholder="MDCAT 2026"
                maxLength={32}
                className="w-full px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
              />
            </div>
          </div>
        </div>

        {/* ── Display Settings ── */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6 space-y-5">
          <h2 className="text-base font-semibold text-[var(--text-strong)] border-b border-[var(--border-faint)] pb-3">
            Display Settings
          </h2>

          {/* Mode selector */}
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-2">Content Mode</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={`flex items-start gap-3 cursor-pointer p-4 border-2 rounded-xl transition-colors ${
                !isDate
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                  : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-primary-300 dark:hover:border-primary-700'
              }`}>
                <input type="radio" checked={!isDate}
                  onChange={() => setFormData({ ...formData, displayMode: 'structure' })}
                  className="form-radio text-primary-600 mt-0.5" />
                <div>
                  <div className={`flex items-center gap-1.5 font-semibold text-sm ${
                    !isDate ? 'text-primary-700 dark:text-primary-200' : 'text-[var(--text)]'
                  }`}>
                    <FiLayers className="w-4 h-4" /> Structured
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Organize by folders &amp; sub-folders (e.g. Subject → Chapter → Topic)
                  </p>
                </div>
              </label>

              <label className={`flex items-start gap-3 cursor-pointer p-4 border-2 rounded-xl transition-colors ${
                isDate
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                  : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-primary-300 dark:hover:border-primary-700'
              }`}>
                <input type="radio" checked={isDate}
                  onChange={() => setFormData({ ...formData, displayMode: 'date' })}
                  className="form-radio text-primary-600 mt-0.5" />
                <div>
                  <div className={`flex items-center gap-1.5 font-semibold text-sm ${
                    isDate ? 'text-primary-700 dark:text-primary-200' : 'text-[var(--text)]'
                  }`}>
                    <FiCalendar className="w-4 h-4" /> Date-Based
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Content organized by date — each entry unlocks on a set date &amp; time
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Custom folder names — Structure Mode only */}
          {!isDate && (
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">
                Folder / Level Names
                <span className="ml-1.5 text-xs text-[var(--text-faint)] font-normal">
                  (leave blank to use defaults)
                </span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">
                    Level 1 <span className="text-[var(--text-faint)]">(default: Subject)</span>
                  </label>
                  <input type="text" value={formData.nodeLabels.level1}
                    onChange={(e) => setLabel('level1', e.target.value)}
                    placeholder="Subject"
                    className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">
                    Level 2 <span className="text-[var(--text-faint)]">(default: Chapter)</span>
                  </label>
                  <input type="text" value={formData.nodeLabels.level2}
                    onChange={(e) => setLabel('level2', e.target.value)}
                    placeholder="Chapter"
                    className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">
                    Level 3 <span className="text-[var(--text-faint)]">(default: Topic)</span>
                  </label>
                  <input type="text" value={formData.nodeLabels.level3}
                    onChange={(e) => setLabel('level3', e.target.value)}
                    placeholder="Topic"
                    className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sort order (Date Mode only) */}
          {isDate && (
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-2">
                Student View — Sort Order
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <label className={`flex items-start gap-3 cursor-pointer p-3 border-2 rounded-xl flex-1 transition-colors ${
                  formData.contentSortOrder === 'upcoming_first'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                    : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-primary-300 dark:hover:border-primary-700'
                }`}>
                  <input type="radio"
                    checked={formData.contentSortOrder === 'upcoming_first'}
                    onChange={() => setFormData({ ...formData, contentSortOrder: 'upcoming_first' })}
                    className="form-radio text-primary-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-[var(--text)]">Upcoming First</p>
                    <p className="text-xs text-[var(--text-faint)]">Locked / future entries appear at the top</p>
                  </div>
                </label>
                <label className={`flex items-start gap-3 cursor-pointer p-3 border-2 rounded-xl flex-1 transition-colors ${
                  formData.contentSortOrder === 'past_first'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                    : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-primary-300 dark:hover:border-primary-700'
                }`}>
                  <input type="radio"
                    checked={formData.contentSortOrder === 'past_first'}
                    onChange={() => setFormData({ ...formData, contentSortOrder: 'past_first' })}
                    className="form-radio text-primary-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-[var(--text)]">Chronological (Past First)</p>
                    <p className="text-xs text-[var(--text-faint)]">Day 1 at top, latest / upcoming at bottom</p>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* ── Course Content ── */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6">
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
            className="px-6 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text)] bg-[var(--bg-surface)] hover:bg-[var(--bg-muted)] text-sm font-medium transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-brand text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? (
              <div className="animate-spin h-4 w-4 rounded-full border-b-2 border-white" />
            ) : (
              <FiSave className="w-4 h-4" />
            )}
            {loading ? 'Saving…' : isEdit ? 'Update Course' : 'Create Course'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CourseFormPage;
