// src/modules/auth/pages/RegisterPage.jsx
//
// SKN-branded signup — same two-pane layout as LoginPage so the experience
// stays cohesive between sign-in and create-account. Stage on the left,
// form on the right. Mobile-first: stage collapses < lg.
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import useAuth from '../../../core/auth/useAuth';
import useForceLightMode from '../../../core/theme/useForceLightMode';
import {
  FiUser, FiMail, FiPhone, FiLock, FiEye, FiEyeOff, FiArrowRight,
  FiCheckCircle, FiZap, FiTrendingUp, FiVideo, FiMessageCircle,
  FiClock, FiBookOpen,
} from 'react-icons/fi';
import GoogleSignInButton from '../components/GoogleSignInButton';
import StudentProfileFields from '../../../shared/components/StudentProfileFields';
import { EMPTY_STUDENT_PROFILE } from '../../../shared/constants/studentProfile';

const RegisterSchema = Yup.object().shape({
  fullName: Yup.string().required('Full name is required').max(50, 'Full name cannot be more than 50 characters'),
  email:    Yup.string().email('Invalid email address').required('Email is required'),
  contactNumber: Yup.string().required('Contact number is required').matches(/^\+?[0-9]{10,14}$/, 'Invalid contact number format'),
  password: Yup.string().required('Password is required').min(6, 'Password must be at least 6 characters'),
  confirmPassword: Yup.string().oneOf([Yup.ref('password'), null], 'Passwords must match').required('Confirm password is required'),
});

const Perk = ({ children }) => (
  <li className="flex items-start gap-2 text-sm opacity-95">
    <FiCheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
    <span>{children}</span>
  </li>
);

// Compact feature card for the left brand stage — icon tile + label + sub.
// Two-column grid keeps the stage information-dense without feeling crowded.
const Feature = ({ Icon, label, sub }) => (
  <div className="flex items-start gap-3">
    <div className="w-9 h-9 rounded-lg bg-white/15 border border-white/25 backdrop-blur flex items-center justify-center flex-shrink-0">
      <Icon className="w-4 h-4" />
    </div>
    <div className="min-w-0">
      <div className="text-sm font-bold leading-tight">{label}</div>
      <div className="text-[12px] opacity-80 leading-snug mt-0.5">{sub}</div>
    </div>
  </div>
);

const Stat = ({ n, l }) => (
  <div>
    <div className="font-display text-2xl font-extrabold tracking-tight leading-none">{n}</div>
    <div className="text-[11px] font-semibold opacity-85 mt-1">{l}</div>
  </div>
);

const RegisterPage = () => {
  // Auth pages are ALWAYS rendered in light mode, regardless of the user's
  // saved theme. See useForceLightMode for details.
  useForceLightMode();

  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (values, { setSubmitting, setStatus }) => {
    try {
      setStatus(null);
      const { confirmPassword: _ignored, ...userData } = values;
      // The "Other" sentinel never reaches the API — strip it.
      if (userData.district === '__OTHER__') userData.district = '';
      const response = await register(userData);
      if (response.success) navigate('/dashboard');
    } catch (error) {
      setStatus(error.response?.data?.message || 'An error occurred during registration');
    } finally {
      setSubmitting(false);
    }
  };

  // Outer container: `min-h-screen flex` on mobile + tablet, `h-screen` on
  // lg+ so the left brand stage stays in the viewport while the right form
  // pane scrolls internally. Without this, a long form pushes the left
  // stage's bottom content below the fold.
  return (
    <div className="min-h-screen lg:h-screen flex bg-[var(--bg)] text-[var(--text)]">
      {/* ── Brand stage (left) ────────────────────────────────────────────── */}
      {/* lg:h-screen pins it to viewport height; overflow-y-auto handles the
          rare case where the content itself is taller than the screen
          (e.g. very short laptops). */}
      <div className="hidden lg:flex w-[44%] relative overflow-hidden bg-brand-gradient text-white p-8 xl:p-10 flex-col lg:h-screen lg:overflow-y-auto">
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,255,255,.22), transparent 70%)' }} />
        <div className="absolute -bottom-24 -right-24 w-[360px] h-[360px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(252,211,77,.35), transparent 70%)' }} />

        {/* Logo + wordmark */}
        <div className="relative z-10 flex items-center gap-3">
          <img src="/skn-logo-mark.png" alt="SKN Academy" className="w-11 h-11 rounded-xl bg-white/15 border border-white/40 p-1 object-contain" />
          <div>
            <div className="font-display font-extrabold text-lg tracking-tight leading-none">SKN Academy</div>
            <div className="text-[10px] font-semibold tracking-[0.18em] opacity-85 mt-1">LMS · STUDENT PORTAL</div>
          </div>
        </div>

        {/* Headline */}
        <div className="relative z-10 mt-10 xl:mt-12">
          <div className="font-mono text-[11px] tracking-[0.18em] uppercase opacity-85">Start free</div>
          <h1 className="font-display text-3xl xl:text-[38px] font-extrabold leading-[1.05] tracking-[-0.035em] mt-2.5 mb-3.5">
            Your <i className="italic">all-in-one</i><br />MDCAT command centre.
          </h1>
          <p className="text-[14px] opacity-90 max-w-[460px] leading-relaxed">
            Build custom drills from 6 question banks, track every weak topic, and
            climb the live leaderboards — all in one place.
          </p>
        </div>

        {/* Feature grid — 2 cols on lg, single col on narrower lg viewports.
            Picked to match the actual modules students unlock after signup. */}
        <div className="relative z-10 mt-7 grid grid-cols-1 xl:grid-cols-2 gap-x-5 gap-y-4 max-w-[520px]">
          <Feature
            Icon={FiZap}
            label="Smart practice modes"
            sub="Drill only unused, incorrect, marked, omitted or correct MCQs."
          />
          <Feature
            Icon={FiBookOpen}
            label="18,000+ vetted MCQs"
            sub="MDCAT 2025, NUMS, AKU, Sindh Board & Saeed Sir's picks."
          />
          <Feature
            Icon={FiClock}
            label="Tutor & Timed modes"
            sub="Explanations after each question, or full mock-exam pacing."
          />
          <Feature
            Icon={FiTrendingUp}
            label="Live leaderboards"
            sub="All-time, weekly, monthly, most-improved + subject-wise."
          />
          <Feature
            Icon={FiVideo}
            label="Notes & video library"
            sub="Chapter-wise notes and Saeed Sir's recorded lectures."
          />
          <Feature
            Icon={FiMessageCircle}
            label="Community + teachers"
            sub="Helpful-vote replies, MCQ reports answered inside 24h."
          />
        </div>

        {/* Stats — push to the bottom with mt-auto so the stage feels grounded
            even on tall viewports. */}
        <div className="relative z-10 mt-auto pt-8 flex gap-7">
          <Stat n="18.2k"  l="MCQs" />
          <Stat n="2,300+" l="Students" />
          <Stat n="92%"    l="Top-10 hit rate" />
        </div>

        <div className="relative z-10 mt-6 text-[11px] opacity-75">
          © {new Date().getFullYear()} SKN Academy · LMS
        </div>
      </div>

      {/* ── Form pane (right) ─────────────────────────────────────────────── */}
      {/* On lg+ this pane scrolls internally (lg:h-screen + overflow) so the
          left brand stage stays pinned in the viewport. Below lg the whole
          document scrolls naturally. */}
      <div className="flex-1 flex flex-col px-6 py-8 sm:px-10 sm:py-10 lg:h-screen lg:overflow-y-auto">
        <div className="flex justify-end items-center gap-1.5 text-sm text-[var(--text-muted)]">
          Already enrolled?
          <Link to="/login" className="text-primary-600 dark:text-primary-400 font-bold no-underline hover:text-primary-700 dark:hover:text-primary-300">
            Sign in →
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center py-4">
          <div className="w-full max-w-md">
            <div className="lg:hidden flex items-center gap-2 mb-8">
              <img src="/skn-logo-mark.png" alt="" className="w-9 h-9 rounded-lg" />
              <span className="font-display text-xl font-extrabold text-brand-gradient tracking-tight">SKN Academy</span>
            </div>

            <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--text-faint)]">
              Get started
            </div>
            <h2 className="font-display text-3xl sm:text-[32px] font-extrabold tracking-[-0.025em] mt-1 mb-1.5 text-[var(--text-strong)]">
              Create your <span className="text-brand-gradient">study HQ</span>
            </h2>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              Takes 30 seconds. No card required.
            </p>

            <Formik
              initialValues={{
                fullName: '', email: '', contactNumber: '',
                password: '', confirmPassword: '',
                ...EMPTY_STUDENT_PROFILE,
              }}
              validationSchema={RegisterSchema}
              onSubmit={handleSubmit}
            >
              {({ isSubmitting, status }) => (
                <Form className="space-y-4">
                  {status && (
                    <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm px-3 py-2.5 rounded-lg">
                      {status}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-strong)] mb-1.5">Full name</label>
                    <div className="relative">
                      <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)] pointer-events-none" />
                      <Field name="fullName" type="text" autoComplete="name"
                        className="w-full pl-10 pr-3 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 transition"
                        placeholder="Huzaifa Saeed" />
                    </div>
                    <ErrorMessage name="fullName" component="div" className="text-xs text-rose-500 mt-1" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-strong)] mb-1.5">Email</label>
                    <div className="relative">
                      <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)] pointer-events-none" />
                      <Field name="email" type="email" autoComplete="email"
                        className="w-full pl-10 pr-3 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 transition"
                        placeholder="you@example.com" />
                    </div>
                    <ErrorMessage name="email" component="div" className="text-xs text-rose-500 mt-1" />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-strong)] mb-1.5">Contact number</label>
                    <div className="relative">
                      <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)] pointer-events-none" />
                      <Field name="contactNumber" type="text" autoComplete="tel"
                        className="w-full pl-10 pr-3 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 transition"
                        placeholder="03001234567" />
                    </div>
                    <ErrorMessage name="contactNumber" component="div" className="text-xs text-rose-500 mt-1" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[var(--text-strong)] mb-1.5">Password</label>
                      <div className="relative">
                        <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)] pointer-events-none" />
                        <Field name="password" type={showPwd ? 'text' : 'password'} autoComplete="new-password"
                          className="w-full pl-10 pr-9 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 transition"
                          placeholder="••••••••" />
                        <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text)]" tabIndex={-1}>
                          {showPwd ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                        </button>
                      </div>
                      <ErrorMessage name="password" component="div" className="text-xs text-rose-500 mt-1" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[var(--text-strong)] mb-1.5">Confirm</label>
                      <div className="relative">
                        <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)] pointer-events-none" />
                        <Field name="confirmPassword" type={showConfirm ? 'text' : 'password'} autoComplete="new-password"
                          className="w-full pl-10 pr-9 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 transition"
                          placeholder="••••••••" />
                        <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text)]" tabIndex={-1}>
                          {showConfirm ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                        </button>
                      </div>
                      <ErrorMessage name="confirmPassword" component="div" className="text-xs text-rose-500 mt-1" />
                    </div>
                  </div>

                  {/* Optional student profile fields — students can skip and fill later on Profile. */}
                  <div className="space-y-4 pt-2">
                    <StudentProfileFields variant="brand" title="Student details (optional — you can fill these later)" />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-brand w-full text-base py-3.5 mt-2"
                  >
                    {isSubmitting ? 'Creating account…' : <>Create my account <FiArrowRight className="w-4 h-4" /></>}
                  </button>

                  <div className="flex items-center gap-3 text-[11px] font-mono tracking-[0.18em] text-[var(--text-faint)] my-2">
                    <div className="flex-1 h-px bg-[var(--border)]" /> OR CONTINUE WITH <div className="flex-1 h-px bg-[var(--border)]" />
                  </div>

                  <GoogleSignInButton />

                  <p className="text-[11px] text-[var(--text-faint)] text-center leading-relaxed pt-3">
                    By creating an account you agree to our <a className="text-[var(--text-muted)] underline">Terms</a> and <a className="text-[var(--text-muted)] underline">Privacy Policy</a>.
                  </p>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
