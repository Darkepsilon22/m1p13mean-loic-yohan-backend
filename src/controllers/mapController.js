const Floor = require('../models/Floor');
const Zone = require('../models/Zone');
const Boutique = require('../models/Boutique');
const SpecialSpace = require('../models/SpecialSpace');
const NavigationNode = require('../models/NavigationNode');
const NavigationEdge = require('../models/NavigationEdge');
const { ApiError, asyncHandler } = require('../middlewares/errorHandler');

/**
 * @desc    Get full floor data for map (zones, boutiques, special spaces)
 * @route   GET /api/map/floor/:floorId
 * @access  Public
 */
exports.getFloorMap = asyncHandler(async (req, res, next) => {
  const floor = await Floor.findById(req.params.floorId).lean();
  if (!floor) return next(new ApiError(404, 'Étage non trouvé'));

  const [zones, boutiques, specialSpaces] = await Promise.all([
    Zone.find({ floorId: floor._id }).lean(),
    Boutique.find({ floorId: floor._id })
      .populate('zoneId', 'name surfaceTotal x y width height')
      .populate('categoryId', 'name')
      .select('name slug surface price emplacementStatus mapShape location zoneId categoryId')
      .lean(),
    SpecialSpace.find({ floorId: floor._id }).lean()
  ]);

  res.status(200).json({
    success: true,
    data: {
      floor,
      zones,
      boutiques,
      specialSpaces
    }
  });
});

/**
 * @desc    Calcul d'un itinéraire (optionnel) : segment entre deux boutiques sur le même étage.
 *          Body: { fromBoutiqueId, toBoutiqueId } ou { fromPosition: {x,y}, toBoutiqueId }.
 * @route   POST /api/map/route
 * @access  Public / Auth
 */
exports.getRoute = asyncHandler(async (req, res, next) => {
  const { fromBoutiqueId, fromPosition, toBoutiqueId } = req.body || {};

  if (!toBoutiqueId) {
    return next(new ApiError(400, 'toBoutiqueId est requis.'));
  }

  let fromX, fromY, toX, toY, floorId;

  if (fromPosition && typeof fromPosition.x === 'number' && typeof fromPosition.y === 'number') {
    fromX = fromPosition.x;
    fromY = fromPosition.y;
  } else if (fromBoutiqueId) {
    const fromBoutique = await Boutique.findById(fromBoutiqueId)
      .select('floorId mapShape')
      .lean();
    if (!fromBoutique) return next(new ApiError(404, 'Boutique de départ non trouvée.'));
    if (!fromBoutique.mapShape || fromBoutique.mapShape.x == null || fromBoutique.mapShape.y == null) {
      return next(new ApiError(400, 'La boutique de départ n\'a pas de position sur le plan.'));
    }
    fromX = fromBoutique.mapShape.x + (fromBoutique.mapShape.width || 0) / 2;
    fromY = fromBoutique.mapShape.y + (fromBoutique.mapShape.height || 0) / 2;
    floorId = fromBoutique.floorId?.toString();
  } else {
    return next(new ApiError(400, 'Indiquez fromBoutiqueId ou fromPosition.'));
  }

  const toBoutique = await Boutique.findById(toBoutiqueId)
    .select('floorId mapShape')
    .lean();
  if (!toBoutique) return next(new ApiError(404, 'Boutique de destination non trouvée.'));
  if (!toBoutique.mapShape || toBoutique.mapShape.x == null || toBoutique.mapShape.y == null) {
    return next(new ApiError(400, 'La boutique de destination n\'a pas de position sur le plan.'));
  }
  toX = toBoutique.mapShape.x + (toBoutique.mapShape.width || 0) / 2;
  toY = toBoutique.mapShape.y + (toBoutique.mapShape.height || 0) / 2;

  const toFloorId = toBoutique.floorId?.toString();
  if (floorId && toFloorId && floorId !== toFloorId) {
    return next(new ApiError(400, 'Départ et destination doivent être sur le même étage (itinéraire multi-étages non géré).'));
  }

  res.status(200).json({
    success: true,
    data: {
      points: [
        { x: fromX, y: fromY },
        { x: toX, y: toY }
      ]
    }
  });
});

/**
 * Trouve le noeud de navigation le plus proche d'un point (x, y) sur un étage
 */
async function findNearestNode(floorId, x, y, accessibleOnly = false) {
  const filter = { floorId };
  if (accessibleOnly) filter.accessible = true;
  const nodes = await NavigationNode.find(filter).lean();
  if (nodes.length === 0) return null;
  let nearest = null;
  let minDist = Infinity;
  for (const node of nodes) {
    const dist = Math.sqrt(Math.pow(node.x - x, 2) + Math.pow(node.y - y, 2));
    if (dist < minDist) {
      minDist = dist;
      nearest = node;
    }
  }
  return nearest;
}

/**
 * Algorithme de Dijkstra pour trouver le plus court chemin dans un graphe
 */
function dijkstra(graph, startNodeId, endNodeId) {
  const distances = {};
  const previous = {};
  const unvisited = new Set();
  
  // Initialisation
  for (const nodeId in graph) {
    distances[nodeId] = Infinity;
    previous[nodeId] = null;
    unvisited.add(nodeId);
  }
  distances[startNodeId] = 0;
  
  while (unvisited.size > 0) {
    // Trouver le noeud non visité avec la distance minimale
    let currentNodeId = null;
    let minDist = Infinity;
    for (const nodeId of unvisited) {
      if (distances[nodeId] < minDist) {
        minDist = distances[nodeId];
        currentNodeId = nodeId;
      }
    }
    
    if (currentNodeId === null || distances[currentNodeId] === Infinity) {
      break; // Pas de chemin possible
    }
    
    unvisited.delete(currentNodeId);
    
    if (currentNodeId === endNodeId) {
      // Chemin trouvé, reconstruire
      const path = [];
      let nodeId = endNodeId;
      while (nodeId !== null) {
        path.unshift(nodeId);
        nodeId = previous[nodeId];
      }
      return { path, cost: distances[endNodeId] };
    }
    
    // Mettre à jour les distances des voisins
    const neighbors = graph[currentNodeId] || {};
    for (const neighborId in neighbors) {
      if (unvisited.has(neighborId)) {
        const alt = distances[currentNodeId] + neighbors[neighborId];
        if (alt < distances[neighborId]) {
          distances[neighborId] = alt;
          previous[neighborId] = currentNodeId;
        }
      }
    }
  }
  
  return null; // Pas de chemin trouvé
}

/**
 * @desc    Calcul d'un itinéraire avec pathfinding (graphe de navigation).
 *          Body: { fromBoutiqueId, toBoutiqueId, avoidStairs?: boolean, accessibleOnly?: boolean }.
 * @route   POST /api/map/route/pathfinding
 * @access  Public / Auth
 */
exports.getPathfindingRoute = asyncHandler(async (req, res, next) => {
  const { fromBoutiqueId, toBoutiqueId, avoidStairs = false, accessibleOnly = false } = req.body || {};
  
  if (!fromBoutiqueId || !toBoutiqueId) {
    return next(new ApiError(400, 'fromBoutiqueId et toBoutiqueId sont requis.'));
  }
  
  // Charger les boutiques
  const fromBoutique = await Boutique.findById(fromBoutiqueId).select('floorId mapShape').lean();
  const toBoutique = await Boutique.findById(toBoutiqueId).select('floorId mapShape').lean();
  
  if (!fromBoutique) return next(new ApiError(404, 'Boutique de départ non trouvée.'));
  if (!toBoutique) return next(new ApiError(404, 'Boutique de destination non trouvée.'));
  if (!fromBoutique.mapShape || !toBoutique.mapShape) {
    return next(new ApiError(400, 'Les boutiques doivent avoir une position sur le plan.'));
  }
  
  const fromFloorId = fromBoutique.floorId?.toString();
  const toFloorId = toBoutique.floorId?.toString();
  const fromX = fromBoutique.mapShape.x + (fromBoutique.mapShape.width || 0) / 2;
  const fromY = fromBoutique.mapShape.y + (fromBoutique.mapShape.height || 0) / 2;
  const toX = toBoutique.mapShape.x + (toBoutique.mapShape.width || 0) / 2;
  const toY = toBoutique.mapShape.y + (toBoutique.mapShape.height || 0) / 2;
  
  // Trouver les noeuds de navigation les plus proches
  const startNode = await findNearestNode(fromFloorId, fromX, fromY, accessibleOnly);
  const endNode = await findNearestNode(toFloorId, toX, toY, accessibleOnly);
  
  if (!startNode) {
    return next(new ApiError(404, `Aucun noeud de navigation trouvé près de la boutique de départ sur l'étage ${fromFloorId}.`));
  }
  if (!endNode) {
    return next(new ApiError(404, `Aucun noeud de navigation trouvé près de la boutique de destination sur l'étage ${toFloorId}.`));
  }
  
  // Collecter tous les noeuds nécessaires (étages de départ et d'arrivée + escaliers/ascenseurs inter-étages)
  const floorIds = new Set([fromFloorId, toFloorId]);
  const nodeFilter = { $or: [{ floorId: fromFloorId }, { floorId: toFloorId }] };
  if (accessibleOnly) nodeFilter.accessible = true;
  if (avoidStairs) {
    nodeFilter.type = { $ne: 'stairs' };
  }
  
  const allNodes = await NavigationNode.find(nodeFilter).lean();
  const nodeMap = {};
  for (const node of allNodes) {
    nodeMap[node._id.toString()] = node;
    if (node.type === 'stairs' || node.type === 'elevator') {
      // Trouver les noeuds correspondants sur d'autres étages (même label ou même specialSpaceId)
      const relatedNodes = await NavigationNode.find({
        $or: [
          { label: node.label, type: node.type, _id: { $ne: node._id } },
          { specialSpaceId: node.specialSpaceId, _id: { $ne: node._id } }
        ]
      }).lean();
      for (const related of relatedNodes) {
        nodeMap[related._id.toString()] = related;
        floorIds.add(related.floorId.toString());
      }
    }
  }
  
  // Charger toutes les arêtes concernant ces noeuds
  const nodeIds = Object.keys(nodeMap);
  const edges = await NavigationEdge.find({
    $or: [
      { fromNode: { $in: nodeIds } },
      { toNode: { $in: nodeIds } }
    ],
    accessible: accessibleOnly ? true : { $exists: true }
  }).lean();
  
  // Construire le graphe (adjacency list)
  const graph = {};
  for (const edge of edges) {
    const fromId = edge.fromNode.toString();
    const toId = edge.toNode.toString();
    if (!graph[fromId]) graph[fromId] = {};
    graph[fromId][toId] = edge.cost;
    if (edge.isBidirectional) {
      if (!graph[toId]) graph[toId] = {};
      graph[toId][fromId] = edge.cost;
    }
  }
  
  // Ajouter les connexions inter-étages pour escaliers/ascenseurs (coût élevé)
  const stairsElevatorNodes = Object.values(nodeMap).filter(n => n.type === 'stairs' || n.type === 'elevator');
  const groupedByLabel = {};
  for (const node of stairsElevatorNodes) {
    const key = node.label || (typeof node.specialSpaceId === 'object' ? node.specialSpaceId?._id?.toString() : node.specialSpaceId?.toString()) || node.type;
    if (!groupedByLabel[key]) groupedByLabel[key] = [];
    groupedByLabel[key].push(node);
  }
  for (const group of Object.values(groupedByLabel)) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const node1Id = group[i]._id.toString();
        const node2Id = group[j]._id.toString();
        const cost = group[i].type === 'elevator' ? 5 : 10; // Ascenseur moins coûteux que escalier
        if (!graph[node1Id]) graph[node1Id] = {};
        if (!graph[node2Id]) graph[node2Id] = {};
        graph[node1Id][node2Id] = cost;
        graph[node2Id][node1Id] = cost;
      }
    }
  }
  
  // Exécuter Dijkstra
  const result = dijkstra(graph, startNode._id.toString(), endNode._id.toString());
  
  if (!result || !result.path || result.path.length === 0) {
    return next(new ApiError(404, 'Aucun chemin trouvé entre les deux points. Vérifiez que les noeuds de navigation sont correctement connectés.'));
  }
  
  // Reconstruire les segments par étage
  const segments = [];
  let currentSegment = null;
  
  // Ajouter le point de départ
  segments.push({
    floorId: fromFloorId,
    points: [{ x: fromX, y: fromY }]
  });
  currentSegment = segments[segments.length - 1];
  
  // Parcourir le chemin de noeuds
  for (let i = 0; i < result.path.length; i++) {
    const nodeId = result.path[i];
    const node = nodeMap[nodeId];
    if (!node) continue;
    
    const nodeFloorId = node.floorId.toString();
    if (!currentSegment || currentSegment.floorId !== nodeFloorId) {
      // Nouveau segment (changement d'étage)
      segments.push({
        floorId: nodeFloorId,
        points: []
      });
      currentSegment = segments[segments.length - 1];
    }
    currentSegment.points.push({ x: node.x, y: node.y });
  }
  
  // Ajouter le point d'arrivée
  if (currentSegment && currentSegment.floorId === toFloorId) {
    currentSegment.points.push({ x: toX, y: toY });
  } else {
    segments.push({
      floorId: toFloorId,
      points: [{ x: toX, y: toY }]
    });
  }
  
  res.status(200).json({
    success: true,
    data: {
      segments,
      totalCost: result.cost,
      nodeCount: result.path.length
    }
  });
});
