const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const topicSchema = new Schema({
  title: { type: String, required: true, trim: true },
  order: { type: Number, default: 0 },
}, { _id: true });

const chapterSchema = new Schema({
  title: { type: String, required: true, trim: true },
  order: { type: Number, default: 0 },
  topics: [topicSchema],
}, { _id: true });

const subjectSchema = new Schema({
  title: { type: String, required: true, trim: true },
  order: { type: Number, default: 0 },
  chapters: [chapterSchema],
}, { _id: true });

const questionBankSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  // Access control:
  //   public → visible to students, teachers, admins (students can auto-generate tests)
  //   staff  → visible to teachers + admins only (hidden from students)
  //   draft  → visible to admins only (work-in-progress / template)
  // Existing docs without this field default to 'public' so prior behaviour is preserved.
  visibility: { type: String, enum: ['public', 'staff', 'draft'], default: 'public', index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  subjects: [subjectSchema],
}, { timestamps: true });

module.exports = mongoose.model('QuestionBank', questionBankSchema);
