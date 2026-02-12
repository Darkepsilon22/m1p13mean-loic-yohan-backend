const mongoose = require('mongoose');

const SPECIAL_SPACE_TYPES = ['relax', 'toilets', 'stairs', 'elevator', 'exit', 'parking'];

const specialSpaceSchema = new mongoose.Schema({
  floorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Floor',
    required: [true, 'Floor is required']
  },
  type: {
    type: String,
    required: [true, 'Type is required'],
    enum: {
      values: SPECIAL_SPACE_TYPES,
      message: `Type must be one of: ${SPECIAL_SPACE_TYPES.join(', ')}`
    }
  },
  name: {
    type: String,
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  x: {
    type: Number,
    required: [true, 'X coordinate is required'],
    min: 0
  },
  y: {
    type: Number,
    required: [true, 'Y coordinate is required'],
    min: 0
  },
  width: {
    type: Number,
    required: [true, 'Width is required'],
    min: [1, 'Width must be positive']
  },
  height: {
    type: Number,
    required: [true, 'Height is required'],
    min: [1, 'Height must be positive']
  }
}, {
  timestamps: true
});

specialSpaceSchema.index({ floorId: 1 });
specialSpaceSchema.index({ type: 1 });

module.exports = mongoose.model('SpecialSpace', specialSpaceSchema);
module.exports.SPECIAL_SPACE_TYPES = SPECIAL_SPACE_TYPES;
