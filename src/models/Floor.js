const mongoose = require('mongoose');

const floorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Floor name is required'],
    trim: true,
    maxlength: [100, 'Floor name cannot exceed 100 characters']
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
