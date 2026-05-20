// Shared Mongo query builder for the admin "Users" page.
// Both GET /users and PATCH /users/access/bulk derive their query from this
// helper, so the filter pills the admin sees in the UI map 1:1 to the rows
// affected by bulk actions.
//
// All filters AND-combine. Empty / undefined values are silently skipped so
// the frontend can send the current form state without conditionals.

// "Self-signup" matches only docs where the flag is explicitly false. Legacy
// docs (no flag) are NOT counted as self-signups — we have no way to prove
// they registered themselves, so they're classified as admin-created. The
// post-import-fixes script can stamp them with the explicit value.
// "Admin-created" intentionally includes legacy docs with the field missing.
const SIGNUP_SELF_CLAUSE  = { createdByAdmin: false };
const SIGNUP_ADMIN_CLAUSE = { $or: [{ createdByAdmin: true  }, { createdByAdmin: { $exists: false } }] };

const buildUserFilter = (q = {}) => {
  const filter = {};

  // ── Role
  if (q.role && ['student', 'teacher', 'admin'].includes(q.role)) {
    filter.role = q.role;
  }

  // ── Free-text search across name / email / contact
  const search = typeof q.search === 'string' ? q.search.trim() : '';
  if (search) {
    filter.$or = [
      { fullName:      { $regex: search, $options: 'i' } },
      { email:         { $regex: search, $options: 'i' } },
      { contactNumber: { $regex: search, $options: 'i' } },
    ];
  }

  // ── Profile-field filters
  const eqIfSet = (key, val) => {
    if (typeof val === 'string' && val.trim() !== '') filter[key] = val.trim();
  };
  const regexIfSet = (key, val) => {
    if (typeof val === 'string' && val.trim() !== '') {
      filter[key] = { $regex: val.trim(), $options: 'i' };
    }
  };
  eqIfSet('province',       q.province);
  eqIfSet('studentClass',   q.studentClass);
  eqIfSet('studentStatus',  q.studentStatus);
  regexIfSet('district',    q.district);
  regexIfSet('fscBoard',    q.fscBoard);

  // ── Date range on createdAt (registration date). Inclusive end-of-day.
  if (q.dateFrom || q.dateTo) {
    filter.createdAt = {};
    if (q.dateFrom) {
      const d = new Date(q.dateFrom);
      if (!isNaN(d)) filter.createdAt.$gte = d;
    }
    if (q.dateTo) {
      const d = new Date(q.dateTo);
      if (!isNaN(d)) {
        d.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = d;
      }
    }
    if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
  }

  // ── Signup source
  // Legacy docs (no `createdByAdmin` field) count as ADMIN-created — see the
  // ADMIN_CLAUSE comment above. When search is also active we collapse both
  // $or clauses into $and so both survive.
  const wantsAdmin = q.createdByAdmin === 'true' || q.signupSource === 'admin';
  const wantsSelf  = q.createdByAdmin === 'false' || q.signupSource === 'self';
  if (wantsAdmin) {
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, SIGNUP_ADMIN_CLAUSE];
      delete filter.$or;
    } else {
      Object.assign(filter, SIGNUP_ADMIN_CLAUSE);
    }
  } else if (wantsSelf) {
    Object.assign(filter, SIGNUP_SELF_CLAUSE);
  }

  return filter;
};

module.exports = { buildUserFilter };
