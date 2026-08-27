const Admin = require('../Model/Admin');
const SeoPage = require('../Model/SeoPage');
const BlogPost = require('../Model/BlogPost');
const Product = require('../Model/Product');
const Redirect = require('../Model/Redirect');
const SeoSettings = require('../Model/SeoSettings');
const { getOrCreateSettings } = require('../Utils/seoDefaults');
const { slugify, ensureUniqueSlug, normalizePath } = require('../Utils/slug');

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const layout = (title, body) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <style>
    body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#f7f3ee;color:#1e1610}
    a{color:#b5623b}
    .wrap{max-width:980px;margin:0 auto;padding:24px 16px 64px}
    .card{background:#fff;border:1px solid #eadfd4;border-radius:16px;padding:20px;margin:12px 0}
    .nav a{margin-right:12px;font-weight:700;text-decoration:none}
    label{display:block;margin:10px 0;font-weight:700;font-size:13px}
    input,textarea,select{width:100%;margin-top:6px;padding:8px;border:1px solid #eadfd4;border-radius:8px;box-sizing:border-box;font:inherit}
    textarea{min-height:90px}
    button{background:#b5623b;color:#fff;border:0;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer}
    .error{color:#b42318}
    .ok{color:#17633a}
    h1{margin:0 0 8px}
  </style>
</head>
<body><div class="wrap">${body}</div></body>
</html>`;

const nav = (name) => `
  <div class="card nav">
    <strong>${esc(name)}</strong> ·
    <a href="/api/cms/home">Home</a>
    <a href="/api/cms/pages">Pages</a>
    <a href="/api/cms/blog">Blog</a>
    <a href="/api/cms/products">Products</a>
    <a href="/api/cms/redirects">Redirects</a>
    <a href="/api/cms/technical">Technical</a>
    <a href="/api/cms/google">Google</a>
    <a href="/api/cms/logout">Sign out</a>
  </div>
`;

exports.requireCms = (req, res, next) => {
  if (!req.session?.adminId) {
    return res.redirect('/api/cms?error=' + encodeURIComponent('Please sign in'));
  }
  next();
};

exports.loginPage = (req, res) => {
  if (req.session?.adminId) return res.redirect('/api/cms/home');
  const error = req.query.error || '';
  res.set('Cache-Control', 'no-store');
  res.type('html').send(
    layout(
      'SEO CMS sign in',
      `<div class="card" style="max-width:420px;margin:48px auto">
        <p style="color:#b5623b;font-weight:700;letter-spacing:.08em">FLORIVA GIFTS</p>
        <h1>SEO CMS</h1>
        <p>Use the same username and password as admin.florivagifts.com.</p>
        ${error ? `<p class="error">${esc(error)}</p>` : ''}
        <form method="post" action="/api/cms/login">
          <label>Username <input name="username" autocomplete="username" required></label>
          <label>Password <input name="password" type="password" autocomplete="current-password" required></label>
          <button type="submit">Sign in</button>
        </form>
      </div>`
    )
  );
};

exports.login = async (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!username || !password) {
      return res.redirect('/api/cms?error=' + encodeURIComponent('Username and password are required'));
    }
    const admin = await Admin.findOne({ username }).select('+password');
    if (!admin || !(await admin.comparePassword(password))) {
      return res.redirect('/api/cms?error=' + encodeURIComponent('Invalid username or password'));
    }
    req.session.adminId = String(admin._id);
    req.session.adminName = admin.username;
    req.session.save((err) => {
      if (err) {
        console.error('CMS session save failed', err);
        return res.redirect('/api/cms?error=' + encodeURIComponent('Could not start session'));
      }
      return res.redirect(302, '/api/cms/home');
    });
  } catch (error) {
    console.error('CMS login failed', error);
    return res.redirect('/api/cms?error=' + encodeURIComponent(error.message || 'Login failed'));
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/api/cms');
  });
};

exports.home = (req, res) => {
  res.type('html').send(
    layout(
      'SEO CMS',
      `${nav(req.session.adminName)}
      <div class="card">
        <h1>SEO &amp; Blog CMS</h1>
        <p>You are signed in. Use the links above. No extra website code is needed for these edits.</p>
      </div>`
    )
  );
};

exports.pages = async (req, res) => {
  const pages = await SeoPage.find().sort({ path: 1 });
  const rows = pages
    .map(
      (page) => `
      <form class="card" method="post" action="/api/cms/pages/${page._id}">
        <h3>${esc(page.label)} <small>${esc(page.path)}</small></h3>
        <label>Name <input name="label" value="${esc(page.label)}"></label>
        <label>URL <input name="path" value="${esc(page.path)}"></label>
        <label>Meta title <input name="metaTitle" value="${esc(page.metaTitle)}"></label>
        <label>Meta description <textarea name="metaDescription">${esc(page.metaDescription)}</textarea></label>
        <label><input type="checkbox" name="robotsIndex" ${page.robotsIndex ? 'checked' : ''}> Index this page</label>
        <button type="submit">Save page</button>
      </form>`
    )
    .join('');
  res.type('html').send(
    layout(
      'Page SEO',
      `${nav(req.session.adminName)}
      <h1>Page SEO</h1>
      ${req.query.ok ? '<p class="ok">Saved.</p>' : ''}
      <form class="card" method="post" action="/api/cms/pages">
        <h3>Add page</h3>
        <label>Name <input name="label" required></label>
        <label>URL <input name="path" value="/" required></label>
        <label>Meta title <input name="metaTitle"></label>
        <label>Meta description <textarea name="metaDescription"></textarea></label>
        <label><input type="checkbox" name="robotsIndex" checked> Index this page</label>
        <button type="submit">Add page</button>
      </form>
      ${rows}`
    )
  );
};

exports.createPage = async (req, res) => {
  await SeoPage.create({
    label: req.body.label,
    path: normalizePath(req.body.path),
    metaTitle: req.body.metaTitle || '',
    metaDescription: req.body.metaDescription || '',
    robotsIndex: req.body.robotsIndex === 'on',
  });
  res.redirect('/api/cms/pages?ok=1');
};

exports.updatePage = async (req, res) => {
  const page = await SeoPage.findById(req.params.id);
  if (!page) return res.redirect('/api/cms/pages?error=missing');
  page.label = req.body.label;
  page.path = normalizePath(req.body.path);
  page.metaTitle = req.body.metaTitle || '';
  page.metaDescription = req.body.metaDescription || '';
  page.robotsIndex = req.body.robotsIndex === 'on';
  await page.save();
  res.redirect('/api/cms/pages?ok=1');
};

exports.blog = async (req, res) => {
  const posts = await BlogPost.find().sort({ updatedAt: -1 });
  const rows = posts
    .map(
      (post) => `
      <form class="card" method="post" action="/api/cms/blog/${post._id}">
        <h3>${esc(post.title)} <small>${esc(post.status)}</small></h3>
        <label>Title <input name="title" value="${esc(post.title)}"></label>
        <label>URL slug <input name="slug" value="${esc(post.slug)}"></label>
        <label>Meta title <input name="metaTitle" value="${esc(post.metaTitle)}"></label>
        <label>Meta description <textarea name="metaDescription">${esc(post.metaDescription)}</textarea></label>
        <label>Content (HTML, use h1/h2/h3, img alt, and a href for links)
          <textarea name="content">${esc(post.content)}</textarea></label>
        <label>Status
          <select name="status">
            <option value="draft" ${post.status === 'draft' ? 'selected' : ''}>Draft</option>
            <option value="published" ${post.status === 'published' ? 'selected' : ''}>Published</option>
          </select>
        </label>
        <label>Featured image ALT <input name="featuredImageAlt" value="${esc(post.featuredImageAlt)}"></label>
        <label><input type="checkbox" name="robotsIndex" ${post.robotsIndex ? 'checked' : ''}> Index this post</label>
        <button type="submit">Save post</button>
      </form>`
    )
    .join('');
  res.type('html').send(
    layout(
      'Blog',
      `${nav(req.session.adminName)}
      <h1>Blog</h1>
      ${req.query.ok ? '<p class="ok">Saved.</p>' : ''}
      <form class="card" method="post" action="/api/cms/blog">
        <h3>New post</h3>
        <label>Title <input name="title" required></label>
        <label>URL slug <input name="slug" placeholder="optional"></label>
        <label>Meta title <input name="metaTitle"></label>
        <label>Meta description <textarea name="metaDescription"></textarea></label>
        <label>Content <textarea name="content" placeholder="<h1>Title</h1><h2>Section</h2><p>Text with <a href='/'>internal link</a></p>"></textarea></label>
        <label>Status
          <select name="status">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <button type="submit">Create post</button>
      </form>
      ${rows}`
    )
  );
};

exports.createPost = async (req, res) => {
  const post = new BlogPost({ title: req.body.title || 'Untitled' });
  post.slug = await ensureUniqueSlug(BlogPost, req.body.slug || post.title, post._id);
  post.metaTitle = req.body.metaTitle || '';
  post.metaDescription = req.body.metaDescription || '';
  post.content = req.body.content || '';
  post.status = req.body.status === 'published' ? 'published' : 'draft';
  if (post.status === 'published') post.publishedAt = new Date();
  post.robotsIndex = req.body.robotsIndex !== 'off';
  await post.save();
  res.redirect('/api/cms/blog?ok=1');
};

exports.updatePost = async (req, res) => {
  const post = await BlogPost.findById(req.params.id);
  if (!post) return res.redirect('/api/cms/blog');
  post.title = req.body.title;
  post.slug = await ensureUniqueSlug(BlogPost, req.body.slug || post.title, post._id);
  post.metaTitle = req.body.metaTitle || '';
  post.metaDescription = req.body.metaDescription || '';
  post.content = req.body.content || '';
  post.featuredImageAlt = req.body.featuredImageAlt || '';
  post.status = req.body.status === 'published' ? 'published' : 'draft';
  if (post.status === 'published' && !post.publishedAt) post.publishedAt = new Date();
  post.robotsIndex = req.body.robotsIndex === 'on';
  await post.save();
  res.redirect('/api/cms/blog?ok=1');
};

exports.products = async (req, res) => {
  const products = await Product.find().select('name title description slug metaTitle metaDescription imageAlts robotsIndex').sort({ name: 1 });
  const rows = products
    .map(
      (product) => `
      <form class="card" method="post" action="/api/cms/products/${product._id}">
        <h3>${esc(product.name)}</h3>
        <label>Title <input name="title" value="${esc(product.title)}"></label>
        <label>Description <textarea name="description">${esc(product.description)}</textarea></label>
        <label>URL slug <input name="slug" value="${esc(product.slug || slugify(product.name))}"></label>
        <label>Meta title <input name="metaTitle" value="${esc(product.metaTitle)}"></label>
        <label>Meta description <textarea name="metaDescription">${esc(product.metaDescription)}</textarea></label>
        <label>Image ALT text (comma separated) <input name="imageAlts" value="${esc((product.imageAlts || []).join(', '))}"></label>
        <label><input type="checkbox" name="robotsIndex" ${product.robotsIndex !== false ? 'checked' : ''}> Index this product</label>
        <button type="submit">Save product SEO</button>
      </form>`
    )
    .join('');
  res.type('html').send(
    layout(
      'Product SEO',
      `${nav(req.session.adminName)}<h1>Product SEO</h1>${req.query.ok ? '<p class="ok">Saved.</p>' : ''}${rows || '<p>No products.</p>'}`
    )
  );
};

exports.updateProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.redirect('/api/cms/products');
  product.title = req.body.title;
  product.description = req.body.description;
  product.metaTitle = req.body.metaTitle || '';
  product.metaDescription = req.body.metaDescription || '';
  product.robotsIndex = req.body.robotsIndex === 'on';
  product.imageAlts = String(req.body.imageAlts || '')
    .split(',')
    .map((item) => item.trim());
  product.slug = await ensureUniqueSlug(Product, req.body.slug || product.name, product._id);
  await product.save();
  res.redirect('/api/cms/products?ok=1');
};

exports.redirects = async (req, res) => {
  const redirects = await Redirect.find().sort({ fromPath: 1 });
  const rows = redirects
    .map(
      (item) => `
      <form class="card" method="post" action="/api/cms/redirects/${item._id}">
        <label>From <input name="fromPath" value="${esc(item.fromPath)}"></label>
        <label>To <input name="toPath" value="${esc(item.toPath)}"></label>
        <label>Type
          <select name="statusCode">
            <option value="301" ${item.statusCode === 301 ? 'selected' : ''}>301</option>
            <option value="302" ${item.statusCode === 302 ? 'selected' : ''}>302</option>
          </select>
        </label>
        <button type="submit">Save</button>
      </form>`
    )
    .join('');
  res.type('html').send(
    layout(
      'Redirects',
      `${nav(req.session.adminName)}
      <h1>301 / 302 redirects</h1>
      ${req.query.ok ? '<p class="ok">Saved.</p>' : ''}
      <form class="card" method="post" action="/api/cms/redirects">
        <label>From URL <input name="fromPath" required></label>
        <label>To URL <input name="toPath" required></label>
        <button type="submit">Add redirect</button>
      </form>
      ${rows}`
    )
  );
};

exports.createRedirect = async (req, res) => {
  await Redirect.create({
    fromPath: normalizePath(req.body.fromPath),
    toPath: req.body.toPath.startsWith('http') ? req.body.toPath : normalizePath(req.body.toPath),
    statusCode: 301,
  });
  res.redirect('/api/cms/redirects?ok=1');
};

exports.updateRedirect = async (req, res) => {
  const item = await Redirect.findById(req.params.id);
  if (item) {
    item.fromPath = normalizePath(req.body.fromPath);
    item.toPath = req.body.toPath.startsWith('http') ? req.body.toPath : normalizePath(req.body.toPath);
    item.statusCode = Number(req.body.statusCode) === 302 ? 302 : 301;
    await item.save();
  }
  res.redirect('/api/cms/redirects?ok=1');
};

exports.technical = async (req, res) => {
  const settings = await getOrCreateSettings(SeoSettings);
  res.type('html').send(
    layout(
      'Technical SEO',
      `${nav(req.session.adminName)}
      <h1>Technical SEO</h1>
      ${req.query.ok ? '<p class="ok">Saved.</p>' : ''}
      <form class="card" method="post" action="/api/cms/technical">
        <label>Public website URL <input name="siteUrl" value="${esc(settings.siteUrl)}"></label>
        <label>Default meta title <input name="defaultMetaTitle" value="${esc(settings.defaultMetaTitle)}"></label>
        <label>Default meta description <textarea name="defaultMetaDescription">${esc(settings.defaultMetaDescription)}</textarea></label>
        <label>Product URL prefix <input name="productPathPrefix" value="${esc(settings.productPathPrefix)}"></label>
        <label>Blog URL prefix <input name="blogPathPrefix" value="${esc(settings.blogPathPrefix)}"></label>
        <label>404 title <input name="notFoundTitle" value="${esc(settings.notFoundTitle)}"></label>
        <label>404 message <textarea name="notFoundBody">${esc(settings.notFoundBody)}</textarea></label>
        <label>Extra robots.txt rules <textarea name="robotsExtra">${esc(settings.robotsExtra)}</textarea></label>
        <p><a href="/sitemap.xml" target="_blank">XML sitemap</a> · <a href="/robots.txt" target="_blank">robots.txt</a></p>
        <button type="submit">Save</button>
      </form>`
    )
  );
};

exports.saveTechnical = async (req, res) => {
  const settings = await getOrCreateSettings(SeoSettings);
  ['siteUrl', 'defaultMetaTitle', 'defaultMetaDescription', 'productPathPrefix', 'blogPathPrefix', 'notFoundTitle', 'notFoundBody', 'robotsExtra'].forEach((key) => {
    if (req.body[key] !== undefined) settings[key] = req.body[key];
  });
  await settings.save();
  res.redirect('/api/cms/technical?ok=1');
};

exports.google = async (req, res) => {
  const settings = await getOrCreateSettings(SeoSettings);
  const g = settings.google || {};
  res.type('html').send(
    layout(
      'Google tools',
      `${nav(req.session.adminName)}
      <h1>Google tools</h1>
      ${req.query.ok ? '<p class="ok">Saved.</p>' : ''}
      <form class="card" method="post" action="/api/cms/google">
        <label>GA4 measurement ID <input name="ga4MeasurementId" value="${esc(g.ga4MeasurementId)}" placeholder="G-XXXXXXXX"></label>
        <label>GTM container ID <input name="gtmContainerId" value="${esc(g.gtmContainerId)}" placeholder="GTM-XXXXXXX"></label>
        <label>Search Console meta tag <input name="searchConsoleMetaTag" value="${esc(g.searchConsoleMetaTag)}"></label>
        <label>Search Console HTML filename <input name="searchConsoleHtmlFilename" value="${esc(g.searchConsoleHtmlFilename)}"></label>
        <label>Search Console HTML contents <textarea name="searchConsoleHtmlContent">${esc(g.searchConsoleHtmlContent)}</textarea></label>
        <button type="submit">Save Google settings</button>
      </form>`
    )
  );
};

exports.saveGoogle = async (req, res) => {
  const settings = await getOrCreateSettings(SeoSettings);
  settings.google.ga4MeasurementId = req.body.ga4MeasurementId || '';
  settings.google.gtmContainerId = req.body.gtmContainerId || '';
  settings.google.searchConsoleMetaTag = req.body.searchConsoleMetaTag || '';
  settings.google.searchConsoleHtmlFilename = req.body.searchConsoleHtmlFilename || '';
  settings.google.searchConsoleHtmlContent = req.body.searchConsoleHtmlContent || '';
  settings.markModified('google');
  await settings.save();
  res.redirect('/api/cms/google?ok=1');
};
