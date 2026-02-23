const mongoose = require('mongoose');

const SPECIAL_SPACE_TYPES = ['relax', 'toilets', 'stairs', 'elevator', 'exit', 'parking'];

const specialSpaceSchema = new mongoose.Schema({
  floorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Floor',
    required: [true, 'L\'étage est requis']
  },
  type: {
    type: String,
    required: [true, 'Le type est requis'],
    enum: {
      values: SPECIAL_SPACE_TYPES,
      message: `Le type doit être l'un des suivants : ${SPECIAL_SPACE_TYPES.join(', ')}`
    }
  },
  name: {
    type: String,
    trim: true,
    maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères']
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

specialSpaceSchema.index({ floorId: 1 });
specialSpaceSchema.index({ type: 1 });

module.exports = mongoose.model('SpecialSpace', specialSpaceSchema);
module.exports.SPECIAL_SPACE_TYPES = SPECIAL_SPACE_TYPES;
