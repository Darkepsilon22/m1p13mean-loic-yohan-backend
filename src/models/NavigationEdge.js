const mongoose = require('mongoose');

const navigationEdgeSchema = new mongoose.Schema({
  fromNode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NavigationNode',
    required: [true, 'Noeud de départ requis']
  },
  toNode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NavigationNode',
    required: [true, 'Noeud d\'arrivée requis']
  },
  cost: {
    type: Number,
    min: [0.1, 'Le coût doit être positif']
  },
  isBidirectional: {
    type: Boolean,
    default: true
  },
  accessible: {
    type: Boolean,
    default: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index pour recherche rapide
navigationEdgeSchema.index({ fromNode: 1 });
navigationEdgeSchema.index({ toNode: 1 });
navigationEdgeSchema.index({ fromNode: 1, toNode: 1 }, { unique: true });

// Calcul automatique du coût et validation de distance
navigationEdgeSchema.pre('validate', async function() {
  if (this.isNew || this.isModified('fromNode') || this.isModified('toNode')) {
    // Prevent self-referential edges
    if (this.fromNode && this.toNode && this.fromNode.toString() === this.toNode.toString()) {
      throw new Error('Une arête ne peut pas relier un noeud à lui-même');
    }

    const MAX_DISTANCE = 200;
    const fromNode = await mongoose.model('NavigationNode').findById(this.fromNode);
    const toNode = await mongoose.model('NavigationNode').findById(this.toNode);
    if (!fromNode || !toNode) {
      throw new Error('Noeuds invalides');
    }
    if (fromNode.floorId.toString() !== toNode.floorId.toString()) {
      // Arête inter-étages : pas de limite de distance
      return;
    }
    const dist = Math.sqrt(Math.pow(toNode.x - fromNode.x, 2) + Math.pow(toNode.y - fromNode.y, 2));
    if (dist > MAX_DISTANCE) {
      throw new Error(`Arête trop longue (${dist.toFixed(2)} unités, max: ${MAX_DISTANCE}). Vérifiez qu'il n'y a pas de raccourci à travers un mur.`);
    }
    // Si cost n'est pas défini, utiliser la distance euclidienne
    if (!this.cost || this.cost === 0) {
      this.cost = dist;
    }
  }
});

module.exports = mongoose.model('NavigationEdge', navigationEdgeSchema);
