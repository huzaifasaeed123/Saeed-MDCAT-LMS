const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const resourceSchema = new Schema({
  type: { type: String, enum: ['test', 'notes', 'lecture', 'external'], required: true },
  title: { type: String, default: '' },
  // For type === 'test'
  testId: { type: Schema.Types.ObjectId, ref: 'Test', default: null },
  // For type === 'notes'
  fileUrl: { type: String, default: '' },
  fileName: { type: String, default: '' },
  // For type === 'lecture'
  youtubeUrl: { type: String, default: '' },
  // For type === 'external'
  externalUrl: { type: String, default: '' },
  // For type === 'lecture' (Google Drive video file ID) and type === 'notes' (Google Drive PDF/doc file ID)
  driveFileId: { type: String, default: '' },

  // ── External-test metadata (type === 'external' only) ─────────────────
  // External tests live OFF-platform — these fields are pure display
  // metadata that the student-side rich view renders next to the link.
  // None of them are enforced; the existing `availability` + `unlockAt`/
  // `lockAt` still govern actual access. Admin enters externalStartAt/
  // externalEndAt as informational strings shown alongside the test
  // details, separate from any access lock.
  externalMcqCount:    { type: Number, default: 0 },
  externalDurationMin: { type: Number, default: 0 },
  externalTestType:    { type: String, default: '' },
  externalStartAt:     { type: Date,   default: null },
  externalEndAt:       { type: Date,   default: null },
  // Syllabus shown on the student page — up to 5 subjects, each with a
  // free list of chapter names. Stored as embedded subdocs without their
  // own _id so admin edits don't need to round-trip ids back to the form.
  externalSyllabus: {
    type: [{
      _id:      false,
      subject:  { type: String, default: '' },
      chapters: { type: [String], default: [] },
    }],
    default: [],
  },

  // Scheduling: 'public' = always on, 'unlock_date' = visible after unlockAt, 'window' = only between unlockAt and lockAt
  availability: { type: String, enum: ['public', 'unlock_date', 'window'], default: 'public' },
  unlockAt: { type: Date, default: null },
  lockAt:   { type: Date, default: null },
  order: { type: Number, default: 0 },
});

const topicSchema = new Schema({
  title: { type: String, required: true },
  order: { type: Number, default: 0 },
  resources: [resourceSchema],
});

const chapterSchema = new Schema({
  title: { type: String, required: true },
  order: { type: Number, default: 0 },
  // When false: resources are attached directly to this chapter
  // When true: content is organized under topics
  useTopics: { type: Boolean, default: false },
  topics: [topicSchema],
  resources: [resourceSchema], // used when useTopics === false
});

const subjectSchema = new Schema({
  title: { type: String, required: true },
  order: { type: Number, default: 0 },
  // Date Mode fields — unlockAt controls when the whole entry becomes accessible
  unlockAt:     { type: Date,    default: null  },
  lockAt:       { type: Date,    default: null  },
  // Date Mode content: direct resources (useSubGroups=false) or chapters as sub-groups (useSubGroups=true)
  useSubGroups: { type: Boolean, default: false },
  resources:    [resourceSchema],
  chapters:     [chapterSchema],
});

const courseSchema = new Schema(
  {
    title:            { type: String,  required: true, trim: true },
    shortDescription: { type: String,  trim: true, default: '' },
    longDescription:  { type: String,  default: '' },
    featureImage:     { type: String,  default: '' },
    isPublic:         { type: Boolean, default: false },
    createdBy:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subjects:         [subjectSchema],
    // 'structure' = Subject→Chapter→Topic hierarchy; 'date' = Date-based entries
    displayMode:      { type: String, enum: ['structure', 'date'], default: 'structure' },
    // Custom labels for each level (empty string = use built-in default)
    nodeLabels: {
      level1: { type: String, default: '' },
      level2: { type: String, default: '' },
      level3: { type: String, default: '' },
    },
    // Student-side sort order for Date Mode
    contentSortOrder: { type: String, enum: ['upcoming_first', 'past_first'], default: 'upcoming_first' },

    // ── Admin metadata shown on student catalog cards ──────────────────────
    // Course schedule. Either or both may be null when the date is open-ended.
    // The frontend formats the visible "Duration" string from these.
    startDate:        { type: Date,    default: null },
    endDate:          { type: Date,    default: null },
    // Free-form tag for the target MDCAT year (e.g., "MDCAT 2026"). Admins
    // can leave it blank; cards only render the badge when it's set.
    mdcatYear:        { type: String,  trim: true, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Course', courseSchema);
