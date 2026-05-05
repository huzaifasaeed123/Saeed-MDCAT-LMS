import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FaEdit, FaTrash, FaEye, FaPlus
} from 'react-icons/fa';
import {
  FiSearch, FiFilter, FiChevronDown, FiChevronUp,
  FiCalendar, FiX, FiBook, FiLayers, FiChevronLeft, FiChevronRight
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';

const PAGE_SIZE = 30;

const statusColors = {
  published: 'bg-green-100 text-green-800',
  draft:     'bg-yellow-100 text-yellow-800',
  archived:  'bg-gray-100 text-gray-500',
};

const formatDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const TestListPage = () => {
  const [tests, setTests]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [pages, setPages]         = useState(1);
  const [loading, setLoading]     = useState(true);
  const [qbs, setQbs]             = useState([]);
  const [courses, setCourses]     = useState([]);
  const [showFilters, setShowFilters] = useState(true);

  // Filter options derived from all test metadata (loaded once on mount)
  const [allSubjects, setAllSubjects] = useState([]);
  const [allChapters, setAllChapters] = useState([]);
  const [allTopics, setAllTopics]     = useState([]);

  // Summary stats (from all tests, loaded with metadata)
  const [statsAll, setStatsAll] = useState({ total: 0, published: 0, draft: 0 });

  // Filter state
  const [search, setSearch]           = useState('');
  const [subjectFilter, setSubject]   = useState('');
  const [chapterFilter, setChapter]   = useState('');
  const [topicFilter, setTopic]       = useState('');
  const [qbFilter, setQb]             = useState('');
  const [courseFilter, setCourse]     = useState('');
  const [statusFilter, setStatus]     = useState('');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');
  const [page, setPage]               = useState(1);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef(null);
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  // Load filter options + QBs + Courses once on mount
  useEffect(() => {
    Promise.all([
      apiClient.get('/tests?metaOnly=1'),
      apiClient.get('/question-banks').catch(() => ({ data: { data: [] } })),
      apiClient.get('/courses').catch(() => ({ data: { data: [] } })),
    ]).then(([metaRes, qbRes, courseRes]) => {
      const metaTests = metaRes.data.data || [];
      const subj = new Set(), chap = new Set(), top = new Set();
      let published = 0, draft = 0;
      metaTests.forEach((t) => {
        (t.subjects || []).forEach((v) => v && subj.add(v));
        if (t.subject) subj.add(t.subject);
        (t.chapters || []).forEach((v) => v && chap.add(v));
        if (t.unit) chap.add(t.unit);
        (t.topics || []).forEach((v) => v && top.add(v));
        if (t.status === 'published') published++;
        else if (t.status === 'draft') draft++;
      });
      setAllSubjects([...subj].sort());
      setAllChapters([...chap].sort());
      setAllTopics([...top].sort());
      setStatsAll({ total: metaTests.length, published, draft });
      setQbs(qbRes.data.data || []);
      setCourses(courseRes.data.data || []);
    }).catch(() => toast.error('Failed to load filter options'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, subjectFilter, chapterFilter, topicFilter, qbFilter, courseFilter, dateFrom, dateTo]);

  // Fetch paginated tests on page / filter change
  useEffect(() => {
    const params = new URLSearchParams({ page, limit: PAGE_SIZE });
    if (debouncedSearch) params.set('search',          debouncedSearch);
    if (statusFilter)    params.set('status',           statusFilter);
    if (subjectFilter)   params.set('subject',          subjectFilter);
    if (chapterFilter)   params.set('chapter',          chapterFilter);
    if (topicFilter)     params.set('topic',            topicFilter);
    if (qbFilter)        params.set('questionBankId',   qbFilter);
    if (courseFilter)    params.set('courseId',         courseFilter);
    if (dateFrom)        params.set('dateFrom',         dateFrom);
    if (dateTo)          params.set('dateTo',           dateTo);

    setLoading(true);
    apiClient.get(`/tests?${params}`)
      .then((res) => {
        setTests(res.data.data || []);
        setTotal(res.data.total || 0);
        setPages(res.data.pages || 1);
      })
      .catch(() => toast.error('Failed to load tests'))
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, statusFilter, subjectFilter, chapterFilter, topicFilter, qbFilter, courseFilter, dateFrom, dateTo]);

  const refetchCurrent = () => {
    const params = new URLSearchParams({ page, limit: PAGE_SIZE });
    if (debouncedSearch) params.set('search',        debouncedSearch);
    if (statusFilter)    params.set('status',         statusFilter);
    setLoading(true);
    apiClient.get(`/tests?${params}`)
      .then((res) => {
        setTests(res.data.data || []);
        setTotal(res.data.total || 0);
        setPages(res.data.pages || 1);
      })
      .catch(() => toast.error('Failed to load tests'))
      .finally(() => setLoading(false));
  };

  const hasActiveFilter = search || statusFilter || subjectFilter || chapterFilter ||
    topicFilter || qbFilter || courseFilter || dateFrom || dateTo;

  const clearFilters = () => {
    setSearch(''); setSubject(''); setChapter(''); setTopic('');
    setQb(''); setCourse(''); setStatus(''); setDateFrom(''); setDateTo('');
  };

  const handleDelete = async (testId) => {
    if (!window.confirm('Delete this test and all its MCQs?')) return;
    try {
      await apiClient.delete(`/tests/${testId}`);
      refetchCurrent();
    } catch { toast.error('Failed to delete test'); }
  };

  const handlePublish = async (testId) => {
    try {
      await apiClient.put(`/tests/${testId}/publish`);
      refetchCurrent();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to publish');
    }
  };

  if (loading && tests.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Test Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{statsAll.total} total tests</p>
        </div>
        <Link
          to="/tests/create"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600"
        >
          <FaPlus /> Create Test
        </Link>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{statsAll.total}</p>
          <p className="text-xs text-gray-400 mt-1">Total Tests</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{statsAll.published}</p>
          <p className="text-xs text-gray-400 mt-1">Published</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-yellow-500">{statsAll.draft}</p>
          <p className="text-xs text-gray-400 mt-1">Drafts</p>
        </div>
      </div>

      {/* Filters panel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <FiFilter className="w-4 h-4" /> Filters
            {hasActiveFilter && (
              <span className="ml-1 px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-xs">active</span>
            )}
          </div>
          <button onClick={() => setShowFilters((v) => !v)} className="text-gray-400 hover:text-gray-600">
            {showFilters ? <FiChevronUp /> : <FiChevronDown />}
          </button>
        </div>

        {showFilters && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by title…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatus(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Subject</label>
                <select value={subjectFilter} onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="">All Subjects</option>
                  {allSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Chapter</label>
                <select value={chapterFilter} onChange={(e) => setChapter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="">All Chapters</option>
                  {allChapters.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Topic</label>
                <select value={topicFilter} onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="">All Topics</option>
                  {allTopics.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Question Bank</label>
                <select value={qbFilter} onChange={(e) => setQb(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="">All QBs</option>
                  {qbs.map((q) => <option key={q._id} value={q._id}>{q.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Course</label>
                <select value={courseFilter} onChange={(e) => setCourse(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="">All Courses</option>
                  {courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1"><FiCalendar className="w-3 h-3" /> From</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1"><FiCalendar className="w-3 h-3" /> To</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
            </div>

            {hasActiveFilter && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">Showing {total} of {statsAll.total} tests</p>
                <button onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-500 border border-red-200 hover:bg-red-50">
                  <FiX className="w-3 h-3" /> Clear filters
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Loading indicator for filter/page changes */}
      {loading && tests.length > 0 && (
        <div className="flex justify-center py-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" />
        </div>
      )}

      {/* Test table */}
      {!loading && tests.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No tests found</h3>
          <p className="text-sm text-gray-400 mb-6">
            {hasActiveFilter ? 'Try adjusting your filters.' : 'Create your first test to get started.'}
          </p>
          {!hasActiveFilter && (
            <Link to="/tests/create" className="px-5 py-2.5 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 text-sm">
              Create Test
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Subjects / Chapters</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">QB / Course</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Qs</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tests.map((test) => {
                const testSubjects = test.subjects?.length ? test.subjects : (test.subject ? [test.subject] : []);
                const testChapters = test.chapters?.length ? test.chapters : (test.unit ? [test.unit] : []);
                const testTopics   = test.topics?.length   ? test.topics   : (test.topic ? [test.topic] : []);
                const qbName     = test.questionBankId?.title || null;
                const courseName = test.courseId?.title || null;

                return (
                  <tr key={test._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-900 text-sm">{test.title}</div>
                      {test.description && (
                        <div className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{test.description}</div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {testSubjects.slice(0, 3).map((s) => (
                          <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">
                            <FiBook className="w-2.5 h-2.5" />{s}
                          </span>
                        ))}
                        {testChapters.slice(0, 2).map((c) => (
                          <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700">
                            <FiLayers className="w-2.5 h-2.5" />{c}
                          </span>
                        ))}
                        {testTopics.slice(0, 2).map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-teal-50 text-teal-700">{t}</span>
                        ))}
                        {(testSubjects.length + testChapters.length + testTopics.length > 7) && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">+more</span>
                        )}
                        {testSubjects.length === 0 && testChapters.length === 0 && (
                          <span className="text-xs text-gray-300 italic">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        {qbName && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700">QB: {qbName}</span>
                        )}
                        {courseName && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-50 text-orange-700">Course: {courseName}</span>
                        )}
                        {!qbName && !courseName && <span className="text-xs text-gray-300 italic">—</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[test.status] || 'bg-gray-100 text-gray-500'}`}>
                        {test.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600 font-medium">{test.totalQuestions}</td>
                    <td className="px-5 py-4 text-xs text-gray-400">{formatDate(test.createdAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-3">
                        <Link to={`/tests/${test._id}`} className="text-blue-500 hover:text-blue-700" title="View"><FaEye /></Link>
                        <Link to={`/tests/${test._id}/edit`} className="text-yellow-500 hover:text-yellow-700" title="Edit"><FaEdit /></Link>
                        <button onClick={() => handleDelete(test._id)} className="text-red-500 hover:text-red-700" title="Delete"><FaTrash /></button>
                        {test.status !== 'published' && (
                          <button onClick={() => handlePublish(test._id)}
                            className="px-2 py-1 rounded-lg text-xs font-bold bg-green-100 text-green-700 hover:bg-green-200">
                            Publish
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-400">Page {page} of {pages} ({total} results)</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
              <FiChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, pages - 4));
              const p = start + i;
              return p <= pages ? (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium ${p === page ? 'bg-orange-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {p}
                </button>
              ) : null;
            })}
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
              className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestListPage;
