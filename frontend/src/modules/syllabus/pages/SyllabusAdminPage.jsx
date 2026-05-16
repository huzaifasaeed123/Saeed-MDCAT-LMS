import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import { FiEdit2, FiTrash2, FiPlus, FiUpload, FiRefreshCw, FiSave, FiX } from 'react-icons/fi';
import * as svc from '../services/syllabusService';
import { subjectClass } from '../components/syllabusMeta';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';

const emptyTopic = {
  subject: '', unitNumber: 1, unitTitle: '',
  outcomeCode: '', outcomeText: '', sortOrder: '',
};

// Theme-aware subject chip — wraps the existing subjectClass() helper (which
// only emits light variants) and layers on dark-mode classes so chips stay
// legible in both themes.
const SUBJECT_DARK = {
  Biology:             'dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50',
  Chemistry:           'dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50',
  Physics:             'dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/50',
  English:             'dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50',
  'Logical Reasoning': 'dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50',
};
const subjectChipCls = (s) =>
  `${subjectClass(s)} ${SUBJECT_DARK[s] || 'dark:bg-[var(--bg-muted)] dark:text-[var(--text-muted)] dark:border-[var(--border)]'}`;

const SyllabusAdminPage = () => {
  const [topics, setTopics]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [busyId, setBusyId]       = useState(null);
  const [form, setForm]           = useState(emptyTopic);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter]       = useState({ subject: '', unitNumber: '' });
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter.subject)    params.subject    = filter.subject;
      if (filter.unitNumber) params.unitNumber = filter.unitNumber;
      const res = await svc.adminListTopics(params);
      setTopics(res.data || []);
    } catch { toast.error('Failed to load topics'); }
    finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusyId('form');
    try {
      const payload = {
        subject:     form.subject.trim(),
        unitNumber:  parseInt(form.unitNumber, 10),
        unitTitle:   form.unitTitle.trim(),
        outcomeCode: form.outcomeCode.trim(),
        outcomeText: form.outcomeText.trim(),
      };
      if (form.sortOrder !== '') payload.sortOrder = parseInt(form.sortOrder, 10);

      if (editingId) {
        await svc.adminUpdateTopic(editingId, payload);
        toast.success('Updated');
      } else {
        await svc.adminCreateTopic(payload);
        toast.success('Created');
      }
      setForm(emptyTopic); setEditingId(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setBusyId(null); }
  };

  const onEdit = (t) => {
    setEditingId(t._id);
    setForm({
      subject:     t.subject,
      unitNumber:  t.unitNumber,
      unitTitle:   t.unitTitle,
      outcomeCode: t.outcomeCode,
      outcomeText: t.outcomeText,
      sortOrder:   String(t.sortOrder ?? ''),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onDelete = async (id) => {
    if (!window.confirm('Delete this topic? All student progress for it will be removed.')) return;
    setBusyId(id);
    try { await svc.adminDeleteTopic(id); await load(); toast.success('Deleted'); }
    catch { toast.error('Delete failed'); }
    finally { setBusyId(null); }
  };

  // JSON file upload — feeds /admin/import. Accepts either { units: [...] }
  // or just the array form for convenience.
  const onUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const units = Array.isArray(json) ? json : json.units;
      if (!Array.isArray(units)) {
        toast.error('JSON must be { units: [...] } or an array');
        return;
      }
      const res = await svc.adminBulkImport(units);
      toast.success(`Imported: ${res.inserted} new, ${res.modified} updated`);
      await load();
    } catch (err) {
      toast.error(err.message || 'Import failed');
    } finally {
      setImporting(false);
      e.target.value = ''; // allow re-upload
    }
  };

  // ── Page header ───────────────────────────────────────────────────────────
  const subtitle = topics.length === 0
    ? 'No topics in catalog'
    : `${topics.length} topic${topics.length === 1 ? '' : 's'} in catalog`;

  // Memoise so PageHeaderContext doesn't see a fresh JSX object every render
  // (would cause its effect to re-fire → setHeader → infinite re-render loop).
  const headerAction = useMemo(() => (
    <div className="flex items-center gap-2">
      <label className="btn-brand text-sm cursor-pointer">
        <FiUpload className="w-4 h-4" /> {importing ? 'Importing…' : 'Upload JSON'}
        <input
          type="file"
          accept="application/json,.json"
          onChange={onUploadFile}
          className="hidden"
          disabled={importing}
        />
      </label>
      <button
        onClick={load}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)] transition-colors"
      >
        <FiRefreshCw className="w-4 h-4" /> Refresh
      </button>
    </div>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [importing]);

  usePageHeader({
    title:    'Syllabus Admin',
    subtitle,
    action:   headerAction,
  });

  const inputCls = 'w-full px-3 py-2 text-sm bg-[var(--bg-muted)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-faint)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400';

  return (
    <div>
      {/* ── Mobile-only action buttons (the navbar action slot is desktop-only) ── */}
      <div className="md:hidden mb-4 flex items-center gap-2">
        <label className="btn-brand text-sm flex-1 justify-center cursor-pointer">
          <FiUpload className="w-4 h-4" /> {importing ? 'Importing…' : 'Upload JSON'}
          <input
            type="file"
            accept="application/json,.json"
            onChange={onUploadFile}
            className="hidden"
            disabled={importing}
          />
        </label>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)] transition-colors"
        >
          <FiRefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-bold text-[var(--text-strong)] flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-300">
              {editingId ? <FiSave className="w-4 h-4" /> : <FiPlus className="w-4 h-4" />}
            </span>
            {editingId ? 'Edit topic' : 'Add topic'}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={() => { setForm(emptyTopic); setEditingId(null); }}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-strong)] flex items-center gap-1"
            >
              <FiX className="w-3 h-3" /> Cancel edit
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Subject *">
            <input
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Biology"
              className={inputCls}
            />
          </Field>
          <Field label="Unit number *">
            <input
              type="number"
              min={1}
              required
              value={form.unitNumber}
              onChange={(e) => setForm({ ...form, unitNumber: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Unit title *">
            <input
              required
              value={form.unitTitle}
              onChange={(e) => setForm({ ...form, unitTitle: e.target.value })}
              placeholder="Bioenergetics"
              className={inputCls}
            />
          </Field>
          <Field label="Outcome code *">
            <input
              required
              value={form.outcomeCode}
              onChange={(e) => setForm({ ...form, outcomeCode: e.target.value })}
              placeholder="3.4"
              className={inputCls}
            />
          </Field>
          <Field label="Sort order">
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              placeholder="(auto)"
              className={inputCls}
            />
          </Field>
          <div />
          <Field label="Outcome text *" full>
            <textarea
              required
              rows={2}
              value={form.outcomeText}
              onChange={(e) => setForm({ ...form, outcomeText: e.target.value })}
              className={`${inputCls} resize-none`}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={busyId === 'form'}
            className="btn-brand text-sm disabled:opacity-50"
          >
            {editingId ? <FiSave className="w-4 h-4" /> : <FiPlus className="w-4 h-4" />}
            {editingId ? 'Save changes' : 'Add topic'}
          </button>
        </div>
      </form>

      {/* Filter */}
      <div className="flex gap-2 mb-3">
        <input
          value={filter.subject}
          onChange={(e) => setFilter({ ...filter, subject: e.target.value })}
          placeholder="Filter by subject…"
          className={`${inputCls} flex-1 bg-[var(--bg-surface)]`}
        />
        <input
          value={filter.unitNumber}
          onChange={(e) => setFilter({ ...filter, unitNumber: e.target.value })}
          placeholder="Unit #"
          className={`${inputCls} w-28 bg-[var(--bg-surface)]`}
        />
      </div>

      {/* List */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
        {loading ? (
          <p className="text-sm text-[var(--text-faint)] p-6 text-center">Loading…</p>
        ) : topics.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)] p-6 text-center">
            No topics yet. Use "Upload JSON" with the PMDC outcomes file to seed in one click, or use the form above to add manually.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-muted)]">
                <tr>
                  {['Subject', 'Unit', 'Code', 'Outcome'].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-muted)] whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                  <th className="text-right px-4 py-3 text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-muted)] whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {topics.map((t) => (
                  <tr
                    key={t._id}
                    className="odd:bg-[var(--bg-surface)] even:bg-[var(--bg-muted)] hover:bg-primary-50/40 dark:hover:bg-primary-950/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded border ${subjectChipCls(t.subject)}`}>
                        {t.subject}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text)]">U{t.unitNumber} · {t.unitTitle}</td>
                    <td className="px-4 py-3 font-semibold text-[var(--text-strong)]">{t.outcomeCode}</td>
                    <td className="px-4 py-3 max-w-md text-[var(--text)]">{t.outcomeText}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => onEdit(t)}
                        className="inline-flex items-center justify-center p-1.5 text-primary-600 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/40 rounded-lg mr-1 transition-colors"
                        title="Edit"
                        aria-label="Edit topic"
                      >
                        <FiEdit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(t._id)}
                        disabled={busyId === t._id}
                        className="inline-flex items-center justify-center p-1.5 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg disabled:opacity-50 transition-colors"
                        title="Delete"
                        aria-label="Delete topic"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, full, children }) => (
  <div className={full ? 'md:col-span-3' : ''}>
    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">{label}</label>
    {children}
  </div>
);

export default SyllabusAdminPage;
