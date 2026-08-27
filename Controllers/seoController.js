const SeoSettings = require('../Model/SeoSettings');
const SeoPage = require('../Model/SeoPage');
const BlogPost = require('../Model/BlogPost');
const Redirect = require('../Model/Redirect');
const Product = require('../Model/Product');
const Category = require('../Model/Category');
const { normalizePath, slugify, ensureUniqueSlug } = require('../Utils/slug');
const { buildSitemapXml, buildRobotsTxt, joinUrl } = require('../Utils/seoXml');
const { DEFAULT_PAGES, getOrCreateSettings } = require('../Utils/seoDefaults');

const parseBool = (value, defaultValue) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  return value !== 'false' && value !== false && value !== '0';
};

const publicGoogle = (settings) => ({
  ga4MeasurementId: settings.google?.ga4MeasurementId || '',
  gtmContainerId: settings.google?.gtmContainerId || '',
  searchConsoleMetaTag: settings.google?.searchConsoleMetaTag || '',
});

exports.seedSeo = async () => {
  await getOrCreateSettings(SeoSettings);
  for (const page of DEFAULT_PAGES) {
    const exists = await SeoPage.findOne({ path: page.path });
    if (!exists) await SeoPage.create(page);
  }

  const products = await Product.find({ $or: [{ slug: { $exists: false } }, { slug: '' }, { slug: null }] }).select('name title');
  for (const product of products) {
    product.slug = await ensureUniqueSlug(Product, product.name || product.title, product._id);
    await product.save();
  }

  const categories = await Category.find({ $or: [{ slug: { $exists: false } }, { slug: '' }, { slug: null }] }).select('name');
  for (const category of categories) {
    category.slug = await ensureUniqueSlug(Category, category.name, category._id);
    await category.save();
  }
};

exports.getPublicConfig = async (req, res) => {
  try {
    const settings = await getOrCreateSettings(SeoSettings);
    res.json({
      success: true,
      data: {
        siteUrl: settings.siteUrl,
        defaultMetaTitle: settings.defaultMetaTitle,
        defaultMetaDescription: settings.defaultMetaDescription,
        productPathPrefix: settings.productPathPrefix,
        categoryPathPrefix: settings.categoryPathPrefix,
        blogPathPrefix: settings.blogPathPrefix,
        notFoundTitle: settings.notFoundTitle,
        notFoundBody: settings.notFoundBody,
        google: publicGoogle(settings),
        cmsVersion: 'login-v6',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const productUrl = (settings, product) => {
  const slug = product.slug || slugify(product.name || product.title || product._id);
  return normalizePath(`${settings.productPathPrefix}/${slug}`);
};

const categoryUrl = (settings, category) => {
  const slug = category.slug || slugify(category.name || category._id);
  return normalizePath(`${settings.categoryPathPrefix}/${slug}`);
};

const blogUrl = (settings, post) =>
  normalizePath(`${settings.blogPathPrefix}/${post.slug}`);

exports.resolveSeo = async (req, res) => {
  try {
    const settings = await getOrCreateSettings(SeoSettings);
    const path = normalizePath(req.query.path || '/');

    const redirect = await Redirect.findOne({ fromPath: path, isActive: true });
    if (redirect) {
      return res.json({
        success: true,
        data: {
          type: 'redirect',
          statusCode: redirect.statusCode || 301,
          fromPath: redirect.fromPath,
          toPath: redirect.toPath,
          robotsIndex: false,
          metaTitle: settings.defaultMetaTitle,
          metaDescription: settings.defaultMetaDescription,
        },
      });
    }

    const page = await SeoPage.findOne({ path, isActive: true });
    if (page) {
      return res.json({
        success: true,
        data: {
          type: 'page',
          path: page.path,
          robotsIndex: page.robotsIndex,
          metaTitle: page.metaTitle || settings.defaultMetaTitle,
          metaDescription: page.metaDescription || settings.defaultMetaDescription,
          canonical: joinUrl(settings.siteUrl, page.path),
        },
      });
    }

    const blogPrefix = normalizePath(settings.blogPathPrefix);
    if (path === blogPrefix || path.startsWith(`${blogPrefix}/`)) {
      const slug = path.slice(blogPrefix.length).replace(/^\//, '');
      if (slug) {
        const post = await BlogPost.findOne({ slug, status: 'published' });
        if (post) {
          return res.json({
            success: true,
            data: {
              type: 'blog',
              path,
              robotsIndex: post.robotsIndex,
              metaTitle: post.metaTitle || post.title,
              metaDescription: post.metaDescription || post.excerpt,
              canonical: joinUrl(settings.siteUrl, path),
              payload: post,
            },
          });
        }
      }
    }

    const productPrefix = normalizePath(settings.productPathPrefix);
    if (path.startsWith(`${productPrefix}/`)) {
      const slug = path.slice(productPrefix.length).replace(/^\//, '');
      const product = await Product.findOne({ slug });
      if (product) {
        return res.json({
          success: true,
          data: {
            type: 'product',
            path,
            robotsIndex: product.robotsIndex !== false,
            metaTitle: product.metaTitle || product.title || product.name,
            metaDescription: product.metaDescription || product.description || '',
            canonical: joinUrl(settings.siteUrl, path),
            payload: product,
          },
        });
      }
    }

    const categoryPrefix = normalizePath(settings.categoryPathPrefix);
    if (path.startsWith(`${categoryPrefix}/`)) {
      const slug = path.slice(categoryPrefix.length).replace(/^\//, '');
      const category = await Category.findOne({ slug });
      if (category) {
        return res.json({
          success: true,
          data: {
            type: 'category',
            path,
            robotsIndex: category.robotsIndex !== false,
            metaTitle: category.metaTitle || category.name,
            metaDescription: category.metaDescription || '',
            canonical: joinUrl(settings.siteUrl, path),
            payload: category,
          },
        });
      }
    }

    return res.status(404).json({
      success: false,
      data: {
        type: 'not_found',
        path,
        robotsIndex: false,
        metaTitle: settings.notFoundTitle || 'Page not found',
        metaDescription: settings.notFoundBody || '',
        notFoundTitle: settings.notFoundTitle,
        notFoundBody: settings.notFoundBody,
      },
      message: 'Not found',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSitemap = async (req, res) => {
  try {
    const settings = await getOrCreateSettings(SeoSettings);
    const [pages, posts, products, categories] = await Promise.all([
      SeoPage.find({ isActive: true, robotsIndex: true }),
      BlogPost.find({ status: 'published', robotsIndex: true }),
      Product.find({ robotsIndex: { $ne: false }, slug: { $exists: true, $ne: '' } }).select(
        'slug updatedAt'
      ),
      Category.find({ robotsIndex: { $ne: false }, slug: { $exists: true, $ne: '' } }).select(
        'slug updatedAt'
      ),
    ]);

    const urls = [
      ...pages.map((page) => ({
        loc: page.path,
        lastmod: page.updatedAt,
        changefreq: page.path === '/' ? 'daily' : 'weekly',
        priority: page.path === '/' ? '1.0' : '0.8',
      })),
      ...posts.map((post) => ({
        loc: blogUrl(settings, post),
        lastmod: post.updatedAt,
        changefreq: 'weekly',
        priority: '0.6',
      })),
      ...products.map((product) => ({
        loc: productUrl(settings, product),
        lastmod: product.updatedAt,
        changefreq: 'weekly',
        priority: '0.7',
      })),
      ...categories.map((category) => ({
        loc: categoryUrl(settings, category),
        lastmod: category.updatedAt,
        changefreq: 'weekly',
        priority: '0.6',
      })),
    ];

    res.type('application/xml').send(buildSitemapXml({ siteUrl: settings.siteUrl, urls }));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRobots = async (req, res) => {
  try {
    const settings = await getOrCreateSettings(SeoSettings);
    res
      .type('text/plain')
      .send(
        buildRobotsTxt({
          siteUrl: settings.siteUrl,
          extraRules: settings.robotsExtra,
        })
      );
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSearchConsoleFile = async (req, res, next) => {
  try {
    const filename = String(req.params.filename || '');
    if (!/^google[a-z0-9]+\.html$/i.test(filename)) return next();
    const settings = await getOrCreateSettings(SeoSettings);
    const stored = String(settings.google?.searchConsoleHtmlFilename || '').trim();
    if (!stored || stored !== filename) return next();
    const content =
      settings.google.searchConsoleHtmlContent ||
      `google-site-verification: ${filename}`;
    res.type('text/html').send(content);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAdminSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings(SeoSettings);
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateAdminSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings(SeoSettings);
    const fields = [
      'siteUrl',
      'defaultMetaTitle',
      'defaultMetaDescription',
      'productPathPrefix',
      'categoryPathPrefix',
      'blogPathPrefix',
      'robotsExtra',
      'notFoundTitle',
      'notFoundBody',
    ];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) settings[field] = req.body[field];
    });
    if (settings.productPathPrefix) {
      settings.productPathPrefix = normalizePath(settings.productPathPrefix);
    }
    if (settings.categoryPathPrefix) {
      settings.categoryPathPrefix = normalizePath(settings.categoryPathPrefix);
    }
    if (settings.blogPathPrefix) {
      settings.blogPathPrefix = normalizePath(settings.blogPathPrefix);
    }
    if (req.body.google) {
      const keepKeys = [
        'ga4MeasurementId',
        'gtmContainerId',
        'searchConsoleMetaTag',
        'searchConsoleHtmlFilename',
        'searchConsoleHtmlContent',
      ];
      keepKeys.forEach((key) => {
        if (req.body.google[key] !== undefined) {
          settings.google[key] = String(req.body.google[key]).trim();
        }
      });
      if (settings.google.searchConsoleHtmlFilename) {
        settings.google.searchConsoleHtmlFilename = settings.google.searchConsoleHtmlFilename
          .replace(/^\/+/, '');
      }
      settings.markModified('google');
    }
    await settings.save();
    res.json({ success: true, data: settings, message: 'SEO settings saved' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.listPages = async (req, res) => {
  try {
    const pages = await SeoPage.find().sort({ path: 1 });
    res.json({ success: true, data: pages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const maybeRedirectPathChange = async (fromPath, toPath, note) => {
  if (!fromPath || !toPath || fromPath === toPath) return;
  await Redirect.findOneAndUpdate(
    { fromPath },
    { fromPath, toPath, statusCode: 301, isActive: true, note },
    { upsert: true, new: true }
  );
};

exports.createPage = async (req, res) => {
  try {
    const path = normalizePath(req.body.path);
    if (!req.body.label?.trim() || !path) {
      return res.status(400).json({ success: false, message: 'Label and URL path are required' });
    }
    const exists = await SeoPage.findOne({ path });
    if (exists) {
      return res.status(409).json({ success: false, message: 'A page with this URL already exists' });
    }
    const page = await SeoPage.create({
      label: req.body.label.trim(),
      path,
      metaTitle: req.body.metaTitle || '',
      metaDescription: req.body.metaDescription || '',
      robotsIndex: parseBool(req.body.robotsIndex, true),
      isActive: parseBool(req.body.isActive, true),
    });
    res.status(201).json({ success: true, data: page });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePage = async (req, res) => {
  try {
    const page = await SeoPage.findById(req.params.id);
    if (!page) return res.status(404).json({ success: false, message: 'Page not found' });
    const previousPath = page.path;
    if (req.body.label !== undefined) page.label = req.body.label;
    if (req.body.path !== undefined) page.path = normalizePath(req.body.path);
    if (req.body.metaTitle !== undefined) page.metaTitle = req.body.metaTitle;
    if (req.body.metaDescription !== undefined) page.metaDescription = req.body.metaDescription;
    if (req.body.robotsIndex !== undefined) page.robotsIndex = parseBool(req.body.robotsIndex, true);
    if (req.body.isActive !== undefined) page.isActive = parseBool(req.body.isActive, true);
    await page.save();
    await maybeRedirectPathChange(previousPath, page.path, `Page URL changed: ${page.label}`);
    res.json({ success: true, data: page });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A page with this URL already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deletePage = async (req, res) => {
  try {
    const page = await SeoPage.findByIdAndDelete(req.params.id);
    if (!page) return res.status(404).json({ success: false, message: 'Page not found' });
    res.json({ success: true, message: 'Page deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.listRedirects = async (req, res) => {
  try {
    const redirects = await Redirect.find().sort({ fromPath: 1 });
    res.json({ success: true, data: redirects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createRedirect = async (req, res) => {
  try {
    const fromPath = normalizePath(req.body.fromPath);
    const toPath = String(req.body.toPath || '').trim();
    if (!fromPath || !toPath) {
      return res.status(400).json({ success: false, message: 'From URL and To URL are required' });
    }
    if (fromPath === normalizePath(toPath)) {
      return res.status(400).json({ success: false, message: 'From and To URLs must be different' });
    }
    const redirect = await Redirect.create({
      fromPath,
      toPath: toPath.startsWith('http') ? toPath : normalizePath(toPath),
      statusCode: Number(req.body.statusCode) === 302 ? 302 : 301,
      isActive: parseBool(req.body.isActive, true),
      note: req.body.note || '',
    });
    res.status(201).json({ success: true, data: redirect });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A redirect from this URL already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateRedirect = async (req, res) => {
  try {
    const redirect = await Redirect.findById(req.params.id);
    if (!redirect) return res.status(404).json({ success: false, message: 'Redirect not found' });
    if (req.body.fromPath !== undefined) redirect.fromPath = normalizePath(req.body.fromPath);
    if (req.body.toPath !== undefined) {
      const toPath = String(req.body.toPath).trim();
      redirect.toPath = toPath.startsWith('http') ? toPath : normalizePath(toPath);
    }
    if (req.body.statusCode !== undefined) {
      redirect.statusCode = Number(req.body.statusCode) === 302 ? 302 : 301;
    }
    if (req.body.isActive !== undefined) redirect.isActive = parseBool(req.body.isActive, true);
    if (req.body.note !== undefined) redirect.note = req.body.note;
    await redirect.save();
    res.json({ success: true, data: redirect });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteRedirect = async (req, res) => {
  try {
    const redirect = await Redirect.findByIdAndDelete(req.params.id);
    if (!redirect) return res.status(404).json({ success: false, message: 'Redirect not found' });
    res.json({ success: true, message: 'Redirect deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
