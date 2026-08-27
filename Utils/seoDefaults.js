const DEFAULT_PAGES = [
  { label: 'Home', path: '/', metaTitle: 'Floriva Gifts', metaDescription: 'Send flowers and thoughtful gifts with Floriva Gifts.', robotsIndex: true },
  { label: 'Shop', path: '/shop', metaTitle: 'Shop gifts | Floriva Gifts', metaDescription: 'Browse flowers, hampers, and gifts from Floriva.', robotsIndex: true },
  { label: 'Blog', path: '/blog', metaTitle: 'Blog | Floriva Gifts', metaDescription: 'Gift ideas, flower care tips, and Floriva stories.', robotsIndex: true },
  { label: 'About', path: '/about', metaTitle: 'About us | Floriva Gifts', metaDescription: 'Learn about Floriva Gifts.', robotsIndex: true },
  { label: 'Contact', path: '/contact', metaTitle: 'Contact | Floriva Gifts', metaDescription: 'Get in touch with Floriva Gifts.', robotsIndex: true },
  { label: 'Cart', path: '/cart', metaTitle: 'Your cart | Floriva Gifts', metaDescription: '', robotsIndex: false },
  { label: 'Checkout', path: '/checkout', metaTitle: 'Checkout | Floriva Gifts', metaDescription: '', robotsIndex: false },
];

const getOrCreateSettings = async (SeoSettings) => {
  let doc = await SeoSettings.findOne({ singleton: 'main' });
  if (!doc) {
    doc = await SeoSettings.create({ singleton: 'main' });
  }
  return doc;
};

module.exports = { DEFAULT_PAGES, getOrCreateSettings };
