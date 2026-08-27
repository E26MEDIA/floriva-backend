const ALIGNMENTS = ['left', 'center', 'right', 'full', 'none'];
const SIZES = ['small', 'medium', 'large', 'full'];

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const normalizeAlign = (value) => {
  const align = String(value || 'none').toLowerCase();
  return ALIGNMENTS.includes(align) ? align : 'none';
};

const normalizeSize = (value) => {
  const size = String(value || 'large').toLowerCase();
  return SIZES.includes(size) ? size : 'large';
};

const wpAlignClass = (align) => {
  if (align === 'full') return 'alignfull';
  if (align === 'none') return 'alignnone';
  return `align${align}`;
};

const wpSizeClass = (size) => `size-${size}`;

/**
 * WordPress-style figure HTML so the storefront can float/center images
 * the same way WP does (alignleft / aligncenter / alignright / alignfull).
 */
const buildBlogImageHtml = ({ url, alt = '', caption = '', align = 'none', size = 'large' }) => {
  if (!url) {
    throw new Error('Image URL is required');
  }
  const safeAlign = normalizeAlign(align);
  const safeSize = normalizeSize(size);
  const classes = ['wp-caption', 'wp-block-image', wpAlignClass(safeAlign), wpSizeClass(safeSize)].join(' ');
  const captionHtml = caption
    ? `\n  <figcaption class="wp-caption-text">${escapeHtml(caption)}</figcaption>`
    : '';
  return `<figure class="${classes}">
  <img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" />${captionHtml}
</figure>`;
};

module.exports = {
  ALIGNMENTS,
  SIZES,
  escapeHtml,
  normalizeAlign,
  normalizeSize,
  buildBlogImageHtml,
};
