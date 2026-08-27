const TOKEN_KEY = 'floriva_seo_cms_token';
const apiBase = `${window.location.origin}/api`;

const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const panel = document.getElementById('panel');
const flashEl = document.getElementById('flash');
let currentTab = 'pages';
let token = localStorage.getItem(TOKEN_KEY) || '';

const qs = (sel, root = document) => root.querySelector(sel);

function flash(message) {
  flashEl.hidden = false;
  flashEl.textContent = message;
  setTimeout(() => { flashEl.hidden = true; }, 3500);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData) && options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(`${apiBase}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    logout();
    throw new Error(data.message || 'Please sign in again');
  }
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
  render();
}

function logout() {
  token = '';
  localStorage.removeItem(TOKEN_KEY);
  loginView.hidden = false;
  appView.hidden = true;
}

qs('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const err = qs('#login-error');
  err.hidden = true;
  const form = new FormData(event.target);
  try {
    const data = await api('/admin/login', {
      method: 'POST',
      body: { username: form.get('username'), password: form.get('password') },
    });
    token = data.token;
    localStorage.setItem(TOKEN_KEY, token);
    showApp();
  } catch (error) {
    err.hidden = false;
    err.textContent = error.message;
  }
});

qs('#logout').addEventListener('click', logout);

document.querySelectorAll('.tabs button').forEach((button) => {
  button.addEventListener('click', () => {
    currentTab = button.dataset.tab;
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b === button));
    render();
  });
});

function field(name, label, value = '', type = 'text') {
  if (type === 'textarea') {
    return `<label>${label}<textarea name="${name}">${value || ''}</textarea></label>`;
  }
  if (type === 'checkbox') {
    return `<label><input type="checkbox" name="${name}" ${value ? 'checked' : ''} /> ${label}</label>`;
  }
  return `<label>${label}<input name="${name}" value="${value || ''}" /></label>`;
}

function wrapForm(inner, submitLabel) {
  return `<form class="editor">${inner}<div class="actions"><button type="submit">${submitLabel}</button></div></form>`;
}

async function render() {
  panel.innerHTML = '<p class="muted">Loading…</p>';
  try {
    if (currentTab === 'pages') return renderPages();
    if (currentTab === 'blog') return renderBlog();
    if (currentTab === 'products') return renderProducts();
    if (currentTab === 'redirects') return renderRedirects();
    if (currentTab === 'technical') return renderTechnical();
    if (currentTab === 'google') return renderGoogle();
  } catch (error) {
    panel.innerHTML = `<p class="error">${error.message}</p>`;
  }
}

async function renderPages() {
  const { data } = await api('/admin/seo/pages');
  panel.innerHTML = `
    <h2>Page SEO</h2>
    <p class="help">Edit meta title, meta description, URL, and index/noindex for each page. Changing a URL creates a 301 redirect from the old path.</p>
    ${wrapForm(`
      <div class="row">
        ${field('label', 'Page name')}
        ${field('path', 'URL path', '/')}
      </div>
      ${field('metaTitle', 'Meta title')}
      ${field('metaDescription', 'Meta description', '', 'textarea')}
      ${field('robotsIndex', 'Allow search indexing', true, 'checkbox')}
    `, 'Add page')}
    <div class="list">
      ${data.map((page) => `
        <form class="item" data-id="${page._id}">
          <h3>${page.label}</h3>
          <div class="row">
            ${field('label', 'Page name', page.label)}
            ${field('path', 'URL', page.path)}
          </div>
          ${field('metaTitle', 'Meta title', page.metaTitle)}
          ${field('metaDescription', 'Meta description', page.metaDescription, 'textarea')}
          ${field('robotsIndex', 'Index this page', page.robotsIndex, 'checkbox')}
          <div class="actions">
            <button type="submit">Save</button>
            <button type="button" class="ghost delete">Delete</button>
          </div>
        </form>
      `).join('')}
    </div>
  `;
  qs('.editor').addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = formBody(event.target);
    await api('/admin/seo/pages', { method: 'POST', body });
    flash('Page created');
    render();
  });
  panel.querySelectorAll('.item').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await api(`/admin/seo/pages/${form.dataset.id}`, { method: 'PUT', body: formBody(form) });
      flash('Page saved');
      render();
    });
    qs('.delete', form).addEventListener('click', async () => {
      if (!confirm('Delete this page SEO record?')) return;
      await api(`/admin/seo/pages/${form.dataset.id}`, { method: 'DELETE' });
      flash('Page deleted');
      render();
    });
  });
}

function formBody(form) {
  const data = {};
  new FormData(form).forEach((value, key) => { data[key] = value; });
  form.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    data[input.name] = input.checked;
  });
  return data;
}

function surround(textarea, before, after = '') {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end) || 'text';
  textarea.setRangeText(`${before}${selected}${after}`, start, end, 'end');
  textarea.focus();
}

function insertAtCursor(textarea, html) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  textarea.setRangeText(html, start, end, 'end');
  textarea.focus();
  textarea.dispatchEvent(new Event('input'));
}

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function featuredAlignOptions(selected = 'center') {
  const choices = [
    ['left', 'Left'],
    ['center', 'Center'],
    ['right', 'Right'],
    ['full', 'Full width'],
    ['none', 'None'],
  ];
  return choices.map(([value, label]) =>
    `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`
  ).join('');
}

function blogToolbar() {
  return `
    <div class="toolbar">
      <button type="button" data-h="h1">H1</button>
      <button type="button" data-h="h2">H2</button>
      <button type="button" data-h="h3">H3</button>
      <button type="button" data-link="1">Internal link</button>
      <button type="button" data-img="1">Insert image + placement</button>
    </div>
  `;
}

function blogContentFields(post = {}) {
  const featured = post.featuredImage
    ? `<p class="help">Current featured image: <a href="${escapeAttr(post.featuredImage)}" target="_blank" rel="noreferrer">${escapeAttr(post.featuredImage)}</a></p>`
    : '';
  return `
      ${field('title', 'Blog title', post.title || '')}
      ${field('slug', 'URL slug (leave blank to auto-generate)', post.slug || '')}
      ${field('metaTitle', 'Meta title', post.metaTitle || '')}
      ${field('metaDescription', 'Meta description', post.metaDescription || '', 'textarea')}
      ${field('excerpt', 'Short excerpt', post.excerpt || '')}
      <label>${post._id ? 'Replace featured image' : 'Featured image'} <input type="file" name="image" accept="image/*" /></label>
      ${featured}
      ${field('featuredImageAlt', 'Featured image ALT text', post.featuredImageAlt || '')}
      <label>Featured image placement
        <select name="featuredImageAlign">${featuredAlignOptions(post.featuredImageAlign || 'center')}</select>
      </label>
      ${blogToolbar()}
      ${field('content', 'Content (HTML)', post.content || '', 'textarea')}
      <div class="preview-wrap">
        <p class="help">Live placement preview (how the image sits in the text)</p>
        <div class="blog-content content-preview" data-preview></div>
      </div>
      <label>Status
        <select name="status">
          <option value="draft" ${post.status === 'draft' ? 'selected' : ''}>Draft</option>
          <option value="published" ${post.status === 'published' ? 'selected' : ''}>Published</option>
        </select>
      </label>
      ${field('robotsIndex', 'Index this post', post.robotsIndex !== false, 'checkbox')}
  `;
}

async function renderBlog() {
  const { data } = await api('/admin/blog');
  panel.innerHTML = `
    <h2>Blog</h2>
    <p class="help">Write posts like WordPress: upload images, then choose placement (left with text wrap, center, right with text wrap, or full width) and size. The storefront should render <code>content</code> as HTML and load <code>/blog-content.css</code>.</p>
    ${wrapForm(blogContentFields(), 'Create post')}
    <div class="list">
      ${data.map((post) => `
        <form class="item" data-id="${post._id}">
          <h3>${post.title} <span class="muted">(${post.status})</span></h3>
          ${blogContentFields(post)}
          <div class="actions">
            <button type="submit">Save</button>
            <button type="button" class="ghost delete">Delete</button>
          </div>
        </form>
      `).join('')}
    </div>
  `;

  const editor = qs('.editor');
  bindEditorToolbar(editor);
  editor.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(editor);
    fd.set('robotsIndex', qs('[name="robotsIndex"]', editor).checked ? 'true' : 'false');
    await api('/admin/blog', { method: 'POST', body: fd });
    flash('Blog post created');
    render();
  });

  panel.querySelectorAll('.item').forEach((form) => {
    bindEditorToolbar(form);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      fd.set('robotsIndex', qs('[name="robotsIndex"]', form).checked ? 'true' : 'false');
      await api(`/admin/blog/${form.dataset.id}`, { method: 'PUT', body: fd });
      flash('Blog post saved');
      render();
    });
    qs('.delete', form).addEventListener('click', async () => {
      if (!confirm('Delete this blog post?')) return;
      await api(`/admin/blog/${form.dataset.id}`, { method: 'DELETE' });
      flash('Post deleted');
      render();
    });
  });
}

function bindContentPreview(root) {
  const textarea = qs('[name="content"]', root);
  const preview = qs('[data-preview]', root);
  if (!textarea || !preview) return;
  const update = () => { preview.innerHTML = textarea.value || '<p class="muted">Start writing, then insert an image to see placement.</p>'; };
  textarea.addEventListener('input', update);
  update();
}

function bindEditorToolbar(root) {
  const textarea = qs('[name="content"]', root);
  bindContentPreview(root);
  root.querySelectorAll('[data-h]').forEach((button) => {
    button.addEventListener('click', () => surround(textarea, `<${button.dataset.h}>`, `</${button.dataset.h}>`));
  });
  qs('[data-link]', root)?.addEventListener('click', () => {
    const href = prompt('Internal path or URL', '/');
    if (!href) return;
    surround(textarea, `<a href="${href}">`, '</a>');
  });
  qs('[data-img]', root)?.addEventListener('click', () => openMediaDialog(textarea));
}

function openMediaDialog(textarea) {
  const existing = qs('#media-dialog');
  if (existing) existing.remove();

  const dialog = document.createElement('div');
  dialog.id = 'media-dialog';
  dialog.className = 'modal-backdrop';
  dialog.innerHTML = `
    <form class="modal card">
      <h3>Insert image (WordPress-style placement)</h3>
      <p class="help">Choose the file, then where it sits in the paragraph — same idea as WordPress Add Media.</p>
      <label>Image file <input type="file" name="image" accept="image/*" required /></label>
      <label>ALT text <input name="alt" placeholder="Describe the image" /></label>
      <label>Caption <input name="caption" placeholder="Optional caption under the image" /></label>
      <fieldset class="placement">
        <legend>Placement</legend>
        <label><input type="radio" name="align" value="left" /> Left (text wraps on the right)</label>
        <label><input type="radio" name="align" value="center" checked /> Center</label>
        <label><input type="radio" name="align" value="right" /> Right (text wraps on the left)</label>
        <label><input type="radio" name="align" value="full" /> Full width</label>
        <label><input type="radio" name="align" value="none" /> Inline / none</label>
      </fieldset>
      <label>Size
        <select name="size">
          <option value="small">Small (25%)</option>
          <option value="medium">Medium (50%)</option>
          <option value="large" selected>Large (75%)</option>
          <option value="full">Original / full</option>
        </select>
      </label>
      <p class="error" data-media-error hidden></p>
      <div class="actions">
        <button type="submit">Upload and insert</button>
        <button type="button" class="ghost" data-cancel>Cancel</button>
      </div>
    </form>
  `;
  document.body.appendChild(dialog);

  const close = () => dialog.remove();
  qs('[data-cancel]', dialog).addEventListener('click', close);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  qs('form', dialog).addEventListener('submit', async (event) => {
    event.preventDefault();
    const err = qs('[data-media-error]', dialog);
    err.hidden = true;
    const form = event.target;
    const file = form.image.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.set('image', file);
    fd.set('alt', form.alt.value);
    fd.set('caption', form.caption.value);
    fd.set('align', form.align.value);
    fd.set('size', form.size.value);
    try {
      const uploaded = await api('/admin/blog/images', { method: 'POST', body: fd });
      insertAtCursor(textarea, `\n${uploaded.data.html}\n`);
      close();
    } catch (error) {
      err.hidden = false;
      err.textContent = error.message;
    }
  });
}

async function renderProducts() {
  const { data } = await api('/productview');
  panel.innerHTML = `
    <h2>Product SEO</h2>
    <p class="help">Edit product titles, descriptions, SEO-friendly URLs, meta tags, and image ALT text. Changing a URL adds a 301 redirect.</p>
    <div class="list">
      ${(data || []).map((product) => `
        <form class="item" data-id="${product._id}">
          <h3>${product.name}</h3>
          ${field('title', 'Product title', product.title)}
          ${field('description', 'Product description', product.description || '', 'textarea')}
          ${field('slug', 'SEO-friendly URL slug', product.slug || '')}
          ${field('metaTitle', 'Meta title', product.metaTitle || '')}
          ${field('metaDescription', 'Meta description', product.metaDescription || '', 'textarea')}
          ${field('imageAlts', 'Image ALT text (comma-separated, same order as images)', (product.imageAlts || []).join(', '))}
          ${field('robotsIndex', 'Index this product', product.robotsIndex !== false, 'checkbox')}
          <div class="actions"><button type="submit">Save product SEO</button></div>
        </form>
      `).join('') || '<p class="muted">No products yet.</p>'}
    </div>
  `;
  panel.querySelectorAll('.item').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const body = formBody(form);
      body.imageAlts = String(body.imageAlts || '').split(',').map((s) => s.trim());
      await api(`/admin/products/${form.dataset.id}/seo`, { method: 'PATCH', body });
      flash('Product SEO saved');
      render();
    });
  });
}

async function renderRedirects() {
  const { data } = await api('/admin/seo/redirects');
  panel.innerHTML = `
    <h2>301 / 302 redirects</h2>
    ${wrapForm(`
      <div class="row">
        ${field('fromPath', 'From URL', '/old-page')}
        ${field('toPath', 'To URL', '/new-page')}
      </div>
      <label>Type
        <select name="statusCode">
          <option value="301">301 permanent</option>
          <option value="302">302 temporary</option>
        </select>
      </label>
      ${field('note', 'Note')}
    `, 'Add redirect')}
    <div class="list">
      ${data.map((item) => `
        <form class="item" data-id="${item._id}">
          <div class="row">
            ${field('fromPath', 'From', item.fromPath)}
            ${field('toPath', 'To', item.toPath)}
          </div>
          <label>Type
            <select name="statusCode">
              <option value="301" ${item.statusCode === 301 ? 'selected' : ''}>301</option>
              <option value="302" ${item.statusCode === 302 ? 'selected' : ''}>302</option>
            </select>
          </label>
          ${field('isActive', 'Active', item.isActive, 'checkbox')}
          <div class="actions">
            <button type="submit">Save</button>
            <button type="button" class="ghost delete">Delete</button>
          </div>
        </form>
      `).join('')}
    </div>
  `;
  qs('.editor').addEventListener('submit', async (event) => {
    event.preventDefault();
    await api('/admin/seo/redirects', { method: 'POST', body: formBody(event.target) });
    flash('Redirect created');
    render();
  });
  panel.querySelectorAll('.item').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await api(`/admin/seo/redirects/${form.dataset.id}`, { method: 'PUT', body: formBody(form) });
      flash('Redirect saved');
      render();
    });
    qs('.delete', form).addEventListener('click', async () => {
      await api(`/admin/seo/redirects/${form.dataset.id}`, { method: 'DELETE' });
      flash('Redirect deleted');
      render();
    });
  });
}

async function renderTechnical() {
  const { data } = await api('/admin/seo/settings');
  panel.innerHTML = `
    <h2>Technical SEO</h2>
    <p class="help">XML sitemap: <a href="/sitemap.xml" target="_blank" rel="noreferrer">/sitemap.xml</a> · robots.txt: <a href="/robots.txt" target="_blank" rel="noreferrer">/robots.txt</a>. Ask hosting to proxy those URLs from the public domain to this API.</p>
    <form class="editor">
      ${field('siteUrl', 'Public website URL', data.siteUrl)}
      ${field('defaultMetaTitle', 'Default meta title', data.defaultMetaTitle)}
      ${field('defaultMetaDescription', 'Default meta description', data.defaultMetaDescription, 'textarea')}
      <div class="row">
        ${field('productPathPrefix', 'Product URL prefix', data.productPathPrefix)}
        ${field('blogPathPrefix', 'Blog URL prefix', data.blogPathPrefix)}
      </div>
      ${field('categoryPathPrefix', 'Category URL prefix', data.categoryPathPrefix)}
      ${field('robotsExtra', 'Extra robots.txt rules', data.robotsExtra, 'textarea')}
      ${field('notFoundTitle', '404 page title', data.notFoundTitle)}
      ${field('notFoundBody', '404 page message', data.notFoundBody, 'textarea')}
      <div class="actions"><button type="submit">Save technical SEO</button></div>
    </form>
  `;
  qs('.editor').addEventListener('submit', async (event) => {
    event.preventDefault();
    await api('/admin/seo/settings', { method: 'PUT', body: formBody(event.target) });
    flash('Technical SEO saved');
  });
}

async function renderGoogle() {
  const { data } = await api('/admin/seo/settings');
  const g = data.google || {};
  panel.innerHTML = `
    <h2>Google tools</h2>
    <p class="help">Paste IDs from your Google accounts. The website frontend should read <code>/api/seo/public</code> and inject GA4 / GTM. Search Console verification can use a meta tag or HTML file hosted by this API.</p>
    <form class="editor">
      ${field('ga4MeasurementId', 'Google Analytics 4 measurement ID (G-XXXXXXXX)', g.ga4MeasurementId)}
      ${field('gtmContainerId', 'Google Tag Manager container ID (GTM-XXXXXXX)', g.gtmContainerId)}
      ${field('searchConsoleMetaTag', 'Search Console HTML tag content', g.searchConsoleMetaTag)}
      ${field('searchConsoleHtmlFilename', 'Search Console HTML file name (googleXXXX.html)', g.searchConsoleHtmlFilename)}
      ${field('searchConsoleHtmlContent', 'Search Console HTML file contents', g.searchConsoleHtmlContent, 'textarea')}
      <div class="actions"><button type="submit">Save Google settings</button></div>
    </form>
  `;
  qs('.editor').addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = formBody(event.target);
    await api('/admin/seo/settings', {
      method: 'PUT',
      body: {
        google: {
          ga4MeasurementId: body.ga4MeasurementId,
          gtmContainerId: body.gtmContainerId,
          searchConsoleMetaTag: body.searchConsoleMetaTag,
          searchConsoleHtmlFilename: body.searchConsoleHtmlFilename,
          searchConsoleHtmlContent: body.searchConsoleHtmlContent,
        },
      },
    });
    flash('Google settings saved');
  });
}

if (token) showApp();
