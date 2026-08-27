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
  let res;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    res = await fetch(`${apiBase}${path}`, { ...options, headers, signal: controller.signal });
    clearTimeout(timer);
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error('Sign in timed out. Restart floriva-backend on the server and try again.');
    }
    throw new Error('Cannot reach the API. Open https://api.florivagifts.com/seo-cms/ and check floriva-backend is online.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    if (path !== '/admin/login') logout();
    throw new Error(data.message || 'Invalid username or password');
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

const loginForm = qs('#login-form');
const loginButton = qs('#login-submit');

async function handleLogin(event) {
  event.preventDefault();
  const err = qs('#login-error');
  err.hidden = true;
  if (loginButton) {
    loginButton.disabled = true;
    loginButton.textContent = 'Signing in…';
  }
  try {
    const data = await api('/admin/login', {
      method: 'POST',
      body: {
        username: qs('#username')?.value || '',
        password: qs('#password')?.value || '',
      },
    });
    token = data.token;
    localStorage.setItem(TOKEN_KEY, token);
    showApp();
  } catch (error) {
    err.hidden = false;
    err.textContent = error.message;
  } finally {
    if (loginButton) {
      loginButton.disabled = false;
      loginButton.textContent = 'Sign in';
    }
  }
}

if (loginForm) {
  loginForm.addEventListener('submit', handleLogin);
}
if (loginButton) {
  loginButton.addEventListener('click', (event) => {
    if (event.target.form) return;
    handleLogin(event);
  });
}

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

async function renderBlog() {
  const { data } = await api('/admin/blog');
  panel.innerHTML = `
    <h2>Blog</h2>
    <p class="help">Create and publish posts with title, URL slug, headings, images + ALT text, internal links, and meta tags.</p>
    ${wrapForm(`
      ${field('title', 'Blog title')}
      ${field('slug', 'URL slug (leave blank to auto-generate)')}
      ${field('metaTitle', 'Meta title')}
      ${field('metaDescription', 'Meta description', '', 'textarea')}
      ${field('excerpt', 'Short excerpt')}
      <label>Featured image <input type="file" name="image" accept="image/*" /></label>
      ${field('featuredImageAlt', 'Featured image ALT text')}
      <div class="toolbar">
        <button type="button" data-h="h1">H1</button>
        <button type="button" data-h="h2">H2</button>
        <button type="button" data-h="h3">H3</button>
        <button type="button" data-link="1">Internal link</button>
        <button type="button" data-img="1">Image with ALT</button>
      </div>
      ${field('content', 'Content (HTML)', '', 'textarea')}
      <label>Status
        <select name="status">
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </label>
      ${field('robotsIndex', 'Index this post', true, 'checkbox')}
    `, 'Create post')}
    <div class="list">
      ${data.map((post) => `
        <form class="item" data-id="${post._id}">
          <h3>${post.title} <span class="muted">(${post.status})</span></h3>
          ${field('title', 'Title', post.title)}
          ${field('slug', 'URL slug', post.slug)}
          ${field('metaTitle', 'Meta title', post.metaTitle)}
          ${field('metaDescription', 'Meta description', post.metaDescription, 'textarea')}
          ${field('content', 'Content', post.content, 'textarea')}
          ${field('featuredImageAlt', 'Featured image ALT', post.featuredImageAlt)}
          <label>Replace featured image <input type="file" name="image" accept="image/*" /></label>
          <label>Status
            <select name="status">
              <option value="draft" ${post.status === 'draft' ? 'selected' : ''}>Draft</option>
              <option value="published" ${post.status === 'published' ? 'selected' : ''}>Published</option>
            </select>
          </label>
          ${field('robotsIndex', 'Index this post', post.robotsIndex, 'checkbox')}
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
    if (!editor.querySelector('[name="robotsIndex"]').checked) fd.set('robotsIndex', 'false');
    else fd.set('robotsIndex', 'true');
    await api('/admin/blog', { method: 'POST', body: fd });
    flash('Blog post created');
    render();
  });

  panel.querySelectorAll('.item').forEach((form) => {
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

function bindEditorToolbar(root) {
  const textarea = qs('[name="content"]', root);
  root.querySelectorAll('[data-h]').forEach((button) => {
    button.addEventListener('click', () => surround(textarea, `<${button.dataset.h}>`, `</${button.dataset.h}>`));
  });
  qs('[data-link]', root)?.addEventListener('click', () => {
    const href = prompt('Internal path or URL', '/');
    if (!href) return;
    surround(textarea, `<a href="${href}">`, '</a>');
  });
  qs('[data-img]', root)?.addEventListener('click', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const alt = prompt('ALT text for this image', '') || '';
      const fd = new FormData();
      fd.set('image', file);
      fd.set('alt', alt);
      const uploaded = await api('/admin/blog/images', { method: 'POST', body: fd });
      surround(textarea, `<img src="${uploaded.data.url}" alt="${alt}" />`, '');
    };
    input.click();
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
