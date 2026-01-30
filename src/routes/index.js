const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/boutiques', require('./boutiqueRoutes'));
router.use('/categories', require('./categoryRoutes'));

module.exports = router;
