// Place this file in: components/Tests/TestList.js

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../utils/apiClient';
import { FaEdit, FaTrash, FaEye, FaPlus } from 'react-icons/fa';

const TestList = () => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    session: '',
    subject: '',
    unit: '',
    topic: ''
  });

  useEffect(() => {
    fetchTests();
  }, [filters]);

  const fetchTests = async () => {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const response = await apiClient.get(`/tests?${queryParams}`);
      setTests(response.data.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching tests:', error);
      setLoading(false);
    }
  };

  const handleDelete = async (testId) => {
    if (window.confirm('Are you sure you want to delete this test?')) {
      try {
        await apiClient.delete(`/tests/${testId}`);
        fetchTests();
      } catch (error) {
        console.error('Error deleting test:', error);
      }
    }
  };

  const handlePublish = async (testId) => {
    try {
      await apiClient.put(`/tests/${testId}/publish`);
      fetchTests();
    } catch (error) {
      console.error('Error publishing test:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Test Management</h1>
        <Link
          to="/tests/create"
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center"
        >
          <FaPlus className="mr-2" /> Create Test
        </Link>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <input
          type="text"
          placeholder="Session"
          className="border rounded-lg px-4 py-2"
          value={filters.session}
          onChange={(e) => setFilters({ ...filters, session: e.target.value })}
        />
        <input
          type="text"
          placeholder="Subject"
          className="border rounded-lg px-4 py-2"
          value={filters.subject}
          onChange={(e) => setFilters({ ...filters, subject: e.target.value })}
        />
        <input
          type="text"
          placeholder="Unit"
          className="border rounded-lg px-4 py-2"
          value={filters.unit}
          onChange={(e) => setFilters({ ...filters, unit: e.target.value })}
        />
        <input
          type="text"
          placeholder="Topic"
          className="border rounded-lg px-4 py-2"
          value={filters.topic}
          onChange={(e) => setFilters({ ...filters, topic: e.target.value })}
        />
      </div>

      {/* Test Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Subject
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Unit/Topic
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Questions
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tests.map((test) => (
              <tr key={test._id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{test.title}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{test.subject}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {test.unit} - {test.topic}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    test.status === 'published' 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {test.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {test.totalQuestions}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link
                    to={`/tests/${test._id}`}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    <FaEye className="inline" />
                  </Link>
                  <Link
                    to={`/tests/${test._id}/edit`}
                    className="text-yellow-600 hover:text-yellow-900 mr-3"
                  >
                    <FaEdit className="inline" />
                  </Link>
                  <button
                    onClick={() => handleDelete(test._id)}
                    className="text-red-600 hover:text-red-900 mr-3"
                  >
                    <FaTrash className="inline" />
                  </button>
                  {test.status !== 'published' && (
                    <button
                      onClick={() => handlePublish(test._id)}
                      className="text-green-600 hover:text-green-900"
                    >
                      Publish
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TestList;