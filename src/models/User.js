const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters']
  },
  role: {
    type: String,
    enum: {
      values: ['admin', 'boutique', 'acheteur'],
      message: 'Role must be admin, boutique, or acheteur'
    },
    required: [true, 'Role is required']
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  phone: {
    type: String,
    trim: true
  },
  avatar: {
    type: String,
    default: null
  },
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Boutique'
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending', 'blocked'],
    default: 'pending'
  },

  // Email verification fields
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    default: null
  },
  emailVerificationExpires: {
    type: Date,
    default: null
  },

  // OTP fields for login
  otp: {
    type: String,
    default: null
  },
  otpExpires: {
    type: Date,
    default: null
  },
  otpAttempts: {
    type: Number,
    default: 0
  },

  // Password reset (forgot password)
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  },

  // Login security fields
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for better query performance (email index is already defined via unique: true)
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ emailVerificationToken: 1 });
userSchema.index({ resetPasswordToken: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Check if account is locked
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
userSchema.pre('save', async function() {
  // Only hash if password is modified
  if (!this.isModified('password')) return;

  // Hash password with cost of 10
  this.password = await bcrypt.hash(this.password, 10);
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate email verification token
userSchema.methods.generateVerificationToken = function() {
  const token = crypto.randomBytes(32).toString('hex');

  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Token expires in 24 hours
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

  return token;
};

// Method to generate password reset token
userSchema.methods.generateResetPasswordToken = function() {
  const token = crypto.randomBytes(32).toString('hex');

  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Token expires in 1 hour
  this.resetPasswordExpires = Date.now() + 60 * 60 * 1000;

  return token;
};

// Method to generate OTP
userSchema.methods.generateOTP = function() {
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Hash OTP before storing
  this.otp = crypto
    .createHash('sha256')
    .update(otp)
    .digest('hex');

  // OTP expires in X minutes (from env or default 5)
  const expiresIn = parseInt(process.env.OTP_EXPIRES_IN) || 5;
  this.otpExpires = Date.now() + expiresIn * 60 * 1000;
  this.otpAttempts = 0;

  return otp;
};

// Method to verify OTP
userSchema.methods.verifyOTP = function(candidateOTP) {
  const hashedOTP = crypto
    .createHash('sha256')
    .update(candidateOTP)
    .digest('hex');

  return this.otp === hashedOTP && this.otpExpires > Date.now();
};

// Method to clear OTP
userSchema.methods.clearOTP = function() {
  this.otp = null;
  this.otpExpires = null;
  this.otpAttempts = 0;
};

// Method to increment login attempts
userSchema.methods.incrementLoginAttempts = async function() {
  // Reset if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return await this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }

  // Increment attempts
  const updates = { $inc: { loginAttempts: 1 } };

  // Lock account after 5 failed attempts for 15 minutes
  if (this.loginAttempts + 1 >= 5) {
    updates.$set = { lockUntil: Date.now() + 15 * 60 * 1000 };
  }

  return await this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = async function() {
  return await this.updateOne({
    $set: { loginAttempts: 0, lastLogin: new Date() },
    $unset: { lockUntil: 1 }
  });
};

// Remove sensitive data from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.loginAttempts;
  delete user.lockUntil;
  delete user.emailVerificationToken;
  delete user.emailVerificationExpires;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpires;
  delete user.otp;
  delete user.otpExpires;
  delete user.otpAttempts;
  return user;
};

module.exports = mongoose.model('User', userSchema);
