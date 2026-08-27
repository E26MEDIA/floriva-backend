const Admin = require('../Model/Admin');
const SeoPage = require('../Model/SeoPage');
const BlogPost = require('../Model/BlogPost');
const Product = require('../Model/Product');
const Redirect = require('../Model/Redirect');
const SeoSettings = require('../Model/SeoSettings');
const { getOrCreateSettings } = require('../Utils/seoDefaults');
const { slugify, ensureUniqueSlug, normalizePath } = require('../Utils/slug');
const {
  buildBlogImageHtml,
  normalizeAlign,
  normalizeSize,
} = require('../Utils/blogImageHtml');

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const ADMIN_URL = process.env.ADMIN_URL || 'https://admin.florivagifts.com';

const layout = (title, body, extraHead = '') => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="/blog-content.css" />
  <style>
    :root{--ink:#1e1610;--muted:#6b5c51;--accent:#b5623b;--line:#eadfd4;--bg:#f7f3ee}
    *{box-sizing:border-box}
    body{margin:0;font-family:Arial,Helvetica,sans-serif;background:var(--bg);color:var(--ink)}
    a{color:var(--accent)}
    .shell{display:grid;grid-template-columns:230px 1fr;min-height:100vh}
    .sidebar{background:#1e1610;color:#f7f3ee;padding:20px 0}
    .sidebar .brand{padding:0 18px 18px;border-bottom:1px solid #3a2f28;margin-bottom:12px}
    .sidebar .brand span{display:block;font-size:11px;letter-spacing:.08em;color:#d7b39a;font-weight:700}
    .sidebar h1{margin:6px 0 0;font-size:18px}
    .sidebar a{display:block;color:#eadfd4;text-decoration:none;padding:10px 18px;font-weight:700;font-size:14px}
    .sidebar a:hover,.sidebar a.active{background:#b5623b;color:#fff}
    .sidebar .sub{padding:16px 18px;color:#9a8b80;font-size:12px}
    .main{padding:24px 28px 64px;max-width:980px}
    .card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;margin:12px 0}
    label{display:block;margin:10px 0;font-weight:700;font-size:13px}
    input[type="checkbox"]{width:auto;margin-right:8px}
    textarea[name="content"]{min-height:220px;font-family:ui-monospace,Menlo,monospace;font-size:13px}
    textarea{min-height:90px}
    button{background:var(--accent);color:#fff;border:0;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer}
    button.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
    .error{color:#b42318}
    .ok{color:#17633a}
    .help,.muted{color:var(--muted);font-size:13px;line-height:1.5;font-weight:400}
    .toolbar{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
    .toolbar button{font-size:12px;padding:6px 10px}
    .content-preview{min-height:120px;padding:16px;border:1px dashed var(--line);border-radius:12px;background:#fffdfb}
    .featured-preview img{max-width:180px;height:auto;border-radius:8px}
    .placement{border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin:12px 0}
    .placement legend{font-weight:700;font-size:13px}
    .placement label{font-weight:500;display:flex;align-items:center;gap:8px}
    .placement input{width:auto;margin:0}
    .actions{display:flex;gap:8px;margin-top:12px}
    .modal-backdrop{position:fixed;inset:0;background:rgba(30,22,16,.45);display:grid;place-items:center;padding:16px;z-index:50}
    .modal{width:min(520px,100%);background:#fff;border-radius:16px;padding:24px;border:1px solid var(--line)}
    @media(max-width:800px){.shell{grid-template-columns:1fr}.sidebar{display:flex;flex-wrap:wrap;padding:8px}.sidebar a{padding:8px 12px}}
  </style>
  ${extraHead}
</head>
<body>${body}</body>
</html>`;

const nav = (name, active = '') => {
  const item = (href, label, key) =>
    `<a href="${href}" class="${active === key ? 'active' : ''}">${label}</a>`;
  return `
  <aside class="sidebar">
    <div class="brand">
      <span>FLORIVA ADMIN</span>
      <h1>CMS</h1>
    </div>
    ${item('/api/cms/home', 'Home', 'home')}
    ${item('/api/cms/blog', 'Blog', 'blog')}
    ${item('/api/cms/pages', 'Page SEO', 'pages')}
    ${item('/api/cms/products', 'Product SEO', 'products')}
    ${item('/api/cms/redirects', 'Redirects', 'redirects')}
    ${item('/api/cms/technical', 'Technical', 'technical')}
    ${item('/api/cms/google', 'Google tools', 'google')}
    <p class="sub">Signed in as ${esc(name)}</p>
    <a href="${esc(ADMIN_URL)}" target="_blank" rel="noreferrer">Open store admin</a>
    <a href="/api/cms/logout">Sign out</a>
  </aside>`;
};

const page = (title, name, active, inner, extraHead = '') =>
  layout(
    title,
    `<div class="shell">${nav(name, active)}<main class="main">${inner}</main></div>`,
    extraHead
  );

const CMS_VERSION = 'blog-images-v2';

const alignOptions = (selected = 'center') =>
  ['left', 'center', 'right', 'full']
    .map(
      (value) =>
        `<option value="${value}" ${selected === value ? 'selected' : ''}>${value[0].toUpperCase()}${value.slice(1)}</option>`
    )
    .join('');

const placementRadios = (name, selected = 'center') =>
  [
    ['left', 'Left — text wraps on the right'],
    ['center', 'Center'],
    ['right', 'Right — text wraps on the left'],
    ['full', 'Full width'],
  ]
    .map(
      ([value, label]) =>
        `<label><input type="radio" name="${name}" value="${value}" ${selected === value ? 'checked' : ''}> ${label}</label>`
    )
    .join('');

const blogToolbar = () => `
  <div class="toolbar">
    <button type="button" data-h="h1">H1</button>
    <button type="button" data-h="h2">H2</button>
    <button type="button" data-h="h3">H3</button>
    <button type="button" data-link="1">Internal link</button>
    <button type="button" data-img="1">Insert another image</button>
  </div>
`;

const blogEditorFields = (post = {}) => {
  const featured = post.featuredImage
    ? `<p class="featured-preview"><img src="${esc(post.featuredImage)}" alt="${esc(post.featuredImageAlt)}" /> Current featured image</p>`
    : '';
  return `
    <label>Title <input name="title" value="${esc(post.title || '')}" required></label>
    <fieldset class="placement">
      <legend>Images</legend>
      <p class="help">Upload the photo here, then choose where it sits in the article.</p>
      <label>${post._id ? 'Replace featured image' : 'Featured image (top of post)'} <input type="file" name="image" accept="image/*"></label>
      ${featured}
      <label>Featured image ALT <input name="featuredImageAlt" value="${esc(post.featuredImageAlt || '')}"></label>
      <label>Featured image placement
        <select name="featuredImageAlign">${alignOptions(post.featuredImageAlign || 'center')}</select>
      </label>
      <hr style="border:0;border-top:1px solid var(--line);margin:16px 0" />
      <label>Image inside the article <input type="file" name="contentImage" accept="image/*"></label>
      <div class="placement" style="margin:8px 0">
        <legend>Article image placement</legend>
        ${placementRadios('contentAlign', 'center')}
      </div>
      <label>Article image size
        <select name="contentSize">
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large" selected>Large</option>
          <option value="full">Full</option>
        </select>
      </label>
      <label>Article image ALT <input name="contentAlt" placeholder="Describe the image"></label>
      <label>Caption <input name="contentCaption" placeholder="Optional"></label>
    </fieldset>
    <label>URL slug <input name="slug" value="${esc(post.slug || '')}" placeholder="optional"></label>
    <label>Meta title <input name="metaTitle" value="${esc(post.metaTitle || '')}"></label>
    <label>Meta description <textarea name="metaDescription">${esc(post.metaDescription || '')}</textarea></label>
    ${blogToolbar()}
    <label>Content
      <textarea name="content" placeholder="<h1>Title</h1><p>Write here. Uploaded article images are added automatically.</p>">${esc(post.content || '')}</textarea>
    </label>
    <div>
      <p class="help">Live placement preview</p>
      <div class="blog-content content-preview" data-preview></div>
    </div>
    <label>Status
      <select name="status">
        <option value="draft" ${post.status === 'draft' ? 'selected' : ''}>Draft</option>
        <option value="published" ${post.status === 'published' ? 'selected' : ''}>Published</option>
      </select>
    </label>
    <label><input type="checkbox" name="robotsIndex" ${post.robotsIndex !== false ? 'checked' : ''}> Index this post</label>
  `;
};

const applyUploadedImage = (post, file) => {
  if (file) post.featuredImage = `/uploads/blog/${file.filename}`;
};

const uploadedFile = (req, field) => {
  if (req.file && (!field || req.file.fieldname === field)) return req.file;
  const files = req.files && req.files[field];
  return Array.isArray(files) ? files[0] : null;
};

const appendContentImage = (post, file, body) => {
  if (!file) return;
  const html = buildBlogImageHtml({
    url: `/uploads/blog/${file.filename}`,
    alt: body.contentAlt || '',
    caption: body.contentCaption || '',
    align: body.contentAlign || 'center',
    size: body.contentSize || 'large',
  });
  post.content = `${post.content || ''}\n${html}\n`;
};

const applyBlogFields = async (post, body) => {
  post.title = String(body.title || post.title || 'Untitled').trim();
  post.slug = await ensureUniqueSlug(BlogPost, body.slug || post.title, post._id);
  post.metaTitle = body.metaTitle || '';
  post.metaDescription = body.metaDescription || '';
  post.content = body.content || '';
  post.featuredImageAlt = body.featuredImageAlt || '';
  post.featuredImageAlign = normalizeAlign(body.featuredImageAlign || post.featuredImageAlign || 'center');
  post.status = body.status === 'published' ? 'published' : 'draft';
  if (post.status === 'published' && !post.publishedAt) post.publishedAt = new Date();
  post.robotsIndex = body.robotsIndex === 'on' || body.robotsIndex === 'true';
};

exports.requireCms = (req, res, next) => {
  if (!req.session?.adminId) {
    return res.redirect('/api/cms?error=' + encodeURIComponent('Please sign in'));
  }
  next();
};

exports.loginPage = (req, res) => {
  if (req.session?.adminId) return res.redirect('/api/cms/blog');
  const error = req.query.error || '';
  res.set('Cache-Control', 'no-store');
  res.type('html').send(
    layout(
      'Floriva Admin sign in',
      `<div class="card" style="max-width:420px;margin:48px auto">
        <p style="color:#b5623b;font-weight:700;letter-spacing:.08em">FLORIVA ADMIN</p>
        <h1>Blog &amp; SEO CMS</h1>
        <p>Same username and password as <a href="${esc(ADMIN_URL)}">admin.florivagifts.com</a>.</p>
        ${error ? `<p class="error">${esc(error)}</p>` : ''}
        <form method="post" action="/api/cms/login">
          <label>Username <input name="username" autocomplete="username" required></label>
          <label>Password <input name="password" type="password" autocomplete="current-password" required></label>
          <button type="submit">Sign in</button>
        </form>
        <p class="help">CMS ${CMS_VERSION} — blog images and placement</p>
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
      return res.redirect(302, '/api/cms/blog');
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
    page(
      'Floriva Admin CMS',
      req.session.adminName,
      'home',
      `<div class="card">
        <h1>Floriva Admin CMS</h1>
        <p>This is the same admin login as <a href="${esc(ADMIN_URL)}">${esc(ADMIN_URL)}</a>. Write blogs here — upload an image and choose placement (left, center, right, full width), like WordPress.</p>
        <p><a href="/api/cms/blog"><button type="button">Write a blog post</button></a></p>
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
    page(
      'Page SEO',
      req.session.adminName,
      'pages',
      `<h1>Page SEO</h1>
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

exports.version = (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, cmsVersion: CMS_VERSION });
};

exports.blog = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const posts = await BlogPost.find().sort({ updatedAt: -1 });
  const rows = posts
    .map(
      (post) => `
      <form class="card editor" method="post" action="/api/cms/blog/${post._id}" enctype="multipart/form-data">
        <h3>${esc(post.title)} <small>${esc(post.status)}</small></h3>
        ${blogEditorFields(post)}
        <button type="submit">Save post</button>
      </form>`
    )
    .join('');
  res.type('html').send(
    page(
      'Blog',
      req.session.adminName,
      'blog',
      `<h1>Blog</h1>
      ${req.query.ok ? '<p class="ok">Saved.</p>' : ''}
      ${req.query.error ? `<p class="error">${esc(req.query.error)}</p>` : ''}
      <p class="help"><strong>Upload photos on this form</strong> and choose placement (left / center / right / full width). This is CMS ${CMS_VERSION}.</p>
      <form class="card editor" method="post" action="/api/cms/blog" enctype="multipart/form-data">
        <h3>New post</h3>
        ${blogEditorFields()}
        <button type="submit">Create post</button>
      </form>
      ${rows}`,
      '<script src="/cms/blog-editor.js" defer></script>'
    )
  );
};

exports.createPost = async (req, res) => {
  const post = new BlogPost({ title: req.body.title || 'Untitled' });
  applyUploadedImage(post, uploadedFile(req, 'image'));
  await applyBlogFields(post, req.body);
  appendContentImage(post, uploadedFile(req, 'contentImage'), req.body);
  await post.save();
  res.redirect('/api/cms/blog?ok=1');
};

exports.updatePost = async (req, res) => {
  const post = await BlogPost.findById(req.params.id);
  if (!post) return res.redirect('/api/cms/blog');
  applyUploadedImage(post, uploadedFile(req, 'image'));
  await applyBlogFields(post, req.body);
  appendContentImage(post, uploadedFile(req, 'contentImage'), req.body);
  await post.save();
  res.redirect('/api/cms/blog?ok=1');
};

exports.uploadImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Image file is required' });
  }
  const url = `/uploads/blog/${req.file.filename}`;
  const alt = req.body?.alt || '';
  const caption = req.body?.caption || '';
  const align = normalizeAlign(req.body?.align);
  const size = normalizeSize(req.body?.size);
  res.status(201).json({
    success: true,
    data: {
      url,
      alt,
      caption,
      align,
      size,
      html: buildBlogImageHtml({ url, alt, caption, align, size }),
    },
  });
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
    page(
      'Product SEO',
      req.session.adminName,
      'products',
      `<h1>Product SEO</h1>${req.query.ok ? '<p class="ok">Saved.</p>' : ''}${rows || '<p>No products.</p>'}`
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
    page(
      'Redirects',
      req.session.adminName,
      'redirects',
      `<h1>301 / 302 redirects</h1>
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
    page(
      'Technical SEO',
      req.session.adminName,
      'technical',
      `<h1>Technical SEO</h1>
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
    page(
      'Google tools',
      req.session.adminName,
      'google',
      `<h1>Google tools</h1>
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
