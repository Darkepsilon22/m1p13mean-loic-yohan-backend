const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
  floorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Floor',
    required: [true, 'L\'étage est requis']
  },
  name: {
    type: String,
    required: [true, 'Le nom de la zone est requis'],
    trim: true,
    maxlength: [100, 'Le nom de la zone ne peut pas dépasser 100 caractères']
  },
  surfaceTotal: {
    type: Number,
    required: [true, 'La surface totale est requise'],
    min: [1, 'La surface doit être positive']
  },
  x: {
    type: Number,
    required: [true, 'La coordonnée X est requise'],
    min: 0
  },
  y: {
    type: Number,
    required: [true, 'La coordonnée Y est requise'],
    min: 0
  },
  width: {
    type: Number,
    required: [true, 'La largeur est requise'],
    min: [1, 'La largeur doit être positive']
  },
  height: {
    type: Number,
    required: [true, 'La hauteur est requise'],
    min: [1, 'La hauteur doit être positive']
  }
}, {
  timestamps: true
});

zoneSchema.index({ floorId: 1 });
zoneSchema.index({ name: 1 });

module.exports = mongoose.model('Zone', zoneSchema);
