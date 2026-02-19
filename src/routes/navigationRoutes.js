const express = require('express');
const router = express.Router();
const navigationController = require('../controllers/navigationController');
const { verifyToken } = require('../middlewares/auth');
const { isAdmin } = require('../middlewares/roles');
const { param, body, query, validationResult } = require('express-validator');

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

const validateNodeId = [
  param('id').isMongoId().withMessage('Format ID invalide'),
  handleValidationErrors
];

const validateEdgeId = [
  param('id').isMongoId().withMessage('Format ID invalide'),
  handleValidationErrors
];

const createNode = [
  body('floorId').isMongoId().withMessage('floorId doit être un ObjectId valide'),
  body('type').isIn(['intersection', 'corridor', 'stairs', 'elevator', 'entrance', 'parking', 'info', 'poi']).withMessage('Type invalide'),
  body('x').isFloat().withMessage('X doit être un nombre').toFloat(),
  body('y').isFloat().withMessage('Y doit être un nombre').toFloat(),
  body('label').optional({ values: 'null' }).isLength({ max: 100 }).withMessage('Label ne peut pas dépasser 100 caractères'),
  body('specialSpaceId').optional({ values: 'null' }).isMongoId().withMessage('specialSpaceId doit être un ObjectId valide'),
  body('accessible').optional({ values: 'null' }).isBoolean().withMessage('accessible doit être un booléen'),
  handleValidationErrors
];

const updateNode = [
  body('floorId').optional({ values: 'null' }).isMongoId().withMessage('floorId doit être un ObjectId valide'),
  body('type').optional({ values: 'null' }).isIn(['intersection', 'corridor', 'stairs', 'elevator', 'entrance', 'parking', 'info', 'poi']).withMessage('Type invalide'),
  body('x').optional({ values: 'null' }).isFloat().withMessage('X doit être un nombre').toFloat(),
  body('y').optional({ values: 'null' }).isFloat().withMessage('Y doit être un nombre').toFloat(),
  body('label').optional({ values: 'null' }).isLength({ max: 100 }).withMessage('Label ne peut pas dépasser 100 caractères'),
  body('specialSpaceId').optional({ values: 'null' }).isMongoId().withMessage('specialSpaceId doit être un ObjectId valide'),
  body('accessible').optional({ values: 'null' }).isBoolean().withMessage('accessible doit être un booléen'),
  handleValidationErrors
];

const createEdge = [
  body('fromNode').isMongoId().withMessage('fromNode doit être un ObjectId valide'),
  body('toNode').isMongoId().withMessage('toNode doit être un ObjectId valide'),
  body('cost').optional({ values: 'null' }).isFloat({ min: 0.1 }).withMessage('cost doit être un nombre positif').toFloat(),
  body('isBidirectional').optional({ values: 'null' }).isBoolean().withMessage('isBidirectional doit être un booléen'),
  body('accessible').optional({ values: 'null' }).isBoolean().withMessage('accessible doit être un booléen'),
  handleValidationErrors
];

const updateEdge = [
  body('cost').optional({ values: 'null' }).isFloat({ min: 0.1 }).withMessage('cost doit être un nombre positif').toFloat(),
  body('isBidirectional').optional({ values: 'null' }).isBoolean().withMessage('isBidirectional doit être un booléen'),
  body('accessible').optional({ values: 'null' }).isBoolean().withMessage('accessible doit être un booléen'),
  handleValidationErrors
];

const listNodes = [
  query('floorId').optional().isMongoId().withMessage('floorId doit être un ObjectId valide'),
  query('type').optional().isIn(['intersection', 'corridor', 'stairs', 'elevator', 'entrance', 'parking', 'info', 'poi']).withMessage('Type invalide'),
  handleValidationErrors
];

const listEdges = [
  query('floorId').optional().isMongoId().withMessage('floorId doit être un ObjectId valide'),
  handleValidationErrors
];

// Public routes
router.get('/nodes', listNodes, navigationController.getAllNodes);
router.get('/nodes/:id', validateNodeId, navigationController.getNodeById);
router.get('/edges', listEdges, navigationController.getAllEdges);
router.get('/edges/:id', validateEdgeId, navigationController.getEdgeById);

// Protected routes (Admin only)
router.use(verifyToken);
router.use(isAdmin);

router.post('/nodes', createNode, navigationController.createNode);
router.put('/nodes/:id', validateNodeId, updateNode, navigationController.updateNode);
router.delete('/nodes/:id', validateNodeId, navigationController.deleteNode);

router.post('/edges', createEdge, navigationController.createEdge);
router.put('/edges/:id', validateEdgeId, updateEdge, navigationController.updateEdge);
router.delete('/edges/:id', validateEdgeId, navigationController.deleteEdge);

module.exports = router;
