const mongoose = require('mongoose');

const seoPageSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    path: { type: String, required: true, unique: true, trim: true },
    metaTitle: { type: String, default: '', trim: true },
    metaDescription: { type: String, default: '', trim: true },
    robotsIndex: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

seoPageSchema.index({ path: 1 });

module.exports = mongoose.model('SeoPage', seoPageSchema);
