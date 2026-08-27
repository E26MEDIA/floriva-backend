const express = require('express');
const cmsSession = require('../Middlewares/cmsSession');
const cms = require('../Controllers/cmsUiController');

const router = express.Router();
router.use(cmsSession);

const wrap = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    console.error('CMS UI error', error);
    res.redirect('/api/cms?error=' + encodeURIComponent(error.message || 'Something went wrong'));
  }
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
router.post('/blog', wrap(cms.createPost));
router.post('/blog/:id', wrap(cms.updatePost));
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
