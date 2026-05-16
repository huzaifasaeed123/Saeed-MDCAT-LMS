const jwt             = require('jsonwebtoken');
const crypto          = require('crypto');
const nodemailer      = require('nodemailer');
const User            = require('../models/User');
const SystemSettings  = require('../models/SystemSettings');
const { validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const { pushToUser }   = require('../utils/sseManager');

// Project a User document into the JSON we send to the client. Single source
// of truth — used by login / register / refresh / getMe so the frontend always
// receives an identical user shape. featureAccess + courseAccess are included
// so the frontend AuthContext can render the sidebar lock state immediately,
// no extra round-trip needed.
const projectUser = (user) => ({
  id:             user._id,
  fullName:       user.fullName,
  email:          user.email,
  contactNumber:  user.contactNumber || '',
  role:           user.role,
  profilePicture: user.profilePicture || null,
  featureAccess:  {
    autoTest:  !!user.featureAccess?.autoTest,
    community: !!user.featureAccess?.community,
    videos:    !!user.featureAccess?.videos,
    notes:     !!user.featureAccess?.notes,
  },
  // Course access: grant-all flag + per-course allowlist. "Has courses" is
  // derived in the frontend as: coursesGrantAll || courseAccess.length > 0.
  coursesGrantAll: !!user.coursesGrantAll,
  courseAccess:    (user.courseAccess || []).map((c) => String(c)),
});

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── Settings helper ──────────────────────────────────────────────────────────
// Always reads live from DB — called only on login and refresh (not per-request).
const getSessionSettings = async () => {
  const s = await SystemSettings.findOne({ key: 'global' });
  return {
    sessionMode:         s?.sessionMode         ?? 'multi',
    sessionDurationDays: s?.sessionDurationDays ?? 547,
  };
};

// ─── Cookie helper ────────────────────────────────────────────────────────────
const setRefreshCookie = (refreshToken, durationDays, res) => {
  const options = {
    expires:  new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
    httpOnly: true,
    path:     '/api/auth',
  };
  if (process.env.NODE_ENV === 'production') {
    options.secure   = true;
    options.sameSite = 'Strict';
  }
  res.cookie('refreshToken', refreshToken, options);
};

// ─── Response helper ─────────────────────────────────────────────────────────
// Builds and sends both tokens.  settings + user.sessionVersion are embedded in
// the JWT payload so no DB hit is needed on normal API requests.
const sendTokenResponse = (user, settings, statusCode, res) => {
  const tokenOpts = {
    sm:          settings.sessionMode,
    sv:          user.sessionVersion ?? 0,
    durationDays: settings.sessionDurationDays,
  };

  const accessToken  = user.getSignedAccessToken(tokenOpts);
  const refreshToken = user.getSignedRefreshToken(tokenOpts);

  setRefreshCookie(refreshToken, settings.sessionDurationDays, res);

  res.status(statusCode).json({
    success: true,
    accessToken,
    user: projectUser(user),
  });
};

// ─── Register ─────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Please enter correct details', errors: errors.array() });
  }

  try {
    const { fullName, email, contactNumber, password } = req.body;

    if (await User.findOne({ email })) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Optional student profile fields — students can fill these at signup
    // (fatherName, province, district, studentClass, studentStatus, fscCollegeName,
    // fscBoard). All optional; empty strings stored as-is.
    const OPT = ['fatherName','province','district','studentClass','studentStatus','fscCollegeName','fscBoard'];
    const profile = {};
    for (const f of OPT) {
      if (req.body[f] !== undefined) profile[f] = typeof req.body[f] === 'string' ? req.body[f].trim() : req.body[f];
    }

    const [user, settings] = await Promise.all([
      User.create({ fullName, email, contactNumber, password, role: 'student', ...profile }),
      getSessionSettings(),
    ]);

    // Admin dashboard cache is NOT auto-invalidated on signup — admins refresh
    // explicitly via the dashboard "Refresh" button when they want fresh KPIs.

    sendTokenResponse(user, settings, 201, res);
  } catch (error) {
    console.error('register error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── Lockout config — 10 failures within 5 minutes locks for 5 minutes ───────
const LOCKOUT_WINDOW_MS    = 5 * 60 * 1000;
const LOCKOUT_THRESHOLD    = 20;
const LOCKOUT_DURATION_MS  = 5 * 60 * 1000;

// ─── Login ────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Please enter correct email and password', errors: errors.array() });
  }

  try {
    const { email, password } = req.body;

    const [user, settings] = await Promise.all([
      User.findOne({ email }).select('+password'),
      getSessionSettings(),
    ]);

    // Generic message for both "no user" and "wrong password" — don't leak which.
    const invalidCredentials = () =>
      res.status(401).json({ success: false, message: 'Invalid credentials' });

    if (!user) return invalidCredentials();

    // ── Account-lockout gate ────────────────────────────────────────────────
    const now = Date.now();
    if (user.lockUntil && user.lockUntil.getTime() > now) {
      const minsLeft = Math.ceil((user.lockUntil.getTime() - now) / 60000);
      return res.status(429).json({
        success: false,
        message: `Too many failed attempts. Try again in ${minsLeft} minute${minsLeft === 1 ? '' : 's'}.`,
        lockedUntil: user.lockUntil,
      });
    }

    if (!(await user.matchPassword(password))) {
      // Track the failure inside a sliding 5-minute window.
      const windowStart = user.firstFailedAt?.getTime();
      const inWindow    = windowStart && (now - windowStart) < LOCKOUT_WINDOW_MS;

      if (inWindow) {
        user.loginAttempts = (user.loginAttempts || 0) + 1;
      } else {
        user.loginAttempts = 1;
        user.firstFailedAt = new Date(now);
      }

      if (user.loginAttempts >= LOCKOUT_THRESHOLD) {
        user.lockUntil = new Date(now + LOCKOUT_DURATION_MS);
      }

      await user.save();
      return invalidCredentials();
    }

    // ── Successful login — clear any failure tracking ───────────────────────
    if (user.loginAttempts || user.firstFailedAt || user.lockUntil) {
      user.loginAttempts = 0;
      user.firstFailedAt = undefined;
      user.lockUntil     = undefined;
    }

    // Mode 2: each new login invalidates all previous sessions by bumping the version.
    // The old refresh tokens carry the previous sv; they'll fail on their next refresh.
    let didReplaceSession = false;
    if (settings.sessionMode === 'single') {
      user.sessionVersion = (user.sessionVersion ?? 0) + 1;
      didReplaceSession   = true;
    }

    await user.save();

    // Instant logout for the OLD device(s): the previous browser still has an
    // open SSE connection in sseManager. Push a 'session_replaced' frame and
    // the frontend will log itself out immediately, instead of waiting up to
    // 1 hour for the access token to expire.
    // Cost = one in-memory Map lookup + one socket write. No DB query. The
    // new device hasn't opened its SSE yet, so it can't kick itself.
    if (didReplaceSession) {
      try {
        pushToUser(user._id, 'session_replaced', {
          message: 'You were signed out because someone signed in to your account on another device.',
        });
      } catch { /* never fail the login on a push error */ }
    }

    sendTokenResponse(user, settings, 200, res);
  } catch (error) {
    console.error('login error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── Google OAuth (Identity Services) ────────────────────────────────────────
exports.googleAuthGIS = async (req, res) => {
  try {
    const { credential } = req.body;

    const ticket = await googleClient.verifyIdToken({
      idToken:  credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { sub: googleId, email, name, picture } = ticket.getPayload();

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (!user) {
      user = await User.create({
        googleId, fullName: name, email,
        contactNumber: '', profilePicture: picture, role: 'student',
      });
    } else if (!user.googleId) {
      user.googleId       = googleId;
      user.profilePicture = picture;
      await user.save();
    }

    const settings = await getSessionSettings();

    if (settings.sessionMode === 'single') {
      user.sessionVersion = (user.sessionVersion ?? 0) + 1;
      await user.save();
      // Instant logout for the previous device — same rationale as the
      // password-login path above. Zero DB cost.
      try {
        pushToUser(user._id, 'session_replaced', {
          message: 'You were signed out because someone signed in to your account on another device.',
        });
      } catch { /* swallow — login should not fail on a push error */ }
    }

    sendTokenResponse(user, settings, 200, res);
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({ success: false, message: 'Invalid Google credentials' });
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────
exports.logout = (req, res) => {
  res.cookie('refreshToken', 'none', {
    expires:  new Date(Date.now() + 5 * 1000),
    httpOnly: true,
    path:     '/api/auth',
  });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

// ─── Refresh Token ────────────────────────────────────────────────────────────
// This is the ONLY endpoint that hits the DB for auth purposes.
// Called by the axios interceptor every ~60 minutes when the access token expires,
// and once on every page load (silentRefresh in AuthContext).
//
// Flow:
//   1. Verify refresh JWT signature (CPU only)
//   2. Read Settings + User in parallel (2 DB reads total)
//   3. If Mode 2: compare decoded.sv against user.sessionVersion
//      → mismatch means a newer login replaced this session → 401
//   4. Issue a new 1-hour access token (refresh token stays the same — no rotation)
exports.refreshToken = async (req, res) => {
  try {
    const rawToken = req.cookies.refreshToken;

    if (!rawToken || rawToken === 'none') {
      return res.status(401).json({ success: false, message: 'No refresh token provided' });
    }

    // Step 1 — verify JWT signature (no DB)
    let decoded;
    try {
      decoded = jwt.verify(rawToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      const msg = err.name === 'TokenExpiredError'
        ? 'Session expired, please log in again'
        : 'Invalid refresh token';
      return res.status(401).json({ success: false, message: msg });
    }

    // Step 2 — read Settings + User in parallel (2 DB reads, only on refresh)
    const [user, settings] = await Promise.all([
      User.findById(decoded.id),
      getSessionSettings(),
    ]);

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    // Step 3 — Mode 2 check: is this session still the latest one?
    if (settings.sessionMode === 'single') {
      const tokenSv   = decoded.sv ?? 0;
      const currentSv = user.sessionVersion ?? 0;
      if (tokenSv !== currentSv) {
        return res.status(401).json({
          success: false,
          message: 'Your session was replaced by a login on another device. Please log in again.',
          sessionReplaced: true,
        });
      }
    }

    // Step 4 — issue new access token; refresh token stays unchanged (no rotation)
    const newAccessToken = user.getSignedAccessToken({
      sm: settings.sessionMode,
      sv: user.sessionVersion ?? 0,
    });

    res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      user: projectUser(user),
    });
  } catch (error) {
    console.error('refreshToken error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── Get Current User ─────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, data: projectUser(user) });
  } catch (error) {
    console.error('getMe error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── Persistent pooled nodemailer transporter ────────────────────────────────
// Built once at module load. `pool: true` keeps SMTP connections alive between
// sends — no fresh TCP+TLS handshake per email. Verified once on startup.
let _transporter = null;
const getTransporter = () => {
  if (_transporter) return _transporter;

  const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`SMTP not configured — missing env vars: ${missing.join(', ')}`);
  }

  _transporter = nodemailer.createTransport({
    host:           process.env.SMTP_HOST,
    port:           Number(process.env.SMTP_PORT) || 587,
    secure:         process.env.SMTP_SECURE === 'true',
    pool:           true,
    maxConnections: 5,
    maxMessages:    100,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Fire-and-forget verification on first use; logs but does not crash.
  _transporter.verify()
    .then(() => console.log('[SMTP] pool ready ✓'))
    .catch((err) => console.error('[SMTP] verify failed:', err.message));

  return _transporter;
};

const renderResetEmail = (user, resetUrl) => `
  <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px">
    <h2 style="color:#1e3a5f;margin-bottom:8px">Reset Your Password</h2>
    <p style="color:#4b5563">Hi ${user.fullName},</p>
    <p style="color:#4b5563">We received a request to reset your password. Click the button below. This link expires in <strong>10 minutes</strong>.</p>
    <a href="${resetUrl}"
       style="display:inline-block;margin:24px 0;padding:12px 28px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">
      Reset Password
    </a>
    <p style="color:#9ca3af;font-size:13px">If you didn't request this, ignore this email.</p>
    <p style="color:#9ca3af;font-size:13px">Or copy this link:<br><a href="${resetUrl}" style="color:#2563eb">${resetUrl}</a></p>
  </div>
`;

// ─── Forgot Password ──────────────────────────────────────────────────────────
// Fire-and-forget: respond to the user the moment the token is saved, then send
// the email in the background. If the send fails, we clear the token so the
// user can request a fresh one — no half-state left behind.
exports.forgotPassword = async (req, res) => {
  const okMsg = 'If that email is registered you will receive a reset link shortly.';

  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address. Please check your email or register a new account.',
      });
    }

    // Cheap pre-flight: make sure SMTP env is configured before persisting a token.
    let transporter;
    try {
      transporter = getTransporter();
    } catch (smtpErr) {
      console.error('[forgotPassword] SMTP not configured:', smtpErr.message);
      return res.status(500).json({
        success: false,
        message: 'Email service is not configured. Please contact the administrator.',
      });
    }

    // Generate raw token, store SHA-256 hash in DB
    const rawToken  = crypto.randomBytes(32).toString('hex');
    const hashToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetPasswordToken  = hashToken;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${rawToken}`;

    // Respond immediately — the user no longer waits on SMTP.
    res.status(200).json({ success: true, message: okMsg });

    // Background send — failures clear the saved token so the user can retry.
    transporter.sendMail({
      from:    `"${process.env.SMTP_FROM_NAME || 'Saeed MDCAT LMS'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
      to:      user.email,
      subject: 'Password Reset Request',
      html:    renderResetEmail(user, resetUrl),
    })
      .then(() => console.log(`[forgotPassword] reset email sent to ${user.email} ✓`))
      .catch(async (err) => {
        console.error(`[forgotPassword] email send FAILED for ${user.email}:`, err.message);
        await User.updateOne(
          { _id: user._id },
          { $unset: { resetPasswordToken: '', resetPasswordExpire: '' } }
        ).catch(() => {});
      });
  } catch (error) {
    console.error('[forgotPassword] unexpected error:', error);
    res.status(500).json({ success: false, message: 'Failed to process request. Please try again.' });
  }
};

// ─── Reset Password ───────────────────────────────────────────────────────────
// POST /api/auth/reset-password/:token  { password }
exports.resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    // Hash the URL token and look up the user
    const hashToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken:  hashToken,
      resetPasswordExpire: { $gt: Date.now() },
    }).select('+password');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired. Please request a new one.' });
    }

    user.password            = password; // pre-save hook hashes it
    user.resetPasswordToken  = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('resetPassword error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
