const mongoose = require('mongoose');
const { Schema } = mongoose;

const subCategorySchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    }
}, { _id: true });

const categorySchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    categoriesimg: {
        type: String,   // URL or path to the category image
        trim: true
    },
    subCategories: [subCategorySchema],
    slug: {
        type: String,
        trim: true,
        lowercase: true,
    },
    metaTitle: {
        type: String,
        default: '',
        trim: true,
    },
    metaDescription: {
        type: String,
        default: '',
        trim: true,
    },
    robotsIndex: {
        type: Boolean,
        default: true,
    },
}, { timestamps: true });

categorySchema.index({ slug: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Category', categorySchema);
