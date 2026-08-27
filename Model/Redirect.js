const mongoose = require('mongoose');

const redirectSchema = new mongoose.Schema(
  {
    fromPath: { type: String, required: true, unique: true, trim: true },
    toPath: { type: String, required: true, trim: true },
    statusCode: { type: Number, enum: [301, 302], default: 301 },
    isActive: { type: Boolean, default: true },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

redirectSchema.index({ fromPath: 1, isActive: 1 });

module.exports = mongoose.model('Redirect', redirectSchema);
