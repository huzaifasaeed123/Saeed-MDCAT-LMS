// src/modules/auth/pages/LoginPage.jsx
//
// SKN Academy LMS — sign-in page (post-redesign).
//   • Two-pane layout: brand-gradient stage left, form right.
//   • Body font (Inter) for running text, font-display (Plus Jakarta Sans)
//     on the headline + logo wordmark.
//   • Primary CTA is solid orange (.btn-brand). Brand gradient is reserved
//     for the logo and the single accent word in the heading.
//   • Full light/dark mode via Tailwind dark: variants.
import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import useAuth from '../../../core/auth/useAuth';
import useForceLightMode from '../../../core/theme/useForceLightMode';
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowRight, FiAward } from 'react-icons/fi';
// ── GOOGLE SIGN-IN DISABLED ──────────────────────────────────────────
// Hidden together with the signup flow because Google login currently
// implies account creation, which we don't offer right now. Restore by
// uncommenting this import and the `<GoogleSignInButton />` usage below.
// import GoogleSignInButton from '../components/GoogleSignInButton';

const LoginSchema = Yup.object().shape({
  email:    Yup.string().email('Invalid email address').required('Email is required'),
  password: Yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
});

const Stat = ({ n, l }) => (
  <div>
    <div className="font-display text-2xl font-extrabold tracking-tight leading-none">{n}</div>
    <div className="text-[11px] font-semibold opacity-85 mt-1">{l}</div>
  </div>
);

// Input + label group — extracted so dark mode + focus state stays consistent.
const FieldGroup = ({ label, name, type = 'text', autoComplete, placeholder, Icon, rightSlot, children }) => (
  <div>
    {children /* allows a wrapper to inject "Forgot?" link in the label row */}
    {!children && (
      <label htmlFor={name} className="block text-xs font-bold text-[var(--text-strong)] mb-1.5">
        {label}
      </label>
    )}
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)] pointer-events-none" />}
      <Field
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 transition"
      />
      {rightSlot}
    </div>
    <ErrorMessage name={name} component="div" className="text-xs text-rose-500 mt-1" />
  </div>
);

const LoginPage = () => {
  // Auth pages are ALWAYS rendered in light mode, regardless of the user's
  // saved theme. Their dark preference is restored when they navigate into
  // the app.
  useForceLightMode();

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [showPwd, setShowPwd] = React.useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (values, { setSubmitting, setStatus }) => {
    try {
      setStatus(null);
      const response = await login(values);
      if (response.success) navigate('/dashboard');
    } catch (error) {
      setStatus(error.response?.data?.message || 'An error occurred during login');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen lg:h-screen flex bg-[var(--bg)] text-[var(--text)]">
      {/* ── Brand stage (left, hidden on mobile) ─────────────────────────── */}
      {/* Always renders in the same gradient regardless of theme. Pinned to
          viewport height on lg+ so it stays visible while the right form
          scrolls internally — matches the Register-page pattern. */}
      <div className="hidden lg:flex w-[44%] relative overflow-hidden bg-brand-gradient text-white p-10 flex-col lg:h-screen lg:overflow-y-auto">
        {/* Decorative orbs — pure CSS, no images. */}
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,.22), transparent 70%)' }} />
        <div className="absolute -bottom-24 -right-24 w-[360px] h-[360px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(252,211,77,.35), transparent 70%)' }} />
        <div className="absolute top-48 right-20 w-28 h-28 rounded-full bg-white/10 blur-[2px]" />

        {/* Logo lockup */}
        <div className="relative z-10 flex items-center gap-3">
          <img src="/skn-logo-mark.png" alt="SKN Academy" className="w-11 h-11 rounded-xl bg-white/15 border border-white/40 p-1 object-contain" />
          <div>
            <div className="font-display font-extrabold text-lg tracking-tight leading-none">SKN Academy</div>
            <div className="text-[10px] font-semibold tracking-[0.18em] opacity-85 mt-1">LMS · ADMIN PORTAL</div>
          </div>
        </div>

        {/* Headline + stats */}
        <div className="relative z-10 mt-auto">
          <div className="font-mono text-[11px] tracking-[0.18em] uppercase opacity-85">MDCAT · 2025 Cycle</div>
          <h1 className="font-display text-4xl xl:text-[42px] font-extrabold leading-[1.05] tracking-[-0.035em] mt-2.5 mb-3.5">
            Crack MDCAT with<br />the <i className="font-bold italic">sharpest</i> practice in PK.
          </h1>
          <p className="text-[15px] opacity-90 max-w-[420px] leading-relaxed">
            18,000+ vetted MCQs · Chapter-wise mocks · Live leaderboards · Doctor-mentor community. Built by the SKN Academy faculty + MBBS toppers.
          </p>

          <div className="flex gap-6 mt-7">
            <Stat n="18.2k"  l="MCQs" />
            <Stat n="2,300+" l="Students" />
            <Stat n="92%"    l="Top-10 hit rate" />
          </div>
        </div>

        <div className="relative z-10 mt-7 text-[11px] opacity-75">
          © {new Date().getFullYear()} SKN Academy · LMS
        </div>
      </div>

      {/* ── Form pane (right) ─────────────────────────────────────────────── */}
      {/* lg:h-screen + lg:overflow-y-auto so it scrolls internally with the
          left stage pinned. Below lg the whole document scrolls naturally. */}
      <div className="flex-1 flex flex-col px-6 py-8 sm:px-10 sm:py-10 lg:h-screen lg:overflow-y-auto">
        {/* ── "New here? Create an account" link disabled ─────────────────
            Public signup is currently turned off. Restore this block to
            bring the signup link back at the top-right of the login pane. */}
        {/*
        <div className="flex justify-end items-center gap-1.5 text-sm text-[var(--text-muted)]">
          New here?
          <Link to="/register" className="text-primary-600 dark:text-primary-400 font-bold no-underline hover:text-primary-700 dark:hover:text-primary-300">
            Create an account →
          </Link>
        </div>
        */}

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md">
            {/* Mobile-only logo (stage is hidden < lg) */}
            <div className="lg:hidden flex items-center gap-2 mb-8">
              <img src="/skn-logo-mark.png" alt="" className="w-9 h-9 rounded-lg" />
              <span className="font-display text-xl font-extrabold text-brand-gradient tracking-tight">SKN Academy</span>
            </div>

            <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--text-faint)]">
              Welcome back
            </div>
            <h2 className="font-display text-3xl sm:text-[32px] font-extrabold tracking-[-0.025em] mt-1 mb-1.5 text-[var(--text-strong)]">
              Sign in to your <span className="text-brand-gradient">study HQ</span>
            </h2>
            <p className="text-sm text-[var(--text-muted)] mb-7">
              Pick up exactly where you left off.
            </p>

            <Formik
              initialValues={{ email: '', password: '' }}
              validationSchema={LoginSchema}
              onSubmit={handleSubmit}
            >
              {({ isSubmitting, status }) => (
                <Form className="space-y-4">
                  {status && (
                    <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm px-3 py-2.5 rounded-lg">
                      {status}
                    </div>
                  )}

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-xs font-bold text-[var(--text-strong)] mb-1.5">Email</label>
                    <div className="relative">
                      <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)] pointer-events-none" />
                      <Field
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        className="w-full pl-10 pr-3 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 transition"
                      />
                    </div>
                    <ErrorMessage name="email" component="div" className="text-xs text-rose-500 mt-1" />
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="password" className="block text-xs font-bold text-[var(--text-strong)]">Password</label>
                      <Link to="/forgot-password" className="text-xs font-bold text-primary-600 dark:text-primary-400 no-underline hover:text-primary-700 dark:hover:text-primary-300">
                        Forgot?
                      </Link>
                    </div>
                    <div className="relative">
                      <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)] pointer-events-none" />
                      <Field
                        id="password"
                        name="password"
                        type={showPwd ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text)]"
                        tabIndex={-1}
                        aria-label={showPwd ? 'Hide password' : 'Show password'}
                      >
                        {showPwd ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                      </button>
                    </div>
                    <ErrorMessage name="password" component="div" className="text-xs text-rose-500 mt-1" />
                  </div>

                  {/* Primary CTA — solid orange via .btn-brand */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-brand w-full text-base py-3.5 mt-2"
                  >
                    {isSubmitting ? 'Signing in…' : <>Sign in <FiArrowRight className="w-4 h-4" /></>}
                  </button>

                  {/* ── "OR CONTINUE WITH" divider + Google Sign-In disabled ────
                      Hidden alongside signup since Google login implies
                      account creation, which we don't currently support.
                      Restore both blocks (and the import at the top of
                      this file) to bring Google login back. */}
                  {/*
                  <div className="flex items-center gap-3 text-[11px] font-mono tracking-[0.18em] text-[var(--text-faint)] my-2">
                    <div className="flex-1 h-px bg-[var(--border)]" /> OR CONTINUE WITH <div className="flex-1 h-px bg-[var(--border)]" />
                  </div>

                  <GoogleSignInButton />
                  */}

                  <p className="text-[11px] text-[var(--text-faint)] text-center leading-relaxed pt-3">
                    By signing in you agree to our <a className="text-[var(--text-muted)] underline">Terms</a> and <a className="text-[var(--text-muted)] underline">Privacy Policy</a>.
                  </p>
                </Form>
              )}
            </Formik>
          </div>
        </div>

        <div className="hidden lg:flex items-center justify-center text-[11px] text-[var(--text-faint)]">
          <FiAward className="w-3 h-3 mr-1" /> Trusted by 2,300+ MDCAT aspirants
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
