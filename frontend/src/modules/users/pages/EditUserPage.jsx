// src/modules/users/pages/EditUserPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import { FiArrowLeft } from 'react-icons/fi';
import { getUserById, updateUser } from '../services/userService';
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

// Shared input class — matches the rest of the admin/teacher forms.
const inputCls =
  'w-full px-3 py-2 border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]';

const EditUserPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  // Push title/subtitle + back action up into the navbar. Memoised so
  // PageHeaderContext doesn't see a fresh JSX object every render (would
  // cause its effect to re-fire → setHeader → infinite re-render loop).
  const subtitle = user ? `${user.fullName} · ${user.email}` : 'Loading user…';
  const headerAction = useMemo(() => (
    <button
      type="button"
      onClick={() => navigate('/admin/users')}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
    >
      <FiArrowLeft className="w-4 h-4" /> Back to users
    </button>
  ), [navigate]);

  usePageHeader({
    title:    'Edit User',
    subtitle,
    action:   headerAction,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
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
    // Optional student profile fields — fall back to empty strings so the
    // form is always controlled (Formik dislikes undefined values).
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
      {/* ── Profile form ──────────────────────────────────────────────────── */}
      <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-5">
        <h3 className="text-base font-bold text-[var(--text-strong)] mb-4">Profile</h3>

        <Formik
          initialValues={initialValues}
          validationSchema={EditUserSchema}
          onSubmit={handleSubmit}
          enableReinitialize
        >
          {({ isSubmitting }) => (
            <Form className="space-y-4">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-[var(--text)] mb-1">Full Name</label>
                <Field type="text" name="fullName" id="fullName" className={inputCls} />
                <ErrorMessage name="fullName" component="div" className="text-xs text-rose-600 dark:text-rose-300 mt-1" />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[var(--text)] mb-1">Email</label>
                <Field type="email" name="email" id="email" className={inputCls} />
                <ErrorMessage name="email" component="div" className="text-xs text-rose-600 dark:text-rose-300 mt-1" />
              </div>

              <div>
                <label htmlFor="contactNumber" className="block text-sm font-medium text-[var(--text)] mb-1">Contact Number</label>
                <Field type="text" name="contactNumber" id="contactNumber" className={inputCls} />
                <ErrorMessage name="contactNumber" component="div" className="text-xs text-rose-600 dark:text-rose-300 mt-1" />
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-[var(--text)] mb-1">Role</label>
                <Field as="select" name="role" id="role" className={inputCls}>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </Field>
                <ErrorMessage name="role" component="div" className="text-xs text-rose-600 dark:text-rose-300 mt-1" />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-[var(--text)] mb-1">
                  Password <span className="text-[var(--text-faint)] font-normal">(leave empty to keep current)</span>
                </label>
                <Field type="password" name="password" id="password" className={inputCls} />
                <ErrorMessage name="password" component="div" className="text-xs text-rose-600 dark:text-rose-300 mt-1" />
              </div>

              {/* Optional student profile fields — empty values clear stored data. */}
              <StudentProfileFields variant="simple" />

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
                  className="px-4 py-2 border border-[var(--border)] hover:bg-[var(--bg-muted)] text-[var(--text)] text-sm font-medium rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </Form>
          )}
        </Formik>
      </div>

      {/* ── Access panel — student only ──────────────────────────────────── */}
      {/*    Staff bypass the locks server-side, so showing toggles for
            admin/teacher rows would be misleading. */}
      {user.role === 'student' && (
        <FeatureAccessPanel
          userId={id}
          initialFeatureAccess={user.featureAccess}
          initialCoursesGrantAll={user.coursesGrantAll}
          initialCourseAccess={user.courseAccess}
        />
      )}
    </div>
  );
};

export default EditUserPage;
