const mongoose = require('mongoose');

const navigationNodeSchema = new mongoose.Schema({
  floorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Floor',
    required: [true, 'Étage requis']
  },
  type: {
    type: String,
    enum: ['intersection', 'corridor', 'stairs', 'elevator', 'entrance', 'parking', 'info', 'poi'],
    required: [true, 'Type de noeud requis']
  },
  x: {
    type: Number,
    required: [true, 'Coordonnée X requise']
  },
  y: {
    type: Number,
    required: [true, 'Coordonnée Y requise']
  },
  label: {
    type: String,
    maxlength: 100
  },
  specialSpaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SpecialSpace',
    default: null
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

// Index pour recherche rapide par étage et type
navigationNodeSchema.index({ floorId: 1, type: 1 });
navigationNodeSchema.index({ floorId: 1, x: 1, y: 1 });

// Validation : empêcher deux noeuds trop proches (distance minimale 5 unités)
navigationNodeSchema.pre('save', async function() {
  if (this.isNew || this.isModified('x') || this.isModified('y') || this.isModified('floorId')) {
    const MIN_DISTANCE = 5;
    const existing = await mongoose.model('NavigationNode').find({
      floorId: this.floorId,
      _id: { $ne: this._id }
    });
    for (const node of existing) {
      const dist = Math.sqrt(Math.pow(this.x - node.x, 2) + Math.pow(this.y - node.y, 2));
      if (dist < MIN_DISTANCE) {
        throw new Error(`Un noeud existe déjà à moins de ${MIN_DISTANCE} unités (distance: ${dist.toFixed(2)})`);
      }
    }
  }
});

module.exports = mongoose.model('NavigationNode', navigationNodeSchema);
