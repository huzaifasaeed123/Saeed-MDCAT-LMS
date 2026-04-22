// src/modules/mcqs/pages/MCQDocumentUploadPage.jsx
// MCQ import from .docx — all QB classification fields are optional.
// Admin can add multiple QB + Subject + Chapter + Topic combinations.
import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { FiUpload, FiFile, FiCheck, FiX, FiInfo, FiPlus, FiTrash2 } from "react-icons/fi";
import apiClient from "../../../core/api/axiosConfig";

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

  return (
    <div className="space-y-3">
      {/* QB select */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Question Bank</label>
        <select value={bankId} onChange={handleBankChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-400">
          <option value="">— Select Question Bank —</option>
          {banks.map((b) => <option key={b._id} value={b._id}>{b.title}</option>)}
        </select>
      </div>

      {/* Cascading selects — only shown when QB is picked */}
      {bankId && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject <span className="text-gray-400 text-xs">(optional)</span></label>
            <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setChapterId(""); setTopicId(""); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-400">
              <option value="">— Any Subject —</option>
              {subjects.map((s) => <option key={s._id} value={s._id}>{s.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chapter <span className="text-gray-400 text-xs">(optional)</span></label>
            <select value={chapterId} onChange={(e) => { setChapterId(e.target.value); setTopicId(""); }}
              disabled={!subjectId}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-400 disabled:opacity-40">
              <option value="">— Any Chapter —</option>
              {chapters.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Topic <span className="text-gray-400 text-xs">(optional)</span></label>
            <select value={topicId} onChange={(e) => setTopicId(e.target.value)}
              disabled={!chapterId}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-400 disabled:opacity-40">
              <option value="">— Any Topic —</option>
              {topics.map((t) => <option key={t._id} value={t._id}>{t.title}</option>)}
            </select>
          </div>
        </div>
      )}
      {bankId && loading && (
        <p className="text-sm text-gray-400">Loading QB details…</p>
      )}

      <button type="button" onClick={handleAdd}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md">
        <FiPlus className="w-4 h-4" /> Add Classification
      </button>
    </div>
  );
};

// ─── Classification Tag List ──────────────────────────────────────────────────
const ClassificationList = ({ items, onRemove }) => {
  if (items.length === 0) return (
    <p className="text-sm text-gray-400 italic">No classifications added yet.</p>
  );
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start justify-between gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
          <div className="text-sm text-indigo-800">
            <span className="font-semibold">{item.bankTitle}</span>
            {item.subjectTitle && <> → <span>{item.subjectTitle}</span></>}
            {item.chapterTitle && <> → <span>{item.chapterTitle}</span></>}
            {item.topicTitle   && <> → <span>{item.topicTitle}</span></>}
          </div>
          <button type="button" onClick={() => onRemove(i)}
            className="text-red-400 hover:text-red-600 flex-shrink-0 mt-0.5">
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

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
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

  const renderStatus = () => {
    if (importStatus === "uploading") return (
      <div className="mt-6 bg-gray-50 p-4 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-2">Uploading…</h3>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div className="bg-indigo-600 h-2.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
        </div>
        <p className="text-sm text-gray-500 mt-1">{uploadProgress}%</p>
      </div>
    );
    if (importStatus === "processing") return (
      <div className="mt-6 bg-blue-50 p-4 rounded-lg flex items-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 flex-shrink-0" />
        <div>
          <h3 className="font-medium text-gray-900">Processing Document</h3>
          <p className="text-sm text-gray-600">Extracting MCQs… this may take a moment.</p>
        </div>
      </div>
    );
    if (importStatus === "success") return (
      <div className="mt-6 bg-green-50 p-4 rounded-lg flex items-center gap-3">
        <div className="bg-green-100 p-2 rounded-full flex-shrink-0"><FiCheck className="text-green-600 w-6 h-6" /></div>
        <div>
          <h3 className="font-medium text-gray-900">Import Successful!</h3>
          <p className="text-sm text-gray-600">Imported {importedCount} MCQs.</p>
          <Link to={backUrl} className="mt-2 inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md">
            View Test
          </Link>
        </div>
      </div>
    );
    if (importStatus === "error") return (
      <div className="mt-6 bg-red-50 p-4 rounded-lg flex items-center gap-3">
        <div className="bg-red-100 p-2 rounded-full flex-shrink-0"><FiX className="text-red-600 w-6 h-6" /></div>
        <div>
          <h3 className="font-medium text-gray-900">Import Failed</h3>
          <p className="text-sm text-gray-600">Check the document format and try again.</p>
          <button onClick={() => { setFile(null); setImportStatus("idle"); }}
            className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md">
            Try Again
          </button>
        </div>
      </div>
    );
    return null;
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Import MCQs from Document</h1>

      {testDetails && (
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <p className="font-medium text-gray-900">Test: {testDetails.title}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
        {importStatus === "idle" && (
          <>
            {/* ── File drop zone ── */}
            <h2 className="text-lg font-medium text-gray-900 mb-4">Upload MCQ Document</h2>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg py-10 px-6 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 transition-colors"
              onDragOver={handleDragOver} onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
            >
              {file ? (
                <div className="flex flex-col items-center">
                  <FiFile className="text-indigo-600 w-12 h-12 mb-3" />
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  <button type="button" className="mt-3 text-red-600 hover:text-red-800 flex items-center"
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                    <FiX className="mr-1" /> Remove
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <FiUpload className="text-gray-400 w-12 h-12 mx-auto mb-3" />
                  <p className="font-medium text-gray-900 mb-1">Drag & drop your .docx file here</p>
                  <p className="text-sm text-gray-500">or click to browse</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept=".docx" className="hidden" onChange={handleFileChange} />
            </div>

            {/* ── Classifications ── */}
            <div className="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-gray-900">
                    Question Bank Classification
                    <span className="ml-2 text-gray-400 text-xs font-normal">(optional — you can add multiple)</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Add one or more QB → Subject → Chapter → Topic entries.
                    The first entry is used for MCQ storage; all entries tag the test.
                  </p>
                </div>
              </div>

              {/* Added classifications */}
              {classifications.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Added ({classifications.length}):</p>
                  <ClassificationList items={classifications} onRemove={handleRemoveClassification} />
                </div>
              )}

              {/* Picker */}
              <div className="bg-white border border-indigo-100 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Add a classification</p>
                <ClassificationPicker banks={banks} onAdd={handleAddClassification} />
              </div>
            </div>

            {/* ── MCQ Settings ── */}
            <div className="mt-6">
              <h3 className="text-md font-medium text-gray-900 mb-3">MCQ Settings</h3>
              <div className="flex flex-wrap gap-6 items-center">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty Level</label>
                  <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500">
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isPublic" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                  <label htmlFor="isPublic" className="text-sm text-gray-700">Make MCQs public</label>
                </div>
              </div>
            </div>

            {/* ── Format hints ── */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Document Format:</h3>
              <div className="bg-gray-50 p-4 rounded-lg space-y-1.5">
                {[
                  "MCQs: Q:) or Q) for questions; A:) or A) for options",
                  "Correct answer: :Correct: followed by the option letter (A, B, C or D)",
                  "Explanation: :Explanation: or :ExplanationA:, :ExplanationB:, etc.",
                  "Images, bold, italic, superscript and subscript are preserved",
                ].map((t) => (
                  <div key={t} className="flex items-start text-sm text-gray-600">
                    <FiInfo className="mt-0.5 mr-2 text-gray-400 flex-shrink-0" />
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => navigate(backUrl)}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={!file || loading}
                className={`px-4 py-2 text-sm font-medium rounded-md text-white ${!file || loading ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"}`}>
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
