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
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  subjects: [subjectSchema],
}, { timestamps: true });

module.exports = mongoose.model('QuestionBank', questionBankSchema);
