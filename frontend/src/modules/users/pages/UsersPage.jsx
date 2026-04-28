import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiEdit, FiTrash2, FiPlusCircle, FiUpload, FiDownload,
  FiSearch, FiFilter, FiX, FiUsers, FiChevronLeft, FiChevronRight,
  FiAlertCircle, FiCheckCircle,
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';

const PAGE_SIZE = 20;

const ROLE_COLORS = {
  admin:   'bg-purple-100 text-purple-800',
  teacher: 'bg-green-100 text-green-800',
  student: 'bg-blue-100 text-blue-800',
};

// ── Excel template download (client-side, no extra library needed) ─────────────
const downloadTemplate = () => {
  const header = ['Name', 'Email', 'Password', 'ContactNumber', 'Role'];
  const sample = ['Ahmed Khan', 'ahmed@example.com', 'password123', '03001234567', 'student'];
  const csv    = [header, sample].map((r) => r.join(',')).join('\n');
  const blob   = new Blob([csv], { type: 'text/csv' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href = url; a.download = 'bulk_users_template.csv'; a.click();
  URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────────────────────────────────────

const UsersPage = () => {
  const [users,      setUsers]      = useState([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [role,   setRole]   = useState('');
  const searchTimer = useRef(null);

  // Bulk upload
  const [uploadOpen,    setUploadOpen]    = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [uploadResult,  setUploadResult]  = useState(null);
  const fileInputRef = useRef(null);

  // Delete confirm
  const [deleteId, setDeleteId] = useState(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async (p = page, s = search, r = role) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: PAGE_SIZE });
      if (s) params.set('search', s);
      if (r) params.set('role', r);
      const res = await apiClient.get(`/users?${params}`);
      if (res.data.success) {
        setUsers(res.data.data);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      }
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(1, search, role); }, [role]);

  // Debounced search
  const handleSearchChange = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchUsers(1, val, role);
    }, 350);
  };

  const handlePageChange = (p) => {
    setPage(p);
    fetchUsers(p, search, role);
  };

  const handleRoleChange = (r) => {
    setRole(r);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch(''); setRole(''); setPage(1);
    fetchUsers(1, '', '');
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    try {
      await apiClient.delete(`/users/${deleteId}`);
      toast.success('User deleted');
      setDeleteId(null);
      fetchUsers(page, search, role);
    } catch {
      toast.error('Failed to delete user');
    }
  };

  // ── Bulk Upload ────────────────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiClient.post('/users/bulk-upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadResult(res.data);
      if (res.data.created > 0) {
        toast.success(`${res.data.created} user(s) created`);
        fetchUsers(1, search, role);
        setPage(1);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total user{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setUploadOpen(true); setUploadResult(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <FiUpload className="w-4 h-4" /> Bulk Upload
          </button>
          <Link
            to="/admin/users/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <FiPlusCircle className="w-4 h-4" /> Add User
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, phone…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {search && (
            <button onClick={() => handleSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <FiX className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Role filter */}
        <div className="flex items-center gap-2">
          <FiFilter className="w-4 h-4 text-gray-400" />
          <select
            value={role}
            onChange={(e) => handleRoleChange(e.target.value)}
            className="border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">All Roles</option>
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {/* Clear */}
        {(search || role) && (
          <button onClick={clearFilters} className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1">
            <FiX className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <FiUsers className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">{search || role ? 'No users match your filters' : 'No users yet'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Name', 'Email', 'Contact', 'Role', 'Joined', 'Actions'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap font-medium text-gray-900">{user.fullName}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-gray-500 text-sm">{user.email}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-gray-500 text-sm">{user.contactNumber || '—'}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[user.role]}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-gray-500 text-sm">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <div className="flex gap-1">
                        <Link
                          to={`/admin/users/${user._id}`}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit"
                        >
                          <FiEdit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => setDeleteId(user._id)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FiChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '…' ? (
                    <span key={`e${i}`} className="px-2 text-gray-400 text-sm">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => handlePageChange(p)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        p === page
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}

              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FiChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Bulk Upload Modal ───────────────────────────────────────────────── */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">Bulk User Upload</h2>
              <button onClick={() => setUploadOpen(false)} className="text-gray-400 hover:text-gray-600">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-sm text-blue-800">
              <p className="font-semibold mb-1">Excel / CSV columns:</p>
              <p><code className="bg-blue-100 px-1 rounded">Name</code> · <code className="bg-blue-100 px-1 rounded">Email</code> · <code className="bg-blue-100 px-1 rounded">Password</code> (required) · <code className="bg-blue-100 px-1 rounded">ContactNumber</code> · <code className="bg-blue-100 px-1 rounded">Role</code> (student/teacher/admin)</p>
              <p className="mt-1 text-blue-600 text-xs">ContactNumber and Role are optional. Role defaults to <strong>student</strong>.</p>
            </div>

            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 text-sm text-green-700 hover:text-green-900 mb-4 font-medium"
            >
              <FiDownload className="w-4 h-4" /> Download CSV template
            </button>

            {/* File pick */}
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <FiUpload className="w-7 h-7 text-gray-400 mb-2" />
              <p className="text-sm text-gray-500">Click to select .xlsx or .xls file</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>

            {uploading && (
              <div className="flex items-center gap-2 mt-3 text-sm text-blue-600">
                <div className="animate-spin h-4 w-4 rounded-full border-b-2 border-blue-600" />
                Uploading and processing…
              </div>
            )}

            {/* Results */}
            {uploadResult && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                  <FiCheckCircle className="w-4 h-4" />
                  {uploadResult.created} user(s) created · {uploadResult.skipped} skipped
                </div>
                {uploadResult.errors?.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 space-y-1">
                    {uploadResult.errors.map((e, i) => (
                      <div key={i} className="flex gap-2">
                        <FiAlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>Row {e.row} ({e.email}): {e.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setUploadOpen(false)}
              className="mt-5 w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <FiTrash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-800">Delete User</h2>
                <p className="text-sm text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
