# Legacy Portal Migration

One-shot importer that pulls everything from the legacy SQLite `portal.db`
into the current MongoDB.

## What gets migrated

| # | Phase | Source table | → Target collection | Approx rows |
|---|---|---|---|---|
| 1 | Users | `users` | `users` | ~1,700 |
| 2 | QB structure | derived from `mcq_questions` | `questionbanks` | 1 doc (5 subjects, ~70 chapters, ~460 topics) |
| 3 | MCQs | `mcq_questions` (active) | `mcqs` | ~21,100 (23 broken-image skipped) |
| 4 | Saved questions | `mcq_marks` | `savedquestions` | ~17,800 |
| 5 | MCQ reports | `mcq_reports` | `mcqreports` | ~1,000 |
| 6 | Per-MCQ history | `mcq_attempts` (collapsed) | `usermcqhistories` | ~600,000 (powers the AutoTestGenerator Used/Unused/Correct/etc. filter) |
| 7 | User-built tests | `qbank_sessions` + `mcq_attempts` join | `tests` + `usertestattempts` | ~20,800 of each |
| 8 | Community | `posts`, `comments`, `comment_helpful` | `posts`, `replies` | ~1,250 + ~2,900 |

## What is NOT migrated (by design)

- **Admin-created `tests_v2`** — not requested
- **`direct_messages`** — not in this pass
- **`user_notifications`** — not requested
- **Leaderboard / streaks / `points`** — recomputed by the server
- **Flash cards / squads / loot boxes** — features removed in new portal

## Prerequisites

1. **Install the SQLite reader** in the backend folder:
   ```bash
   cd backend
   npm install better-sqlite3
   ```
   (`package.json` already lists it — `npm install` once will do this.)

2. **Upload `portal.db` to the server.** Pick any path the backend container
   can read; we recommend the persistent uploads volume:
   - Local: `backend/uploads/migration/portal.db`
   - Inside Coolify container: `/app/uploads/migration/portal.db`

3. **Copy the legacy `uploads/` folder contents into `backend/uploads/`.**
   Post image URLs are stored as `/uploads/<uuid>.<ext>` exactly as they were
   on the old portal — when you copy the legacy upload files into the new
   portal's `backend/uploads/` folder, every post image just works (the
   express static middleware serves any file at that path).

4. **The backend server must have booted at least once** so the seed admin
   user (`admin@sknmdcat.com`) exists — the QB needs an admin to attribute to.

## How to run

From inside the Coolify Terminal of `skn-backend`:

```bash
# Dry run first — reads the SQLite, builds in-memory data, validates everything,
# but writes NOTHING to Mongo. Useful to see expected counts and catch issues.
node migrations/import-legacy.js /app/uploads/migration/portal.db --dry-run

# Real run — writes to Mongo. Takes ~10–15 minutes for ~700k inserts.
node migrations/import-legacy.js /app/uploads/migration/portal.db
```

You'll see live progress lines like:
```
[migrate] PHASE 3 — MCQs
[migrate]   legacy active MCQs: 21,148
[migrate]   skipped: 23 broken-image · 0 no-options · 0 no-lookup
  mcqs: 21,125 / 21,125
[migrate] PHASE 6 — UserMcqHistory (collapses legacy mcq_attempts)
  scanned 750,000 attempts
[migrate]   scanned 772,000 attempts · collapsed into 598,432 (user,mcq) pairs
  usermcqhistories: 598,432 / 598,432
```

## Idempotency

The script writes a marker doc in `migration_markers` when it finishes. A second
run aborts immediately with a clear message. **Pass `--force` only if you intend
to create duplicate documents** — the script does not attempt to dedupe a
re-run; it inserts blindly. Safer to drop the affected collections first if you
need to redo.

```bash
node migrations/import-legacy.js /app/uploads/migration/portal.db --force
```

## What to expect after success

Open the new portal and verify:

| Area | What should be visible |
|---|---|
| Login | Every legacy user logs in with their legacy email + password (bcrypt hashes carry over) |
| AutoTestGenerator | Correct "Unused / Used / Correct / Incorrect / Marked" counts for every student |
| Test History | All legacy QB practice sessions appear as test attempts |
| Question Bank admin | `SKN MDCAT Bank` with 5 subjects, ~70 chapters, ~460 topics |
| Community feed | All 1,200+ posts with images, voting, replies, best-answer marks |
| Saved Questions | Each user's bookmarked MCQs |
| MCQ Reports (admin) | All 1,000+ open reports |

## Troubleshooting

- **`better-sqlite3` install fails** → it needs build tools. On Alpine (Coolify
  default) run: `apk add --no-cache python3 make g++` then `npm install better-sqlite3`.
- **"Already imported" abort** → expected on second run. Use `--force` or drop
  the docs first.
- **Page-scan warnings on `mcq_attempts`** → expected, the legacy DB has page
  corruption. The script logs the count of pages skipped at the end.
- **Posts with broken images** → confirm legacy `uploads/` content was copied
  into `backend/uploads/` (not `backend/uploads/images/`).
