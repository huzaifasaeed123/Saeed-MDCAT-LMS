// src/modules/users/pages/EditUserPage.jsx
//
// Admin edit-user page. Two-column layout on desktop:
//   • Left  — Profile form (identity, password, optional student fields)
//   • Right — Access panel (feature toggles + course access) — student only
// A delete-user action lives in the navbar action slot and in a danger-zone
// footer at the bottom of the page so admin can remove a misregistered or
// duplicate account without leaving this view.
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import {
  FiArrowLeft, FiTrash2, FiUser, FiMail, FiPhone, FiKey,
  FiShield, FiLoader, FiCalendar, FiUserPlus, FiUserCheck,
} from 'react-icons/fi';
import { getUserById, updateUser, deleteUser } from '../services/userService';
import FeatureAccessPanel from '../components/FeatureAccessPanel';
import StudentProfileFields from '../../../shared/components/StudentProfileFields';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';

const EditUserSchema = Yup.object().shape({
  fullName: Yup.string()
    .required('Full name is required')
    .max(50, 'Full name cannot be more than 50 characters'),
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  contactNumber: Yup.string()
    .required('Contact number is required')
    .matches(/^\+?[0-9]{10,14}$/, 'Invalid contact number format'),
  role: Yup.string()
    .required('Role is required')
    .oneOf(['student', 'teacher', 'admin'], 'Invalid role'),
  password: Yup.string()
    .min(6, 'If provided, password must be at least 6 characters')
    .nullable(),
});

const inputCls =
  'w-full pl-9 pr-3 py-2.5 border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]';

const labelCls = 'block text-sm font-medium text-[var(--text-strong)] mb-1.5';

const ROLE_BADGE_CLS = {
  admin:   'bg-secondary-100 text-secondary-800 dark:bg-secondary-950/40 dark:text-secondary-300',
  teacher: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  student: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
};

const EditUserPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        const response = await getUserById(id);
        if (response.success) {
          setUser(response.data);
        } else {
          setError('Failed to fetch user data');
          toast.error('Failed to fetch user data');
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch user');
        toast.error('Failed to fetch user');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [id]);

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      const payload = { ...values };
      if (payload.district === '__OTHER__') payload.district = '';
      const response = await updateUser(id, payload);
      if (response.success) {
        toast.success('User updated successfully');
        navigate('/admin/users');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteUser(id);
      toast.success('User deleted');
      navigate('/admin/users');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const subtitle = user ? `${user.fullName} · ${user.email}` : 'Loading user…';
  const headerAction = useMemo(() => (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        disabled={!user}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-300 dark:border-rose-900/50 text-sm font-medium text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-50"
        title="Delete user"
      >
        <FiTrash2 className="w-4 h-4" /> Delete
      </button>
      <button
        type="button"
        onClick={() => navigate('/admin/users')}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
      >
        <FiArrowLeft className="w-4 h-4" /> Back to users
      </button>
    </div>
  ), [navigate, user]);

  usePageHeader({
    title:    'Edit User',
    subtitle,
    action:   headerAction,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <FiLoader className="animate-spin w-8 h-8 text-[var(--text-faint)]" />
        <span className="ml-3 text-sm text-[var(--text-muted)]">Loading user…</span>
      </div>
    );
  }
  if (error)  return <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-xl p-4 text-sm">{error}</div>;
  if (!user)  return <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-xl p-4 text-sm">User not found</div>;

  const initialValues = {
    fullName: user.fullName || '',
    email: user.email || '',
    contactNumber: user.contactNumber || '',
    role: user.role || 'student',
    password: '',
    fatherName:     user.fatherName     || '',
    province:       user.province       || '',
    district:       user.district       || '',
    studentClass:   user.studentClass   || '',
    studentStatus:  user.studentStatus  || '',
    fscCollegeName: user.fscCollegeName || '',
    fscBoard:       user.fscBoard       || '',
  };

  return (
    <div className="space-y-5">
      {/* ── Mobile-only action row ── */}
      <div className="md:hidden flex gap-2">
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-rose-300 dark:border-rose-900/50 text-sm font-medium text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
        >
          <FiTrash2 className="w-4 h-4" /> Delete user
        </button>
        <button
          type="button"
          onClick={() => navigate('/admin/users')}
          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
        >
          <FiArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* ── Identity strip — quick at-a-glance summary at the top ─────────── */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-4 sm:p-5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
            {user.fullName?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-extrabold text-[var(--text-strong)] truncate">{user.fullName}</p>
            <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${ROLE_BADGE_CLS[user.role] || ROLE_BADGE_CLS.student}`}>
              {user.role}
            </span>
            {/* `createdByAdmin === false` is the only state that proves a
                self-signup. Missing field (legacy users) is reported as
                admin-created, matching the filter UI. */}
            {(() => {
              const isSelf = user.createdByAdmin === false;
              return (
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                  isSelf
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-secondary-50 text-secondary-700 dark:bg-secondary-950/40 dark:text-secondary-300'
                }`} title={isSelf ? 'Self-registered' : 'Created by admin'}>
                  {isSelf ? <FiUserPlus className="w-2.5 h-2.5" /> : <FiUserCheck className="w-2.5 h-2.5" />}
                  {isSelf ? 'Self-signup' : 'Admin-created'}
                </span>
              );
            })()}
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-[var(--bg-muted)] text-[var(--text-muted)]">
              <FiCalendar className="w-2.5 h-2.5" />
              Joined {new Date(user.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* ── Two-column main area on desktop ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Profile form (spans 2 of 3 columns on desktop) */}
        <div className="lg:col-span-2 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <FiUser className="w-4 h-4 text-primary-500" />
            <h3 className="text-base font-bold text-[var(--text-strong)]">Profile</h3>
          </div>

          <Formik
            initialValues={initialValues}
            validationSchema={EditUserSchema}
            onSubmit={handleSubmit}
            enableReinitialize
          >
            {({ isSubmitting }) => (
              <Form className="space-y-4">
                {/* Identity row — name + role on one line on wide screens */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="fullName" className={labelCls}>Full Name</label>
                    <div className="relative">
                      <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)]" />
                      <Field type="text" name="fullName" id="fullName" className={inputCls} />
                    </div>
                    <ErrorMessage name="fullName" component="div" className="text-xs text-rose-600 dark:text-rose-300 mt-1" />
                  </div>

                  <div>
                    <label htmlFor="role" className={labelCls}>Role</label>
                    <div className="relative">
                      <FiShield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)]" />
                      <Field as="select" name="role" id="role" className={inputCls}>
                        <option value="student">Student</option>
                        <option value="teacher">Teacher</option>
                        <option value="admin">Admin</option>
                      </Field>
                    </div>
                    <ErrorMessage name="role" component="div" className="text-xs text-rose-600 dark:text-rose-300 mt-1" />
                  </div>
                </div>

                {/* Contact info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className={labelCls}>Email</label>
                    <div className="relative">
                      <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)]" />
                      <Field type="email" name="email" id="email" className={inputCls} />
                    </div>
                    <ErrorMessage name="email" component="div" className="text-xs text-rose-600 dark:text-rose-300 mt-1" />
                  </div>

                  <div>
                    <label htmlFor="contactNumber" className={labelCls}>Contact Number</label>
                    <div className="relative">
                      <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)]" />
                      <Field type="text" name="contactNumber" id="contactNumber" className={inputCls} />
                    </div>
                    <ErrorMessage name="contactNumber" component="div" className="text-xs text-rose-600 dark:text-rose-300 mt-1" />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className={labelCls}>
                    Password <span className="text-[var(--text-faint)] font-normal">(leave empty to keep current)</span>
                  </label>
                  <div className="relative">
                    <FiKey className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)]" />
                    <Field type="password" name="password" id="password" className={inputCls} placeholder="Set a new password…" />
                  </div>
                  <ErrorMessage name="password" component="div" className="text-xs text-rose-600 dark:text-rose-300 mt-1" />
                </div>

                {/* Student profile fields — optional. Hidden field group renders
                    its own divider so it doesn't visually merge with the
                    identity inputs above. */}
                <div className="pt-2 border-t border-[var(--border-faint)]">
                  <p className="text-xs font-mono uppercase tracking-wider text-[var(--text-faint)] mb-3">
                    Optional student profile
                  </p>
                  <StudentProfileFields variant="simple" />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-brand text-sm disabled:opacity-50"
                  >
                    {isSubmitting ? 'Updating…' : 'Save Profile'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/users')}
                    disabled={isSubmitting}
                    className="px-4 py-2 border border-[var(--border)] hover:bg-[var(--bg-muted)] text-[var(--text)] text-sm font-medium rounded-xl disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </Form>
            )}
          </Formik>
        </div>

        {/* Access panel — student only. Staff bypass the locks server-side. */}
        <div className="lg:col-span-1">
          {user.role === 'student' ? (
            <FeatureAccessPanel
              userId={id}
              initialFeatureAccess={user.featureAccess}
              initialCoursesGrantAll={user.coursesGrantAll}
              initialCourseAccess={user.courseAccess}
            />
          ) : (
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5">
              <div className="flex items-center gap-2 mb-2">
                <FiShield className="w-4 h-4 text-secondary-500" />
                <h3 className="text-base font-bold text-[var(--text-strong)]">Access</h3>
              </div>
              <p className="text-sm text-[var(--text-muted)]">
                Staff accounts ({user.role}) bypass all feature locks automatically — there's nothing to configure here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Danger zone ──────────────────────────────────────────────────── */}
      <div className="bg-rose-50/40 dark:bg-rose-950/20 rounded-2xl border border-rose-200 dark:border-rose-900/40 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <FiTrash2 className="w-4 h-4" /> Delete user
            </h3>
            <p className="text-sm text-rose-700/80 dark:text-rose-200/80 mt-1">
              Permanently removes this account, their attempts, saved questions, posts and replies.
              This cannot be undone.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-xl transition-colors flex-shrink-0"
          >
            Delete this user
          </button>
        </div>
      </div>

      {/* ── Delete confirm modal ─────────────────────────────────────────── */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center">
                <FiTrash2 className="w-5 h-5 text-rose-600 dark:text-rose-300" />
              </div>
              <div>
                <h2 className="font-bold text-[var(--text-strong)]">Delete user</h2>
                <p className="text-sm text-[var(--text-muted)]">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-[var(--text)] mb-4">
              Delete <strong>{user.fullName}</strong>? Their account and all related data will be removed.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-muted)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {deleting && <FiLoader className="w-4 h-4 animate-spin" />}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditUserPage;
