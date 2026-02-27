const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const productController = require('../controllers/productController');
const { verifyToken } = require('../middlewares/auth');
const { isAdmin, isAdminOrBoutique } = require('../middlewares/roles');
const { cache } = require('../middlewares/cache');
const {
  validateProductId,
  createProduct,
  updateProduct,
  patchAvailability,
  listProducts
} = require('../middlewares/productValidation');

// Public routes (cached)
router.get('/', listProducts, cache(30), productController.getAll);
router.get('/featured', cache(60), productController.getFeatured);
router.get('/slug/:slug', cache(30), productController.getBySlug);
router.get('/boutique/:boutiqueId', validateProductId('boutiqueId'), cache(30), productController.getByBoutique);

// Protected routes (Boutique owner or Admin)
router.use(verifyToken);

// My products routes (must be before /:id to avoid conflict)
router.get('/my-products', isAdminOrBoutique, productController.getMyProducts);
router.get('/my-products/stats', isAdminOrBoutique, productController.getMyProductsStats);

// Admin-only routes
router.get('/admin/all', isAdmin, productController.adminGetAll);
router.get('/admin/stats', isAdmin, productController.adminGetStats);

// Public route with ID (must be after specific routes)
router.get('/:id', validateProductId('id'), productController.getById);

// Protected routes requiring boutique ownership
router.use(isAdminOrBoutique);

router.get('/import/template', productController.importTemplate);
router.post('/import', upload.single('file'), productController.importExcel);
router.post('/', createProduct, productController.create);
router.put('/:id', validateProductId('id'), updateProduct, productController.update);
router.patch('/:id/availability', validateProductId('id'), patchAvailability, productController.patchAvailability);
router.patch('/:id/featured', validateProductId('id'), productController.toggleFeatured);
router.patch('/:id/archive', validateProductId('id'), productController.archive);
router.patch('/:id/restore', validateProductId('id'), productController.restore);
router.delete('/:id', validateProductId('id'), productController.delete);
router.get('/stats/:boutiqueId', validateProductId('boutiqueId'), productController.getStats);

module.exports = router;
