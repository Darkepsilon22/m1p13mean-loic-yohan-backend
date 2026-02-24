const mongoose = require('mongoose');

const floorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom de l\'étage est requis'],
    trim: true,
    maxlength: [100, 'Le nom de l\'étage ne peut pas dépasser 100 caractères']
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
  },
  order: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

floorSchema.index({ order: 1 });
floorSchema.index({ name: 1 });

module.exports = mongoose.model('Floor', floorSchema);
