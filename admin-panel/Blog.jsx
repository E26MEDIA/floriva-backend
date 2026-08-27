import { useCallback, useEffect, useState } from 'react';
import { FileText, Plus, Trash2, Upload } from 'lucide-react';

const API = (import.meta.env?.VITE_API_URL || 'https://api.florivagifts.com').replace(/\/$/, '');

const emptyForm = () => ({
  title: '',
  slug: '',
  metaTitle: '',
  metaDescription: '',
  excerpt: '',
  content: '',
  featuredImageAlt: '',
  featuredImageAlign: 'center',
  status: 'draft',
  robotsIndex: true,
  image: null,
  contentImage: null,
  contentAlign: 'center',
  contentSize: 'large',
  contentAlt: '',
  contentCaption: '',
});

async function api(path, options = {}) {
  const token = localStorage.getItem('adminToken') || '';
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData) && options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

const Placement = ({ name, value, onChange }) => (
  <div className="grid gap-2 sm:grid-cols-2">
    {[
      ['left', 'Left — text wraps on the right'],
      ['center', 'Center'],
      ['right', 'Right — text wraps on the left'],
      ['full', 'Full width'],
    ].map(([id, label]) => (
      <label key={id} className="flex items-center gap-2 text-sm text-gray-700 font-medium">
        <input
          type="radio"
          name={name}
          value={id}
          checked={value === id}
          onChange={() => onChange(id)}
          className="accent-floral-600"
        />
        {label}
      </label>
    ))}
  </div>
);

export default function Blog() {
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api('/api/admin/blog');
      setPosts(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const startEdit = (post) => {
    setEditingId(post._id);
    setForm({
      ...emptyForm(),
      title: post.title || '',
      slug: post.slug || '',
      metaTitle: post.metaTitle || '',
      metaDescription: post.metaDescription || '',
      excerpt: post.excerpt || '',
      content: post.content || '',
      featuredImageAlt: post.featuredImageAlt || '',
      featuredImageAlign: post.featuredImageAlign || 'center',
      status: post.status || 'draft',
      robotsIndex: post.robotsIndex !== false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setOk('');
    try {
      const fd = new FormData();
      [
        'title',
        'slug',
        'metaTitle',
        'metaDescription',
        'excerpt',
        'content',
        'featuredImageAlt',
        'featuredImageAlign',
        'status',
      ].forEach((key) => fd.set(key, form[key] ?? ''));
      fd.set('robotsIndex', form.robotsIndex ? 'true' : 'false');
      if (form.image) fd.set('image', form.image);
      if (form.contentImage) {
        const uploaded = new FormData();
        uploaded.set('image', form.contentImage);
        uploaded.set('alt', form.contentAlt);
        uploaded.set('caption', form.contentCaption);
        uploaded.set('align', form.contentAlign);
        uploaded.set('size', form.contentSize);
        const { data } = await api('/api/admin/blog/images', { method: 'POST', body: uploaded });
        fd.set('content', `${form.content || ''}\n${data.html}\n`);
      }
      if (editingId) {
        await api(`/api/admin/blog/${editingId}`, { method: 'PUT', body: fd });
        setOk('Post saved');
      } else {
        await api('/api/admin/blog', { method: 'POST', body: fd });
        setOk('Post created');
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this blog post?')) return;
    try {
      await api(`/api/admin/blog/${id}`, { method: 'DELETE' });
      setOk('Post deleted');
      if (editingId === id) resetForm();
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Blog</h1>
        <p className="text-gray-500 mt-1">
          Same idea as Banner &amp; Images: upload a photo, choose placement (left, center, right, or full width), then publish.
        </p>
      </div>

      {error ? <p className="text-red-600 text-sm">{error}</p> : null}
      {ok ? <p className="text-green-700 text-sm">{ok}</p> : null}

      <form onSubmit={save} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Plus className="w-5 h-5 text-floral-600" />
          {editingId ? 'Edit post' : 'New post'}
        </h2>

        <label className="block text-sm font-medium text-gray-700">
          Title
          <input
            required
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
          />
        </label>

        <div className="rounded-xl border border-dashed border-floral-600/40 bg-floral-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Upload className="w-4 h-4" /> Images
          </p>
          <label className="block text-sm font-medium text-gray-700">
            Featured image
            <input type="file" accept="image/*" onChange={(e) => setField('image', e.target.files?.[0] || null)} className="mt-1 block w-full text-sm" />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Featured image ALT
            <input value={form.featuredImageAlt} onChange={(e) => setField('featuredImageAlt', e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" />
          </label>
          <p className="text-xs text-gray-500">Featured image placement</p>
          <Placement name="featuredImageAlign" value={form.featuredImageAlign} onChange={(v) => setField('featuredImageAlign', v)} />

          <label className="block text-sm font-medium text-gray-700 pt-2">
            Image inside the article
            <input type="file" accept="image/*" onChange={(e) => setField('contentImage', e.target.files?.[0] || null)} className="mt-1 block w-full text-sm" />
          </label>
          <p className="text-xs text-gray-500">Article image placement</p>
          <Placement name="contentAlign" value={form.contentAlign} onChange={(v) => setField('contentAlign', v)} />
          <label className="block text-sm font-medium text-gray-700">
            Size
            <select value={form.contentSize} onChange={(e) => setField('contentSize', e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2">
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="full">Full</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Article image ALT
            <input value={form.contentAlt} onChange={(e) => setField('contentAlt', e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Caption
            <input value={form.contentCaption} onChange={(e) => setField('contentCaption', e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" />
          </label>
        </div>

        <label className="block text-sm font-medium text-gray-700">
          URL slug
          <input value={form.slug} onChange={(e) => setField('slug', e.target.value)} placeholder="optional" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Meta title
          <input value={form.metaTitle} onChange={(e) => setField('metaTitle', e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Meta description
          <textarea value={form.metaDescription} onChange={(e) => setField('metaDescription', e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 min-h-[80px]" />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Content
          <textarea value={form.content} onChange={(e) => setField('content', e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 min-h-[180px] font-mono text-sm" />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Status
          <select value={form.status} onChange={(e) => setField('status', e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input type="checkbox" checked={form.robotsIndex} onChange={(e) => setField('robotsIndex', e.target.checked)} />
          Index this post
        </label>

        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="bg-floral-600 hover:bg-floral-700 text-white font-semibold px-4 py-2 rounded-lg disabled:opacity-60">
            {saving ? 'Saving…' : editingId ? 'Save post' : 'Create post'}
          </button>
          {editingId ? (
            <button type="button" onClick={resetForm} className="border border-gray-200 px-4 py-2 rounded-lg">
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">Posts</h2>
        {loading ? <p className="text-gray-500 text-sm">Loading…</p> : null}
        {!loading && posts.length === 0 ? <p className="text-gray-500 text-sm">No posts yet.</p> : null}
        {posts.map((post) => (
          <div key={post._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-floral-600" />
                {post.title}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {post.status} · /{post.slug}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => startEdit(post)} className="text-sm text-floral-600 hover:underline">
                Edit
              </button>
              <button type="button" onClick={() => remove(post._id)} className="text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
