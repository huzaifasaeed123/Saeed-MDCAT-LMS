const mongoose = require('mongoose');

const NoteFolderSchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true, maxlength: 200 },
  parent:        { type: mongoose.Schema.Types.ObjectId, ref: 'NoteFolder', default: null },
  section:       { type: String, enum: ['notes', 'videos'], default: 'notes' },
  driveFolderId: { type: String, default: null },
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

NoteFolderSchema.index({ parent: 1, section: 1, name: 1 });
NoteFolderSchema.index({ driveFolderId: 1 });

module.exports = mongoose.model('NoteFolder', NoteFolderSchema);
