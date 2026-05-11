// src/modules/tests/pages/TestDetailPage.jsx

import React, { useState, useEffect } from "react";
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
} from "react-icons/fi";
import { toast } from "react-toastify";


const TestDetailPage = () => {
  const { id } = useParams();
  const [test, setTest] = useState(null);
  const [mcqs, setMcqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportCounts, setReportCounts] = useState({});

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

  // Helper function to display difficulty badge
  const getDifficultyBadge = (difficulty) => {
    switch (difficulty) {
      case "Easy":
        return (
          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
            Easy
          </span>
        );
      case "Medium":
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
            Medium
          </span>
        );
      case "Hard":
        return (
          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
            Hard
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <strong className="font-bold">Not Found!</strong>
          <span className="block sm:inline">
            {" "}
            The requested test could not be found.
          </span>
        </div>
        <Link
          to="/tests"
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md"
        >
          Back to Tests
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Test Details Header */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{test.title}</h1>
            <p className="text-gray-600 mb-4">{test.description}</p>
          </div>
          <div className="flex space-x-2">
            {test.status !== "published" && (
              <button
                onClick={handlePublishTest}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center"
                disabled={mcqs.length === 0}
              >
                <FiEye className="mr-2" /> Publish Test
              </button>
            )}
            <Link
              to={`/tests/${id}/stats`}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center"
            >
              <FiBarChart2 className="mr-2" /> View Stats
            </Link>
            <Link
              to={`/tests/${id}/edit`}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center"
            >
              <FiEdit className="mr-2" /> Edit Test
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <p className="text-sm text-gray-500">Total Questions</p>
            <p className="font-semibold">{test.totalQuestions}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Difficulty</p>
            <p className="font-semibold">{test.difficultyLevel || '—'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <span
              className={`px-2 py-1 rounded-full text-sm ${
                test.status === "published"
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {test.status}
            </span>
          </div>
          {test.questionBankId && (
            <div>
              <p className="text-sm text-gray-500">Question Bank</p>
              <p className="font-semibold">{test.questionBankId?.title || test.questionBankId}</p>
            </div>
          )}
          {test.courseId && (
            <div>
              <p className="text-sm text-gray-500">Course</p>
              <p className="font-semibold">{test.courseId?.title || test.courseId}</p>
            </div>
          )}
        </div>

        {/* Classification badges */}
        {(test.subjects?.length > 0 || test.chapters?.length > 0 || test.topics?.length > 0) && (
          <div className="mt-4 space-y-2">
            {test.subjects?.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500 w-16">Subjects</span>
                {test.subjects.map((s) => (
                  <span key={s} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">{s}</span>
                ))}
              </div>
            )}
            {test.chapters?.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500 w-16">Chapters</span>
                {test.chapters.map((c) => (
                  <span key={c} className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs">{c}</span>
                ))}
              </div>
            )}
            {test.topics?.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500 w-16">Topics</span>
                {test.topics.map((t) => (
                  <span key={t} className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs">{t}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {test.instructions && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium mb-2">Instructions</h3>
            <p className="text-gray-700">{test.instructions}</p>
          </div>
        )}
      </div>

      {/* Add MCQs Panel */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Add MCQs to this Test</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option 1: Import .docx */}
          <div className="border-2 border-dashed border-green-300 rounded-xl p-5 hover:bg-green-50 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <FiUpload className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Import from .docx</h3>
                <p className="text-xs text-gray-500">Upload a Word document with MCQs</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Parse MCQs from a formatted Word document. MCQs are saved to the Question Bank and linked to this test.
            </p>
            <Link
              to={`/tests/${id}/import-mcqs`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <FiUpload className="w-4 h-4" /> Import MCQs
            </Link>
          </div>

          {/* Option 2: Use Question Bank */}
          <div className="border-2 border-dashed border-indigo-300 rounded-xl p-5 hover:bg-indigo-50 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <FiDatabase className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Use Question Bank</h3>
                <p className="text-xs text-gray-500">Pick from existing MCQ library</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Select MCQs from a Question Bank by subject, chapter, and topic.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/auto-test?testId=${id}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <FiZap className="w-4 h-4" /> Auto Generate
              </Link>
              <Link
                to={`/tests/${id}/pick-mcqs`}
                className="inline-flex items-center gap-2 px-4 py-2 border border-indigo-400 text-indigo-700 hover:bg-indigo-100 text-sm font-medium rounded-lg transition-colors"
              >
                <FiCheckSquare className="w-4 h-4" /> Manual Pick
              </Link>
            </div>
          </div>
        </div>

        {/* Single MCQ shortcut */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
          <Link
            to={`/tests/${id}/mcqs/create`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <FiPlus className="w-4 h-4" /> Add single question manually
          </Link>
        </div>
      </div>

      {/* MCQs Section */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">Questions</h2>
            <p className="text-sm text-gray-500 mt-1">
              Total: {mcqs.length} questions
            </p>
          </div>
          {mcqs.length > 0 && (
            <Link
              to={`/tests/${id}/mcqs/edit-all/0`}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center"
            >
              <FiEdit3 className="mr-2" /> Edit All MCQs
            </Link>
          )}
        </div>

        {/* Question Summary - At the top before the questions */}
        {mcqs.length > 0 && (
          <div className="mb-6 pb-4 border-b border-gray-200">
            <h3 className="font-semibold mb-2">Question Summary</h3>
            <div className="flex gap-4 mt-2 text-sm">
              <div className="flex items-center">
                <span className="inline-block w-3 h-3 rounded-full bg-green-100 mr-1"></span>
                <span>
                  Easy: {mcqs.filter((m) => m.difficulty === "Easy").length}
                </span>
              </div>
              <div className="flex items-center">
                <span className="inline-block w-3 h-3 rounded-full bg-yellow-100 mr-1"></span>
                <span>
                  Medium:{" "}
                  {
                    mcqs.filter(
                      (m) => m.difficulty === "Medium" || !m.difficulty
                    ).length
                  }
                </span>
              </div>
              <div className="flex items-center">
                <span className="inline-block w-3 h-3 rounded-full bg-red-100 mr-1"></span>
                <span>
                  Hard: {mcqs.filter((m) => m.difficulty === "Hard").length}
                </span>
              </div>
              <div className="flex items-center">
                <FiLock className="text-gray-400 mr-1 w-3 h-3" />
                <span>
                  Private: {mcqs.filter((m) => m.isPublic === false).length}
                </span>
              </div>
            </div>
          </div>
        )}

        {mcqs.length === 0 ? (
          <div className="bg-gray-50 text-center py-12 rounded-lg">
            <FiInfo className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No questions added yet.</p>
            <p className="text-gray-400 mt-2">
              Use the options above to import or pick MCQs from a Question Bank.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {mcqs.map((mcq, index) => (
              <div
                key={mcq._id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                {/* Top div with question number, tags, and action buttons */}
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    {/* Question number */}
                    <div className="bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center text-gray-700 font-semibold flex-shrink-0">
                      {index + 1}
                    </div>

                    {/* Question tags/badges */}
                    {getDifficultyBadge(mcq.difficulty)}

                    {mcq.isPublic === false && (
                      <span className="flex items-center text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        <FiLock className="mr-1" /> Private
                      </span>
                    )}

                    {mcq.revisionCount > 0 && (
                      <span className="flex items-center text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded-full">
                        <FiEdit3 className="mr-1" /> Revised {mcq.revisionCount}{" "}
                        times
                      </span>
                    )}

                    {reportCounts[mcq._id] > 0 && (
                      <span className="flex items-center text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-full font-semibold">
                        <FiFlag className="mr-1 w-3 h-3" /> {reportCounts[mcq._id]} report{reportCounts[mcq._id] > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex space-x-2">
                    <Link
                      to={`/tests/${id}/mcqs/${mcq._id}/edit`}
                      className="text-yellow-600 hover:text-yellow-900 p-2 rounded hover:bg-yellow-50"
                      title="Edit question"
                    >
                      <FiEdit className="w-5 h-5" />
                    </Link>
                    <button
                      onClick={() => handleDeleteMCQ(mcq._id)}
                      className="text-red-600 hover:text-red-900 p-2 rounded hover:bg-red-50"
                      title="Delete question"
                    >
                      <FiTrash className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Question text */}
                <div className="prose max-w-none mb-3">
                  <div dangerouslySetInnerHTML={{ __html: fixImageUrls(mcq.questionText) }} />
                </div>

                {/* Options with two-column layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                  {mcq.options &&
                    mcq.options.map((option) => (
                      <div
                        key={option._id || `${mcq._id}-${option.optionLetter}`}
                        className={`p-2 rounded flex items-start ${
                          option.isCorrect
                            ? "bg-green-50 border border-green-200"
                            : "bg-gray-50 border border-gray-200"
                        }`}
                      >
                        <span className="font-medium mr-2 flex-shrink-0">
                          {option.optionLetter}.
                        </span>
                        <span
                          className="inline"
                          dangerouslySetInnerHTML={{
                            __html: fixImageUrls(option.optionText),
                          }}
                        />
                      </div>
                    ))}
                </div>

                {/* Explanation section */}
                {mcq.explanationText && (
                  <div className="p-3 bg-blue-50 rounded mb-3">
                    <p className="text-sm font-semibold text-blue-800">
                      Explanation:
                    </p>
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: fixImageUrls(mcq.explanationText) }}
                    />
                  </div>
                )}

                {/* MCQ metadata */}
                <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                  <div>Author: {mcq.author || "Unknown"}</div>
                  {mcq.lastRevised && (
                    <div>Last revised: {formatDate(mcq.lastRevised)}</div>
                  )}
                  <div>Created: {formatDate(mcq.createdAt)}</div>
                  {mcq.statistics &&
                    mcq.statistics.correctPercentage !== undefined && (
                      <div>
                        Student accuracy: {mcq.statistics.correctPercentage}%
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Publish button at the bottom for convenience */}
        {mcqs.length > 0 && test.status !== "published" && (
          <div className="mt-6 pt-6 border-t border-gray-200 flex justify-end">
            <button
              onClick={handlePublishTest}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center"
            >
              <FiEye className="mr-2" /> Publish Test
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestDetailPage;
