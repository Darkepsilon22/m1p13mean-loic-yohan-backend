const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/boutiques', require('./boutiqueRoutes'));
router.use('/reviews', require('./reviewRoutes'));
router.use('/categories', require('./categoryRoutes'));
router.use('/events', require('./eventRoutes'));
router.use('/floors', require('./floorRoutes'));
router.use('/zones', require('./zoneRoutes'));
router.use('/special-spaces', require('./specialSpaceRoutes'));
router.use('/map', require('./mapRoutes'));
router.use('/navigation', require('./navigationRoutes'));
router.use('/products', require('./productRoutes'));
router.use('/promotions', require('./promotionRoutes'));
router.use('/stock', require('./stockRoutes'));
router.use('/cart', require('./cartRoutes'));
router.use('/orders', require('./orderRoutes'));
router.use('/payments', require('./paymentRoutes'));
router.use('/stats', require('./statsRoutes'));
router.use('/contracts', require('./contractRoutes'));
router.use('/invoices', require('./invoiceRoutes'));

module.exports = router;
