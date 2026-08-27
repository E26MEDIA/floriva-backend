const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─── Ensure upload directories exist ─────────────────────────────────────────
const dirs = [
  'uploads/products/',
  'uploads/categories/',
  'uploads/vendors/',
  'uploads/site-content/',
  'uploads/blog/',
];

dirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('✅ Created upload directory:', dir);
  }
});

// ─── Filename helper ──────────────────────────────────────────────────────────
const buildFilename = (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const base = path.basename(file.originalname, ext)
    .replace(/\s+/g, '-')
    .toLowerCase();
  const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
  return `${base}-${unique}${ext}`;
};

// ─── File filter (images only) ────────────────────────────────────────────────
const imageFilter = (req, file, cb) => {
  const allowedExts = /jpeg|jpg|png|gif|webp/;
  const extOk  = allowedExts.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = allowedExts.test(file.mimetype);

  if (extOk && mimeOk) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

// ─── Storage factories ────────────────────────────────────────────────────────
const makeStorage = (folder) =>
  multer.diskStorage({
    destination: (req, file, cb) => cb(null, folder),
    filename:    (req, file, cb) => cb(null, buildFilename(file)),
  });

// ─── Multer instances per domain ──────────────────────────────────────────────
const productUploader  = multer({ storage: makeStorage('uploads/products/'),  fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const categoryUploader = multer({ storage: makeStorage('uploads/categories/'), fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const vendorUploader   = multer({ storage: makeStorage('uploads/vendors/'),    fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const siteContentUploader = multer({ storage: makeStorage('uploads/site-content/'), fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const blogUploader = multer({ storage: makeStorage('uploads/blog/'), fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  // Products  -- field: "image"  (single) | "images" (array / fields)
  singleUpload: productUploader.single('image'),
  arrayUpload:  productUploader.array('images', 10),
  fieldsUpload: productUploader.fields([{ name: 'images', maxCount: 10 }]),

  // Categories -- field: "categoriesimg"
  categoryUpload: categoryUploader.single('categoriesimg'),

  // Vendors -- fields: photo, shopPhoto, shopLicence
  vendorUpload: vendorUploader.fields([
    { name: 'photo',       maxCount: 1 },
    { name: 'shopPhoto',   maxCount: 1 },
    { name: 'shopLicence', maxCount: 1 },
  ]),

  siteContentUpload: siteContentUploader.single('image'),
  blogUpload: blogUploader.single('image'),
};