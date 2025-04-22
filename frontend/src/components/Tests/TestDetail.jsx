// Place this file in: components/Tests/TestDetail.js

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../../utils/apiClient';
import { FaEdit, FaTrash, FaPlus } from 'react-icons/fa';

const TestDetail = () => {
  const { id } = useParams();
  const [test, setTest] = useState(null);
  const [mcqs, setMcqs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTestDetails();
    fetchMCQs();
  }, [id]);

  const fetchTestDetails = async () => {
    try {
      const response = await apiClient.get(`/tests/${id}`);
      setTest(response.data.data);
    } catch (error) {
      console.error('Error fetching test details:', error);
    }
  };

  const fetchMCQs = async () => {
    try {
      const response = await apiClient.get(`/mcqs/test/${id}`);
      setMcqs(response.data.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching MCQs:', error);
      setLoading(false);
    }
  };

  const handleDeleteMCQ = async (mcqId) => {
    if (window.confirm('Are you sure you want to delete this MCQ?')) {
      try {
        await apiClient.delete(`/mcqs/${mcqId}`);
        fetchMCQs();
        fetchTestDetails(); // To update total questions count
      } catch (error) {
        console.error('Error deleting MCQ:', error);
      }
    }
  };

  if (loading || !test) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
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
          <Link
            to={`/tests/${id}/edit`}
            className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center"
          >
            <FaEdit className="mr-2" /> Edit Test
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <p className="text-sm text-gray-500">Session</p>
            <p className="font-semibold">{test.session}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Subject</p>
            <p className="font-semibold">{test.subject}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Unit/Topic</p>
            <p className="font-semibold">{test.unit} - {test.topic}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Duration</p>
            <p className="font-semibold">{test.duration} minutes</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Questions</p>
            <p className="font-semibold">{test.totalQuestions}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <span className={`px-2 py-1 rounded-full text-sm ${
              test.status === 'published' 
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {test.status}
            </span>
          </div>
        </div>
      </div>

      {/* MCQs Section */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Questions</h2>
          <Link
            to={`/tests/${id}/mcqs/create`}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center"
          >
            <FaPlus className="mr-2" /> Add Question
          </Link>
        </div>

        {mcqs.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No questions added yet. Click "Add Question" to create one.
          </p>
        ) : (
          <div className="space-y-6">
            {mcqs.map((mcq, index) => (
              <div key={mcq._id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold mb-2">
                      Question {index + 1}
                    </h3>
                    <div 
                      className="mb-4 prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: mcq.questionText }}
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Link
                      to={`/tests/${id}/mcqs/${mcq._id}/edit`}
                      className="text-yellow-600 hover:text-yellow-900"
                    >
                      <FaEdit />
                    </Link>
                    <button
                      onClick={() => handleDeleteMCQ(mcq._id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {mcq.options.map((option) => (
                    <div 
                      key={option._id}
                      className={`p-2 rounded ${
                        option.isCorrect 
                          ? 'bg-green-50 border border-green-200' 
                          : 'bg-gray-50'
                      }`}
                    >
                      <span className="font-medium">{option.optionLetter}.</span>{' '}
                      <span dangerouslySetInnerHTML={{ __html: option.optionText }} />
                    </div>
                  ))}
                </div>

                {mcq.explanationText && (
                  <div className="mt-4 p-3 bg-blue-50 rounded">
                    <p className="text-sm font-semibold text-blue-800">Explanation:</p>
                    <div dangerouslySetInnerHTML={{ __html: mcq.explanationText }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TestDetail;