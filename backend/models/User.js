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

  // ── Optional student profile fields ────────────────────────────────────────
  // All optional. Teachers/admins typically leave them blank. Enum values are
  // enforced only when a value is present (empty string / undefined passes).
  // Used by the Profile page, admin user views, and test result Excel exports.
  fatherName:     { type: String, trim: true, maxlength: 50 },
  province:       {
    type: String,
    enum: {
      values: ['', 'Punjab', 'KPK', 'Sindh', 'Balochistan', 'AJK', 'Gilgit Baltistan'],
      message: 'Invalid province',
    },
    default: '',
  },
  district:       { type: String, trim: true, maxlength: 50 },
  studentClass:   {
    type: String,
    enum: {
      values: ['', 'XI', 'XII', 'FSC Completed'],
      message: 'Invalid class',
    },
    default: '',
  },
  studentStatus:  {
    type: String,
    enum: {
      values: ['', 'Fresher', 'Repeater'],
      message: 'Invalid status',
    },
    default: '',
  },
  fscCollegeName: { type: String, trim: true, maxlength: 100 },
  fscBoard:       { type: String, trim: true, maxlength: 100 },

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

  // ── Feature access flags ─────────────────────────────────────────────────
  // Per-student gating of paid features. ALL default to false — admin must
  // explicitly grant access. Staff (admin/teacher) bypass these checks in the
  // featureGate middleware. Read at request-time from userAccessCache (10-min
  // TTL, eager-invalidated on admin write) so the hot path never hits the DB.
  // Courses are NOT in this map — they have a richer model below.
  featureAccess: {
    autoTest:  { type: Boolean, default: false }, // Create Auto Test (practice generator)
    community: { type: Boolean, default: false }, // Community discussion board
    videos:    { type: Boolean, default: false }, // Videos library
    notes:     { type: Boolean, default: false }, // Notes / PDF library
  },

  // Course access model — two ways to grant:
  //   1. coursesGrantAll === true → student can open EVERY course (existing
  //      and future) and the courseAccess array is ignored entirely.
  //   2. coursesGrantAll === false → student can open only courses listed in
  //      courseAccess.
  // "Has courses feature" is derived: coursesGrantAll OR courseAccess.length > 0.
  // There is no separate "master toggle" — keeping a flag in sync with this
  // derived state caused bugs and admin confusion.
  coursesGrantAll: { type: Boolean, default: false },
  courseAccess:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],

  // True iff this account was created by an admin (via "Add User" form or bulk
  // upload). False for users who registered themselves (email/password or
  // Google OAuth). Used by the Users page filter and to decide whether the
  // "default access" preset applies on signup.
  createdByAdmin: { type: Boolean, default: false, index: true },

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