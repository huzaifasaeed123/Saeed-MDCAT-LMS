// modules/questionbank/pages/QuestionBankListPage.jsx
//
// Admin "Question Banks" list. Mirrors the CourseListPage admin pattern —
// theme tokens, visibility (active/inactive) filter, sort, grid/list view
// toggle, and a search bar. The action button (and title) live in the top
// navbar via usePageHeader.
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiDatabase, FiPlus, FiEdit2, FiTrash2, FiUpload,
  FiLayers, FiCheckSquare, FiSearch, FiEye, FiEyeOff,
  FiGrid, FiList, FiX, FiLoader, FiArrowRight,
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';

const SORT_OPTIONS = [
  { key: 'recent', label: 'Recently added', cmp: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  { key: 'oldest', label: 'Oldest first',   cmp: (a, b) => new Date(a.createdAt) - new Date(b.createdAt) },
  { key: 'a-z',    label: 'Title (A–Z)',    cmp: (a, b) => a.title.localeCompare(b.title) },
  { key: 'z-a',    label: 'Title (Z–A)',    cmp: (a, b) => b.title.localeCompare(a.title) },
];

// ── Cards ─────────────────────────────────────────────────────────────────────
const QbCard = ({ bank, onView, onEdit, onImport, onAutoTest, onDelete, deleting }) => (
  <div
    onClick={onView}
    className="group text-left bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden flex flex-col cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary-300 dark:hover:border-primary-700"
  >
    {/* Top stripe */}
    <div className="h-2 bg-gradient-to-r from-primary-500 via-secondary-500 to-secondary-600" />

    <div className="p-5 flex flex-col flex-1">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-display text-base sm:text-lg font-extrabold text-[var(--text-strong)] tracking-[-0.01em] leading-snug line-clamp-2">
          {bank.title}
        </h3>
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 ${
            bank.isActive
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
          }`}
        >
          {bank.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {bank.description && (
        <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed mb-3">
          {bank.description}
        </p>
      )}

      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-faint)] mb-4 mt-auto">
        <FiLayers className="w-3.5 h-3.5" />
        <span>By {bank.createdBy?.fullName || 'Admin'}</span>
        <span className="mx-1">·</span>
        <span>{new Date(bank.createdAt).toLocaleDateString()}</span>
      </div>

      {/* Actions */}
      <div
        className="grid grid-cols-2 gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onView}
          className="col-span-2 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-primary-600 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/40 hover:bg-primary-100 dark:hover:bg-primary-950/60 rounded-lg transition-colors"
        >
          <FiEye className="w-3.5 h-3.5" /> View MCQs
        </button>
        <button
          onClick={onEdit}
          className="inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-[var(--text-muted)] border border-[var(--border)] hover:bg-[var(--bg-muted)] rounded-lg transition-colors"
        >
          <FiEdit2 className="w-3.5 h-3.5" /> Edit
        </button>
        <button
          onClick={onImport}
          className="inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 rounded-lg transition-colors"
        >
          <FiUpload className="w-3.5 h-3.5" /> Import
        </button>
        <button
          onClick={onAutoTest}
          className="inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-secondary-600 dark:text-secondary-300 bg-secondary-50 dark:bg-secondary-950/40 hover:bg-secondary-100 dark:hover:bg-secondary-950/60 rounded-lg transition-colors"
        >
          <FiCheckSquare className="w-3.5 h-3.5" /> Auto Test
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/60 rounded-lg transition-colors disabled:opacity-50"
        >
          {deleting ? <FiLoader className="w-3.5 h-3.5 animate-spin" /> : <FiTrash2 className="w-3.5 h-3.5" />}
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  </div>
);

const QbRow = ({ bank, onView, onEdit, onImport, onAutoTest, onDelete, deleting }) => (
  <div
    onClick={onView}
    className="group w-full text-left bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden flex items-center gap-3 sm:gap-4 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all p-2 sm:p-3 cursor-pointer"
  >
    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-primary-500 via-secondary-500 to-secondary-600 rounded-xl flex items-center justify-center flex-shrink-0">
      <FiDatabase className="w-6 h-6 text-white/90" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-0.5">
        <span
          className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 ${
            bank.isActive
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
          }`}
        >
          {bank.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
      <p className="text-sm sm:text-base font-bold text-[var(--text-strong)] line-clamp-1">
        {bank.title}
      </p>
      <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
        By {bank.createdBy?.fullName || 'Admin'} · {new Date(bank.createdAt).toLocaleDateString()}
      </p>
    </div>
    <div
      className="flex items-center gap-1 flex-shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onImport}
        className="p-2 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
        aria-label="Import MCQs"
        title="Import MCQs"
      >
        <FiUpload className="w-4 h-4" />
      </button>
      <button
        onClick={onAutoTest}
        className="p-2 text-secondary-600 dark:text-secondary-300 hover:bg-secondary-50 dark:hover:bg-secondary-950/40 rounded-lg transition-colors"
        aria-label="Auto Test"
        title="Auto Test"
      >
        <FiCheckSquare className="w-4 h-4" />
      </button>
      <button
        onClick={onEdit}
        className="p-2 text-primary-600 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/40 rounded-lg transition-colors"
        aria-label="Edit"
        title="Edit"
      >
        <FiEdit2 className="w-4 h-4" />
      </button>
      <button
        onClick={onDelete}
        disabled={deleting}
        className="p-2 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg disabled:opacity-50 transition-colors"
        aria-label="Delete"
        title="Delete"
      >
        {deleting ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiTrash2 className="w-4 h-4" />}
      </button>
    </div>
    <FiArrowRight className="w-4 h-4 text-[var(--text-faint)] group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all flex-shrink-0 hidden sm:block" />
  </div>
);

const QuestionBankListPage = () => {
  const navigate = useNavigate();
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  // Frontend filter / sort / view state
  const [activeVis, setActiveVis] = useState('all'); // 'all' | 'active' | 'inactive'
  const [sortKey,   setSortKey]   = useState('recent');
  const [view,      setView]      = useState('grid'); // 'grid' | 'list'

  useEffect(() => { fetchBanks(); }, []);

  const fetchBanks = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/question-banks');
      if (res.data.success) {
        setBanks(res.data.data);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = banks;
    if (activeVis === 'active')   list = list.filter((b) => b.isActive);
    else if (activeVis === 'inactive') list = list.filter((b) => !b.isActive);
    if (q) list = list.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        (b.description || '').toLowerCase().includes(q)
    );
    const cmp = SORT_OPTIONS.find((o) => o.key === sortKey)?.cmp;
    return cmp ? [...list].sort(cmp) : list;
  }, [banks, activeVis, search, sortKey]);

  const activeCount   = banks.filter((b) => b.isActive).length;
  const inactiveCount = banks.length - activeCount;
  const subtitle = banks.length === 0
    ? 'No question banks yet'
    : `${banks.length} bank${banks.length === 1 ? '' : 's'} · ${activeCount} active · ${inactiveCount} inactive`;

  // Memoise so PageHeaderContext doesn't see a fresh JSX object every render
  // (would cause its effect to re-fire → setHeader → infinite re-render loop).
  const headerAction = useMemo(() => (
    <button
      onClick={() => navigate('/admin/question-banks/create')}
      className="btn-brand text-sm"
    >
      <FiPlus className="w-4 h-4" /> New Question Bank
    </button>
  ), [navigate]);

  usePageHeader({
    title:    'Question Banks',
    subtitle,
    action:   headerAction,
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <FiLoader className="animate-spin w-8 h-8 text-[var(--text-faint)]" />
        <span className="ml-3 text-sm text-[var(--text-muted)]">Loading question banks…</span>
      </div>
    );
  }

  return (
    <div>
      {/* ── Mobile-only action button (the navbar action slot is desktop-only) ── */}
      <div className="md:hidden mb-4">
        <button
          onClick={() => navigate('/admin/question-banks/create')}
          className="btn-brand text-sm w-full justify-center"
        >
          <FiPlus className="w-4 h-4" /> New Question Bank
        </button>
      </div>

      {/* ── Visibility filter (left) + Sort + View (right) ── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { key: 'all',      label: 'All',      count: banks.length },
            { key: 'active',   label: 'Active',   count: activeCount },
            { key: 'inactive', label: 'Inactive', count: inactiveCount },
          ].map((opt) => {
            const active = activeVis === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setActiveVis(opt.key)}
                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
                  active
                    ? 'bg-secondary-600 text-white'
                    : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                }`}
              >
                {opt.label}
                <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
                  active ? 'bg-white/20 text-white' : 'bg-[var(--bg-muted)] text-[var(--text-faint)]'
                }`}>
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          <label className="hidden sm:flex items-center gap-2 text-xs text-[var(--text-muted)]">
            Sort by
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className="px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </label>

          <div className="flex bg-[var(--bg-muted)] rounded-xl border border-[var(--border)] p-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => setView('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                view === 'grid'
                  ? 'bg-[var(--bg-surface)] text-primary-600 dark:text-primary-300 shadow-sm'
                  : 'text-[var(--text-faint)] hover:text-[var(--text)]'
              }`}
              aria-label="Grid view"
            >
              <FiGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={`p-1.5 rounded-lg transition-colors ${
                view === 'list'
                  ? 'bg-[var(--bg-surface)] text-primary-600 dark:text-primary-300 shadow-sm'
                  : 'text-[var(--text-faint)] hover:text-[var(--text)]'
              }`}
              aria-label="List view"
            >
              <FiList className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Search bar ── */}
      <div className="relative mb-5">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] w-4 h-4" />
        <input
          type="text"
          placeholder="Search question banks by title or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-9 py-2.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-faint)] hover:text-[var(--text)]"
            aria-label="Clear search"
          >
            <FiX className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Cards / List ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)]">
          <FiDatabase className="w-12 h-12 text-[var(--text-faint)] mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-1">
            {(search || activeVis !== 'all')
              ? 'No banks match your filters'
              : 'No question banks yet'}
          </h3>
          {(search || activeVis !== 'all') ? (
            <button
              onClick={() => { setSearch(''); setActiveVis('all'); }}
              className="text-xs text-primary-600 dark:text-primary-300 hover:underline mt-1"
            >
              Clear filters
            </button>
          ) : (
            <button
              onClick={() => navigate('/admin/question-banks/create')}
              className="btn-brand text-sm mt-3"
            >
              <FiPlus className="w-4 h-4" /> Create your first Question Bank
            </button>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 items-stretch">
          {filtered.map((bank) => (
            <QbCard
              key={bank._id}
              bank={bank}
              deleting={deletingId === bank._id}
              onView={() => navigate(`/admin/question-banks/${bank._id}`)}
              onEdit={() => navigate(`/admin/question-banks/${bank._id}/edit`)}
              onImport={() => navigate(`/admin/question-banks/${bank._id}/import`)}
              onAutoTest={() => navigate(`/admin/auto-test?qbId=${bank._id}`)}
              onDelete={() => handleDelete(bank._id)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((bank) => (
            <QbRow
              key={bank._id}
              bank={bank}
              deleting={deletingId === bank._id}
              onView={() => navigate(`/admin/question-banks/${bank._id}`)}
              onEdit={() => navigate(`/admin/question-banks/${bank._id}/edit`)}
              onImport={() => navigate(`/admin/question-banks/${bank._id}/import`)}
              onAutoTest={() => navigate(`/admin/auto-test?qbId=${bank._id}`)}
              onDelete={() => handleDelete(bank._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default QuestionBankListPage;
