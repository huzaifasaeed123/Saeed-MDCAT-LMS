// src/modules/tests/pages/TestDetailPage.jsx
//
// Admin Test Detail page — themed to match the design system.
//   • Title/subtitle pushed up into the global top bar via usePageHeader().
//   • Header card uses theme tokens, status pill, classification chips with
//     dark: variants.
//   • "Add MCQs" panel keeps two import options (docx + question bank) with
//     themed dashed cards.
//   • Question list cards use theme tokens; option grid keeps green-correct
//     highlighting with dark variants.
//
// State, effects, API calls and validation are preserved untouched —
// only JSX, Tailwind classes and the page-header wiring changed.
import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "../../../core/api/axiosConfig";
import { fixImageUrls } from "../../../shared/utils/fixImageUrls";
import {
  FiEdit,
  FiTrash,
  FiPlus,
  FiEye,
  FiLock,
  FiEdit3,
  FiInfo,
  FiUpload,
  FiDatabase,
  FiZap,
  FiCheckSquare,
  FiFlag,
  FiBarChart2,
  FiSearch,
  FiX,
} from "react-icons/fi";
import { toast } from "react-toastify";
import { usePageHeader } from "../../../core/layouts/PageHeaderContext";

const TestDetailPage = () => {
  const { id } = useParams();
  const [test, setTest] = useState(null);
  const [mcqs, setMcqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportCounts, setReportCounts] = useState({});

  // Client-side MCQ search. Test MCQs are already loaded in memory, so we
  // filter locally (no API round-trip). Strips HTML so a search like "skeleton"
  // matches the visible text of a rich-text question, not its <p> tags.
  const [mcqSearch, setMcqSearch] = useState("");
  const stripHtml = (html) => (html || "").replace(/<[^>]*>/g, " ");
  const filteredMcqs = useMemo(() => {
    const q = mcqSearch.trim().toLowerCase();
    if (!q) return mcqs;
    return mcqs.filter((m) => {
      if (stripHtml(m.questionText).toLowerCase().includes(q)) return true;
      return (m.options || []).some((o) => stripHtml(o.optionText).toLowerCase().includes(q));
    });
  }, [mcqs, mcqSearch]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await fetchTestDetails();
      } catch (err) {
        console.error("Error loading test data:", err);
        setError("Failed to load test data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const fetchTestDetails = async () => {
    console.log("Called");
    try {
      const response = await apiClient.get(`/tests/${id}`);
      if (response.data.success) {
        const testData = response.data.data;
        setTest(testData);

        const mcqArr = testData.mcqs;
        if (!Array.isArray(mcqArr) || mcqArr.length === 0) {
          // No MCQs yet — nothing more to fetch
          setMcqs([]);
        } else if (typeof mcqArr[0] === 'object') {
          // Already populated — use directly
          setMcqs(mcqArr);
          try {
            const ids = mcqArr.map(m => m._id).join(',');
            const countRes = await apiClient.get(`/mcq-reports/counts?mcqIds=${ids}`);
            setReportCounts(countRes.data.data || {});
          } catch (_) { /* non-critical */ }
        } else {
          // Array of ObjectId strings — need a separate fetch
          await fetchMCQs();
        }
      } else {
        throw new Error(response.data.message || "Failed to load test details");
      }
    } catch (error) {
      console.error("Error fetching test details:", error);
      setError("Failed to load test details");
      toast.error("Failed to load test details");
      throw error;
    }
  };

  // Only used as a fallback if test.mcqs contains just IDs instead of populated objects
  const fetchMCQs = async () => {
    try {
      const response = await apiClient.get(`/mcqs/test/${id}`);
      if (response.data.success) {
        setMcqs(response.data.data);
        if (response.data.data.length > 0) {
          try {
            const ids = response.data.data.map(m => m._id).join(',');
            const countRes = await apiClient.get(`/mcq-reports/counts?mcqIds=${ids}`);
            setReportCounts(countRes.data.data || {});
          } catch (_) { /* non-critical */ }
        }
      } else {
        throw new Error(response.data.message || "Failed to load questions");
      }
    } catch (error) {
      console.error("Error fetching MCQs:", error);
      setError("Failed to load questions");
      toast.error("Failed to load questions");
      throw error;
    }
  };

  const handleDeleteMCQ = async (mcqId) => {
    if (
      window.confirm(
        "Are you sure you want to delete this question? This action cannot be undone."
      )
    ) {
      try {
        const response = await apiClient.delete(`/mcqs/${mcqId}`);

        if (response.data.success) {
          toast.success("Question deleted successfully");
          await fetchTestDetails();
        } else {
          throw new Error(response.data.message || "Failed to delete question");
        }
      } catch (error) {
        console.error("Error deleting MCQ:", error);
        toast.error(
          error.response?.data?.message || "Failed to delete question"
        );
      }
    }
  };

  const handlePublishTest = async () => {
    if (mcqs.length === 0) {
      toast.warning("Cannot publish a test with no questions");
      return;
    }

    try {
      const response = await apiClient.put(`/tests/${id}/publish`);

      if (response.data.success) {
        toast.success("Test published successfully");
        await fetchTestDetails();
      } else {
        throw new Error(response.data.message || "Failed to publish test");
      }
    } catch (error) {
      console.error("Error publishing test:", error);
      toast.error(error.response?.data?.message || "Failed to publish test");
    }
  };

  // Helper function to display difficulty badge — theme-aware with dark variants
  const getDifficultyBadge = (difficulty) => {
    switch (difficulty) {
      case "Easy":
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            Easy
          </span>
        );
      case "Medium":
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            Medium
          </span>
        );
      case "Hard":
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            Hard
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--bg-muted)] text-[var(--text-muted)]">
            Medium
          </span>
        );
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // ── Push title/subtitle to top navbar ───────────────────────────────────
  const headerSubtitle = test
    ? `${test.totalQuestions ?? mcqs.length} question${(test.totalQuestions ?? mcqs.length) === 1 ? '' : 's'} · ${test.status || 'draft'}`
    : 'Loading…';

  const headerAction = useMemo(() => {
    if (!test) return null;
    return (
      <div className="flex items-center gap-2">
        {test.status !== 'published' && (
          <button
            type="button"
            onClick={handlePublishTest}
            disabled={mcqs.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
          >
            <FiEye className="w-4 h-4" /> Publish
          </button>
        )}
        <Link
          to={`/tests/${id}/stats`}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-secondary-600 hover:bg-secondary-700 text-white rounded-xl transition-colors"
        >
          <FiBarChart2 className="w-4 h-4" /> Stats
        </Link>
        <Link
          to={`/tests/${id}/edit`}
          className="btn-brand text-sm"
        >
          <FiEdit className="w-4 h-4" /> Edit
        </Link>
      </div>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test, mcqs.length, id]);

  usePageHeader({
    title:    test?.title || 'Test',
    subtitle: headerSubtitle,
    action:   headerAction,
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-xl mb-4">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="btn-brand text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!test) {
    return (
      <div>
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-300 px-4 py-3 rounded-xl mb-4">
          <strong className="font-bold">Not Found!</strong>
          <span className="block sm:inline"> The requested test could not be found.</span>
        </div>
        <Link to="/tests" className="btn-brand text-sm">
          Back to Tests
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Mobile-only action buttons (navbar action slot is desktop-only) */}
      <div className="md:hidden mb-4 flex flex-wrap gap-2">
        {test.status !== 'published' && (
          <button
            type="button"
            onClick={handlePublishTest}
            disabled={mcqs.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
          >
            <FiEye className="w-4 h-4" /> Publish
          </button>
        )}
        <Link
          to={`/tests/${id}/stats`}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-secondary-600 hover:bg-secondary-700 text-white rounded-xl transition-colors"
        >
          <FiBarChart2 className="w-4 h-4" /> Stats
        </Link>
        <Link to={`/tests/${id}/edit`} className="btn-brand text-sm">
          <FiEdit className="w-4 h-4" /> Edit
        </Link>
      </div>

      {/* ── Test summary card ───────────────────────────────────────────── */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6 mb-5">
        {test.description && (
          <p className="text-sm text-[var(--text-muted)] mb-4">{test.description}</p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)]">Total Questions</p>
            <p className="font-display text-xl font-extrabold text-[var(--text-strong)] mt-0.5">{test.totalQuestions}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)]">Difficulty</p>
            <div className="mt-1">{getDifficultyBadge(test.difficultyLevel)}</div>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)]">Status</p>
            <div className="mt-1">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  test.status === 'published'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                }`}
              >
                {test.status}
              </span>
            </div>
          </div>
          {test.questionBankId && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)]">Question Bank</p>
              <p className="text-sm font-semibold text-[var(--text-strong)] mt-0.5 truncate">{test.questionBankId?.title || test.questionBankId}</p>
            </div>
          )}
          {test.courseId && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)]">Course</p>
              <p className="text-sm font-semibold text-[var(--text-strong)] mt-0.5 truncate">{test.courseId?.title || test.courseId}</p>
            </div>
          )}
        </div>

        {/* Classification badges */}
        {(test.subjects?.length > 0 || test.chapters?.length > 0 || test.topics?.length > 0) && (
          <div className="mt-4 pt-4 border-t border-[var(--border-faint)] space-y-2">
            {test.subjects?.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)] w-20">Subjects</span>
                {test.subjects.map((s) => (
                  <span key={s} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{s}</span>
                ))}
              </div>
            )}
            {test.chapters?.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)] w-20">Chapters</span>
                {test.chapters.map((c) => (
                  <span key={c} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-secondary-50 text-secondary-700 dark:bg-secondary-950/40 dark:text-secondary-300">{c}</span>
                ))}
              </div>
            )}
            {test.topics?.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)] w-20">Topics</span>
                {test.topics.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{t}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {test.instructions && (
          <div className="mt-4 p-4 bg-[var(--bg-muted)] rounded-xl">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)] mb-1.5">Instructions</h3>
            <p className="text-sm text-[var(--text)] whitespace-pre-wrap">{test.instructions}</p>
          </div>
        )}
      </div>

      {/* ── Add MCQs Panel ───────────────────────────────────────────────── */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6 mb-5">
        <h2 className="font-display text-base font-bold text-[var(--text-strong)] mb-4">Add MCQs to this Test</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option 1: Import .docx */}
          <div className="border-2 border-dashed border-emerald-300 dark:border-emerald-800 rounded-xl p-5 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center flex-shrink-0">
                <FiUpload className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--text-strong)]">Import from .docx</h3>
                <p className="text-xs text-[var(--text-faint)]">Upload a Word document with MCQs</p>
              </div>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-3">
              Parse MCQs from a formatted Word document. MCQs are saved to the Question Bank and linked to this test.
            </p>
            <Link
              to={`/tests/${id}/import-mcqs`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <FiUpload className="w-4 h-4" /> Import MCQs
            </Link>
          </div>

          {/* Option 2: Use Question Bank */}
          <div className="border-2 border-dashed border-secondary-300 dark:border-secondary-800 rounded-xl p-5 hover:bg-secondary-50/40 dark:hover:bg-secondary-950/20 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-secondary-100 dark:bg-secondary-950/40 rounded-full flex items-center justify-center flex-shrink-0">
                <FiDatabase className="w-5 h-5 text-secondary-600 dark:text-secondary-300" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--text-strong)]">Use Question Bank</h3>
                <p className="text-xs text-[var(--text-faint)]">Pick from existing MCQ library</p>
              </div>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-3">
              Select MCQs from a Question Bank by subject, chapter, and topic.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/auto-test?testId=${id}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-secondary-600 hover:bg-secondary-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <FiZap className="w-4 h-4" /> Auto Generate
              </Link>
              <Link
                to={`/tests/${id}/pick-mcqs`}
                className="inline-flex items-center gap-2 px-4 py-2 border border-secondary-400 dark:border-secondary-700 text-secondary-700 dark:text-secondary-300 hover:bg-secondary-50 dark:hover:bg-secondary-950/40 text-sm font-semibold rounded-lg transition-colors"
              >
                <FiCheckSquare className="w-4 h-4" /> Manual Pick
              </Link>
            </div>
          </div>
        </div>

        {/* Single MCQ shortcut */}
        <div className="mt-3 pt-3 border-t border-[var(--border-faint)] flex justify-end">
          <Link
            to={`/tests/${id}/mcqs/create`}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors"
          >
            <FiPlus className="w-4 h-4" /> Add single question manually
          </Link>
        </div>
      </div>

      {/* ── MCQs Section ─────────────────────────────────────────────────── */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6">
        <div className="flex justify-between items-center mb-5 gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--text-strong)]">Questions</h2>
            <p className="text-xs text-[var(--text-faint)] mt-0.5">
              Total: {mcqs.length} questions
            </p>
          </div>
          {mcqs.length > 0 && (
            <Link
              to={`/tests/${id}/mcqs/edit-all/0`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/40 hover:bg-primary-100 dark:hover:bg-primary-950/60 rounded-xl transition-colors"
            >
              <FiEdit3 className="w-4 h-4" /> Edit All MCQs
            </Link>
          )}
        </div>

        {/* Question Summary */}
        {mcqs.length > 0 && (
          <div className="mb-5 pb-4 border-b border-[var(--border-faint)]">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)] mb-2">Question Summary</h3>
            <div className="flex flex-wrap gap-4 text-sm text-[var(--text)]">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-emerald-400 dark:bg-emerald-600" />
                <span>Easy: {mcqs.filter((m) => m.difficulty === "Easy").length}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-amber-400 dark:bg-amber-600" />
                <span>Medium: {mcqs.filter((m) => m.difficulty === "Medium" || !m.difficulty).length}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-rose-400 dark:bg-rose-600" />
                <span>Hard: {mcqs.filter((m) => m.difficulty === "Hard").length}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                <FiLock className="w-3 h-3 text-[var(--text-faint)]" />
                <span>Private: {mcqs.filter((m) => m.isPublic === false).length}</span>
              </div>
            </div>
          </div>
        )}

        {/* Search — client-side filter over question + option text. */}
        {mcqs.length > 0 && (
          <div className="relative mb-4">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] w-4 h-4" />
            <input
              type="text"
              placeholder="Search questions by text or options…"
              value={mcqSearch}
              onChange={(e) => setMcqSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
            />
            {mcqSearch && (
              <button
                onClick={() => setMcqSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-faint)] hover:text-[var(--text)]"
                aria-label="Clear search"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
            {mcqSearch && (
              <p className="text-xs text-[var(--text-faint)] mt-1.5">
                {filteredMcqs.length} of {mcqs.length} question{mcqs.length !== 1 ? "s" : ""} match
              </p>
            )}
          </div>
        )}

        {mcqs.length === 0 ? (
          <div className="bg-[var(--bg-muted)] text-center py-12 rounded-xl">
            <FiInfo className="w-12 h-12 text-[var(--text-faint)] mx-auto mb-3" />
            <p className="text-[var(--text-muted)] text-base font-semibold">No questions added yet.</p>
            <p className="text-[var(--text-faint)] text-sm mt-1">
              Use the options above to import or pick MCQs from a Question Bank.
            </p>
          </div>
        ) : filteredMcqs.length === 0 ? (
          <div className="bg-[var(--bg-muted)] text-center py-12 rounded-xl">
            <FiSearch className="w-12 h-12 text-[var(--text-faint)] mx-auto mb-3" />
            <p className="text-[var(--text-muted)] text-base font-semibold">No questions match “{mcqSearch}”.</p>
            <button
              onClick={() => setMcqSearch("")}
              className="mt-2 text-sm text-primary-600 dark:text-primary-300 hover:underline font-medium"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMcqs.map((mcq) => {
              // Number by the MCQ's real position in the full list so the
              // shown number stays stable while filtering.
              const index = mcqs.findIndex((m) => m._id === mcq._id);
              return (
              <div
                key={mcq._id}
                className="border border-[var(--border)] rounded-xl p-4 hover:bg-[var(--bg-muted)] transition-colors"
              >
                {/* Top row: question number, tags, action buttons */}
                <div className="flex justify-between items-center mb-3 gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="bg-[var(--bg-muted)] rounded-full w-8 h-8 flex items-center justify-center text-[var(--text)] font-semibold flex-shrink-0">
                      {index + 1}
                    </div>

                    {getDifficultyBadge(mcq.difficulty)}

                    {mcq.isPublic === false && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] bg-[var(--bg-muted)] px-2 py-0.5 rounded-full font-medium">
                        <FiLock className="w-3 h-3" /> Private
                      </span>
                    )}

                    {mcq.revisionCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full font-medium">
                        <FiEdit3 className="w-3 h-3" /> Revised {mcq.revisionCount} times
                      </span>
                    )}

                    {reportCounts[mcq._id] > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 px-2 py-0.5 rounded-full font-semibold">
                        <FiFlag className="w-3 h-3" /> {reportCounts[mcq._id]} report{reportCounts[mcq._id] > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Link
                      to={`/tests/${id}/mcqs/${mcq._id}/edit`}
                      className="p-2 text-primary-600 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/40 rounded-lg transition-colors"
                      title="Edit question"
                    >
                      <FiEdit className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDeleteMCQ(mcq._id)}
                      className="p-2 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                      title="Delete question"
                    >
                      <FiTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Question text */}
                <div className="prose prose-sm dark:prose-invert max-w-none text-[var(--text-strong)] mb-3">
                  <div dangerouslySetInnerHTML={{ __html: fixImageUrls(mcq.questionText) }} />
                </div>

                {/* Options grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                  {mcq.options &&
                    mcq.options.map((option) => (
                      <div
                        key={option._id || `${mcq._id}-${option.optionLetter}`}
                        className={`p-2.5 rounded-lg flex items-start text-sm ${
                          option.isCorrect
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800'
                            : 'bg-[var(--bg-muted)] border border-[var(--border)]'
                        }`}
                      >
                        <span className={`font-bold mr-2 flex-shrink-0 ${option.isCorrect ? 'text-emerald-700 dark:text-emerald-300' : 'text-[var(--text-muted)]'}`}>
                          {option.optionLetter}.
                        </span>
                        <span
                          className={`inline ${option.isCorrect ? 'text-emerald-900 dark:text-emerald-100 font-medium' : 'text-[var(--text)]'}`}
                          dangerouslySetInnerHTML={{
                            __html: fixImageUrls(option.optionText),
                          }}
                        />
                      </div>
                    ))}
                </div>

                {/* Explanation */}
                {mcq.explanationText && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg mb-3">
                    <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300 mb-1.5">
                      Explanation
                    </p>
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none text-[var(--text)]"
                      dangerouslySetInnerHTML={{ __html: fixImageUrls(mcq.explanationText) }}
                    />
                  </div>
                )}

                {/* Metadata */}
                <div className="text-[11px] text-[var(--text-faint)] flex flex-wrap gap-x-4 gap-y-1">
                  <div>Author: {mcq.author || "Unknown"}</div>
                  {mcq.lastRevised && (
                    <div>Last revised: {formatDate(mcq.lastRevised)}</div>
                  )}
                  <div>Created: {formatDate(mcq.createdAt)}</div>
                  {mcq.statistics &&
                    mcq.statistics.correctPercentage !== undefined && (
                      <div>Student accuracy: {mcq.statistics.correctPercentage}%</div>
                    )}
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* Bottom publish button */}
        {mcqs.length > 0 && test.status !== "published" && (
          <div className="mt-5 pt-5 border-t border-[var(--border-faint)] flex justify-end">
            <button
              onClick={handlePublishTest}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors"
            >
              <FiEye className="w-4 h-4" /> Publish Test
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestDetailPage;
