const mongoose = require('mongoose');

const NoteFileSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 300 },
  folder:      { type: mongoose.Schema.Types.ObjectId, ref: 'NoteFolder', default: null },
  section:     { type: String, enum: ['notes', 'videos'], default: 'notes' },
  driveFileId: { type: String, required: true },
  mimeType:    { type: String, default: 'application/pdf' },
  isProtected: { type: Boolean, default: false },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

NoteFileSchema.index({ folder: 1, section: 1, name: 1 });
NoteFileSchema.index({ driveFileId: 1 });

module.exports = mongoose.model('NoteFile', NoteFileSchema);
