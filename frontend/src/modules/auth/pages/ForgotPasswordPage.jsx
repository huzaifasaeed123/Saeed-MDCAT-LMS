import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiMail, FiArrowLeft, FiCheckCircle, FiClock } from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import useForceLightMode from '../../../core/theme/useForceLightMode';

// SKN-branded forgot-password. Centred card on the brand surface background,
// gradient mark + mono eyebrow, brand-gradient submit button. Logic unchanged.
const EXPIRY_SECONDS = 10 * 60;

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const ForgotPasswordPage = () => {
  useForceLightMode(); // Auth flows always render in light mode.

  const [email,     setEmail]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [sent,      setSent]      = useState(false);
  const [error,     setError]     = useState('');
  const [countdown, setCountdown] = useState(EXPIRY_SECONDS);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!sent) return;
    setCountdown(EXPIRY_SECONDS);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [sent]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email'); return; }
    setLoading(true); setError('');
    try {
      await apiClient.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-md">
        {/* Brand mark above the card */}
        <div className="flex items-center justify-center gap-2 mb-5">
          <img src="/skn-logo-mark.png" alt="" className="w-9 h-9 rounded-lg" />
          <span className="text-xl font-extrabold text-brand-gradient tracking-tight">SKN Academy</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-7">
          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiCheckCircle className="w-7 h-7 text-emerald-600" />
              </div>
              <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-gray-400">Sent</div>
              <h2 className="text-xl font-extrabold text-gray-900 mt-1 mb-2 tracking-tight">Check your inbox</h2>
              <p className="text-sm text-gray-500 mb-4">
                A password reset link was sent to <span className="font-bold text-gray-700">{email}</span>.
              </p>

              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-4 ${
                countdown === 0  ? 'bg-rose-50 text-rose-600'
                : countdown < 120 ? 'bg-amber-50 text-amber-700'
                : 'bg-blue-50 text-blue-700'
              }`}>
                <FiClock className="w-4 h-4" />
                {countdown === 0
                  ? 'Link has expired — request a new one'
                  : <>Link expires in <strong className="ml-1">{formatTime(countdown)}</strong></>}
              </div>

              <p className="text-xs text-gray-400 mb-5">Didn't receive it? Check your spam folder or try again.</p>
              <button onClick={() => { setSent(false); setEmail(''); }} className="text-sm font-bold text-primary-700 hover:text-primary-800">
                Try a different email
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-brand-gradient-soft rounded-xl flex items-center justify-center mx-auto mb-3">
                  <FiMail className="w-5 h-5 text-primary-700" />
                </div>
                <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-gray-400">Recover</div>
                <h2 className="text-xl font-extrabold text-gray-900 mt-1 tracking-tight">Forgot your password?</h2>
                <p className="text-sm text-gray-500 mt-1">Enter your email and we'll send you a reset link.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-2.5">
                    {error}
                  </p>
                )}
                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">Email address</label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email" autoFocus value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 transition"
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn-brand w-full justify-center text-sm py-3 disabled:opacity-60 disabled:cursor-not-allowed">
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 text-center">
            <Link to="/login" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              <FiArrowLeft className="w-4 h-4" /> Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
