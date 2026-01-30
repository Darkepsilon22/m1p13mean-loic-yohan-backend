const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/boutiques', require('./boutiqueRoutes'));
router.use('/reviews', require('./reviewRoutes'));
router.use('/categories', require('./categoryRoutes'));

module.exports = router;
