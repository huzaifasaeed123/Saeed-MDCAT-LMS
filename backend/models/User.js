const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Please provide full name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  contactNumber: {
    type: String,
    match: [/^\+?[0-9]{10,14}$/, 'Please add a valid contact number']
  },
  password: {
    type: String,
    required: [function() { return !this.googleId; }, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['student', 'teacher', 'admin'],
    default: 'student'
  },
  googleId: { type: String },
  profilePicture: { type: String },

  // Incremented on every new login when sessionMode === 'single'.
  // Embedded in the refresh token; mismatch on refresh = session was replaced.
  sessionVersion: { type: Number, default: 0 },

  resetPasswordToken: String,
  resetPasswordExpire: Date,

  // Brute-force protection — sliding 5-min window, lock after 10 failures.
  // firstFailedAt = start of the current window; loginAttempts = count in window;
  // lockUntil = if set and in the future, login is rejected.
  loginAttempts:  { type: Number, default: 0 },
  firstFailedAt:  Date,
  lockUntil:      Date,

  communityPoints: { type: Number, default: 0 },

  // Last time the user opened the Announcements panel. Used to compute the
  // unread badge as count(announcement.createdAt > announcementsSeenAt) — no
  // per-user announcement-read documents needed.
  announcementsSeenAt: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now }
});

// ── Indexes ───────────────────────────────────────────────────────────────────
// email already indexed via unique:true above.
// These cover: role filter, date sort, google login lookup,
// forgot-password token lookup, and text search on name+email.
UserSchema.index({ role: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ googleId: 1 }, { sparse: true });          // sparse = skip docs without googleId
UserSchema.index({ resetPasswordToken: 1 }, { sparse: true }); // sparse = skip docs without token
UserSchema.index({ fullName: 'text', email: 'text' });         // text search for admin user search
UserSchema.index({ communityPoints: -1 });                     // leaderboard sort

// ── Password hashing ──────────────────────────────────────────────────────────
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// ── Access token — 1 hour ─────────────────────────────────────────────────────
// Payload carries id, role, fullName → protect middleware never needs a DB lookup.
// sm (session mode) and sv (session version) are embedded so the refresh endpoint
// can re-validate Mode 2 without an extra query.
UserSchema.methods.getSignedAccessToken = function({ sm = 'multi', sv = 0 } = {}) {
  return jwt.sign(
    { id: this._id, role: this.role, fullName: this.fullName, profilePicture: this.profilePicture || null, sm, sv },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '1h' }
  );
};

// ── Refresh token — duration set by admin (default 547 days / ~1.5 years) ─────
// sv is embedded so a Mode 2 check on /refresh-token can compare against
// user.sessionVersion without needing to trust the Access Token.
UserSchema.methods.getSignedRefreshToken = function({ sm = 'multi', sv = 0, durationDays = 547 } = {}) {
  return jwt.sign(
    { id: this._id, sm, sv },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: `${durationDays}d` }
  );
};

// ── Password comparison ───────────────────────────────────────────────────────
// Returns false (never throws) when the user has no password — i.e. a pure
// Google-OAuth account that hasn't set one yet. This prevents bcrypt from
// throwing on undefined and lets the login controller return a normal 401.
UserSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);