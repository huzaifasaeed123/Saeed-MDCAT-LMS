import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FiLock, FiEye, FiEyeOff, FiCheckCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import apiClient from '../../../core/api/axiosConfig';
import useForceLightMode from '../../../core/theme/useForceLightMode';

// SKN-branded reset-password — single card on the brand surface, gradient
// mark above, mono eyebrow inside, brand-gradient submit. Logic unchanged.
const ResetPasswordPage = () => {
  useForceLightMode(); // Auth flows always render in light mode.

  const { token }   = useParams();
  const navigate    = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      await apiClient.post(`/auth/reset-password/${token}`, { password });
      setDone(true);
      toast.success('Password reset successfully!');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-5">
          <img src="/skn-logo-mark.png" alt="" className="w-9 h-9 rounded-lg" />
          <span className="text-xl font-extrabold text-brand-gradient tracking-tight">SKN Academy</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-7">
          {done ? (
            <div className="text-center py-2">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiCheckCircle className="w-7 h-7 text-emerald-600" />
              </div>
              <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-gray-400">Done</div>
              <h2 className="text-xl font-extrabold text-gray-900 mt-1 mb-1 tracking-tight">Password updated</h2>
              <p className="text-sm text-gray-500">Redirecting you to sign-in…</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-brand-gradient-soft rounded-xl flex items-center justify-center mx-auto mb-3">
                  <FiLock className="w-5 h-5 text-primary-700" />
                </div>
                <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-gray-400">Set new password</div>
                <h2 className="text-xl font-extrabold text-gray-900 mt-1 tracking-tight">Choose a new password</h2>
                <p className="text-sm text-gray-500 mt-1">Must be at least 6 characters.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-2.5">
                    {error}
                  </p>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">New Password</label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPwd ? 'text' : 'password'} autoFocus value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 transition"
                    />
                    <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                      {showPwd ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPwd ? 'text' : 'password'} value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15 transition"
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-brand w-full justify-center text-sm py-3 disabled:opacity-60 disabled:cursor-not-allowed">
                  {loading ? 'Saving…' : 'Reset Password'}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700">Back to sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
