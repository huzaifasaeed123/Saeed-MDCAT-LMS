// modules/questionbank/pages/QuestionBankFormPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiDatabase, FiArrowLeft, FiSave } from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import QBHierarchyBuilder from '../components/QBHierarchyBuilder';

const QuestionBankFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    isActive: true,
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
        isActive: formData.isActive,
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Back */}
      <button
        onClick={() => navigate('/admin/question-banks')}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-5 group"
      >
        <FiArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Question Banks
      </button>

      <div className="flex items-center gap-3 mb-6">
        <FiDatabase className="w-7 h-7 text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-800">
          {isEdit ? 'Edit Question Bank' : 'Create Question Bank'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          <h2 className="font-semibold text-gray-700 text-base">Basic Information</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. MDCAT 2025 Question Bank"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Brief description of this question bank…"
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-gray-700">Active (visible to teachers for test creation)</span>
          </label>
        </div>

        {/* Hierarchy */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="font-semibold text-gray-700 text-base mb-1">Content Hierarchy</h2>
          <p className="text-xs text-gray-400 mb-4">Build Subject → Chapter → Topic structure for this bank</p>
          <QBHierarchyBuilder
            subjects={formData.subjects}
            onChange={(subjects) => setFormData((prev) => ({ ...prev, subjects }))}
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/question-banks')}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60"
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
