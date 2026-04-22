// modules/questionbank/pages/QuestionBankImportPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiUpload, FiFile, FiCheck, FiX, FiInfo, FiArrowLeft } from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';

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

  return (
    <div className="max-w-3xl mx-auto p-6">
      <button
        onClick={() => navigate('/admin/question-banks')}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-5 group"
      >
        <FiArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Question Banks
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Import MCQs to Question Bank</h1>
      {qb && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
          <p className="font-semibold text-indigo-800">{qb.title}</p>
          {qb.description && <p className="text-sm text-indigo-600 mt-0.5">{qb.description}</p>}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-6 space-y-6">
        {importStatus === 'idle' && (
          <>
            {/* QB location selectors */}
            <div>
              <h3 className="text-base font-semibold text-gray-800 mb-3">Select Location in Bank</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                  <select
                    value={selectedSubjectId}
                    onChange={handleSubjectChange}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chapter *</label>
                  <select
                    value={selectedChapterId}
                    onChange={handleChapterChange}
                    disabled={!selectedSubjectId}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm disabled:bg-gray-50 disabled:text-gray-400"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Topic *</label>
                  <select
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value)}
                    disabled={!selectedChapterId}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm disabled:bg-gray-50 disabled:text-gray-400"
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
              <h3 className="text-base font-semibold text-gray-800 mb-3">Upload MCQ Document (.docx)</h3>
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl py-10 px-6 flex flex-col items-center cursor-pointer hover:border-indigo-400 transition-colors"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
              >
                {file ? (
                  <div className="flex flex-col items-center">
                    <FiFile className="text-indigo-600 w-12 h-12 mb-3" />
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    <button type="button" className="mt-3 text-red-500 hover:text-red-700 flex items-center text-sm"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                      <FiX className="mr-1" /> Remove
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <FiUpload className="text-gray-400 w-12 h-12 mx-auto mb-3" />
                    <p className="font-medium text-gray-900 mb-1">Drag and drop your .docx file here</p>
                    <p className="text-sm text-gray-500">or click to browse</p>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept=".docx" className="hidden" onChange={handleFileChange} />
              </div>
            </div>

            {/* Additional info */}
            <div>
              <h3 className="text-base font-semibold text-gray-800 mb-3">Additional Info (optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                  <input type="text" value={formData.author}
                    onChange={(e) => setFormData((p) => ({ ...p, author: e.target.value }))}
                    placeholder="Author name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Session / Year</label>
                  <input type="text" value={formData.session}
                    onChange={(e) => setFormData((p) => ({ ...p, session: e.target.value }))}
                    placeholder="e.g. 2024"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <select value={formData.difficulty}
                    onChange={(e) => setFormData((p) => ({ ...p, difficulty: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm">
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <div className="flex items-center mt-6">
                  <input type="checkbox" id="isPublic" checked={formData.isPublic}
                    onChange={(e) => setFormData((p) => ({ ...p, isPublic: e.target.checked }))}
                    className="h-4 w-4 text-indigo-600 rounded" />
                  <label htmlFor="isPublic" className="ml-2 text-sm text-gray-700">Make MCQs public</label>
                </div>
              </div>
            </div>

            {/* Format hint */}
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500 space-y-1">
              <div className="flex items-start gap-2"><FiInfo className="mt-0.5 flex-shrink-0" />
                <span>Use Q:) or Q) for questions; A:) or A) for options</span></div>
              <div className="flex items-start gap-2"><FiInfo className="mt-0.5 flex-shrink-0" />
                <span>Mark correct answer with :Correct: followed by the option letter</span></div>
              <div className="flex items-start gap-2"><FiInfo className="mt-0.5 flex-shrink-0" />
                <span>Add explanation with :Explanation:</span></div>
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => navigate('/admin/question-banks')}
                className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={!file || loading}
                className={`px-5 py-2.5 text-sm font-medium rounded-xl text-white transition-colors ${
                  !file || loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}>
                {loading ? 'Uploading…' : 'Upload & Process'}
              </button>
            </div>
          </>
        )}

        {/* Upload progress */}
        {importStatus === 'uploading' && (
          <div className="py-4">
            <p className="font-medium text-gray-800 mb-2">Uploading…</p>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-indigo-600 h-2.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-sm text-gray-500 mt-1">{uploadProgress}%</p>
          </div>
        )}

        {importStatus === 'processing' && (
          <div className="flex items-center gap-4 py-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
            <div>
              <p className="font-medium text-gray-900">Processing Document</p>
              <p className="text-sm text-gray-500">Extracting MCQs from your document…</p>
            </div>
          </div>
        )}

        {importStatus === 'success' && (
          <div className="flex items-center gap-4 py-4 bg-emerald-50 rounded-xl p-4">
            <div className="bg-emerald-100 p-2 rounded-full"><FiCheck className="text-emerald-600 w-6 h-6" /></div>
            <div>
              <p className="font-medium text-gray-900">Import Successful!</p>
              <p className="text-sm text-gray-600">{importedCount} MCQs imported into the question bank.</p>
              <button onClick={() => navigate('/admin/question-banks')}
                className="mt-2 text-sm text-indigo-600 hover:underline">
                Back to Question Banks
              </button>
            </div>
          </div>
        )}

        {importStatus === 'error' && (
          <div className="flex items-center gap-4 py-4 bg-red-50 rounded-xl p-4">
            <div className="bg-red-100 p-2 rounded-full"><FiX className="text-red-600 w-6 h-6" /></div>
            <div>
              <p className="font-medium text-gray-900">Import Failed</p>
              <p className="text-sm text-gray-600">Please check the file format and try again.</p>
              <button onClick={() => { setFile(null); setImportStatus('idle'); }}
                className="mt-2 text-sm text-indigo-600 hover:underline">
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
