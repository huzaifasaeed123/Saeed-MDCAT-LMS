// modules/questionbank/pages/QuestionBankImportPage.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiUpload, FiFile, FiCheck, FiX, FiInfo, FiArrowLeft, FiLoader } from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';

const QuestionBankImportPage = () => {
  const { qbId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [qb, setQb] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('idle');
  const [importId, setImportId] = useState(null);
  const [importedCount, setImportedCount] = useState(0);

  // Cascading selections
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');

  const [formData, setFormData] = useState({
    author: '',
    session: '',
    difficulty: 'Medium',
    isPublic: true,
  });

  useEffect(() => { fetchQB(); }, [qbId]);

  // Poll import status
  useEffect(() => {
    if (!importId || importStatus !== 'processing') return;
    const iv = setInterval(async () => {
      try {
        const res = await apiClient.get(`/mcqs/import-status/${importId}`);
        if (res.data.status === 'completed') {
          setImportStatus('success');
          setImportedCount(res.data.importedCount);
          clearInterval(iv);
          toast.success(`Imported ${res.data.importedCount} MCQs into question bank`);
        } else if (res.data.status === 'error') {
          setImportStatus('error');
          clearInterval(iv);
          toast.error(res.data.message || 'Import failed');
        }
      } catch {
        clearInterval(iv);
        setImportStatus('error');
      }
    }, 2000);
    return () => clearInterval(iv);
  }, [importId, importStatus]);

  const fetchQB = async () => {
    try {
      const res = await apiClient.get(`/question-banks/${qbId}`);
      if (res.data.success) setQb(res.data.data);
    } catch {
      toast.error('Failed to load question bank');
      navigate('/admin/question-banks');
    }
  };

  // Derived lists for cascading selects
  const subjects = qb?.subjects || [];
  const chapters = subjects.find((s) => s._id === selectedSubjectId)?.chapters || [];
  const topics   = chapters.find((c) => c._id === selectedChapterId)?.topics || [];

  const handleSubjectChange = (e) => {
    setSelectedSubjectId(e.target.value);
    setSelectedChapterId('');
    setSelectedTopicId('');
  };
  const handleChapterChange = (e) => {
    setSelectedChapterId(e.target.value);
    setSelectedTopicId('');
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f && f.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      toast.error('Please upload a valid .docx file');
      return;
    }
    if (f) setFile(f);
  };

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    const f = e.dataTransfer.files[0];
    if (f && f.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      toast.error('Please upload a valid .docx file'); return;
    }
    if (f) setFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { toast.error('Please select a .docx file'); return; }
    if (!selectedSubjectId) { toast.error('Please select a Subject'); return; }
    if (!selectedChapterId) { toast.error('Please select a Chapter'); return; }
    if (!selectedTopicId) { toast.error('Please select a Topic'); return; }

    // Resolve human-readable names for MCQ string fields
    const subjectTitle = subjects.find((s) => s._id === selectedSubjectId)?.title || '';
    const chapterTitle = chapters.find((c) => c._id === selectedChapterId)?.title || '';
    const topicTitle   = topics.find((t)   => t._id === selectedTopicId)?.title   || '';

    setLoading(true);
    setImportStatus('uploading');
    setUploadProgress(0);

    try {
      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('questionBankId', qbId);
      uploadData.append('qbSubjectId', selectedSubjectId);
      uploadData.append('qbChapterId', selectedChapterId);
      uploadData.append('qbTopicId', selectedTopicId);
      uploadData.append('subject', subjectTitle);
      uploadData.append('unit', chapterTitle);
      uploadData.append('topic', topicTitle);
      uploadData.append('author', formData.author);
      uploadData.append('session', formData.session);
      uploadData.append('difficulty', formData.difficulty);
      uploadData.append('isPublic', formData.isPublic);

      const res = await apiClient.post('/mcqs/import-document', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (pe) => setUploadProgress(Math.round((pe.loaded * 100) / pe.total)),
      });

      if (res.data.success) {
        setImportId(res.data.importId);
        setImportStatus('processing');
        toast.info('File uploaded. Processing MCQs…');
      } else {
        setImportStatus('error');
        toast.error(res.data.message || 'Upload failed');
      }
    } catch (err) {
      setImportStatus('error');
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setLoading(false);
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
    title:    'Import MCQs',
    subtitle: qb ? `Into ${qb.title}` : 'Bulk import from a .docx file',
    action:   headerAction,
  });

  return (
    <div>
      {/* Mobile back */}
      <div className="md:hidden mb-4">
        <button
          onClick={() => navigate('/admin/question-banks')}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <FiArrowLeft className="w-4 h-4" />
          Back to Question Banks
        </button>
      </div>

      {qb && (
        <div className="bg-primary-50/60 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-900/50 rounded-2xl p-4 mb-5">
          <p className="font-semibold text-primary-800 dark:text-primary-200">{qb.title}</p>
          {qb.description && <p className="text-sm text-primary-700 dark:text-primary-300 mt-0.5">{qb.description}</p>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6 space-y-6">
        {importStatus === 'idle' && (
          <>
            {/* QB location selectors */}
            <div>
              <h3 className="font-display text-base font-bold text-[var(--text-strong)] mb-3">Select Location in Bank</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-strong)] mb-1.5">Subject *</label>
                  <select
                    value={selectedSubjectId}
                    onChange={handleSubjectChange}
                    className="w-full px-3 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm transition-colors"
                    required
                  >
                    <option value="">— Select Subject —</option>
                    {subjects.map((s) => (
                      <option key={s._id} value={s._id}>{s.title}</option>
                    ))}
                  </select>
                </div>

                {/* Chapter */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-strong)] mb-1.5">Chapter *</label>
                  <select
                    value={selectedChapterId}
                    onChange={handleChapterChange}
                    disabled={!selectedSubjectId}
                    className="w-full px-3 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm disabled:bg-[var(--bg-muted)] disabled:text-[var(--text-faint)] transition-colors"
                    required
                  >
                    <option value="">— Select Chapter —</option>
                    {chapters.map((c) => (
                      <option key={c._id} value={c._id}>{c.title}</option>
                    ))}
                  </select>
                </div>

                {/* Topic */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-strong)] mb-1.5">Topic *</label>
                  <select
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value)}
                    disabled={!selectedChapterId}
                    className="w-full px-3 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm disabled:bg-[var(--bg-muted)] disabled:text-[var(--text-faint)] transition-colors"
                    required
                  >
                    <option value="">— Select Topic —</option>
                    {topics.map((t) => (
                      <option key={t._id} value={t._id}>{t.title}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* File upload */}
            <div>
              <h3 className="font-display text-base font-bold text-[var(--text-strong)] mb-3">Upload MCQ Document (.docx)</h3>
              <div
                className={`border-2 border-dashed rounded-2xl py-10 px-6 flex flex-col items-center cursor-pointer transition-colors ${
                  file
                    ? 'border-primary-400 bg-primary-50/40 dark:bg-primary-950/20'
                    : 'border-[var(--border)] bg-[var(--bg-muted)] hover:border-primary-400 hover:bg-primary-50/30 dark:hover:bg-primary-950/20'
                }`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
              >
                {file ? (
                  <div className="flex flex-col items-center">
                    <FiFile className="text-primary-500 w-12 h-12 mb-3" />
                    <p className="font-medium text-[var(--text-strong)]">{file.name}</p>
                    <p className="text-sm text-[var(--text-muted)] mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    <button
                      type="button"
                      className="mt-3 text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 flex items-center text-sm"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    >
                      <FiX className="mr-1" /> Remove
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <FiUpload className="text-[var(--text-faint)] w-12 h-12 mx-auto mb-3" />
                    <p className="font-medium text-[var(--text-strong)] mb-1">Drag and drop your .docx file here</p>
                    <p className="text-sm text-[var(--text-muted)]">or click to browse</p>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept=".docx" className="hidden" onChange={handleFileChange} />
              </div>
            </div>

            {/* Additional info */}
            <div>
              <h3 className="font-display text-base font-bold text-[var(--text-strong)] mb-3">Additional Info (optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-strong)] mb-1.5">Author</label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData((p) => ({ ...p, author: e.target.value }))}
                    placeholder="Author name"
                    className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] placeholder-[var(--text-faint)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-strong)] mb-1.5">Session / Year</label>
                  <input
                    type="text"
                    value={formData.session}
                    onChange={(e) => setFormData((p) => ({ ...p, session: e.target.value }))}
                    placeholder="e.g. 2024"
                    className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] placeholder-[var(--text-faint)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-strong)] mb-1.5">Difficulty</label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData((p) => ({ ...p, difficulty: e.target.value }))}
                    className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm transition-colors"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <div className="flex items-center mt-6">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={formData.isPublic}
                    onChange={(e) => setFormData((p) => ({ ...p, isPublic: e.target.checked }))}
                    className="h-4 w-4 text-primary-600 rounded focus:ring-primary-400"
                  />
                  <label htmlFor="isPublic" className="ml-2 text-sm text-[var(--text-strong)]">Make MCQs public</label>
                </div>
              </div>
            </div>

            {/* Format hint */}
            <div className="bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl p-4 text-sm text-[var(--text-muted)] space-y-1">
              <div className="flex items-start gap-2">
                <FiInfo className="mt-0.5 flex-shrink-0 text-[var(--text-faint)]" />
                <span>Use Q:) or Q) for questions; A:) or A) for options</span>
              </div>
              <div className="flex items-start gap-2">
                <FiInfo className="mt-0.5 flex-shrink-0 text-[var(--text-faint)]" />
                <span>Mark correct answer with :Correct: followed by the option letter</span>
              </div>
              <div className="flex items-start gap-2">
                <FiInfo className="mt-0.5 flex-shrink-0 text-[var(--text-faint)]" />
                <span>Add explanation with :Explanation:</span>
              </div>
            </div>

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
                disabled={!file || loading}
                className="btn-brand text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiUpload className="w-4 h-4" />
                {loading ? 'Uploading…' : 'Upload & Process'}
              </button>
            </div>
          </>
        )}

        {/* Upload progress */}
        {importStatus === 'uploading' && (
          <div className="py-4">
            <p className="font-medium text-[var(--text-strong)] mb-2">Uploading…</p>
            <div className="w-full bg-[var(--bg-muted)] rounded-full h-2.5">
              <div className="bg-primary-500 h-2.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-sm text-[var(--text-muted)] mt-1">{uploadProgress}%</p>
          </div>
        )}

        {importStatus === 'processing' && (
          <div className="flex items-center gap-4 py-4">
            <FiLoader className="animate-spin w-8 h-8 text-primary-500" />
            <div>
              <p className="font-medium text-[var(--text-strong)]">Processing Document</p>
              <p className="text-sm text-[var(--text-muted)]">Extracting MCQs from your document…</p>
            </div>
          </div>
        )}

        {importStatus === 'success' && (
          <div className="flex items-center gap-4 py-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-4">
            <div className="bg-emerald-100 dark:bg-emerald-900/40 p-2 rounded-full">
              <FiCheck className="text-emerald-600 dark:text-emerald-300 w-6 h-6" />
            </div>
            <div>
              <p className="font-medium text-emerald-800 dark:text-emerald-200">Import Successful!</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">{importedCount} MCQs imported into the question bank.</p>
              <button
                onClick={() => navigate('/admin/question-banks')}
                className="mt-2 text-sm text-primary-600 dark:text-primary-300 hover:underline"
              >
                Back to Question Banks
              </button>
            </div>
          </div>
        )}

        {importStatus === 'error' && (
          <div className="flex items-center gap-4 py-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl p-4">
            <div className="bg-rose-100 dark:bg-rose-900/40 p-2 rounded-full">
              <FiX className="text-rose-600 dark:text-rose-300 w-6 h-6" />
            </div>
            <div>
              <p className="font-medium text-rose-800 dark:text-rose-200">Import Failed</p>
              <p className="text-sm text-rose-700 dark:text-rose-300">Please check the file format and try again.</p>
              <button
                onClick={() => { setFile(null); setImportStatus('idle'); }}
                className="mt-2 text-sm text-primary-600 dark:text-primary-300 hover:underline"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default QuestionBankImportPage;
