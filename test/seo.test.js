const test = require('node:test');
const assert = require('node:assert/strict');
const { slugify, normalizePath, ensureUniqueSlug } = require('../Utils/slug');
const { buildSitemapXml, buildRobotsTxt, joinUrl } = require('../Utils/seoXml');

test('slugify creates SEO-friendly URLs', () => {
  assert.equal(slugify('Red Rose Bouquet'), 'red-rose-bouquet');
  assert.equal(slugify('  Gift Hamper!!!  '), 'gift-hamper');
  assert.equal(slugify(''), 'item');
});

test('normalizePath keeps a single leading slash', () => {
  assert.equal(normalizePath('about-us'), '/about-us');
  assert.equal(normalizePath('/blog/my-post/'), '/blog/my-post');
  assert.equal(normalizePath(''), '/');
  assert.equal(normalizePath('//shop//gifts'), '/shop/gifts');
});

test('joinUrl concatenates site origin and path', () => {
  assert.equal(joinUrl('https://www.florivagifts.com', '/blog/hello'), 'https://www.florivagifts.com/blog/hello');
  assert.equal(joinUrl('https://www.florivagifts.com/', '/'), 'https://www.florivagifts.com/');
});

test('sitemap XML includes loc and lastmod', () => {
  const xml = buildSitemapXml({
    siteUrl: 'https://www.florivagifts.com',
    urls: [{ loc: '/about', lastmod: '2026-08-27', priority: '0.8', changefreq: 'weekly' }],
  });
  assert.match(xml, /<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
  assert.match(xml, /<loc>https:\/\/www.florivagifts.com\/about<\/loc>/);
  assert.match(xml, /<lastmod>2026-08-27<\/lastmod>/);
});

test('robots.txt includes sitemap and disallow rules', () => {
  const txt = buildRobotsTxt({
    siteUrl: 'https://www.florivagifts.com',
    extraRules: 'Disallow: /admin',
  });
  assert.match(txt, /User-agent: \*/);
  assert.match(txt, /Disallow: \/checkout/);
  assert.match(txt, /Disallow: \/admin/);
  assert.match(txt, /Sitemap: https:\/\/www.florivagifts.com\/sitemap.xml/);
});

test('SEO CMS HTML loads scripts from an absolute /seo-cms path', () => {
  const html = require('fs').readFileSync(require('path').join(__dirname, '../public/seo-cms/index.html'), 'utf8');
  assert.match(html, /action="\/api\/admin\/login"/);
  assert.match(html, /src="\/seo-cms\/app\.js\?v=8"/);
  assert.match(html, /href="\/seo-cms\/styles\.css"/);
});

test('CORS allows Floriva hosts and does not throw on unknown origins', () => {
  const { isAllowedOrigin } = require('../Middlewares/security');
  assert.equal(isAllowedOrigin('https://api.florivagifts.com'), true);
  assert.equal(isAllowedOrigin('https://www.florivagifts.com'), true);
  assert.equal(isAllowedOrigin('https://evil.example'), false);
});

test('ensureUniqueSlug increments when taken', async () => {
  const taken = new Set(['roses', 'roses-2']);
  const Model = {
    exists: async (query) => taken.has(query.slug),
  };
  const slug = await ensureUniqueSlug(Model, 'Roses');
  assert.equal(slug, 'roses-3');
});
