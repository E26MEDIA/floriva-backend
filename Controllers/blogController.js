const BlogPost = require('../Model/BlogPost');
const Redirect = require('../Model/Redirect');
const SeoSettings = require('../Model/SeoSettings');
const { ensureUniqueSlug, normalizePath } = require('../Utils/slug');
const { getOrCreateSettings } = require('../Utils/seoDefaults');

const parseBool = (value, defaultValue) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  return value !== 'false' && value !== false && value !== '0';
};

const parseImages = (body) => {
  if (!body) return undefined;
  if (Array.isArray(body.images)) return body.images;
  if (typeof body.images === 'string' && body.images.trim()) {
    try {
      const parsed = JSON.parse(body.images);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const publicSelect = '-__v';

exports.listPublicPosts = async (req, res) => {
  try {
    const posts = await BlogPost.find({ status: 'published' })
      .select(publicSelect)
      .sort({ publishedAt: -1, createdAt: -1 });
    res.json({ success: true, data: posts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPublicPost = async (req, res) => {
  try {
    const post = await BlogPost.findOne({ slug: req.params.slug, status: 'published' });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, data: post });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.listAdminPosts = async (req, res) => {
  try {
    const posts = await BlogPost.find().sort({ updatedAt: -1 });
    res.json({ success: true, data: posts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const applyPostFields = async (post, body, isCreate) => {
  if (body.title !== undefined) post.title = String(body.title).trim();
  if (!post.title) {
    const err = new Error('Title is required');
    err.status = 400;
    throw err;
  }

  const requestedSlug = body.slug !== undefined ? body.slug : isCreate ? post.title : post.slug;
  post.slug = await ensureUniqueSlug(BlogPost, requestedSlug || post.title, post._id);

  if (body.excerpt !== undefined) post.excerpt = body.excerpt;
  if (body.content !== undefined) post.content = body.content;
  if (body.featuredImage !== undefined) post.featuredImage = body.featuredImage;
  if (body.featuredImageAlt !== undefined) post.featuredImageAlt = body.featuredImageAlt;
  if (body.metaTitle !== undefined) post.metaTitle = body.metaTitle;
  if (body.metaDescription !== undefined) post.metaDescription = body.metaDescription;
  if (body.robotsIndex !== undefined) post.robotsIndex = parseBool(body.robotsIndex, true);
  if (body.status !== undefined) {
    post.status = body.status === 'published' ? 'published' : 'draft';
    if (post.status === 'published' && !post.publishedAt) post.publishedAt = new Date();
    if (post.status === 'draft') post.publishedAt = post.publishedAt || null;
  }

  const images = parseImages(body);
  if (images) {
    post.images = images
      .filter((img) => img && (img.url || typeof img === 'string'))
      .map((img) =>
        typeof img === 'string' ? { url: img, alt: '' } : { url: img.url, alt: img.alt || '' }
      );
  }
};

exports.createPost = async (req, res) => {
  try {
    const post = new BlogPost({ title: req.body?.title || '' });
    if (req.file) {
      post.featuredImage = `/uploads/blog/${req.file.filename}`;
      if (req.body?.featuredImageAlt) post.featuredImageAlt = req.body.featuredImageAlt;
    }
    await applyPostFields(post, req.body || {}, true);
    await post.save();
    res.status(201).json({ success: true, data: post });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.updatePost = async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    const previousSlug = post.slug;
    if (req.file) {
      post.featuredImage = `/uploads/blog/${req.file.filename}`;
    }
    await applyPostFields(post, req.body || {}, false);
    await post.save();

    if (previousSlug && previousSlug !== post.slug) {
      const settings = await getOrCreateSettings(SeoSettings);
      const fromPath = normalizePath(`${settings.blogPathPrefix}/${previousSlug}`);
      const toPath = normalizePath(`${settings.blogPathPrefix}/${post.slug}`);
      await Redirect.findOneAndUpdate(
        { fromPath },
        { fromPath, toPath, statusCode: 301, isActive: true, note: `Blog URL changed: ${post.title}` },
        { upsert: true, new: true }
      );
    }

    res.json({ success: true, data: post });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const post = await BlogPost.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.uploadBlogImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image file is required' });
    }
    const url = `/uploads/blog/${req.file.filename}`;
    res.status(201).json({
      success: true,
      data: { url, alt: req.body?.alt || '' },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
