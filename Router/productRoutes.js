const express = require('express');
const multer = require('multer');
const router = express.Router();
const { createProduct, productView, singleProductView, productUpdate, productDelete, particularView, countryWiseProducts, productsByFeaturedLabel, updateProductSeo } = require('../Controllers/productController');
const { arrayUpload } = require('../Middlewares/multer');
const { authenticateAdmin } = require('../Middlewares/adminAuth');

const handleUpload = (req, res, next) => {
  arrayUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: err.code === 'LIMIT_FILE_SIZE'
          ? 'Image too large. Maximum size is 5 MB per file.'
          : err.message,
      });
    }
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

router.post('/insert', authenticateAdmin, handleUpload, createProduct);
router.get('/productview',productView);
router.get('/particularview',particularView)
router.get('/countrywise',countryWiseProducts)
router.get('/products-by-featured', productsByFeaturedLabel)
router.get('/productview/:id',singleProductView)
router.put('/productupdate/:id', authenticateAdmin, handleUpload, productUpdate);
router.patch('/admin/products/:id/seo', authenticateAdmin, updateProductSeo);
router.delete('/productdelete/:id', authenticateAdmin, productDelete);

module.exports = router;


