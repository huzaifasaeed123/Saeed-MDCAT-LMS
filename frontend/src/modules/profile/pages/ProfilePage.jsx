import React, { useState, useRef, useMemo } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import useAuth from '../../../core/auth/useAuth';
import { updateProfile } from '../../users/services/userService';
import apiClient from '../../../core/api/axiosConfig';
import {
  FiUser, FiMail, FiPhone, FiShield, FiEdit, FiSave, FiX, FiCamera,
  FiLock, FiKey, FiCalendar, FiUsers, FiMapPin, FiBookOpen, FiAward, FiHome,
} from 'react-icons/fi';
import StudentProfileFields from '../../../shared/components/StudentProfileFields';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';
import { getBackendUrl } from '../../../shared/utils/fixImageUrls';

// ── Validation ───────────────────────────────────────────────────────────────
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

const ROLE_CHIP = {
  admin:   'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  teacher: 'bg-primary-100 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300',
  student: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
};

// ── Building blocks ──────────────────────────────────────────────────────────
// Single info field rendered as label-above-value, no row separator.
// We pack these into a responsive grid so groups read like a structured card,
// not a long stacked list.
const InfoField = ({ Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-300 flex items-center justify-center flex-shrink-0">
      <Icon className="w-4 h-4" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
        {label}
      </div>
      <div className="text-sm font-semibold text-[var(--text-strong)] mt-0.5 break-words">
        {value || <span className="text-[var(--text-faint)] font-normal italic">Not set</span>}
      </div>
    </div>
  </div>
);

// Themed section card — used by every info group in view mode and every form
// group in edit mode. Keeps the page rhythm consistent.
const SectionCard = ({ title, subtitle, icon: Icon, children, className = '' }) => (
  <section className={`bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6 ${className}`}>
    {(title || subtitle) && (
      <header className="mb-4 sm:mb-5">
        <div className="flex items-center gap-2">
          {Icon && (
            <span className="w-7 h-7 rounded-lg bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-300 flex items-center justify-center">
              <Icon className="w-4 h-4" />
            </span>
          )}
          <h3 className="text-sm font-bold text-[var(--text-strong)]">{title}</h3>
        </div>
        {subtitle && (
          <p className="text-xs text-[var(--text-faint)] mt-1 ml-9">{subtitle}</p>
        )}
      </header>
    )}
    {children}
  </section>
);

// Reusable themed input wrapper used in the edit form so every field looks
// identical (icon + label + ring/border).
const TextField = ({ Icon, name, label, type = 'text', placeholder, autoComplete, disabled, required, hint }) => (
  <div>
    <label className="block text-xs font-bold text-[var(--text-strong)] mb-1.5">
      {label}
      {required && <span className="ml-1 text-rose-500">*</span>}
      {hint && <span className="ml-1.5 text-[var(--text-faint)] font-normal">{hint}</span>}
    </label>
    <div className="relative">
      {Icon && (
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)] pointer-events-none" />
      )}
      <Field
        type={type}
        name={name}
        autoComplete={autoComplete}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full ${Icon ? 'pl-10' : 'pl-3'} pr-3 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 placeholder:text-[var(--text-faint)] disabled:bg-[var(--bg-muted)] disabled:cursor-not-allowed transition`}
      />
    </div>
    <ErrorMessage name={name} component="div" className="text-xs text-rose-600 dark:text-rose-300 mt-1" />
  </div>
);

// ── Page ─────────────────────────────────────────────────────────────────────
const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);
  const fileInputRef = useRef(null);

  const isStudent = (user?.role || 'student') === 'student';

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

  // Navbar action — memoised so PageHeaderContext doesn't loop.
  const headerAction = useMemo(() => (
    isEditing ? null : (
      <button onClick={() => setIsEditing(true)} className="btn-brand text-sm">
        <FiEdit className="w-4 h-4" /> Edit Profile
      </button>
    )
  ), [isEditing]);

  usePageHeader({
    title:    'My Profile',
    subtitle: 'Manage your account details and security',
    action:   headerAction,
  });

  return (
    <div className="space-y-5">
      {/* Mobile-only Edit button — navbar action slot is desktop-only */}
      {!isEditing && (
        <div className="md:hidden">
          <button
            onClick={() => setIsEditing(true)}
            className="btn-brand text-sm w-full justify-center"
          >
            <FiEdit className="w-4 h-4" /> Edit Profile
          </button>
        </div>
      )}

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      {/* Brand gradient banner with avatar + identity. Decorative soft circles
          to add depth. Role chip + joined date + email pinned in a clean row
          below the name. */}
      <div className="relative overflow-hidden bg-brand-gradient text-white rounded-2xl shadow-md">
        <span aria-hidden className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10 blur-2xl" />
        <span aria-hidden className="absolute -bottom-24 left-1/4 w-64 h-64 rounded-full bg-white/10 blur-2xl" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-5 p-5 sm:p-7">
          {/* Avatar with camera overlay */}
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 group mx-auto sm:mx-0">
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

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-[-0.025em] truncate">
              {user?.fullName || 'Welcome'}
            </h2>
            <p className="text-sm opacity-90 truncate mt-1 flex items-center gap-1.5 justify-center sm:justify-start">
              <FiMail className="w-3.5 h-3.5 opacity-80" /> {user?.email}
            </p>
            <div className="mt-3 flex items-center gap-2 flex-wrap justify-center sm:justify-start">
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${ROLE_CHIP[user?.role || 'student']}`}>
                {user?.role || 'student'}
              </span>
              {user?.createdAt && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold opacity-90 bg-white/15 backdrop-blur-sm rounded-full px-2.5 py-0.5">
                  <FiCalendar className="w-3 h-3" />
                  Joined {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                </span>
              )}
              {user?.contactNumber && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold opacity-90 bg-white/15 backdrop-blur-sm rounded-full px-2.5 py-0.5">
                  <FiPhone className="w-3 h-3" />
                  {user.contactNumber}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── VIEW mode: grouped cards ─────────────────────────────────────── */}
      {!isEditing ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Personal Information — every role */}
          <SectionCard title="Personal Information" icon={FiUser}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <InfoField Icon={FiUser}  label="Full Name"      value={user?.fullName} />
              {isStudent && (
                <InfoField Icon={FiUsers} label="Father Name"    value={user?.fatherName} />
              )}
              <InfoField Icon={FiPhone} label="Contact Number" value={user?.contactNumber} />
              <InfoField Icon={FiMail}  label="Email"          value={user?.email} />
            </div>
          </SectionCard>

          {/* Account & Security — every role */}
          <SectionCard title="Account &amp; Security" icon={FiShield}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <InfoField Icon={FiShield}   label="Role" value={user?.role} />
              <InfoField
                Icon={FiCalendar}
                label="Account Created"
                value={user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
                  : null}
              />
              <InfoField Icon={FiKey} label="Password" value="••••••••" />
            </div>
          </SectionCard>

          {/* Location — students only */}
          {isStudent && (
            <SectionCard title="Location" icon={FiMapPin}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <InfoField Icon={FiMapPin} label="Province" value={user?.province} />
                <InfoField Icon={FiMapPin} label="District" value={user?.district} />
              </div>
            </SectionCard>
          )}

          {/* Academic Details — students only */}
          {isStudent && (
            <SectionCard title="Academic Details" icon={FiBookOpen}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <InfoField Icon={FiBookOpen} label="Class"            value={user?.studentClass} />
                <InfoField Icon={FiAward}    label="Status"           value={user?.studentStatus} />
                <InfoField Icon={FiHome}     label="FSC College Name" value={user?.fscCollegeName} />
                <InfoField Icon={FiBookOpen} label="FSC Board"        value={user?.fscBoard} />
              </div>
            </SectionCard>
          )}
        </div>
      ) : (
        // ── EDIT mode: grouped form sections ──────────────────────────────
        <Formik
          initialValues={{
            fullName: user?.fullName || '',
            contactNumber: user?.contactNumber || '',
            password: '',
            currentPassword: '',
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
            <Form className="space-y-5">
              {/* Personal Information */}
              <SectionCard title="Personal Information" icon={FiUser}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextField Icon={FiUser}  name="fullName"       label="Full Name"      placeholder="Your full name" required />
                  <TextField Icon={FiPhone} name="contactNumber"  label="Contact Number" placeholder="Your contact number" required />
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[var(--text-strong)] mb-1.5">
                      Email <span className="ml-1 text-[var(--text-faint)] font-normal">(cannot be changed)</span>
                    </label>
                    <div className="relative">
                      <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)] pointer-events-none" />
                      <input
                        type="text" value={user?.email || ''} disabled
                        className="w-full pl-10 pr-3 py-2.5 bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-muted)] cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* Student-only fields */}
              {isStudent && (
                <SectionCard
                  title="Student Details"
                  icon={FiBookOpen}
                  subtitle="Optional — fill these to help us tailor your dashboard."
                >
                  <StudentProfileFields variant="brand" title="" />
                </SectionCard>
              )}

              {/* Password change */}
              <SectionCard
                title="Change Password"
                icon={FiKey}
                subtitle="Leave both fields empty to keep your current password."
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextField
                    Icon={FiLock}
                    name="password"
                    label="New Password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="New password (optional)"
                  />
                  <TextField
                    Icon={FiShield}
                    name="currentPassword"
                    label="Current Password"
                    type="password"
                    autoComplete="current-password"
                    disabled={!values.password || values.password.trim() === ''}
                    required={!!(values.password && values.password.trim() !== '')}
                    placeholder={values.password && values.password.trim() !== '' ? 'Confirm with current password' : 'Enter a new password first'}
                  />
                </div>
              </SectionCard>

              {/* Save / Cancel — sticky-feel footer card */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-muted)] text-[var(--text)] text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  <FiX className="w-4 h-4" /> Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-brand text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting
                    ? <>Saving…</>
                    : <><FiSave className="w-4 h-4" /> Save Changes</>}
                </button>
              </div>
            </Form>
          )}
        </Formik>
      )}
    </div>
  );
};

export default ProfilePage;
