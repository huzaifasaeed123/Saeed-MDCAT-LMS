const User    = require('../models/User');
const XLSX    = require('xlsx');
const { validationResult } = require('express-validator');

// ─── GET /api/users  (paginated + search + filter) ───────────────────────────
// Query params: page, limit, search (matches name OR email), role
exports.getUsers = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const skip   = (page - 1) * limit;
    const role   = req.query.role;   // 'student' | 'teacher' | 'admin' | undefined
    const search = req.query.search?.trim();

    const filter = {};
    if (role && ['student', 'teacher', 'admin'].includes(role)) {
      filter.role = role;
    }
    if (search) {
      filter.$or = [
        { fullName:     { $regex: search, $options: 'i' } },
        { email:        { $regex: search, $options: 'i' } },
        { contactNumber:{ $regex: search, $options: 'i' } },
      ];
    }

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
      totalPages: Math.ceil(total / limit),
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

    if (await User.findOne({ email })) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const user = await User.create({ fullName, email, contactNumber, password, role });
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
const ADMIN_UPDATABLE_FIELDS = ['fullName', 'email', 'contactNumber', 'role', 'profilePicture'];

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

      await User.create({ fullName: name, email, password, contactNumber, role });
      results.created++;
    }

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
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName, contactNumber, password, profilePicture } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (fullName)    user.fullName    = fullName;
    if (contactNumber) user.contactNumber = contactNumber;
    if (profilePicture !== undefined) user.profilePicture = profilePicture;
    if (password && password.trim()) user.password = password;

    await user.save();
    res.status(200).json({ success: true, data: user });
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
