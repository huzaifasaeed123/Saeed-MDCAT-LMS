// src/modules/tests/pages/TestFormPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';

const TestFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    passingScore: 50,
    difficultyLevel: 'Medium',
    instructions: '',
    // null = unlimited (default). When the admin flips the toggle off, this
    // becomes a positive integer that startTest enforces against students.
    maxAttempts: null,
  });

  useEffect(() => {
    if (isEdit) fetchTest();
  }, [id]);

  const fetchTest = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/tests/${id}`);
      if (res.data.success) {
        const d = res.data.data;
        setFormData({
          title: d.title || '',
          description: d.description || '',
          passingScore: d.passingScore ?? 50,
          difficultyLevel: d.difficultyLevel || 'Medium',
          instructions: d.instructions || '',
          maxAttempts: d.maxAttempts ?? null,
        });
      }
    } catch {
      toast.error('Failed to load test');
      navigate('/tests');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await apiClient.put(`/tests/${id}`, formData);
        toast.success('Test updated');
      } else {
        const res = await apiClient.post('/tests', formData);
        toast.success('Test created');
        // Navigate to test detail so admin can add MCQs right away
        const newId = res.data?.data?._id;
        navigate(newId ? `/tests/${newId}` : '/tests');
        return;
      }
      navigate('/tests');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save test');
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
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <button onClick={() => navigate('/tests')}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-5 group">
        <FiArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Tests
      </button>

      <h1 className="text-2xl font-bold text-gray-800 mb-2">{isEdit ? 'Edit Test' : 'Create Test'}</h1>
      {!isEdit && (
        <p className="text-sm text-gray-500 mb-6">
          Fill in the basic details. You can add MCQs from a Question Bank after creating the test.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          <h2 className="font-semibold text-gray-700">Basic Information</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
            <input type="text" name="title" value={formData.title} onChange={handleChange}
              placeholder="e.g. Biology Mock Test – Chapter 5"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea name="description" value={formData.description} onChange={handleChange}
              rows={3} placeholder="Optional description for students…"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>
        </div>

        {/* Test Settings */}
        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          <h2 className="font-semibold text-gray-700">Test Settings</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Passing Score (%)</label>
              <input type="number" name="passingScore" value={formData.passingScore} onChange={handleChange}
                min={0} max={100}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select name="difficultyLevel" value={formData.difficultyLevel} onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
          </div>

          {/* Attempt limit — toggle "Unlimited" on/off; show number input when off */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Allowed Attempts</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFormData((p) => ({
                  ...p,
                  maxAttempts: p.maxAttempts == null ? 1 : null,
                }))}
                className={`relative inline-block w-11 h-6 rounded-full transition-colors ${
                  formData.maxAttempts == null ? 'bg-emerald-500' : 'bg-gray-300'
                }`}
                title="Toggle unlimited attempts"
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  formData.maxAttempts == null ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
              <span className="text-sm text-gray-700">
                {formData.maxAttempts == null ? 'Unlimited attempts' : 'Limit attempts to'}
              </span>
              {formData.maxAttempts != null && (
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={formData.maxAttempts}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setFormData((p) => ({ ...p, maxAttempts: Number.isFinite(v) && v > 0 ? v : 1 }));
                  }}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Admins/teachers are always exempt — this limit applies to students only.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
            <textarea name="instructions" value={formData.instructions} onChange={handleChange}
              rows={4} placeholder="Instructions shown to students before the test…"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/tests')}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60">
            <FiSave className="w-4 h-4" />
            {saving ? 'Saving…' : isEdit ? 'Update Test' : 'Create Test & Add MCQs →'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TestFormPage;
