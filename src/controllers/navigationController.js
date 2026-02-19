const NavigationNode = require('../models/NavigationNode');
const NavigationEdge = require('../models/NavigationEdge');
const Floor = require('../models/Floor');
const SpecialSpace = require('../models/SpecialSpace');
const { ApiError, asyncHandler } = require('../middlewares/errorHandler');
const { emitToAdmin } = require('../socket');

/**
 * @desc    Get all navigation nodes (optional filter by floorId, type)
 * @route   GET /api/navigation/nodes
 * @access  Public / Auth
 */
exports.getAllNodes = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.floorId) filter.floorId = req.query.floorId;
  if (req.query.type) filter.type = req.query.type;
  const nodes = await NavigationNode.find(filter)
    .populate('floorId', 'name order')
    .populate('specialSpaceId', 'type name x y width height')
    .sort({ floorId: 1, type: 1, label: 1 })
    .lean();
  res.status(200).json({ success: true, data: nodes });
});

/**
 * @desc    Get node by ID
 * @route   GET /api/navigation/nodes/:id
 * @access  Public / Auth
 */
exports.getNodeById = asyncHandler(async (req, res, next) => {
  const node = await NavigationNode.findById(req.params.id)
    .populate('floorId', 'name order')
    .populate('specialSpaceId', 'type name x y width height')
    .lean();
  if (!node) return next(new ApiError(404, 'Noeud non trouvé'));
  res.status(200).json({ success: true, data: node });
});

/**
 * @desc    Create navigation node
 * @route   POST /api/navigation/nodes
 * @access  Private (Admin)
 */
exports.createNode = asyncHandler(async (req, res, next) => {
  const { floorId, type, x, y, label, specialSpaceId, accessible, metadata } = req.body;
  const floor = await Floor.findById(floorId);
  if (!floor) return next(new ApiError(404, 'Étage non trouvé'));
  if (specialSpaceId) {
    const space = await SpecialSpace.findById(specialSpaceId);
    if (!space) return next(new ApiError(404, 'Espace spécial non trouvé'));
  }
  let node;
  try {
    node = await NavigationNode.create({
      floorId,
      type,
      x,
      y,
      label,
      specialSpaceId: specialSpaceId || null,
      accessible: accessible !== undefined ? accessible : true,
      metadata: metadata || {}
    });
  } catch (err) {
    // Erreur du pre('save') hook (ex: noeud trop proche)
    if (err.message && !err.statusCode) {
      return next(new ApiError(400, err.message));
    }
    throw err;
  }
  const populated = await NavigationNode.findById(node._id)
    .populate('floorId', 'name order')
    .populate('specialSpaceId', 'type name x y width height')
    .lean();
  emitToAdmin('navigation:nodeCreated', { nodeId: populated._id, label: populated.label });
  res.status(201).json({ success: true, message: 'Noeud créé avec succès', data: populated });
});

/**
 * @desc    Update navigation node
 * @route   PUT /api/navigation/nodes/:id
 * @access  Private (Admin)
 */
exports.updateNode = asyncHandler(async (req, res, next) => {
  const node = await NavigationNode.findById(req.params.id);
  if (!node) return next(new ApiError(404, 'Noeud non trouvé'));
  const { floorId, type, x, y, label, specialSpaceId, accessible, metadata } = req.body;
  if (floorId) {
    const floor = await Floor.findById(floorId);
    if (!floor) return next(new ApiError(404, 'Étage non trouvé'));
    node.floorId = floorId;
  }
  if (type) node.type = type;
  if (x !== undefined) node.x = x;
  if (y !== undefined) node.y = y;
  if (label !== undefined) node.label = label;
  if (specialSpaceId !== undefined) {
    if (specialSpaceId) {
      const space = await SpecialSpace.findById(specialSpaceId);
      if (!space) return next(new ApiError(404, 'Espace spécial non trouvé'));
      node.specialSpaceId = specialSpaceId;
    } else {
      node.specialSpaceId = null;
    }
  }
  if (accessible !== undefined) node.accessible = accessible;
  if (metadata !== undefined) node.metadata = metadata;
  try {
    await node.save();
  } catch (err) {
    if (err.message && !err.statusCode) {
      return next(new ApiError(400, err.message));
    }
    throw err;
  }
  const populated = await NavigationNode.findById(node._id)
    .populate('floorId', 'name order')
    .populate('specialSpaceId', 'type name x y width height')
    .lean();
  emitToAdmin('navigation:nodeUpdated', { nodeId: populated._id, label: populated.label });
  res.status(200).json({ success: true, message: 'Noeud mis à jour avec succès', data: populated });
});

/**
 * @desc    Delete navigation node
 * @route   DELETE /api/navigation/nodes/:id
 * @access  Private (Admin)
 */
exports.deleteNode = asyncHandler(async (req, res, next) => {
  const node = await NavigationNode.findById(req.params.id);
  if (!node) return next(new ApiError(404, 'Noeud non trouvé'));
  // Supprimer toutes les arêtes liées
  await NavigationEdge.deleteMany({ $or: [{ fromNode: node._id }, { toNode: node._id }] });
  await NavigationNode.findByIdAndDelete(req.params.id);
  emitToAdmin('navigation:nodeDeleted', { nodeId: req.params.id });
  res.status(200).json({ success: true, message: 'Noeud supprimé avec succès' });
});

/**
 * @desc    Get all navigation edges (optional filter by floorId)
 * @route   GET /api/navigation/edges
 * @access  Public / Auth
 */
exports.getAllEdges = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.floorId) {
    const nodes = await NavigationNode.find({ floorId: req.query.floorId }).select('_id').lean();
    const nodeIds = nodes.map(n => n._id);
    filter.$or = [{ fromNode: { $in: nodeIds } }, { toNode: { $in: nodeIds } }];
  }
  const edges = await NavigationEdge.find(filter)
    .populate('fromNode', 'floorId type x y label')
    .populate('toNode', 'floorId type x y label')
    .lean();
  res.status(200).json({ success: true, data: edges });
});

/**
 * @desc    Get edge by ID
 * @route   GET /api/navigation/edges/:id
 * @access  Public / Auth
 */
exports.getEdgeById = asyncHandler(async (req, res, next) => {
  const edge = await NavigationEdge.findById(req.params.id)
    .populate('fromNode', 'floorId type x y label')
    .populate('toNode', 'floorId type x y label')
    .lean();
  if (!edge) return next(new ApiError(404, 'Arête non trouvée'));
  res.status(200).json({ success: true, data: edge });
});

/**
 * @desc    Create navigation edge
 * @route   POST /api/navigation/edges
 * @access  Private (Admin)
 */
exports.createEdge = asyncHandler(async (req, res, next) => {
  const { fromNode, toNode, cost, isBidirectional, accessible, metadata } = req.body;
  const from = await NavigationNode.findById(fromNode);
  const to = await NavigationNode.findById(toNode);
  if (!from) return next(new ApiError(404, 'Noeud de départ non trouvé'));
  if (!to) return next(new ApiError(404, 'Noeud d\'arrivée non trouvé'));
  if (from._id.toString() === to._id.toString()) {
    return next(new ApiError(400, 'Une arête ne peut pas relier un noeud à lui-même'));
  }
  // Vérifier si l'arête existe déjà
  const existing = await NavigationEdge.findOne({ fromNode, toNode });
  if (existing) {
    return next(new ApiError(400, 'Cette arête existe déjà'));
  }
  const edge = await NavigationEdge.create({
    fromNode,
    toNode,
    cost: cost || undefined, // Sera calculé automatiquement si non fourni
    isBidirectional: isBidirectional !== undefined ? isBidirectional : true,
    accessible: accessible !== undefined ? accessible : true,
    metadata: metadata || {}
  });
  const populated = await NavigationEdge.findById(edge._id)
    .populate('fromNode', 'floorId type x y label')
    .populate('toNode', 'floorId type x y label')
    .lean();
  emitToAdmin('navigation:edgeCreated', { edgeId: populated._id });
  res.status(201).json({ success: true, message: 'Arête créée avec succès', data: populated });
});

/**
 * @desc    Update navigation edge
 * @route   PUT /api/navigation/edges/:id
 * @access  Private (Admin)
 */
exports.updateEdge = asyncHandler(async (req, res, next) => {
  const edge = await NavigationEdge.findById(req.params.id);
  if (!edge) return next(new ApiError(404, 'Arête non trouvée'));
  const { cost, isBidirectional, accessible, metadata } = req.body;
  if (cost !== undefined) edge.cost = cost;
  if (isBidirectional !== undefined) edge.isBidirectional = isBidirectional;
  if (accessible !== undefined) edge.accessible = accessible;
  if (metadata !== undefined) edge.metadata = metadata;
  await edge.save();
  const populated = await NavigationEdge.findById(edge._id)
    .populate('fromNode', 'floorId type x y label')
    .populate('toNode', 'floorId type x y label')
    .lean();
  emitToAdmin('navigation:edgeUpdated', { edgeId: populated._id });
  res.status(200).json({ success: true, message: 'Arête mise à jour avec succès', data: populated });
});

/**
 * @desc    Delete navigation edge
 * @route   DELETE /api/navigation/edges/:id
 * @access  Private (Admin)
 */
exports.deleteEdge = asyncHandler(async (req, res, next) => {
  const edge = await NavigationEdge.findByIdAndDelete(req.params.id);
  if (!edge) return next(new ApiError(404, 'Arête non trouvée'));
  emitToAdmin('navigation:edgeDeleted', { edgeId: req.params.id });
  res.status(200).json({ success: true, message: 'Arête supprimée avec succès' });
});
