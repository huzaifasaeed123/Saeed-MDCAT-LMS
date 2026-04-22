// modules/questionbank/pages/QuestionBankListPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiDatabase, FiPlus, FiEdit2, FiTrash2, FiUpload,
  FiLayers, FiCheckSquare, FiSearch, FiEye,
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';

const QuestionBankListPage = () => {
  const navigate = useNavigate();
  const [banks, setBanks] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => { fetchBanks(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q
        ? banks.filter(
            (b) =>
              b.title.toLowerCase().includes(q) ||
              (b.description || '').toLowerCase().includes(q)
          )
        : banks
    );
  }, [search, banks]);

  const fetchBanks = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/question-banks');
      if (res.data.success) {
        setBanks(res.data.data);
        setFiltered(res.data.data);
      }
    } catch {
      toast.error('Failed to load question banks');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this Question Bank? All hierarchy data will be removed. MCQs linked to it will remain but lose their QB reference.')) return;
    setDeletingId(id);
    try {
      await apiClient.delete(`/question-banks/${id}`);
      toast.success('Question Bank deleted');
      setBanks((prev) => prev.filter((b) => b._id !== id));
    } catch {
      toast.error('Failed to delete question bank');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
        <span className="ml-3 text-gray-600">Loading question banks…</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <FiDatabase className="text-indigo-600" /> Question Banks
          </h1>
          <p className="text-gray-500 mt-1">Centralized MCQ repositories organised by Subject → Chapter → Topic</p>
        </div>
        <button
          onClick={() => navigate('/admin/question-banks/create')}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
        >
          <FiPlus className="w-4 h-4" /> New Question Bank
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search question banks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        />
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border shadow-sm">
          <FiDatabase className="w-14 h-14 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500 mb-1">
            {search ? 'No banks match your search' : 'No question banks yet'}
          </h3>
          {!search && (
            <button
              onClick={() => navigate('/admin/question-banks/create')}
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline font-medium"
            >
              <FiPlus className="w-4 h-4" /> Create your first Question Bank
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((bank) => (
            <div
              key={bank._id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
            >
              {/* Top stripe */}
              <div className="h-2 bg-gradient-to-r from-indigo-500 to-violet-500" />

              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3
                    className="font-bold text-gray-800 text-lg leading-snug cursor-pointer hover:text-indigo-600 transition-colors"
                    onClick={() => navigate(`/admin/question-banks/${bank._id}`)}
                  >{bank.title}</h3>
                  <span
                    className={`text-xs font-medium px-2.5 py-0.5 rounded-full flex-shrink-0 ${
                      bank.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {bank.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {bank.description && (
                  <p className="text-gray-500 text-sm line-clamp-2 mb-4">{bank.description}</p>
                )}

                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-5 mt-auto">
                  <FiLayers className="w-3.5 h-3.5" />
                  <span>Created by {bank.createdBy?.fullName || 'Admin'}</span>
                  <span className="mx-1">·</span>
                  <span>{new Date(bank.createdAt).toLocaleDateString()}</span>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => navigate(`/admin/question-banks/${bank._id}`)}
                    className="flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors col-span-2"
                  >
                    <FiEye className="w-3.5 h-3.5" /> View MCQs
                  </button>
                  <button
                    onClick={() => navigate(`/admin/question-banks/${bank._id}/edit`)}
                    className="flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <FiEdit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => navigate(`/admin/question-banks/${bank._id}/import`)}
                    className="flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors"
                  >
                    <FiUpload className="w-3.5 h-3.5" /> Import
                  </button>
                  <button
                    onClick={() => navigate(`/admin/auto-test?qbId=${bank._id}`)}
                    className="flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-sky-600 border border-sky-200 rounded-lg hover:bg-sky-50 transition-colors"
                  >
                    <FiCheckSquare className="w-3.5 h-3.5" /> Auto Test
                  </button>
                  <button
                    onClick={() => handleDelete(bank._id)}
                    disabled={deletingId === bank._id}
                    className="flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <FiTrash2 className="w-3.5 h-3.5" />
                    {deletingId === bank._id ? 'Deleting…' : 'Delete'}
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

export default QuestionBankListPage;
