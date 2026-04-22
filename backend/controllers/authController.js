const jwt             = require('jsonwebtoken');
const User            = require('../models/User');
const SystemSettings  = require('../models/SystemSettings');
const { validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');

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
    user: {
      id:             user._id,
      fullName:       user.fullName,
      email:          user.email,
      contactNumber:  user.contactNumber || '',
      role:           user.role,
      profilePicture: user.profilePicture || null,
    },
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

    const [user, settings] = await Promise.all([
      User.create({ fullName, email, contactNumber, password, role: 'student' }),
      getSessionSettings(),
    ]);

    sendTokenResponse(user, settings, 201, res);
  } catch (error) {
    console.error('register error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

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

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Mode 2: each new login invalidates all previous sessions by bumping the version.
    // The old refresh tokens carry the previous sv; they'll fail on their next refresh.
    if (settings.sessionMode === 'single') {
      user.sessionVersion = (user.sessionVersion ?? 0) + 1;
      await user.save();
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
      user: {
        id:             user._id,
        fullName:       user.fullName,
        email:          user.email,
        contactNumber:  user.contactNumber || '',
        role:           user.role,
        profilePicture: user.profilePicture || null,
      },
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
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('getMe error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
