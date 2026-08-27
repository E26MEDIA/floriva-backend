const express = require('express');
const multer = require('multer');
const { authenticateAdmin } = require('../Middlewares/adminAuth');
const { blogUpload } = require('../Middlewares/multer');
const seo = require('../Controllers/seoController');
const blog = require('../Controllers/blogController');

const router = express.Router();

const handleBlogUpload = (req, res, next) => {
  blogUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message:
          err.code === 'LIMIT_FILE_SIZE'
            ? 'Image too large. Maximum size is 5 MB.'
            : err.message,
      });
    }
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

router.get('/cms', seo.getCmsSignin);
router.get('/seo/public', seo.getPublicConfig);
router.get('/seo/resolve', seo.resolveSeo);
router.get('/seo/sitemap.xml', seo.getSitemap);
router.get('/seo/robots.txt', seo.getRobots);

router.get('/blog', blog.listPublicPosts);
router.get('/blog/:slug', blog.getPublicPost);

router.get('/admin/seo/settings', authenticateAdmin, seo.getAdminSettings);
router.put('/admin/seo/settings', authenticateAdmin, seo.updateAdminSettings);
router.get('/admin/seo/pages', authenticateAdmin, seo.listPages);
router.post('/admin/seo/pages', authenticateAdmin, seo.createPage);
router.put('/admin/seo/pages/:id', authenticateAdmin, seo.updatePage);
router.delete('/admin/seo/pages/:id', authenticateAdmin, seo.deletePage);
router.get('/admin/seo/redirects', authenticateAdmin, seo.listRedirects);
router.post('/admin/seo/redirects', authenticateAdmin, seo.createRedirect);
router.put('/admin/seo/redirects/:id', authenticateAdmin, seo.updateRedirect);
router.delete('/admin/seo/redirects/:id', authenticateAdmin, seo.deleteRedirect);

router.get('/admin/blog', authenticateAdmin, blog.listAdminPosts);
router.post('/admin/blog', authenticateAdmin, handleBlogUpload, blog.createPost);
router.put('/admin/blog/:id', authenticateAdmin, handleBlogUpload, blog.updatePost);
router.delete('/admin/blog/:id', authenticateAdmin, blog.deletePost);
router.post('/admin/blog/images', authenticateAdmin, handleBlogUpload, blog.uploadBlogImage);

module.exports = router;
