const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildBlogImageHtml,
  normalizeAlign,
  normalizeSize,
} = require('../Utils/blogImageHtml');

test('normalizeAlign falls back to none', () => {
  assert.equal(normalizeAlign('left'), 'left');
  assert.equal(normalizeAlign('FULL'), 'full');
  assert.equal(normalizeAlign('sideways'), 'none');
});

test('normalizeSize falls back to large', () => {
  assert.equal(normalizeSize('small'), 'small');
  assert.equal(normalizeSize('huge'), 'large');
});

test('buildBlogImageHtml uses WordPress alignment classes', () => {
  const html = buildBlogImageHtml({
    url: '/uploads/blog/roses.jpg',
    alt: 'Red roses',
    caption: 'A bouquet',
    align: 'left',
    size: 'medium',
  });
  assert.match(html, /class="wp-caption wp-block-image alignleft size-medium"/);
  assert.match(html, /src="\/uploads\/blog\/roses.jpg"/);
  assert.match(html, /alt="Red roses"/);
  assert.match(html, /<figcaption class="wp-caption-text">A bouquet<\/figcaption>/);
});

test('buildBlogImageHtml escapes HTML in alt and caption', () => {
  const html = buildBlogImageHtml({
    url: '/uploads/blog/x.jpg',
    alt: 'A "gift" <script>',
    caption: '<b>bold</b>',
    align: 'center',
    size: 'full',
  });
  assert.match(html, /alt="A &quot;gift&quot; &lt;script&gt;"/);
  assert.match(html, /&lt;b&gt;bold&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
