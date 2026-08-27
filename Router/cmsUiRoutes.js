const express = require('express');
const multer = require('multer');
const cmsSession = require('../Middlewares/cmsSession');
const { blogUpload } = require('../Middlewares/multer');
const cms = require('../Controllers/cmsUiController');

const router = express.Router();
router.use(cmsSession);
router.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://admin.florivagifts.com http://localhost:5173 http://localhost:3000"
  );
  next();
});

const wrap = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    console.error('CMS UI error', error);
    res.redirect('/api/cms?error=' + encodeURIComponent(error.message || 'Something went wrong'));
  }
};

const handleBlogUpload = (req, res, next) => {
  blogUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE' ? 'Image too large. Maximum size is 5 MB.' : err.message;
      if (req.path.endsWith('/images')) {
        return res.status(400).json({ success: false, message });
      }
      return res.redirect('/api/cms/blog?error=' + encodeURIComponent(message));
    }
    if (err) {
      if (req.path.endsWith('/images')) {
        return res.status(400).json({ success: false, message: err.message });
      }
      return res.redirect('/api/cms/blog?error=' + encodeURIComponent(err.message));
    }
    next();
  });
};

router.get('/', wrap(cms.loginPage));
router.post('/login', wrap(cms.login));
router.get('/logout', wrap(cms.logout));

router.use(cms.requireCms);
router.get('/home', wrap(cms.home));
router.get('/pages', wrap(cms.pages));
router.post('/pages', wrap(cms.createPage));
router.post('/pages/:id', wrap(cms.updatePage));
router.get('/blog', wrap(cms.blog));
router.post('/blog/images', handleBlogUpload, async (req, res) => {
  try {
    await cms.uploadImage(req, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.post('/blog', handleBlogUpload, wrap(cms.createPost));
router.post('/blog/:id', handleBlogUpload, wrap(cms.updatePost));
router.get('/products', wrap(cms.products));
router.post('/products/:id', wrap(cms.updateProduct));
router.get('/redirects', wrap(cms.redirects));
router.post('/redirects', wrap(cms.createRedirect));
router.post('/redirects/:id', wrap(cms.updateRedirect));
router.get('/technical', wrap(cms.technical));
router.post('/technical', wrap(cms.saveTechnical));
router.get('/google', wrap(cms.google));
router.post('/google', wrap(cms.saveGoogle));

module.exports = router;
