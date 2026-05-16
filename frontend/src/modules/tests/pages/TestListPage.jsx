// src/modules/tests/pages/TestListPage.jsx
//
// Admin Test Management — themed list page that mirrors CourseListPage:
//   • Title/subtitle pushed into the top navbar via usePageHeader().
//   • Status filter chips (All / Published / Draft / Archived) on the left,
//     sort + view toggle on the right. Optional category-style chips not
//     used here — the table view keeps the dense filter form for power users.
//   • Grid view: hero card per test with subject/chapter chips.
//   • List view: compact zebra-striped table with all the same actions.
//
// State, effects, API calls, and validation are untouched — only the JSX,
// Tailwind classes, and the page header wiring changed.
import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiSearch, FiFilter, FiChevronDown, FiChevronUp,
  FiCalendar, FiX, FiBook, FiLayers, FiChevronLeft, FiChevronRight,
  FiPlus, FiEdit2, FiTrash2, FiEye, FiGrid, FiList, FiFileText,
  FiCheckCircle, FiClock, FiArchive, FiArrowRight,
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';

const PAGE_SIZE = 30;

const STATUS_META = {
  published: {
    label: 'Published',
    chipCls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    Icon: FiCheckCircle,
  },
  draft: {
    label: 'Draft',
    chipCls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    Icon: FiClock,
  },
  archived: {
    label: 'Archived',
    chipCls: 'bg-[var(--bg-muted)] text-[var(--text-muted)]',
    Icon: FiArchive,
  },
};

const formatDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const TestListPage = () => {
  const navigate = useNavigate();

  const [tests, setTests]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [pages, setPages]         = useState(1);
  const [loading, setLoading]     = useState(true);
  const [qbs, setQbs]             = useState([]);
  const [courses, setCourses]     = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView]           = useState('list'); // 'grid' | 'list'

  // Filter options derived from all test metadata (loaded once on mount)
  const [allSubjects, setAllSubjects] = useState([]);
  const [allChapters, setAllChapters] = useState([]);
  const [allTopics, setAllTopics]     = useState([]);

  // Summary stats (from all tests, loaded with metadata)
  const [statsAll, setStatsAll] = useState({ total: 0, published: 0, draft: 0, archived: 0 });

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
      let published = 0, draft = 0, archived = 0;
      metaTests.forEach((t) => {
        (t.subjects || []).forEach((v) => v && subj.add(v));
        if (t.subject) subj.add(t.subject);
        (t.chapters || []).forEach((v) => v && chap.add(v));
        if (t.unit) chap.add(t.unit);
        (t.topics || []).forEach((v) => v && top.add(v));
        if (t.status === 'published') published++;
        else if (t.status === 'draft') draft++;
        else if (t.status === 'archived') archived++;
      });
      setAllSubjects([...subj].sort());
      setAllChapters([...chap].sort());
      setAllTopics([...top].sort());
      setStatsAll({ total: metaTests.length, published, draft, archived });
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

  // ── Push title/subtitle to top navbar ───────────────────────────────────
  const subtitle = statsAll.total === 0
    ? 'No tests yet'
    : `${statsAll.total} total · ${statsAll.published} published · ${statsAll.draft} draft`;

  const headerAction = useMemo(() => (
    <Link to="/tests/create" className="btn-brand text-sm whitespace-nowrap">
      <FiPlus className="w-4 h-4" /> Create test
    </Link>
  ), []);

  usePageHeader({
    title:    'Test Management',
    subtitle,
    action:   headerAction,
  });

  // Shared input class for filter form
  const inputCls =
    'w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm ' +
    'text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-primary-400 transition';

  if (loading && tests.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div>
      {/* Mobile-only action button — the navbar action slot is desktop-only */}
      <div className="md:hidden mb-4">
        <Link to="/tests/create" className="btn-brand text-sm w-full justify-center">
          <FiPlus className="w-4 h-4" /> Create test
        </Link>
      </div>

      {/* ── Status filter chips (left) + Sort/View (right) ── */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { key: '',          label: 'All',       count: statsAll.total },
            { key: 'published', label: 'Published', count: statsAll.published },
            { key: 'draft',     label: 'Draft',     count: statsAll.draft },
            { key: 'archived',  label: 'Archived',  count: statsAll.archived },
          ].map((opt) => {
            const active = statusFilter === opt.key;
            return (
              <button
                key={opt.key || 'all'}
                onClick={() => setStatus(opt.key)}
                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${
                  active
                    ? (opt.key === '' ? 'bg-[var(--text-strong)] text-[var(--bg-surface)]' : 'bg-secondary-600 text-white')
                    : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                }`}
              >
                {opt.label}
                <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
                  active ? 'bg-white/20 text-white' : 'bg-[var(--bg-muted)] text-[var(--text-faint)]'
                }`}>
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors flex-shrink-0 ${
              showFilters || hasActiveFilter
                ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300'
                : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
            }`}
            aria-expanded={showFilters}
          >
            <FiFilter className="w-3.5 h-3.5" />
            <span>Filters</span>
            {hasActiveFilter && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary-500" aria-hidden />
            )}
            {showFilters ? <FiChevronUp className="w-3 h-3" /> : <FiChevronDown className="w-3 h-3" />}
          </button>

          <div className="flex bg-[var(--bg-muted)] rounded-xl border border-[var(--border)] p-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => setView('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                view === 'grid'
                  ? 'bg-[var(--bg-surface)] text-primary-600 dark:text-primary-300 shadow-sm'
                  : 'text-[var(--text-faint)] hover:text-[var(--text)]'
              }`}
              aria-label="Grid view"
            >
              <FiGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={`p-1.5 rounded-lg transition-colors ${
                view === 'list'
                  ? 'bg-[var(--bg-surface)] text-primary-600 dark:text-primary-300 shadow-sm'
                  : 'text-[var(--text-faint)] hover:text-[var(--text)]'
              }`}
              aria-label="List view"
            >
              <FiList className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Search bar ── */}
      <div className="relative mb-3">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] w-4 h-4 pointer-events-none" />
        <input
          type="text"
          placeholder="Search tests by title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-9 py-2.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-faint)] hover:text-[var(--text)]"
            aria-label="Clear search"
          >
            <FiX className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Expanded filter form ── */}
      {showFilters && (
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-4 mb-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Subject</label>
              <select value={subjectFilter} onChange={(e) => setSubject(e.target.value)} className={inputCls}>
                <option value="">All Subjects</option>
                {allSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Chapter</label>
              <select value={chapterFilter} onChange={(e) => setChapter(e.target.value)} className={inputCls}>
                <option value="">All Chapters</option>
                {allChapters.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Topic</label>
              <select value={topicFilter} onChange={(e) => setTopic(e.target.value)} className={inputCls}>
                <option value="">All Topics</option>
                {allTopics.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Question Bank</label>
              <select value={qbFilter} onChange={(e) => setQb(e.target.value)} className={inputCls}>
                <option value="">All QBs</option>
                {qbs.map((q) => <option key={q._id} value={q._id}>{q.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Course</label>
              <select value={courseFilter} onChange={(e) => setCourse(e.target.value)} className={inputCls}>
                <option value="">All Courses</option>
                {courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1 flex items-center gap-1">
                <FiCalendar className="w-3 h-3" /> From
              </label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1 flex items-center gap-1">
                <FiCalendar className="w-3 h-3" /> To
              </label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
            </div>
          </div>

          {hasActiveFilter && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--text-faint)]">Showing {total} of {statsAll.total} tests</p>
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              >
                <FiX className="w-3 h-3" /> Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Loading indicator for filter/page changes */}
      {loading && tests.length > 0 && (
        <div className="flex justify-center py-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
        </div>
      )}

      {/* ── Empty state / Grid / List ── */}
      {!loading && tests.length === 0 ? (
        <div className="text-center py-16 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)]">
          <FiFileText className="w-12 h-12 text-[var(--text-faint)] mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-1">No tests found</h3>
          <p className="text-xs text-[var(--text-faint)] mb-4">
            {hasActiveFilter ? 'Try adjusting your filters.' : 'Create your first test to get started.'}
          </p>
          {hasActiveFilter ? (
            <button
              onClick={clearFilters}
              className="text-xs text-primary-600 dark:text-primary-300 hover:underline"
            >
              Clear filters
            </button>
          ) : (
            <Link to="/tests/create" className="btn-brand text-sm">
              <FiPlus className="w-4 h-4" /> Create test
            </Link>
          )}
        </div>
      ) : view === 'grid' ? (
        // ── Grid view ──
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {tests.map((test) => {
            const meta = STATUS_META[test.status] || STATUS_META.draft;
            const StatusIcon = meta.Icon;
            const testSubjects = test.subjects?.length ? test.subjects : (test.subject ? [test.subject] : []);
            const testChapters = test.chapters?.length ? test.chapters : (test.unit ? [test.unit] : []);
            const qbName     = test.questionBankId?.title || null;
            const courseName = test.courseId?.title || null;

            return (
              <div
                key={test._id}
                onClick={() => navigate(`/tests/${test._id}`)}
                className="group bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden flex flex-col cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary-300 dark:hover:border-primary-700"
              >
                <div className="p-4 sm:p-5 flex-1 flex flex-col">
                  {/* Status pill */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${meta.chipCls}`}>
                      <StatusIcon className="w-3 h-3" />
                      {meta.label}
                    </span>
                    <span className="text-[11px] text-[var(--text-faint)]">
                      {test.totalQuestions} Qs
                    </span>
                  </div>

                  <h3 className="font-display text-base sm:text-lg font-extrabold text-[var(--text-strong)] tracking-[-0.01em] line-clamp-2 leading-snug">
                    {test.title}
                  </h3>

                  {test.description && (
                    <p className="text-xs text-[var(--text-muted)] mt-2 line-clamp-2 leading-relaxed">
                      {test.description}
                    </p>
                  )}

                  {/* Subjects / chapters */}
                  {(testSubjects.length > 0 || testChapters.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {testSubjects.slice(0, 3).map((s) => (
                        <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                          <FiBook className="w-2.5 h-2.5" />{s}
                        </span>
                      ))}
                      {testChapters.slice(0, 2).map((c) => (
                        <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-secondary-50 text-secondary-700 dark:bg-secondary-950/40 dark:text-secondary-300">
                          <FiLayers className="w-2.5 h-2.5" />{c}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* QB / Course meta */}
                  {(qbName || courseName) && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {qbName && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-[var(--bg-muted)] text-[var(--text-muted)]">
                          QB: {qbName}
                        </span>
                      )}
                      {courseName && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                          Course: {courseName}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div
                    className="flex items-center justify-between gap-2 mt-auto pt-4 border-t border-[var(--border-faint)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[11px] text-[var(--text-faint)]">
                      {formatDate(test.createdAt)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Link
                        to={`/tests/${test._id}`}
                        className="p-1.5 text-[var(--text-faint)] hover:text-primary-600 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/40 rounded-lg transition-colors"
                        title="View"
                      >
                        <FiEye className="w-3.5 h-3.5" />
                      </Link>
                      <Link
                        to={`/tests/${test._id}/edit`}
                        className="p-1.5 text-primary-600 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/40 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <FiEdit2 className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        onClick={() => handleDelete(test._id)}
                        className="p-1.5 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                      {test.status !== 'published' && (
                        <button
                          onClick={() => handlePublish(test._id)}
                          className="ml-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 rounded-full px-2.5 py-1 transition-colors"
                        >
                          Publish
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // ── List view (table) ──
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--bg-muted)]">
                <tr>
                  <th className="px-5 py-3 text-left text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)]">Title</th>
                  <th className="px-5 py-3 text-left text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)]">Subjects / Chapters</th>
                  <th className="px-5 py-3 text-left text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)]">QB / Course</th>
                  <th className="px-5 py-3 text-left text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)]">Status</th>
                  <th className="px-5 py-3 text-left text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)]">Qs</th>
                  <th className="px-5 py-3 text-left text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)]">Created</th>
                  <th className="px-5 py-3 text-right text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((test) => {
                  const meta = STATUS_META[test.status] || STATUS_META.draft;
                  const StatusIcon = meta.Icon;
                  const testSubjects = test.subjects?.length ? test.subjects : (test.subject ? [test.subject] : []);
                  const testChapters = test.chapters?.length ? test.chapters : (test.unit ? [test.unit] : []);
                  const testTopics   = test.topics?.length   ? test.topics   : (test.topic ? [test.topic] : []);
                  const qbName     = test.questionBankId?.title || null;
                  const courseName = test.courseId?.title || null;

                  return (
                    <tr key={test._id} className="odd:bg-[var(--bg-surface)] even:bg-[var(--bg-muted)] hover:bg-primary-50/40 dark:hover:bg-primary-950/20 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-medium text-[var(--text-strong)] text-sm">{test.title}</div>
                        {test.description && (
                          <div className="text-xs text-[var(--text-faint)] mt-0.5 truncate max-w-xs">{test.description}</div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {testSubjects.slice(0, 3).map((s) => (
                            <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                              <FiBook className="w-2.5 h-2.5" />{s}
                            </span>
                          ))}
                          {testChapters.slice(0, 2).map((c) => (
                            <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-secondary-50 text-secondary-700 dark:bg-secondary-950/40 dark:text-secondary-300">
                              <FiLayers className="w-2.5 h-2.5" />{c}
                            </span>
                          ))}
                          {testTopics.slice(0, 2).map((t) => (
                            <span key={t} className="px-2 py-0.5 rounded-full text-[11px] bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">{t}</span>
                          ))}
                          {(testSubjects.length + testChapters.length + testTopics.length > 7) && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] bg-[var(--bg-muted)] text-[var(--text-muted)]">+more</span>
                          )}
                          {testSubjects.length === 0 && testChapters.length === 0 && (
                            <span className="text-xs text-[var(--text-faint)] italic">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          {qbName && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">QB: {qbName}</span>
                          )}
                          {courseName && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">Course: {courseName}</span>
                          )}
                          {!qbName && !courseName && <span className="text-xs text-[var(--text-faint)] italic">—</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${meta.chipCls}`}>
                          <StatusIcon className="w-3 h-3" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-[var(--text)] font-medium">{test.totalQuestions}</td>
                      <td className="px-5 py-4 text-xs text-[var(--text-faint)]">{formatDate(test.createdAt)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/tests/${test._id}`}
                            className="p-1.5 text-[var(--text-faint)] hover:text-primary-600 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/40 rounded-lg transition-colors"
                            title="View"
                          >
                            <FiEye className="w-4 h-4" />
                          </Link>
                          <Link
                            to={`/tests/${test._id}/edit`}
                            className="p-1.5 text-primary-600 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/40 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <FiEdit2 className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(test._id)}
                            className="p-1.5 text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                          {test.status !== 'published' && (
                            <button
                              onClick={() => handlePublish(test._id)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 rounded-full px-2.5 py-1 transition-colors"
                            >
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
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-[var(--text-faint)]">Page {page} of {pages} ({total} results)</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <FiChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, pages - 4));
              const p = start + i;
              return p <= pages ? (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
                    p === page
                      ? 'bg-primary-500 text-white'
                      : 'border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                  }`}
                >
                  {p}
                </button>
              ) : null;
            })}
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestListPage;
