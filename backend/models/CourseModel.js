const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const resourceSchema = new Schema({
  type: { type: String, enum: ['test', 'notes', 'lecture'], required: true },
  title: { type: String, default: '' },
  // For type === 'test'
  testId: { type: Schema.Types.ObjectId, ref: 'Test', default: null },
  // For type === 'notes'
  fileUrl: { type: String, default: '' },
  fileName: { type: String, default: '' },
  // For type === 'lecture'
  youtubeUrl: { type: String, default: '' },
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
  chapters: [chapterSchema],
});

const courseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    shortDescription: { type: String, trim: true, default: '' },
    longDescription: { type: String, default: '' },
    featureImage: { type: String, default: '' },
    isPublic: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subjects: [subjectSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Course', courseSchema);
