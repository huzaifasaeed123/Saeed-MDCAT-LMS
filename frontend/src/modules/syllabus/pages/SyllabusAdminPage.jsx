import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FiEdit2, FiTrash2, FiPlus, FiUpload, FiRefreshCw, FiSave, FiX } from 'react-icons/fi';
import * as svc from '../services/syllabusService';
import { subjectClass } from '../components/syllabusMeta';

const emptyTopic = {
  subject: '', unitNumber: 1, unitTitle: '',
  outcomeCode: '', outcomeText: '', sortOrder: '',
};

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

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-end justify-between mb-5 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Syllabus Admin</h1>
          <p className="text-sm text-gray-500">{topics.length} topics in catalog</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="px-3 py-2 text-sm rounded-md bg-emerald-500 hover:bg-emerald-400 text-white flex items-center gap-1 cursor-pointer">
            <FiUpload className="w-4 h-4" /> {importing ? 'Importing…' : 'Upload JSON'}
            <input type="file" accept="application/json,.json" onChange={onUploadFile} className="hidden" disabled={importing} />
          </label>
          <button onClick={load} className="px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50 flex items-center gap-1">
            <FiRefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="bg-white rounded-lg shadow p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-700">{editingId ? 'Edit topic' : 'Add topic'}</h2>
          {editingId && (
            <button type="button" onClick={() => { setForm(emptyTopic); setEditingId(null); }} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <FiX className="w-3 h-3" /> Cancel edit
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Subject *">
            <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Biology" className="input" />
          </Field>
          <Field label="Unit number *">
            <input type="number" min={1} required value={form.unitNumber} onChange={(e) => setForm({ ...form, unitNumber: e.target.value })} className="input" />
          </Field>
          <Field label="Unit title *">
            <input required value={form.unitTitle} onChange={(e) => setForm({ ...form, unitTitle: e.target.value })} placeholder="Bioenergetics" className="input" />
          </Field>
          <Field label="Outcome code *">
            <input required value={form.outcomeCode} onChange={(e) => setForm({ ...form, outcomeCode: e.target.value })} placeholder="3.4" className="input" />
          </Field>
          <Field label="Sort order">
            <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} placeholder="(auto)" className="input" />
          </Field>
          <div />
          <Field label="Outcome text *" full>
            <textarea required rows={2} value={form.outcomeText} onChange={(e) => setForm({ ...form, outcomeText: e.target.value })} className="input resize-none" />
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="submit" disabled={busyId === 'form'} className="px-4 py-2 text-sm rounded-md bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 flex items-center gap-1">
            {editingId ? <FiSave className="w-4 h-4" /> : <FiPlus className="w-4 h-4" />}
            {editingId ? 'Save changes' : 'Add topic'}
          </button>
        </div>
      </form>

      {/* Filter */}
      <div className="flex gap-2 mb-3">
        <input value={filter.subject} onChange={(e) => setFilter({ ...filter, subject: e.target.value })} placeholder="Filter by subject…" className="input flex-1" />
        <input value={filter.unitNumber} onChange={(e) => setFilter({ ...filter, unitNumber: e.target.value })} placeholder="Unit #" className="input w-24" />
      </div>

      {/* List */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <p className="text-sm text-gray-500 p-6 text-center">Loading…</p>
        ) : topics.length === 0 ? (
          <p className="text-sm text-gray-500 p-6 text-center">
            No topics yet. Use "Upload JSON" with the PMDC outcomes file to seed in one click, or use the form above to add manually.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200">
                  <th className="px-4 py-2">Subject</th>
                  <th className="px-4 py-2">Unit</th>
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Outcome</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {topics.map((t) => (
                  <tr key={t._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded border ${subjectClass(t.subject)}`}>{t.subject}</span>
                    </td>
                    <td className="px-4 py-2">U{t.unitNumber} · {t.unitTitle}</td>
                    <td className="px-4 py-2 font-semibold">{t.outcomeCode}</td>
                    <td className="px-4 py-2 max-w-md">{t.outcomeText}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => onEdit(t)} className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100 mr-1" title="Edit">
                        <FiEdit2 className="w-3 h-3 inline" />
                      </button>
                      <button onClick={() => onDelete(t._id)} disabled={busyId === t._id} className="px-2 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50" title="Delete">
                        <FiTrash2 className="w-3 h-3 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inline style helper — Tailwind doesn't have an .input class so add one */}
      <style>{`
        .input { width: 100%; padding: 0.5rem 0.75rem; font-size: 0.875rem; border: 1px solid #d1d5db; border-radius: 0.375rem; }
        .input:focus { outline: none; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.4); border-color: transparent; }
      `}</style>
    </div>
  );
};

const Field = ({ label, full, children }) => (
  <div className={full ? 'md:col-span-3' : ''}>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    {children}
  </div>
);

export default SyllabusAdminPage;
