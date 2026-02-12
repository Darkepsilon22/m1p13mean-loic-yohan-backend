const express = require('express');
const router = express.Router();
const mapController = require('../controllers/mapController');
const { param, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({ field: err.path, message: err.msg }))
    });
  }
  next();
};

const validateFloorId = [
  param('floorId').isMongoId().withMessage('Invalid floorId format'),
  handleValidationErrors
];

// Public: get full floor data for map rendering
router.get('/floor/:floorId', validateFloorId, mapController.getFloorMap);

module.exports = router;
