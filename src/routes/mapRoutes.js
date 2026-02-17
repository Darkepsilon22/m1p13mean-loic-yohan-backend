const express = require('express');
const router = express.Router();
const mapController = require('../controllers/mapController');
const { param, body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Erreur de validation',
      errors: errors.array().map(err => ({ field: err.path, message: err.msg }))
    });
  }
  next();
};

const validateFloorId = [
  param('floorId').isMongoId().withMessage('Format floorId invalide'),
  handleValidationErrors
];

const validateRouteBody = [
  body('toBoutiqueId').isMongoId().withMessage('toBoutiqueId doit être un ObjectId valide'),
  body('fromBoutiqueId').optional().isMongoId().withMessage('fromBoutiqueId doit être un ObjectId valide'),
  body('fromPosition').optional().isObject().withMessage('fromPosition doit être un objet { x, y }'),
  body('fromPosition.x').optional().isFloat().toFloat(),
  body('fromPosition.y').optional().isFloat().toFloat(),
  handleValidationErrors
];

const validatePathfindingBody = [
  body('fromBoutiqueId').isMongoId().withMessage('fromBoutiqueId doit être un ObjectId valide'),
  body('toBoutiqueId').isMongoId().withMessage('toBoutiqueId doit être un ObjectId valide'),
  body('avoidStairs').optional().isBoolean().withMessage('avoidStairs doit être un booléen'),
  body('accessibleOnly').optional().isBoolean().withMessage('accessibleOnly doit être un booléen'),
  handleValidationErrors
];

// Public: get full floor data for map rendering
router.get('/floor/:floorId', validateFloorId, mapController.getFloorMap);

// Calcul d'itinéraire (segment entre deux boutiques, même étage)
router.post('/route', validateRouteBody, mapController.getRoute);

// Calcul d'itinéraire avec pathfinding (graphe de navigation, multi-étages)
router.post('/route/pathfinding', validatePathfindingBody, mapController.getPathfindingRoute);

module.exports = router;
