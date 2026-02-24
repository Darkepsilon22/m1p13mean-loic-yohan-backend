const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
  floorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Floor',
    required: [true, 'Floor is required']
  },
  name: {
    type: String,
    required: [true, 'Zone name is required'],
    trim: true,
    maxlength: [100, 'Zone name cannot exceed 100 characters']
  },
  surfaceTotal: {
    type: Number,
    required: [true, 'Total surface is required'],
    min: [1, 'Surface must be positive']
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

zoneSchema.index({ floorId: 1 });
zoneSchema.index({ name: 1 });

module.exports = mongoose.model('Zone', zoneSchema);
