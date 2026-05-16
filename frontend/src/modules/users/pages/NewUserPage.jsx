// src/modules/users/pages/NewUserPage.jsx
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import { FiArrowLeft } from 'react-icons/fi';
import { createUser } from '../services/userService';
import StudentProfileFields from '../../../shared/components/StudentProfileFields';
import { EMPTY_STUDENT_PROFILE } from '../../../shared/constants/studentProfile';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';

// Validation schema for creating new users
const NewUserSchema = Yup.object().shape({
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
    .required('Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

// Shared input class — matches the rest of the admin/teacher forms.
const inputCls =
  'w-full px-3 py-2 border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]';

const NewUserPage = () => {
  const navigate = useNavigate();

  // Push title + back action up into the navbar.
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
    title:    'Create New User',
    subtitle: 'Add a student, teacher or admin to the platform',
    action:   headerAction,
  });

  // Handle form submission
  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      const payload = { ...values };
      if (payload.district === '__OTHER__') payload.district = '';
      const response = await createUser(payload);

      if (response.success) {
        toast.success('User created successfully');
        navigate('/admin/users');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  // Initial form values — admin can fill optional student fields too.
  const initialValues = {
    fullName: '',
    email: '',
    contactNumber: '',
    role: 'student',
    password: '',
    ...EMPTY_STUDENT_PROFILE,
  };

  return (
    <div className="space-y-5">
      <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-5">
        <h3 className="text-base font-bold text-[var(--text-strong)] mb-4">Profile</h3>

        <Formik
          initialValues={initialValues}
          validationSchema={NewUserSchema}
          onSubmit={handleSubmit}
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
                <label htmlFor="password" className="block text-sm font-medium text-[var(--text)] mb-1">Password</label>
                <Field type="password" name="password" id="password" className={inputCls} />
                <ErrorMessage name="password" component="div" className="text-xs text-rose-600 dark:text-rose-300 mt-1" />
              </div>

              {/* Optional student profile fields — admin can fill on behalf of student. */}
              <div className="space-y-4">
                <StudentProfileFields variant="simple" />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-brand text-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating…' : 'Create User'}
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
    </div>
  );
};

export default NewUserPage;
