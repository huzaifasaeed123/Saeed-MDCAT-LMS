// frontend/src/components/MCQs/MCQDocumentUpload.jsx
import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate,Link  } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FiUpload,
  FiFile,
  FiCheck,
  FiX,
  FiLoader,
  FiInfo,
} from "react-icons/fi";
import apiClient from "../../utils/axiosConfig";

const MCQDocumentUpload = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [testDetails, setTestDetails] = useState(null);
  const [importStatus, setImportStatus] = useState("idle"); // idle, uploading, processing, success, error
  const [importId, setImportId] = useState(null);
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef(null);

  // Form fields for additional MCQ information
  const [formData, setFormData] = useState({
    author: "",
    subject: "",
    unit: "",
    topic: "",
    subTopic: "",
    session: "",
    difficulty: "Medium",
    isPublic: true,
  });

  // Fetch test details on component mount
  useEffect(() => {
    const fetchTestDetails = async () => {
      try {
        const response = await apiClient.get(`/tests/${testId}`);
        if (response.data.success) {
          const test = response.data.data;
          setTestDetails(test);

          // Pre-fill form data with test details
          setFormData((prev) => ({
            ...prev,
            subject: test.subject || "",
            unit: test.unit || "",
            topic: test.topic || "",
            subTopic: test.subTopic || "",
            session: test.session || "",
          }));
        }
      } catch (error) {
        console.error("Error fetching test details:", error);
        toast.error("Failed to load test details");
      }
    };

    fetchTestDetails();
  }, [testId]);

  // Poll import status if we have an importId
  useEffect(() => {
    if (!importId || importStatus !== "processing") {
      return;
    }

    const statusInterval = setInterval(async () => {
      try {
        const response = await apiClient.get(`/mcqs/import-status/${importId}`);

        if (response.data.status === "completed") {
          setImportStatus("success");
          setImportedCount(response.data.importedCount);
          clearInterval(statusInterval);
          toast.success(
            `Successfully imported ${response.data.importedCount} MCQs`
          );
        } else if (response.data.status === "error") {
          setImportStatus("error");
          clearInterval(statusInterval);
          toast.error(response.data.message || "Import failed");
        }
      } catch (error) {
        console.error("Error checking import status:", error);
        clearInterval(statusInterval);
        setImportStatus("error");
        toast.error("Failed to check import status");
      }
    }, 2000);

    return () => clearInterval(statusInterval);
  }, [importId, importStatus]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle checkbox changes
  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  // Handle file input change
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (
        selectedFile.type !==
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        toast.error("Please upload a valid .docx file");
        return;
      }
      setFile(selectedFile);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (
        droppedFile.type !==
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        toast.error("Please upload a valid .docx file");
        return;
      }
      setFile(droppedFile);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      toast.error("Please select a file to upload");
      return;
    }

    setLoading(true);
    setImportStatus("uploading");
    setUploadProgress(0);

    try {
      // Create FormData
      const formData = new FormData();
      formData.append("file", file);
      formData.append("testId", testId);

      // Append all additional fields
      Object.keys(formData).forEach((key) => {
        formData.append(key, formData[key]);
      });

      // Upload file with progress tracking
      const response = await apiClient.post("/mcqs/import-document", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });

      if (response.data.success) {
        setImportId(response.data.importId);
        setImportStatus("processing");
        toast.info("File uploaded successfully. Processing MCQs...");
      } else {
        setImportStatus("error");
        toast.error(response.data.message || "Failed to upload file");
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      setImportStatus("error");
      toast.error(error.response?.data?.message || "Failed to upload file");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(`/tests/${testId}`);
  };

  // Render file upload area
  const renderFileUpload = () => {
    return (
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg py-10 px-6 flex flex-col items-center justify-center cursor-pointer"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current.click()}
      >
        {file ? (
          <div className="flex flex-col items-center">
            <FiFile className="text-primary-600 w-12 h-12 mb-3" />
            <p className="font-medium text-gray-900">{file.name}</p>
            <p className="text-sm text-gray-500 mt-1">
              {(file.size / (1024 * 1024)).toFixed(2)} MB
            </p>
            <button
              type="button"
              className="mt-3 text-red-600 hover:text-red-800 flex items-center"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
            >
              <FiX className="mr-1" /> Remove
            </button>
          </div>
        ) : (
          <div className="text-center">
            <FiUpload className="text-gray-400 w-12 h-12 mx-auto mb-3" />
            <p className="font-medium text-gray-900 mb-1">
              Drag and drop your .docx file here
            </p>
            <p className="text-sm text-gray-500">or click to browse</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    );
  };

  // Render import status
  const renderImportStatus = () => {
    switch (importStatus) {
      case "uploading":
        return (
          <div className="mt-6 bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Uploading Document
            </h3>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {uploadProgress}% Uploaded
            </p>
          </div>
        );
      case "processing":
        return (
          <div className="mt-6 bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="mr-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Processing Document
                </h3>
                <p className="text-sm text-gray-600">
                  Extracting MCQs from your document. This may take a few
                  minutes depending on the document size.
                </p>
              </div>
            </div>
          </div>
        );
      case "success":
        return (
          <div className="mt-6 bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="mr-3 bg-green-100 p-2 rounded-full">
                <FiCheck className="text-green-600 w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Import Successful!
                </h3>
                <p className="text-sm text-gray-600">
                  Successfully imported {importedCount} MCQs from your document.
                </p>
                {/* <button
                  onClick={() => navigate(`/tests/${testId}`)}
                  className="mt-3 inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  View MCQs
                </button> */}
                <Link
                  to={`/tests/${testId}`}
                  className="mt-3 inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  View MCQs
                </Link>
              </div>
            </div>
          </div>
        );
      case "error":
        return (
          <div className="mt-6 bg-red-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="mr-3 bg-red-100 p-2 rounded-full">
                <FiX className="text-red-600 w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Import Failed
                </h3>
                <p className="text-sm text-gray-600">
                  There was an error processing your document. Please check the
                  format and try again.
                </p>
                <button
                  onClick={() => {
                    setFile(null);
                    setImportStatus("idle");
                  }}
                  className="mt-3 inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Import MCQs from Document
      </h1>

      {testDetails && (
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <h2 className="font-medium text-gray-900">
            Test: {testDetails.title}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {testDetails.subject} {testDetails.unit && `- ${testDetails.unit}`}{" "}
            {testDetails.topic && `- ${testDetails.topic}`}
          </p>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-md p-6"
      >
        {importStatus === "idle" && (
          <>
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Upload MCQ Document
            </h2>

            {renderFileUpload()}

            {/* Additional MCQ Information */}
            <div className="mt-6">
              <h3 className="text-md font-medium text-gray-900 mb-3">
                MCQ Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label
                    htmlFor="author"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Author
                  </label>
                  <input
                    type="text"
                    id="author"
                    name="author"
                    value={formData.author}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Author name (optional)"
                  />
                </div>

                <div>
                  <label
                    htmlFor="session"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Session
                  </label>
                  <input
                    type="text"
                    id="session"
                    name="session"
                    value={formData.session}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label
                    htmlFor="subject"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Subject
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="unit"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Unit
                  </label>
                  <input
                    type="text"
                    id="unit"
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label
                    htmlFor="topic"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Topic
                  </label>
                  <input
                    type="text"
                    id="topic"
                    name="topic"
                    value={formData.topic}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="subTopic"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Sub-Topic
                  </label>
                  <input
                    type="text"
                    id="subTopic"
                    name="subTopic"
                    value={formData.subTopic}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label
                    htmlFor="difficulty"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Difficulty Level
                  </label>
                  <select
                    id="difficulty"
                    name="difficulty"
                    value={formData.difficulty}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                <div className="flex items-center mt-8">
                  <input
                    type="checkbox"
                    id="isPublic"
                    name="isPublic"
                    checked={formData.isPublic}
                    onChange={handleCheckboxChange}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="isPublic"
                    className="ml-2 block text-sm text-gray-700"
                  >
                    Make MCQs public
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Document Requirements:
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start">
                    <FiInfo className="mt-0.5 mr-2 text-gray-400" />
                    <span>
                      MCQs must follow the format: Q:) or Q) for questions, A:)
                      or A) for options
                    </span>
                  </li>
                  <li className="flex items-start">
                    <FiInfo className="mt-0.5 mr-2 text-gray-400" />
                    <span>
                      Correct answer should be marked with :Correct: followed by
                      the option letter (A, B, C, or D)
                    </span>
                  </li>
                  <li className="flex items-start">
                    <FiInfo className="mt-0.5 mr-2 text-gray-400" />
                    <span>
                      Explanations can be added with :Explanation: for general
                      explanation and :ExplanationA:, :ExplanationB:, etc. for
                      option-specific explanations
                    </span>
                  </li>
                  <li className="flex items-start">
                    <FiInfo className="mt-0.5 mr-2 text-gray-400" />
                    <span>
                      Images, formatting (bold, italic), and special notation
                      (superscript, subscript) will be preserved
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!file || loading}
                className={`px-4 py-2 shadow-sm text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
                  !file || loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-primary-600 hover:bg-primary-700"
                }`}
              >
                {loading ? "Uploading..." : "Upload and Process"}
              </button>
            </div>
          </>
        )}

        {renderImportStatus()}
      </form>
    </div>
  );
};

export default MCQDocumentUpload;
