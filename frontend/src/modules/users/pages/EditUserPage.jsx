// src/modules/users/pages/EditUserPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import { getUserById, updateUser } from '../services/userService';
import FeatureAccessPanel from '../components/FeatureAccessPanel';
import StudentProfileFields from '../../../shared/components/StudentProfileFields';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }
  if (error)  return <div className="error-message">{error}</div>;
  if (!user)  return <div className="error-message">User not found</div>;

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
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit User</h1>
        <p className="text-sm text-gray-500 mt-0.5">{user.fullName} · {user.email}</p>
      </div>

      {/* ── Profile form ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-base font-bold text-gray-800 mb-4">Profile</h3>

        <Formik
          initialValues={initialValues}
          validationSchema={EditUserSchema}
          onSubmit={handleSubmit}
          enableReinitialize
        >
          {({ isSubmitting }) => (
            <Form className="space-y-4">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <Field type="text" name="fullName" id="fullName" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <ErrorMessage name="fullName" component="div" className="text-xs text-rose-600 mt-1" />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <Field type="email" name="email" id="email" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <ErrorMessage name="email" component="div" className="text-xs text-rose-600 mt-1" />
              </div>

              <div>
                <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                <Field type="text" name="contactNumber" id="contactNumber" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <ErrorMessage name="contactNumber" component="div" className="text-xs text-rose-600 mt-1" />
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <Field as="select" name="role" id="role" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </Field>
                <ErrorMessage name="role" component="div" className="text-xs text-rose-600 mt-1" />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-gray-400 font-normal">(leave empty to keep current)</span></label>
                <Field type="password" name="password" id="password" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <ErrorMessage name="password" component="div" className="text-xs text-rose-600 mt-1" />
              </div>

              {/* Optional student profile fields — empty values clear stored data. */}
              <StudentProfileFields variant="simple" />

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Updating…' : 'Save Profile'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/admin/users')}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg disabled:opacity-50"
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
