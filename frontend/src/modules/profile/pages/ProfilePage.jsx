import React, { useState, useRef } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import useAuth from '../../../core/auth/useAuth';
import { updateProfile } from '../../users/services/userService';
import apiClient from '../../../core/api/axiosConfig';
import { FiUser, FiMail, FiPhone, FiShield, FiEdit, FiSave, FiX, FiCamera, FiLock, FiKey, FiCalendar, FiUsers, FiMapPin, FiBookOpen, FiAward, FiHome } from 'react-icons/fi';
import StudentProfileFields from '../../../shared/components/StudentProfileFields';

// SKN-branded profile.
//   • Gradient hero card with avatar + name + role chip.
//   • Info grid in view mode.
//   • Edit mode: Plus Jakarta Sans form with brand focus rings + a clearly
//     separated "Change password" section that requires the current password
//     (verified by the backend).
const ProfileSchema = Yup.object().shape({
  fullName: Yup.string().required('Full name is required').max(50, 'Full name cannot be more than 50 characters'),
  contactNumber: Yup.string().required('Contact number is required').matches(/^\+?[0-9]{10,14}$/, 'Invalid contact number format'),
  password: Yup.string().min(6, 'New password must be at least 6 characters').nullable(),
  currentPassword: Yup.string().when('password', {
    is: (val) => !!val && val.trim() !== '',
    then: (s) => s.required('Current password is required to change your password'),
    otherwise: (s) => s.notRequired(),
  }),
});

const getBackendUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  const apiUrl = import.meta.env.VITE_API_URL || import.meta.env.REACT_APP_API_URL || '';
  if (apiUrl) return apiUrl.replace(/\/api\/?$/, '');
  return 'http://localhost:5000';
};

const InfoRow = ({ Icon, label, value }) => (
  <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
    <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 flex-shrink-0">
      <Icon className="w-4 h-4" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-[11px] font-mono tracking-[0.16em] uppercase text-gray-400">{label}</div>
      <div className="text-sm font-semibold text-gray-900 mt-0.5 truncate">{value || '—'}</div>
    </div>
  </div>
);

const ROLE_CHIP = {
  admin:   'bg-purple-100 text-purple-800',
  teacher: 'bg-green-100 text-green-800',
  student: 'bg-blue-100 text-blue-800',
};

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);
  const fileInputRef = useRef(null);

  const profilePicUrl = user?.profilePicture
    ? user.profilePicture.startsWith('http')
      ? user.profilePicture
      : `${getBackendUrl()}${user.profilePicture}`
    : null;

  const handlePictureClick = () => fileInputRef.current?.click();

  const handlePictureChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please select a JPEG, PNG, GIF or WebP image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB');
      return;
    }

    setUploadingPic(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const uploadRes = await apiClient.post('/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const imageUrl = uploadRes.data?.url || uploadRes.data?.data?.url;
      if (!imageUrl) throw new Error('No URL returned');

      const profileRes = await updateProfile({ profilePicture: imageUrl });
      const updatedUser = profileRes.data || { ...user, profilePicture: imageUrl };
      updateUser({ ...user, ...updatedUser, profilePicture: imageUrl });
      toast.success('Profile picture updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload picture');
    } finally {
      setUploadingPic(false);
      e.target.value = '';
    }
  };

  const handleUpdateProfile = async (values, { setSubmitting, setFieldError, resetForm }) => {
    try {
      const dataToSubmit = {
        fullName: values.fullName,
        contactNumber: values.contactNumber,
        // Optional student profile fields — send always so users can clear values too.
        fatherName:     values.fatherName,
        province:       values.province,
        district:       values.district === '__OTHER__' ? '' : values.district,
        studentClass:   values.studentClass,
        studentStatus:  values.studentStatus,
        fscCollegeName: values.fscCollegeName,
        fscBoard:       values.fscBoard,
      };
      if (values.password && values.password.trim() !== '') {
        dataToSubmit.password = values.password;
        dataToSubmit.currentPassword = values.currentPassword;
      }

      const response = await updateProfile(dataToSubmit);
      if (response.success && response.data) {
        updateUser(response.data);
      } else {
        updateUser({ ...user, ...dataToSubmit });
      }
      toast.success('Profile updated successfully');
      resetForm({
        values: {
          ...values,
          password: '',
          currentPassword: '',
        },
      });
      setIsEditing(false);
    } catch (error) {
      const errField = error.response?.data?.field;
      const errMsg   = error.response?.data?.message || 'Failed to update profile';
      if (errField) setFieldError(errField, errMsg);
      else toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-gray-400">Account</div>
          <h1 className="text-2xl font-extrabold tracking-[-0.025em] text-gray-900 mt-0.5">My Profile</h1>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="btn-brand text-sm"
          >
            <FiEdit className="w-4 h-4" /> Edit Profile
          </button>
        )}
      </div>

      {/* ── Hero card with avatar + identity ─────────────────────────────── */}
      <div className="relative overflow-hidden bg-brand-gradient text-white rounded-2xl mb-6">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,.2), transparent 70%)' }} />
        <div className="absolute -bottom-24 left-1/3 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(circle, rgba(252,211,77,.3), transparent 70%)' }} />

        <div className="relative z-10 flex items-center gap-5 p-6 sm:p-7">
          {/* Avatar with camera-overlay (same UX as before) */}
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 group">
            {profilePicUrl ? (
              <img src={profilePicUrl} alt="" className="w-full h-full rounded-2xl object-cover ring-4 ring-white/30 shadow-xl" />
            ) : (
              <div className="w-full h-full rounded-2xl bg-white/15 border-2 border-white/40 flex items-center justify-center text-white font-extrabold text-4xl backdrop-blur ring-4 ring-white/30 shadow-xl">
                {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
            <button
              type="button"
              onClick={handlePictureClick}
              disabled={uploadingPic}
              className="absolute inset-0 rounded-2xl bg-black/0 hover:bg-black/40 flex items-center justify-center transition-all"
              title="Change profile picture"
            >
              {uploadingPic
                ? <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
                : <FiCamera className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handlePictureChange} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="font-mono text-[11px] tracking-[0.18em] uppercase opacity-85">Welcome back</div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.025em] mt-1 truncate">{user?.fullName || 'Student'}</h2>
            <p className="text-sm opacity-90 truncate mt-1">{user?.email}</p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${ROLE_CHIP[user?.role || 'student']}`}>
                {user?.role || 'student'}
              </span>
              {user?.createdAt && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold opacity-85">
                  <FiCalendar className="w-3 h-3" />
                  Joined {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Edit mode form OR view-mode info grid ────────────────────────── */}
      {isEditing ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="mb-5">
            <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-gray-400">Edit details</div>
            <h3 className="text-lg font-bold text-gray-900 tracking-tight mt-0.5">Update your profile</h3>
          </div>

          <Formik
            initialValues={{
              fullName: user?.fullName || '',
              contactNumber: user?.contactNumber || '',
              password: '',
              currentPassword: '',
              // Optional student profile fields — empty strings make them controlled inputs.
              fatherName:     user?.fatherName     || '',
              province:       user?.province       || '',
              district:       user?.district       || '',
              studentClass:   user?.studentClass   || '',
              studentStatus:  user?.studentStatus  || '',
              fscCollegeName: user?.fscCollegeName || '',
              fscBoard:       user?.fscBoard       || '',
            }}
            validationSchema={ProfileSchema}
            onSubmit={handleUpdateProfile}
          >
            {({ isSubmitting, values }) => (
              <Form className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">Full Name</label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <Field type="text" name="fullName"
                      className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 transition"
                      placeholder="Your full name" />
                  </div>
                  <ErrorMessage name="fullName" component="div" className="text-xs text-rose-600 mt-1" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">Contact Number</label>
                  <div className="relative">
                    <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <Field type="text" name="contactNumber"
                      className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 transition"
                      placeholder="Your contact number" />
                  </div>
                  <ErrorMessage name="contactNumber" component="div" className="text-xs text-rose-600 mt-1" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">Email <span className="text-gray-400 font-normal">(cannot be changed)</span></label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input type="text" value={user?.email || ''} disabled
                      className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 cursor-not-allowed" />
                  </div>
                </div>

                {/* ── Optional student profile fields ────────────────────── */}
                <div className="border-t border-gray-200 pt-5 mt-2 space-y-4">
                  <StudentProfileFields variant="brand" title="Student details (optional)" />
                </div>

                {/* ── Change password — current pwd required server-side ── */}
                <div className="border-t border-gray-200 pt-5 mt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <FiKey className="w-4 h-4 text-gray-500" />
                    <h4 className="text-sm font-bold text-gray-900">Change Password</h4>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Leave both fields empty to keep your current password.</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-900 mb-1.5">New Password</label>
                      <div className="relative">
                        <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <Field type="password" name="password" autoComplete="new-password"
                          className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 transition"
                          placeholder="New password (optional)" />
                      </div>
                      <ErrorMessage name="password" component="div" className="text-xs text-rose-600 mt-1" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-900 mb-1.5">
                        Current Password
                        {values.password && values.password.trim() !== '' && <span className="ml-1 text-rose-500">*</span>}
                      </label>
                      <div className="relative">
                        <FiShield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <Field type="password" name="currentPassword" autoComplete="current-password"
                          disabled={!values.password || values.password.trim() === ''}
                          className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 disabled:bg-gray-50 disabled:cursor-not-allowed transition"
                          placeholder={values.password && values.password.trim() !== '' ? 'Confirm with current password' : 'Enter a new password first'} />
                      </div>
                      <ErrorMessage name="currentPassword" component="div" className="text-xs text-rose-600 mt-1" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="submit" disabled={isSubmitting} className="btn-brand text-sm disabled:opacity-60 disabled:cursor-not-allowed">
                    {isSubmitting ? <>Saving…</> : <><FiSave className="w-4 h-4" /> Save Changes</>}
                  </button>
                  <button type="button" onClick={() => setIsEditing(false)} disabled={isSubmitting}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold transition-colors disabled:opacity-60">
                    <FiX className="w-4 h-4" /> Cancel
                  </button>
                </div>
              </Form>
            )}
          </Formik>
        </div>
      ) : (
        // Single Details panel — every field is rendered in a fixed sequence
        // so the layout is identical for students who filled their profile and
        // those who haven't. Empty fields show "—" via InfoRow's fallback.
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-gray-400 mb-3">Details</div>
          <InfoRow Icon={FiUser}     label="Full Name"       value={user?.fullName} />
          <InfoRow Icon={FiUsers}    label="Father Name"     value={user?.fatherName} />
          <InfoRow Icon={FiMail}     label="Email"           value={user?.email} />
          <InfoRow Icon={FiPhone}    label="Contact Number"  value={user?.contactNumber} />
          <InfoRow Icon={FiMapPin}   label="Province"        value={user?.province} />
          <InfoRow Icon={FiMapPin}   label="District"        value={user?.district} />
          <InfoRow Icon={FiBookOpen} label="Class"           value={user?.studentClass} />
          <InfoRow Icon={FiAward}    label="Status"          value={user?.studentStatus} />
          <InfoRow Icon={FiHome}     label="FSC College Name" value={user?.fscCollegeName} />
          <InfoRow Icon={FiBookOpen} label="FSC Board"       value={user?.fscBoard} />
          <InfoRow Icon={FiShield}   label="Role"            value={user?.role} />
          <InfoRow Icon={FiCalendar} label="Account Created" value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }) : null} />
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
