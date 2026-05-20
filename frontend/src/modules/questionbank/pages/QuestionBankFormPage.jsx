// modules/questionbank/pages/QuestionBankFormPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiArrowLeft, FiSave, FiLoader,
  FiGlobe, FiShield, FiFileText,
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import QBHierarchyBuilder from '../components/QBHierarchyBuilder';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';

const VISIBILITY_OPTIONS = [
  {
    value: 'public',
    label: 'Public',
    icon: FiGlobe,
    blurb: 'Students, teachers, and admins can browse and generate auto-tests from this bank.',
    accent: 'emerald',
  },
  {
    value: 'staff',
    label: 'Staff only',
    icon: FiShield,
    blurb: 'Only teachers and admins see this bank. Students cannot use it for auto-test generation.',
    accent: 'sky',
  },
  {
    value: 'draft',
    label: 'Draft',
    icon: FiFileText,
    blurb: 'Hidden from everyone except admins. Use this as a template or while still building the bank.',
    accent: 'amber',
  },
];

// Tailwind needs literal class names — map accent → static classes.
const ACCENT_CLASSES = {
  emerald: {
    iconActive:  'text-emerald-600 dark:text-emerald-300',
    ringActive:  'ring-emerald-500/40 border-emerald-500/60 bg-emerald-50/60 dark:bg-emerald-950/30',
    dotActive:   'bg-emerald-500',
  },
  sky: {
    iconActive:  'text-sky-600 dark:text-sky-300',
    ringActive:  'ring-sky-500/40 border-sky-500/60 bg-sky-50/60 dark:bg-sky-950/30',
    dotActive:   'bg-sky-500',
  },
  amber: {
    iconActive:  'text-amber-600 dark:text-amber-300',
    ringActive:  'ring-amber-500/40 border-amber-500/60 bg-amber-50/60 dark:bg-amber-950/30',
    dotActive:   'bg-amber-500',
  },
};

const QuestionBankFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    visibility: 'public',
    subjects: [],
  });

  useEffect(() => {
    if (isEdit) fetchBank();
  }, [id]);

  const fetchBank = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/question-banks/${id}`);
      if (res.data.success) setFormData(res.data.data);
    } catch {
      toast.error('Failed to load question bank');
      navigate('/admin/question-banks');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description,
        visibility: formData.visibility || 'public',
        subjects: formData.subjects,
      };
      if (isEdit) {
        await apiClient.put(`/question-banks/${id}`, payload);
        toast.success('Question Bank updated');
      } else {
        await apiClient.post('/question-banks', payload);
        toast.success('Question Bank created');
      }
      navigate('/admin/question-banks');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Memoise back link so PageHeaderContext doesn't re-fire on every render.
  const headerAction = useMemo(() => (
    <button
      onClick={() => navigate('/admin/question-banks')}
      className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] group"
    >
      <FiArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
      Back to Question Banks
    </button>
  ), [navigate]);

  usePageHeader({
    title:    isEdit ? 'Edit Question Bank' : 'Create Question Bank',
    subtitle: isEdit ? 'Update structure and details' : 'Build a new MCQ repository',
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

  return (
    <div>
      {/* Mobile-only back button (the navbar action slot is desktop-only) */}
      <div className="md:hidden mb-4">
        <button
          onClick={() => navigate('/admin/question-banks')}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <FiArrowLeft className="w-4 h-4" />
          Back to Question Banks
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic info */}
        <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="font-display text-base font-bold text-[var(--text-strong)]">Basic Information</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Name, description, and visibility</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-strong)] mb-1.5">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. MDCAT 2025 Question Bank"
              className="w-full px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-primary-400 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-strong)] mb-1.5">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Brief description of this question bank…"
              rows={3}
              className="w-full px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none transition-colors"
            />
          </div>

          {/* ── Visibility ───────────────────────────────────────────────── */}
          <div className="pt-1">
            <label className="block text-sm font-medium text-[var(--text-strong)] mb-2">
              Visibility
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {VISIBILITY_OPTIONS.map((opt) => {
                const active = (formData.visibility || 'public') === opt.value;
                const accent = ACCENT_CLASSES[opt.accent];
                const Icon = opt.icon;
                return (
                  <label
                    key={opt.value}
                    className={`relative cursor-pointer rounded-xl border p-3 transition-all ${
                      active
                        ? `ring-2 ${accent.ringActive}`
                        : 'border-[var(--border)] hover:bg-[var(--bg-muted)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={opt.value}
                      checked={active}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <div className="flex items-start gap-2.5">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-muted)] ${
                        active ? accent.iconActive : 'text-[var(--text-faint)]'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-[var(--text-strong)]">{opt.label}</span>
                          {active && <span className={`w-1.5 h-1.5 rounded-full ${accent.dotActive}`} />}
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] leading-snug mt-0.5">
                          {opt.blurb}
                        </p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </section>

        {/* Hierarchy */}
        <section className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="font-display text-base font-bold text-[var(--text-strong)]">Content Hierarchy</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Build Subject → Chapter → Topic structure for this bank</p>
          </div>
          <QBHierarchyBuilder
            subjects={formData.subjects}
            onChange={(subjects) => setFormData((prev) => ({ ...prev, subjects }))}
          />
        </section>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/question-banks')}
            className="px-5 py-2.5 text-sm font-medium text-[var(--text-muted)] border border-[var(--border)] rounded-xl hover:bg-[var(--bg-muted)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-brand text-sm disabled:opacity-60"
          >
            <FiSave className="w-4 h-4" />
            {saving ? 'Saving…' : isEdit ? 'Update Question Bank' : 'Create Question Bank'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default QuestionBankFormPage;
