const Product = require('../Model/Product');
const Country = require('../Model/country');
const FeaturedProduct = require('../Model/FeaturedProduct');
const Redirect = require('../Model/Redirect');
const SeoSettings = require('../Model/SeoSettings');
const { ensureUniqueSlug, normalizePath } = require('../Utils/slug');
const { getOrCreateSettings } = require('../Utils/seoDefaults');

const isObjectId = (value) => /^[a-fA-F0-9]{24}$/.test(String(value || ''));

const parseImageAlts = (body) => {
  if (!body || body.imageAlts === undefined) return undefined;
  const raw = body.imageAlts;
  if (Array.isArray(raw)) return raw.map((alt) => String(alt || ''));
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((alt) => String(alt || ''));
    } catch {
      return raw.split(',').map((alt) => alt.trim());
    }
  }
  return [];
};

const applyProductSeoFields = async (product, body) => {
  if (body.metaTitle !== undefined) product.metaTitle = body.metaTitle;
  if (body.metaDescription !== undefined) product.metaDescription = body.metaDescription;
  if (body.robotsIndex !== undefined) {
    const value = body.robotsIndex;
    product.robotsIndex = value !== 'false' && value !== false && value !== '0';
  }
  const alts = parseImageAlts(body);
  if (alts) product.imageAlts = alts;

  if (body.slug !== undefined || !product.slug) {
    const source = body.slug || product.name || product.title || 'product';
    product.slug = await ensureUniqueSlug(Product, source, product._id);
  }
};

// ─── Helper: parse FeaturedProduct IDs from multipart body ───────────────────
function parseFeaturedIds(body) {
  let ids = [];

  if (body.featuredProducts) {
    const raw = body.featuredProducts;
    if (Array.isArray(raw)) {
      ids = raw.filter(id => id && id.toString().trim() !== '');
    } else if (typeof raw === 'string' && raw.trim() !== '') {
      ids = [raw.trim()];
    }
  }

  if (body.featuredProductsJSON !== undefined) {
    try {
      const parsed = JSON.parse(body.featuredProductsJSON);
      if (Array.isArray(parsed)) {
        if (ids.length === 0) {
          ids = parsed.filter(id => id && id.toString().trim() !== '');
        }
        return { ids, wasProvided: true };
      }
    } catch (e) {
      console.warn('featuredProductsJSON parse error:', e.message);
    }
  }

  const wasProvided =
    body.featuredProducts !== undefined ||
    body.featuredProductsJSON !== undefined;

  return { ids, wasProvided };
}

function parseCategoryIds(body) {
  let ids = [];

  if (body.categories) {
    const raw = body.categories;
    if (Array.isArray(raw)) {
      ids = raw.filter(id => id && id.toString().trim() !== '');
    } else if (typeof raw === 'string' && raw.trim() !== '') {
      ids = [raw.trim()];
    }
  }

  if (body.categoriesJSON !== undefined) {
    try {
      const parsed = JSON.parse(body.categoriesJSON);
      if (Array.isArray(parsed)) {
        if (ids.length === 0) {
          ids = parsed.filter(id => id && id.toString().trim() !== '');
        }
        return { ids, wasProvided: true };
      }
    } catch (e) {
      console.warn('categoriesJSON parse error:', e.message);
    }
  }

  const wasProvided =
    body.categories !== undefined ||
    body.categoriesJSON !== undefined ||
    body.category !== undefined;

  if (ids.length === 0 && body.category !== undefined) {
    const single = body.category?.toString().trim();
    if (single) ids = [single];
  }

  return { ids, wasProvided };
}

function parseSubCategoryIds(body) {
  let ids = [];

  if (body.subCategories) {
    const raw = body.subCategories;
    if (Array.isArray(raw)) {
      ids = raw.filter(id => id && id.toString().trim() !== '');
    } else if (typeof raw === 'string' && raw.trim() !== '') {
      ids = [raw.trim()];
    }
  }

  if (body.subCategoriesJSON !== undefined) {
    try {
      const parsed = JSON.parse(body.subCategoriesJSON);
      if (Array.isArray(parsed)) {
        if (ids.length === 0) {
          ids = parsed.filter(id => id && id.toString().trim() !== '');
        }
        return { ids, wasProvided: true };
      }
    } catch (e) {
      console.warn('subCategoriesJSON parse error:', e.message);
    }
  }

  const wasProvided =
    body.subCategories !== undefined ||
    body.subCategoriesJSON !== undefined ||
    body.subCategory !== undefined;

  if (ids.length === 0 && body.subCategory !== undefined) {
    const single = body.subCategory?.toString().trim();
    if (single) ids = [single];
  }

  return { ids, wasProvided };
}

// ─── Create Product ───────────────────────────────────────────────────────────
const createProduct = async (req, res) => {
  try {
    // ── THIS IS THE FIX ──────────────────────────────────────────────────────
    // NEVER use  const { name } = req.body  at the top.
    // When the request is multipart/form-data and multer is missing from the
    // route, req.body is undefined. Destructuring undefined throws:
    //   "Cannot destructure property 'name' of undefined"
    // Reading properties one-by-one is safe — undefined.name just returns
    // undefined instead of crashing.
    // ─────────────────────────────────────────────────────────────────────────
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message:
          'req.body is undefined. The route must include upload middleware: ' +
          'router.post("/insert", upload.array("images", 10), createProduct)',
      });
    }

    console.log('Request Body :', req.body);
    console.log('Request Files:', req.files);

    const name          = req.body.name;
    const title         = req.body.title;
    const description   = req.body.description   || '';
    const exactPrice    = req.body.exactPrice;
    const discountPrice = req.body.discountPrice  || null;
    const subCategory   = req.body.subCategory    || null;
    const color         = req.body.color          || null;
    const country        = req.body.country         || null;
    const stock         = req.body.stock          || 0;
    const deliveryInfo  = req.body.deliveryInfo;

    // Validate
    if (!name || !title || !exactPrice || !deliveryInfo) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, title, exactPrice, deliveryInfo',
      });
    }

    // Images
    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map(f => `/uploads/products/${f.filename}`);
    }

    // Numerics
    const numericPrice    = parseFloat(exactPrice);
    const numericDiscount = discountPrice ? parseFloat(discountPrice) : null;
    const numericStock    = parseInt(stock, 10) || 0;

    // FeaturedProduct
    const { ids: featuredProductIds } = parseFeaturedIds(req.body);
    const { ids: categoryIds } = parseCategoryIds(req.body);
    const { ids: subCategoryIds } = parseSubCategoryIds(req.body);

    if (categoryIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one category is required',
      });
    }

    const imageAlts = parseImageAlts(req.body) || [];
    const productData = {
      name:            name.trim(),
      title:           title.trim(),
      description:     description.trim(),
      exactPrice:      numericPrice,
      discountPrice:   numericDiscount,
      category:        categoryIds[0],
      categories:      categoryIds,
      stock:           numericStock,
      deliveryInfo:    deliveryInfo.trim(),
      images,
      imageAlts,
      FeaturedProduct: featuredProductIds,
      metaTitle:       req.body.metaTitle || '',
      metaDescription: req.body.metaDescription || '',
      robotsIndex:     req.body.robotsIndex !== 'false' && req.body.robotsIndex !== false,
    };

    if (subCategoryIds.length > 0) {
      productData.subCategories = subCategoryIds;
      productData.subCategory = subCategoryIds[0];
    } else if (subCategory && subCategory.toString().trim() !== '') {
      productData.subCategory = subCategory.toString().trim();
      productData.subCategories = [subCategory.toString().trim()];
    }
    if (color && color.toString().trim() !== '') {
      productData.color = color.toString().trim();
    }
    if (country && country.toString().trim() !== '') {
      productData.country = country.toString().trim();
    }

    const product   = new Product(productData);
    product.slug = await ensureUniqueSlug(
      Product,
      req.body.slug || product.name || product.title,
      product._id
    );
    await product.save();

    const populated = await Product.findById(product._id)
      .populate('category')
      .populate('categories')
      .populate('subCategory')
      .populate('color')
      .populate('FeaturedProduct')
      .populate('country');

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product: populated,
    });
  } catch (error) {
    console.error('Error creating product:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error creating product',
      error: error.message,
    });
  }
};

// ─── View All Products ────────────────────────────────────────────────────────
const productView = async (req, res) => {
  try {
    const data = await Product.find()
      .populate('category')
      .populate('categories')
      .populate('subCategory')
      .populate('color')
      .populate('FeaturedProduct')
      .populate('country')

    return res.json({ success: true, data });
  } catch (err) {
    console.error('All product view failed:', err);
    return res.status(500).json({ success: false, message: 'All product view failed' });
  }
};


// particular data view
const particularView = async (req, res) => {
  try {
    const { country } = req.query;

    let query = {};

    // ✅ Country filter
    if (country) {
      const countryDoc = await Country.findOne({
        name: new RegExp(`^${country}$`, "i")
      });

      if (!countryDoc) {
        return res.json({ success: true, data: [] });
      }

      query.country = countryDoc._id;
    }

    // ✅ FeaturedProduct filter (SAFE CHECK)
    let featuredDoc = null;

    try {
      featuredDoc = await FeaturedProduct.findOne({
        name: "New Arrivals"
      });
    } catch (e) {
      console.log("FeaturedProduct error:", e.message);
    }

    if (featuredDoc) {
      query.FeaturedProduct = { $in: [featuredDoc._id] };
    }

    console.log("Final Query:", query); // 🔥 debug

    const data = await Product.find(query)
      .populate('category')
      .populate('categories')
      .populate('subCategory')
      .populate('color')
      .populate('FeaturedProduct')
      .populate('country');

    return res.json({
      success: true,
      count: data.length,
      data
    });

  } catch (err) {
    console.error('ERROR FULL:', err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};


const countryWiseProducts = async (req, res) => {
  try {
    const { country } = req.query;

    let query = {};

    // ✅ Country filter
    if (country) {
      const countryDoc = await Country.findOne({
        name: new RegExp(`^${country}$`, "i")
      });

      if (!countryDoc) {
        return res.json({ success: true, data: [] });
      }

      query.country = countryDoc._id;
    }

    


    console.log("Final Query:", query); // 🔥 debug

    const data = await Product.find(query)
      .populate('category')
      .populate('categories')
      .populate('subCategory')
      .populate('color')
      .populate('FeaturedProduct')
      .populate('country');

    return res.json({
      success: true,
      count: data.length,
      data
    });

  } catch (err) {
    console.error('ERROR FULL:', err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

const productsByFeaturedLabel = async (req, res) => {
  try {
    const { featured = 'Best Seller', country } = req.query;

    const featuredDoc = await FeaturedProduct.findOne({
      name: new RegExp(`^${String(featured).trim()}$`, 'i'),
    });

    if (!featuredDoc) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const query = {
      FeaturedProduct: { $in: [featuredDoc._id] },
    };

    if (country) {
      const countryDoc = await Country.findOne({
        name: new RegExp(`^${String(country).trim()}$`, 'i'),
      });

      if (!countryDoc) {
        return res.json({ success: true, count: 0, data: [] });
      }

      query.country = countryDoc._id;
    }

    const data = await Product.find(query)
      .populate('category')
      .populate('categories')
      .populate('subCategory')
      .populate('color')
      .populate('FeaturedProduct')
      .populate('country');

    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('Featured product listing failed:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Single Product View  GET /api/allFeaturedProducts/:id ───────────────────
const singleProductView = async (req, res) => {
  try {
    const { id } = req.params;
    const query = isObjectId(id) ? { _id: id } : { slug: String(id).toLowerCase() };

    const product = await Product.findOne(query)
      .populate('category')
      .populate('categories')
      .populate('subCategory')
      .populate('color')
      .populate('FeaturedProduct')
      .populate('country');

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    return res.json({ success: true, product });
  } catch (err) {
    console.error('Single product view failed:', err);
    return res.status(500).json({ success: false, message: 'Single product view failed' });
  }
};

// ─── Update Product  PUT /api/FeaturedProductUpdate/:id ──────────────────────
const productUpdate = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.body) {
      return res.status(400).json({
        success: false,
        message:
          'req.body is undefined. The route must include upload middleware: ' +
          'router.put("/FeaturedProductUpdate/:id", upload.array("images", 10), productUpdate)',
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // 1️⃣ Scalar fields
    const previousSlug = product.slug;
    ['name', 'title', 'description', 'exactPrice', 'discountPrice', 'stock', 'deliveryInfo']
      .forEach(field => {
        if (req.body[field] !== undefined) product[field] = req.body[field];
      });
    await applyProductSeoFields(product, req.body);

    // Categories (multi-select; keeps legacy single category field working)
    const { ids: categoryIds, wasProvided: categoriesProvided } = parseCategoryIds(req.body);
    if (categoriesProvided) {
      product.categories = categoryIds;
      product.category = categoryIds.length > 0 ? categoryIds[0] : null;
    }

    // 2️⃣ subCategories (multi-select; keeps legacy single subCategory working)
    const { ids: subCategoryIds, wasProvided: subCategoriesProvided } = parseSubCategoryIds(req.body);
    if (subCategoriesProvided) {
      product.subCategories = subCategoryIds;
      product.subCategory = subCategoryIds.length > 0 ? subCategoryIds[0] : null;
    }

    // 3️⃣ color
    if (req.body.color !== undefined) {
      const col = req.body.color.toString().trim();
      product.color = col !== '' ? col : null;
    }
    if (req.body.country !== undefined) {
      const cou = req.body.country.toString().trim();
      product.country = cou !== '' ? cou : null;
    }

    // 4️⃣ FeaturedProduct array
    const { ids: featuredIds, wasProvided } = parseFeaturedIds(req.body);
    if (wasProvided) {
      product.FeaturedProduct = featuredIds;
    }

    // 5️⃣ Images
    let existingImages = [];
    if (req.body.existingImages) {
      try { existingImages = JSON.parse(req.body.existingImages); } catch { existingImages = []; }
    }

    let finalImages = [...existingImages];
    if (req.files && req.files.length > 0) {
      finalImages.push(...req.files.map(f => `/uploads/products/${f.filename}`));
    }
    if (finalImages.length === 0) finalImages = product.images;

    product.images = finalImages;
    await product.save();

    if (previousSlug && product.slug && previousSlug !== product.slug) {
      const settings = await getOrCreateSettings(SeoSettings);
      const fromPath = normalizePath(`${settings.productPathPrefix}/${previousSlug}`);
      const toPath = normalizePath(`${settings.productPathPrefix}/${product.slug}`);
      await Redirect.findOneAndUpdate(
        { fromPath },
        { fromPath, toPath, statusCode: 301, isActive: true, note: `Product URL changed: ${product.name}` },
        { upsert: true, new: true }
      );
    }

    const populated = await Product.findById(product._id)
      .populate('category')
      .populate('categories')
      .populate('subCategory')
      .populate('color')
      .populate('FeaturedProduct')
      .populate('country');

    return res.json({ success: true, message: 'Product updated successfully', product: populated });
  } catch (err) {
    console.error('Product update failed:', err);
    return res.status(500).json({ success: false, message: 'Product update failed' });
  }
};

// ─── Delete Product ───────────────────────────────────────────────────────────
const productDelete = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    return res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Product delete failed:', err);
    return res.status(500).json({ success: false, message: 'Product delete failed' });
  }
};

const updateProductSeo = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const previousSlug = product.slug;
    if (req.body.title !== undefined) product.title = req.body.title;
    if (req.body.name !== undefined) product.name = req.body.name;
    if (req.body.description !== undefined) product.description = req.body.description;
    await applyProductSeoFields(product, req.body);
    await product.save();

    if (previousSlug && product.slug && previousSlug !== product.slug) {
      const settings = await getOrCreateSettings(SeoSettings);
      const fromPath = normalizePath(`${settings.productPathPrefix}/${previousSlug}`);
      const toPath = normalizePath(`${settings.productPathPrefix}/${product.slug}`);
      await Redirect.findOneAndUpdate(
        { fromPath },
        { fromPath, toPath, statusCode: 301, isActive: true, note: `Product URL changed: ${product.name}` },
        { upsert: true, new: true }
      );
    }

    return res.json({ success: true, message: 'Product SEO saved', product });
  } catch (err) {
    console.error('Product SEO update failed:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createProduct,
  productView,
  singleProductView,
  productUpdate,
  productDelete,
  particularView,
  countryWiseProducts,
  productsByFeaturedLabel,
  updateProductSeo,
};