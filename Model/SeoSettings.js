const mongoose = require('mongoose');

const seoSettingsSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'main', unique: true },
    siteUrl: { type: String, default: 'https://www.florivagifts.com' },
    defaultMetaTitle: { type: String, default: 'Floriva Gifts' },
    defaultMetaDescription: {
      type: String,
      default: 'Send flowers and thoughtful gifts with Floriva Gifts.',
    },
    productPathPrefix: { type: String, default: '/product' },
    categoryPathPrefix: { type: String, default: '/category' },
    blogPathPrefix: { type: String, default: '/blog' },
    robotsExtra: { type: String, default: '' },
    notFoundTitle: { type: String, default: 'Page not found' },
    notFoundBody: {
      type: String,
      default:
        'Sorry, this page does not exist. Use the menu to continue shopping or return home.',
    },
    google: {
      ga4MeasurementId: { type: String, default: '' },
      gtmContainerId: { type: String, default: '' },
      searchConsoleMetaTag: { type: String, default: '' },
      searchConsoleHtmlFilename: { type: String, default: '' },
      searchConsoleHtmlContent: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SeoSettings', seoSettingsSchema);
