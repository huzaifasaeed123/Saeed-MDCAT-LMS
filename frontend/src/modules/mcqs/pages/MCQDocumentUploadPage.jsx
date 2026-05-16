// src/modules/mcqs/pages/MCQDocumentUploadPage.jsx
// MCQ import from .docx — all QB classification fields are optional.
// Admin can add multiple QB + Subject + Chapter + Topic combinations.
import React, { useState, useRef, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { FiUpload, FiFile, FiCheck, FiX, FiInfo, FiPlus, FiTrash2 } from "react-icons/fi";
import apiClient from "../../../core/api/axiosConfig";
import { usePageHeader } from "../../../core/layouts/PageHeaderContext";

// ─── Classification Picker ────────────────────────────────────────────────────
// Lets user build one QB→Subject→Chapter→Topic entry and click "Add"
const ClassificationPicker = ({ banks, onAdd }) => {
  const [bankId, setBankId]       = useState("");
  const [bank, setBank]           = useState(null);
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [topicId, setTopicId]     = useState("");
  const [loading, setLoading]     = useState(false);

  const fetchBank = async (id) => {
    if (!id) { setBank(null); return; }
    setLoading(true);
    try {
      const r = await apiClient.get(`/question-banks/${id}`);
      if (r.data.success) setBank(r.data.data);
    } catch { toast.error("Failed to load QB details"); }
    finally { setLoading(false); }
  };

  const handleBankChange = (e) => {
    const id = e.target.value;
    setBankId(id); setSubjectId(""); setChapterId(""); setTopicId("");
    setBank(null);
    fetchBank(id);
  };

  const subjects = bank?.subjects || [];
  const chapters = subjects.find((s) => s._id === subjectId)?.chapters || [];
  const topics   = chapters.find((c) => c._id === chapterId)?.topics   || [];

  const handleAdd = () => {
    if (!bankId) { toast.error("Select at least a Question Bank to add a classification"); return; }
    const b = banks.find((x) => x._id === bankId);
    const s = subjects.find((x) => x._id === subjectId);
    const c = chapters.find((x) => x._id === chapterId);
    const t = topics.find((x) => x._id === topicId);

    onAdd({
      questionBankId: bankId,
      bankTitle:      b?.title || "",
      qbSubjectId:    subjectId || null,
      subjectTitle:   s?.title  || null,
      qbChapterId:    chapterId || null,
      chapterTitle:   c?.title  || null,
      qbTopicId:      topicId   || null,
      topicTitle:     t?.title  || null,
    });

    // Reset picker
    setBankId(""); setSubjectId(""); setChapterId(""); setTopicId(""); setBank(null);
  };

  // Shared select style matches theme tokens with primary focus ring.
  const selectCls =
    "w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 transition disabled:opacity-40";

  return (
    <div className="space-y-3">
      {/* QB select */}
      <div>
        <label className="block text-sm font-medium text-[var(--text)] mb-1">Question Bank</label>
        <select value={bankId} onChange={handleBankChange} className={selectCls}>
          <option value="">— Select Question Bank —</option>
          {banks.map((b) => <option key={b._id} value={b._id}>{b.title}</option>)}
        </select>
      </div>

      {/* Cascading selects — only shown when QB is picked */}
      {bankId && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">
              Subject <span className="text-[var(--text-faint)] text-xs">(optional)</span>
            </label>
            <select
              value={subjectId}
              onChange={(e) => { setSubjectId(e.target.value); setChapterId(""); setTopicId(""); }}
              className={selectCls}
            >
              <option value="">— Any Subject —</option>
              {subjects.map((s) => <option key={s._id} value={s._id}>{s.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">
              Chapter <span className="text-[var(--text-faint)] text-xs">(optional)</span>
            </label>
            <select
              value={chapterId}
              onChange={(e) => { setChapterId(e.target.value); setTopicId(""); }}
              disabled={!subjectId}
              className={selectCls}
            >
              <option value="">— Any Chapter —</option>
              {chapters.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">
              Topic <span className="text-[var(--text-faint)] text-xs">(optional)</span>
            </label>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              disabled={!chapterId}
              className={selectCls}
            >
              <option value="">— Any Topic —</option>
              {topics.map((t) => <option key={t._id} value={t._id}>{t.title}</option>)}
            </select>
          </div>
        </div>
      )}
      {bankId && loading && (
        <p className="text-sm text-[var(--text-faint)]">Loading QB details…</p>
      )}

      <button
        type="button"
        onClick={handleAdd}
        className="inline-flex items-center gap-2 px-4 py-2 bg-secondary-600 hover:bg-secondary-700 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        <FiPlus className="w-4 h-4" /> Add Classification
      </button>
    </div>
  );
};

// ─── Classification Tag List ──────────────────────────────────────────────────
const ClassificationList = ({ items, onRemove }) => {
  if (items.length === 0) return (
    <p className="text-sm text-[var(--text-faint)] italic">No classifications added yet.</p>
  );
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-start justify-between gap-2 px-3 py-2 bg-secondary-50 border border-secondary-200 dark:bg-secondary-950/30 dark:border-secondary-900 rounded-lg"
        >
          <div className="text-sm text-secondary-800 dark:text-secondary-200">
            <span className="font-semibold">{item.bankTitle}</span>
            {item.subjectTitle && <> → <span>{item.subjectTitle}</span></>}
            {item.chapterTitle && <> → <span>{item.chapterTitle}</span></>}
            {item.topicTitle   && <> → <span>{item.topicTitle}</span></>}
          </div>
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex-shrink-0 mt-0.5"
          >
            <FiTrash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const MCQDocumentUploadPage = () => {
  const { testId } = useParams();
  const navigate   = useNavigate();
  const fileInputRef = useRef(null);

  const [file, setFile]               = useState(null);
  const [loading, setLoading]         = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [testDetails, setTestDetails] = useState(null);
  const [importStatus, setImportStatus] = useState("idle");
  const [importId, setImportId]         = useState(null);
  const [importedCount, setImportedCount] = useState(0);
  // Drag highlight — local UI state so we can tint the drop zone in primary.
  const [isDragging, setIsDragging]   = useState(false);

  const [banks, setBanks] = useState([]);
  const [classifications, setClassifications] = useState([]);

  const [difficulty, setDifficulty] = useState("Medium");
  const [isPublic, setIsPublic]     = useState(true);

  // Load QB list and test details on mount
  useEffect(() => {
    apiClient.get("/question-banks")
      .then((r) => { if (r.data.success) setBanks(r.data.data); })
      .catch(() => {});

    if (testId) {
      apiClient.get(`/tests/${testId}`)
        .then((r) => { if (r.data.success) setTestDetails(r.data.data); })
        .catch(() => toast.error("Failed to load test details"));
    }
  }, [testId]);

  // Poll import status
  useEffect(() => {
    if (!importId || importStatus !== "processing") return;
    const iv = setInterval(async () => {
      try {
        const r = await apiClient.get(`/mcqs/import-status/${importId}`);
        if (r.data.status === "completed") {
          setImportStatus("success"); setImportedCount(r.data.importedCount); clearInterval(iv);
          toast.success(`Imported ${r.data.importedCount} MCQs`);
        } else if (r.data.status === "error") {
          setImportStatus("error"); clearInterval(iv);
          toast.error(r.data.message || "Import failed");
        }
      } catch {
        clearInterval(iv); setImportStatus("error");
        toast.error("Failed to check import status");
      }
    }, 2000);
    return () => clearInterval(iv);
  }, [importId, importStatus]);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      toast.error("Please upload a valid .docx file"); return;
    }
    setFile(f);
  };

  const handleDragOver  = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (f.type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      toast.error("Please upload a valid .docx file"); return;
    }
    setFile(f);
  };

  const handleAddClassification = (entry) => {
    // Prevent exact duplicates (same QB + subject + chapter + topic)
    const key = `${entry.questionBankId}|${entry.qbSubjectId}|${entry.qbChapterId}|${entry.qbTopicId}`;
    const exists = classifications.some(
      (c) => `${c.questionBankId}|${c.qbSubjectId}|${c.qbChapterId}|${c.qbTopicId}` === key
    );
    if (exists) { toast.warning("This classification is already added"); return; }
    setClassifications((prev) => [...prev, entry]);
  };

  const handleRemoveClassification = (idx) => {
    setClassifications((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { toast.error("Please select a file"); return; }

    setLoading(true); setImportStatus("uploading"); setUploadProgress(0);
    try {
      const data = new FormData();
      data.append("file", file);
      if (testId) data.append("testId", testId);
      data.append("difficulty", difficulty);
      data.append("isPublic",   isPublic);

      // Attach classifications as JSON
      if (classifications.length > 0) {
        data.append("classifications", JSON.stringify(classifications));
        // Also send primary QB fields (first entry) for MCQ storage
        const primary = classifications[0];
        if (primary.questionBankId) data.append("questionBankId", primary.questionBankId);
        if (primary.qbSubjectId)    data.append("qbSubjectId",    primary.qbSubjectId);
        if (primary.qbChapterId)    data.append("qbChapterId",    primary.qbChapterId);
        if (primary.qbTopicId)      data.append("qbTopicId",      primary.qbTopicId);
      }

      const r = await apiClient.post("/mcqs/import-document", data, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (pe) => setUploadProgress(Math.round((pe.loaded * 100) / pe.total)),
      });

      if (r.data.success) {
        setImportId(r.data.importId); setImportStatus("processing");
        toast.info("File uploaded. Processing MCQs…");
      } else {
        setImportStatus("error"); toast.error(r.data.message || "Upload failed");
      }
    } catch (err) {
      setImportStatus("error"); toast.error(err.response?.data?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const backUrl = testId ? `/tests/${testId}` : "/admin/question-banks";

  // Push title / subtitle / Cancel action to the global top bar.
  const headerSubtitle = testDetails?.title ? `Test: ${testDetails.title}` : "";
  const headerAction = useMemo(() => (
    <button
      type="button"
      onClick={() => navigate(backUrl)}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)] transition-colors whitespace-nowrap"
    >
      <FiX className="w-4 h-4" /> Cancel
    </button>
  ), [navigate, backUrl]);
  usePageHeader({
    title:    'Import MCQs from Document',
    subtitle: headerSubtitle,
    action:   headerAction,
  });

  const renderStatus = () => {
    if (importStatus === "uploading") return (
      <div className="mt-6 bg-[var(--bg-muted)] p-4 rounded-xl border border-[var(--border)]">
        <h3 className="font-medium text-[var(--text-strong)] mb-2">Uploading…</h3>
        <div className="w-full bg-[var(--border)] rounded-full h-2.5">
          <div
            className="bg-primary-500 h-2.5 rounded-full transition-all"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-1">{uploadProgress}%</p>
      </div>
    );
    if (importStatus === "processing") return (
      <div className="mt-6 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-4 rounded-xl flex items-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 flex-shrink-0" />
        <div>
          <h3 className="font-medium text-[var(--text-strong)]">Processing Document</h3>
          <p className="text-sm text-[var(--text-muted)]">Extracting MCQs… this may take a moment.</p>
        </div>
      </div>
    );
    if (importStatus === "success") return (
      <div className="mt-6 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-4 rounded-xl flex items-center gap-3">
        <div className="bg-emerald-100 dark:bg-emerald-950/60 p-2 rounded-full flex-shrink-0">
          <FiCheck className="text-emerald-600 dark:text-emerald-300 w-6 h-6" />
        </div>
        <div>
          <h3 className="font-medium text-[var(--text-strong)]">Import Successful!</h3>
          <p className="text-sm text-[var(--text-muted)]">Imported {importedCount} MCQs.</p>
          <Link to={backUrl} className="btn-brand text-sm mt-2">
            View Test
          </Link>
        </div>
      </div>
    );
    if (importStatus === "error") return (
      <div className="mt-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-4 rounded-xl flex items-center gap-3">
        <div className="bg-red-100 dark:bg-red-950/60 p-2 rounded-full flex-shrink-0">
          <FiX className="text-red-600 dark:text-red-300 w-6 h-6" />
        </div>
        <div>
          <h3 className="font-medium text-[var(--text-strong)]">Import Failed</h3>
          <p className="text-sm text-[var(--text-muted)]">Check the document format and try again.</p>
          <button
            onClick={() => { setFile(null); setImportStatus("idle"); }}
            className="btn-brand text-sm mt-2"
          >
            Try Again
          </button>
        </div>
      </div>
    );
    return null;
  };

  return (
    <div>
      {testDetails && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 mb-6">
          <p className="font-medium text-[var(--text-strong)]">Test: {testDetails.title}</p>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6"
      >
        {importStatus === "idle" && (
          <>
            {/* ── File drop zone ── */}
            <h2 className="font-display text-lg font-extrabold text-[var(--text-strong)] tracking-[-0.01em] mb-4">
              Upload MCQ Document
            </h2>
            <div
              className={`border-2 border-dashed rounded-2xl py-10 px-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-primary-400 bg-primary-50 dark:bg-primary-950/30'
                  : file
                    ? 'border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-950/20'
                    : 'border-[var(--border)] bg-[var(--bg-muted)] hover:border-primary-300 dark:hover:border-primary-700'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
            >
              {file ? (
                <div className="flex flex-col items-center">
                  <FiFile className="text-primary-500 w-12 h-12 mb-3" />
                  <p className="font-medium text-[var(--text-strong)]">{file.name}</p>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  <button
                    type="button"
                    className="mt-3 inline-flex items-center gap-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-semibold"
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  >
                    <FiX className="w-4 h-4" /> Remove
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <FiUpload className="text-[var(--text-faint)] w-12 h-12 mx-auto mb-3" />
                  <p className="font-medium text-[var(--text-strong)] mb-1">
                    Drag &amp; drop your .docx file here
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">or click to browse</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept=".docx" className="hidden" onChange={handleFileChange} />
            </div>

            {/* ── Classifications ── */}
            <div className="mt-6 p-4 sm:p-5 bg-secondary-50 dark:bg-secondary-950/20 border border-secondary-200 dark:border-secondary-900 rounded-2xl">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-[var(--text-strong)]">
                    Question Bank Classification
                    <span className="ml-2 text-[var(--text-faint)] text-xs font-normal">(optional — you can add multiple)</span>
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Add one or more QB → Subject → Chapter → Topic entries.
                    The first entry is used for MCQ storage; all entries tag the test.
                  </p>
                </div>
              </div>

              {/* Added classifications */}
              {classifications.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">
                    Added ({classifications.length}):
                  </p>
                  <ClassificationList items={classifications} onRemove={handleRemoveClassification} />
                </div>
              )}

              {/* Picker */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
                <p className="text-[11px] font-mono font-semibold text-[var(--text-faint)] mb-3 uppercase tracking-[0.16em]">
                  Add a classification
                </p>
                <ClassificationPicker banks={banks} onAdd={handleAddClassification} />
              </div>
            </div>

            {/* ── MCQ Settings ── */}
            <div className="mt-6">
              <h3 className="font-display text-base font-extrabold text-[var(--text-strong)] tracking-[-0.01em] mb-3">
                MCQ Settings
              </h3>
              <div className="flex flex-wrap gap-6 items-center">
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">Difficulty Level</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="h-4 w-4 text-primary-600 border-[var(--border)] rounded focus:ring-primary-400"
                  />
                  <label htmlFor="isPublic" className="text-sm text-[var(--text)]">Make MCQs public</label>
                </div>
              </div>
            </div>

            {/* ── Format hints ── */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-[var(--text)] mb-2">Document Format:</h3>
              <div className="bg-[var(--bg-muted)] border border-[var(--border-faint)] p-4 rounded-xl space-y-1.5">
                {[
                  "MCQs: Q:) or Q) for questions; A:) or A) for options",
                  "Correct answer: :Correct: followed by the option letter (A, B, C or D)",
                  "Explanation: :Explanation: or :ExplanationA:, :ExplanationB:, etc.",
                  "Images, bold, italic, superscript and subscript are preserved",
                ].map((t) => (
                  <div key={t} className="flex items-start text-sm text-[var(--text-muted)]">
                    <FiInfo className="mt-0.5 mr-2 text-[var(--text-faint)] flex-shrink-0" />
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-5 border-t border-[var(--border-faint)]">
              <button
                type="button"
                onClick={() => navigate(backUrl)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!file || loading}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
                  !file || loading
                    ? 'bg-[var(--border)] text-[var(--text-faint)] cursor-not-allowed'
                    : 'bg-primary-500 hover:bg-primary-600'
                }`}
              >
                <FiUpload className="w-4 h-4" />
                {loading ? "Uploading…" : "Upload and Process"}
              </button>
            </div>
          </>
        )}

        {renderStatus()}
      </form>
    </div>
  );
};

export default MCQDocumentUploadPage;
