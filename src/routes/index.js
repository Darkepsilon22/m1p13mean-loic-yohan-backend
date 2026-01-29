const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/boutiques', require('./boutiqueRoutes'));

module.exports = router;
