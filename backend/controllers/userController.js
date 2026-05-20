const User    = require('../models/User');
const XLSX    = require('xlsx');
const { validationResult } = require('express-validator');
const dashboardCache = require('../utils/dashboardCache');
const { buildUserFilter } = require('../utils/userFilter');

// Optional student profile fields shared across createUser / updateUser /
// updateProfile / register. All are optional + trimmed; empty strings clear
// the field, allowing users to remove a previously-set value via the form.
const OPTIONAL_PROFILE_FIELDS = [
  'fatherName',
  'province',
  'district',
  'studentClass',
  'studentStatus',
  'fscCollegeName',
  'fscBoard',
];

// Pull only known profile fields from a request body. Trims strings; passes
// undefined through so callers can distinguish "not provided" (skip) from
// "" (explicit clear).
const pickProfileFields = (body = {}) => {
  const out = {};
  for (const f of OPTIONAL_PROFILE_FIELDS) {
    if (body[f] === undefined) continue;
    out[f] = typeof body[f] === 'string' ? body[f].trim() : body[f];
  }
  return out;
};

// ─── GET /api/users  (paginated + search + filters) ──────────────────────────
// Query params:
//   page, limit          — pagination (limit capped at 100)
//   search               — case-insensitive partial match on name/email/contact
//   role                 — exact match (student/teacher/admin)
//   province             — exact match against User.province
//   district             — case-insensitive partial match (lets admin type
//                          "kara" to find all Karachi sub-districts)
//   studentClass         — exact match (XI / XII / FSC Completed)
//   studentStatus        — exact match (Fresher / Repeater)
//   fscBoard             — case-insensitive partial match
// All filters AND-combine. Returned `total` reflects the filtered set.
exports.getUsers = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const skip   = (page - 1) * limit;

    const filter = buildUserFilter(req.query);

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data:        users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    console.error('getUsers error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── GET /api/users/:id ───────────────────────────────────────────────────────
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('getUser error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── POST /api/users ──────────────────────────────────────────────────────────
exports.createUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const { fullName, email, contactNumber, password, role } = req.body;
    const profile = pickProfileFields(req.body);

    if (await User.findOne({ email })) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const user = await User.create({
      fullName, email, contactNumber, password, role,
      createdByAdmin: true,
      ...profile,
    });
    // Admin dashboard cache is refreshed manually by admins — see dashboardController.
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    console.error('createUser error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── PUT /api/users/:id ───────────────────────────────────────────────────────
// Whitelist of fields admins are allowed to set via this endpoint. Everything
// else (sessionVersion, resetPasswordToken, lockUntil, loginAttempts, googleId,
// firstFailedAt, createdAt) is internal state and must never be set by the API.
const ADMIN_UPDATABLE_FIELDS = [
  'fullName', 'email', 'contactNumber', 'role', 'profilePicture',
  ...OPTIONAL_PROFILE_FIELDS,
];

exports.updateUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    let user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const updateData = {};
    for (const field of ADMIN_UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }
    const password = req.body.password;
    const hasPassword = password && password.trim();

    if (hasPassword) {
      // Use save() so the pre-save hashing hook runs.
      Object.assign(user, updateData);
      user.password = password;
      await user.save();
    } else if (Object.keys(updateData).length > 0) {
      user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('updateUser error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── DELETE /api/users/:id ────────────────────────────────────────────────────
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    await user.deleteOne();
    // Drop the deleted user's per-user cache; admin cache is refreshed manually.
    dashboardCache.invalidateUser(user._id);
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    console.error('deleteUser error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── POST /api/users/bulk-upload ─────────────────────────────────────────────
// Accepts multipart/form-data with field "file" (Excel .xlsx or .xls)
// Required columns: Name, Email, Password
// Optional columns: ContactNumber, Role (defaults to 'student')
exports.bulkUploadUsers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const rows     = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'Excel file is empty' });
    }

    const results  = { created: 0, skipped: 0, errors: [] };
    const VALID_ROLES = ['student', 'teacher', 'admin'];

    for (let i = 0; i < rows.length; i++) {
      const row  = rows[i];
      const rowNum = i + 2; // +2 because row 1 is the header

      // Normalise column names (case-insensitive, strip spaces)
      const name    = String(row['Name']          || row['name']          || row['Full Name']    || row['FullName']    || '').trim();
      const email   = String(row['Email']         || row['email']         || '').trim().toLowerCase();
      const password = String(row['Password']     || row['password']      || '').trim();
      const contact = String(row['ContactNumber'] || row['Contact Number']|| row['contactNumber']|| row['contact']     || '').trim();
      const roleRaw = String(row['Role']          || row['role']          || 'student').trim().toLowerCase();

      // Validate required fields
      if (!name) {
        results.errors.push({ row: rowNum, email: email || '—', reason: 'Name is required' });
        results.skipped++;
        continue;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        results.errors.push({ row: rowNum, email: email || '—', reason: 'Invalid or missing email' });
        results.skipped++;
        continue;
      }
      if (!password || password.length < 6) {
        results.errors.push({ row: rowNum, email, reason: 'Password must be at least 6 characters' });
        results.skipped++;
        continue;
      }

      const role = VALID_ROLES.includes(roleRaw) ? roleRaw : 'student';
      const contactNumber = contact && /^\+?[0-9]{10,14}$/.test(contact) ? contact : undefined;

      // Check duplicate
      const exists = await User.findOne({ email });
      if (exists) {
        results.errors.push({ row: rowNum, email, reason: 'Email already registered' });
        results.skipped++;
        continue;
      }

      await User.create({ fullName: name, email, password, contactNumber, role, createdByAdmin: true });
      results.created++;
    }

    // Admin dashboard cache is refreshed manually by admins after a bulk upload.
    res.status(200).json({
      success: true,
      message: `${results.created} user(s) created, ${results.skipped} skipped`,
      ...results,
    });
  } catch (error) {
    console.error('bulkUploadUsers error:', error);
    res.status(500).json({ success: false, message: 'Failed to process Excel file' });
  }
};

// ─── PUT /api/users/profile (self-update) ────────────────────────────────────
// Password change requires the user's CURRENT password as proof — even if the
// JWT is valid (which it always is for an authenticated request), we don't
// want a stolen session to be able to swap the password and lock the owner
// out. We load the existing hash, compare, and only then accept the new one.
//
// Exception: Google-only accounts (signed in via OAuth, no local password
// set yet) can set a password without supplying "current" — there's nothing
// to verify against. After that, future changes require the current one.
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName, contactNumber, password, currentPassword, profilePicture } = req.body;
    const wantsPasswordChange = password && String(password).trim() !== '';

    // Load with the password hash only when we actually need to verify it.
    // Skipping +password on no-password updates keeps the projection lean.
    const user = wantsPasswordChange
      ? await User.findById(userId).select('+password')
      : await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (wantsPasswordChange) {
      // Verify the current password — but only if the user already has one.
      // Google-only accounts (no local password yet) skip the check.
      if (user.password) {
        if (!currentPassword || !String(currentPassword).trim()) {
          return res.status(400).json({
            success: false,
            field:   'currentPassword',
            message: 'Current password is required to change your password.',
          });
        }
        const matches = await user.matchPassword(currentPassword);
        if (!matches) {
          return res.status(401).json({
            success: false,
            field:   'currentPassword',
            message: 'Current password is incorrect.',
          });
        }
      }
      // Pre-save hook hashes the new password before persisting.
      user.password = password;
    }

    if (fullName)    user.fullName    = fullName;
    if (contactNumber) user.contactNumber = contactNumber;
    if (profilePicture !== undefined) user.profilePicture = profilePicture;

    // Optional student profile fields — empty string clears the field.
    const profile = pickProfileFields(req.body);
    for (const [k, v] of Object.entries(profile)) user[k] = v;

    await user.save();

    // Strip the password hash from the response so it never goes over the wire.
    const safe = user.toObject();
    delete safe.password;
    res.status(200).json({ success: true, data: safe });
  } catch (error) {
    console.error('updateProfile error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ─── Boot-time admin seed ─────────────────────────────────────────────────────
exports.createAdminUser = async () => {
  try {
    const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULLNAME, ADMIN_CONTACT } = process.env;
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      console.log('Admin env vars not set — skipping admin seed.');
      return;
    }
    if (await User.findOne({ email: ADMIN_EMAIL })) {
      console.log('Admin user already exists.');
      return;
    }
    const admin = await User.create({
      fullName:      ADMIN_FULLNAME || 'System Admin',
      email:         ADMIN_EMAIL,
      contactNumber: ADMIN_CONTACT || '+123456789',
      password:      ADMIN_PASSWORD,
      role:          'admin',
    });
    console.log(`Admin user created: ${admin.email}`);
  } catch (error) {
    console.error('Error creating admin user:', error.message);
  }
};
