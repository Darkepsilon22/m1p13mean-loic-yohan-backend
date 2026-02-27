const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { ApiError, asyncHandler } = require('../middlewares/errorHandler');
const { sendVerificationEmail, sendPasswordResetEmail, sendOTPEmail, sendWelcomeEmail, sendApprovalEmail, sendRejectionEmail, sendPendingApprovalEmail } = require('../services/emailService');
const { emitToAdmin, emitToUser } = require('../socket');

/**
 * Generate JWT Token
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = asyncHandler(async (req, res, next) => {
  const { email, password, firstName, lastName, role, phone, adminSecretKey } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return next(new ApiError(400, 'Email already registered'));
  }

  // Handle admin role creation
  let userRole = role;
  
  if (role === 'admin') {
    // Vérifier si une clé secrète admin est fournie
    const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'admin-secret-2024';
    
    if (adminSecretKey !== ADMIN_SECRET_KEY) {
      // Si pas de clé ou clé incorrecte, convertir en acheteur
      userRole = 'acheteur';
      console.warn(`Attempt to create admin account without valid secret key: ${email}`);
    } else {
      // Clé valide, permettre la création d'admin
      console.log(`Admin account creation authorized for: ${email}`);
    }
  }

  // Create user with pending status
  const user = await User.create({
    email: email.toLowerCase(),
    password,
    firstName,
    lastName,
    role: userRole,
    phone: phone || undefined,
    status: 'pending',
    isEmailVerified: false
  });

  // Generate email verification token
  const verificationToken = user.generateVerificationToken();
  await user.save({ validateBeforeSave: false });

  // Send verification email
  try {
    await sendVerificationEmail(user.email, user.firstName, verificationToken);

    emitToAdmin('user:registered', { userId: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      }
    });
  } catch (emailError) {
    console.error('Email sending failed:', emailError);

    emitToAdmin('user:registered', { userId: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Email verification could not be sent. Please request a new verification email.',
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      }
    });
  }
});

/**
 * @desc    Create admin account (protected route, admin only)
 * @route   POST /api/auth/create-admin
 * @access  Private (Admin only)
 */
exports.createAdmin = asyncHandler(async (req, res, next) => {
  const { email, password, firstName, lastName, phone } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return next(new ApiError(400, 'Email already registered'));
  }

  // Create admin user directly (status active, email verified)
  const user = await User.create({
    email: email.toLowerCase(),
    password,
    firstName,
    lastName,
    role: 'admin',
    phone: phone || undefined,
    status: 'active',
    isEmailVerified: true
  });

  res.status(201).json({
    success: true,
    message: 'Admin account created successfully',
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status
      }
    }
  });
});

/**
 * @desc    Verify email address
 * @route   GET /api/auth/verify-email/:token
 * @access  Public
 */
exports.verifyEmail = asyncHandler(async (req, res, next) => {
  const { token } = req.params;

  // Hash the token to compare with stored hash
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // Find user with valid token
  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() }
  });

  if (!user) {
    return next(new ApiError(400, 'Invalid or expired verification token'));
  }

  // Update user - Admin gets active status immediately
  user.isEmailVerified = true;
  user.status = (user.role === 'admin' || user.role === 'acheteur') ? 'active' : 'pending';
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  // Send appropriate email based on role
  try {
    if (user.role === 'boutique') {
      // Boutique accounts need admin approval - send pending email
      await sendPendingApprovalEmail(user.email, user.firstName);
    } else {
      // Acheteur/Admin accounts are active immediately - send welcome email
      await sendWelcomeEmail(user.email, user.firstName);
    }
  } catch (error) {
    console.error('Post-verification email failed:', error);
  }

  // Generate token for auto-login
  const authToken = generateToken(user);

  res.status(200).json({
    success: true,
    message: user.role === 'boutique'
      ? 'Email verified successfully. Your boutique account is pending admin approval.'
      : 'Email verified successfully. You can now login.',
    data: {
      user,
      token: authToken
    }
  });
});

/**
 * @desc    Resend verification email
 * @route   POST /api/auth/resend-verification
 * @access  Public
 */
exports.resendVerification = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    return next(new ApiError(404, 'No account found with this email'));
  }

  if (user.isEmailVerified) {
    return next(new ApiError(400, 'Email is already verified'));
  }

  // Generate new verification token
  const verificationToken = user.generateVerificationToken();
  await user.save({ validateBeforeSave: false });

  // Send verification email
  await sendVerificationEmail(user.email, user.firstName, verificationToken);

  res.status(200).json({
    success: true,
    message: 'Verification email sent successfully'
  });
});

/**
 * @desc    Forgot password - send reset link by email
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });

  // Always return success to avoid revealing whether email exists
  if (!user) {
    return res.status(200).json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.'
    });
  }

  // Blocked users cannot reset password
  if (user.status === 'blocked') {
    return res.status(200).json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.'
    });
  }

  const resetToken = user.generateResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  try {
    await sendPasswordResetEmail(user.email, user.firstName, resetToken);
  } catch (err) {
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save({ validateBeforeSave: false });
    console.error('Password reset email failed:', err);
    return next(new ApiError(500, 'Failed to send reset email. Please try again later.'));
  }

  res.status(200).json({
    success: true,
    message: 'If an account exists with this email, you will receive a password reset link.'
  });
});

/**
 * @desc    Reset password with token from email
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const { token, newPassword } = req.body;

  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() }
  }).select('+password');

  if (!user) {
    return next(new ApiError(400, 'Invalid or expired reset token. Please request a new password reset.'));
  }

  user.password = newPassword;
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password reset successfully. You can now log in with your new password.'
  });
});

/**
 * @desc    Login user - Step 1: Verify credentials and send OTP
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Find user by email (include password for comparison)
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user) {
    return next(new ApiError(401, 'Invalid email or password'));
  }

  // Check if email is verified
  if (!user.isEmailVerified) {
    return next(new ApiError(403, 'Please verify your email before logging in'));
  }

  // Check if account is locked
  if (user.isLocked) {
    const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 60000);
    return next(new ApiError(423, `Account is locked. Try again in ${remainingTime} minutes.`));
  }

  // Check if account is active
  if (user.status === 'inactive') {
    return next(new ApiError(403, 'Your account has been deactivated. Please contact administrator.'));
  }

  if (user.status === 'pending') {
    return next(new ApiError(403, 'Your account is pending approval. Please wait for admin validation.'));
  }

  if (user.status === 'blocked') {
    return next(new ApiError(403, 'Your account has been blocked. Please contact administrator.'));
  }

  // Check password
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    await user.incrementLoginAttempts();

    const attemptsLeft = 5 - (user.loginAttempts + 1);
    if (attemptsLeft > 0) {
      return next(new ApiError(401, `Invalid email or password. ${attemptsLeft} attempts remaining.`));
    } else {
      return next(new ApiError(423, 'Account locked due to too many failed attempts. Try again in 15 minutes.'));
    }
  }

  // Generate OTP
  const otp = user.generateOTP();
  await user.save({ validateBeforeSave: false });

  // Test accounts: return OTP directly without sending email
  const testEmails = ['admin@test.com', 'boutique@test.com', 'acheteur@test.com'];
  if (testEmails.includes(user.email)) {
    return res.status(200).json({
      success: true,
      message: 'OTP generated for test account.',
      data: {
        email: user.email,
        otpRequired: true,
        otp: otp // Returned directly for test accounts only
      }
    });
  }

  // Send OTP via email
  try {
    await sendOTPEmail(user.email, user.firstName, otp);

    res.status(200).json({
      success: true,
      message: 'OTP sent to your email. Please verify to complete login.',
      data: {
        email: user.email,
        otpRequired: true
      }
    });
  } catch (emailError) {
    console.error('OTP email failed:', emailError);
    return next(new ApiError(500, 'Failed to send OTP. Please try again.'));
  }
});

/**
 * @desc    Verify OTP and complete login
 * @route   POST /api/auth/verify-otp
 * @access  Public
 */
exports.verifyOTP = asyncHandler(async (req, res, next) => {
  const { email, otp } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    return next(new ApiError(404, 'User not found'));
  }

  // Check if OTP exists
  if (!user.otp || !user.otpExpires) {
    return next(new ApiError(400, 'No OTP requested. Please login again.'));
  }

  // Check OTP attempts
  if (user.otpAttempts >= 3) {
    user.clearOTP();
    await user.save({ validateBeforeSave: false });
    return next(new ApiError(429, 'Too many failed attempts. Please login again.'));
  }

  // Verify OTP
  if (!user.verifyOTP(otp)) {
    user.otpAttempts += 1;
    await user.save({ validateBeforeSave: false });

    const attemptsLeft = 3 - user.otpAttempts;
    return next(new ApiError(401, `Invalid or expired OTP. ${attemptsLeft} attempts remaining.`));
  }

  // Clear OTP and reset login attempts
  user.clearOTP();
  await user.resetLoginAttempts();
  await user.save({ validateBeforeSave: false });

  // Generate token
  const token = generateToken(user);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user,
      token
    }
  });
});

/**
 * @desc    Resend OTP
 * @route   POST /api/auth/resend-otp
 * @access  Public
 */
exports.resendOTP = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    return next(new ApiError(404, 'User not found'));
  }

  if (!user.isEmailVerified) {
    return next(new ApiError(403, 'Please verify your email first'));
  }

  // Generate new OTP
  const otp = user.generateOTP();
  await user.save({ validateBeforeSave: false });

  // Send OTP via email
  await sendOTPEmail(user.email, user.firstName, otp);

  res.status(200).json({
    success: true,
    message: 'New OTP sent to your email'
  });
});

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  res.status(200).json({
    success: true,
    data: { user }
  });
});

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
exports.updateProfile = asyncHandler(async (req, res, next) => {
  const allowedFields = ['firstName', 'lastName', 'phone', 'avatar'];

  // Filter body to only include allowed fields
  const updates = {};
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updates,
    {
      new: true,
      runValidators: true
    }
  );

  emitToAdmin('user:profileUpdated', { userId: user._id, firstName: user.firstName, lastName: user.lastName });

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: { user }
  });
});

/**
 * @desc    Change password
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
exports.changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');

  // Check current password
  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    return next(new ApiError(401, 'Current password is incorrect'));
  }

  // Update password
  user.password = newPassword;
  await user.save();

  // Generate new token
  const token = generateToken(user);

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
    data: { token }
  });
});

/**
 * @desc    Logout user (client-side should delete token)
 * @route   POST /api/auth/logout
 * @access  Private
 */
exports.logout = asyncHandler(async (req, res, next) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * @desc    Add boutique to favorites
 * @route   POST /api/auth/favorites/:boutiqueId
 * @access  Private (Acheteur only)
 */
exports.addFavorite = asyncHandler(async (req, res, next) => {
  const { boutiqueId } = req.params;

  const user = await User.findById(req.user._id);

  if (user.favorites.includes(boutiqueId)) {
    return next(new ApiError(400, 'Boutique already in favorites'));
  }

  user.favorites.push(boutiqueId);
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Boutique added to favorites',
    data: { favorites: user.favorites }
  });
});

/**
 * @desc    Remove boutique from favorites
 * @route   DELETE /api/auth/favorites/:boutiqueId
 * @access  Private (Acheteur only)
 */
exports.removeFavorite = asyncHandler(async (req, res, next) => {
  const { boutiqueId } = req.params;

  const user = await User.findById(req.user._id);

  if (!user.favorites.includes(boutiqueId)) {
    return next(new ApiError(400, 'Boutique not in favorites'));
  }

  user.favorites = user.favorites.filter(
    fav => fav.toString() !== boutiqueId
  );
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Boutique removed from favorites',
    data: { favorites: user.favorites }
  });
});

/**
 * @desc    Get user favorites
 * @route   GET /api/auth/favorites
 * @access  Private
 */
exports.getFavorites = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id)
    .populate('favorites', 'name logo rating shortDescription');

  res.status(200).json({
    success: true,
    data: { favorites: user.favorites }
  });
});

/**
 * @desc    Verify token validity
 * @route   GET /api/auth/verify
 * @access  Private
 */
exports.verifyToken = asyncHandler(async (req, res, next) => {
  res.status(200).json({
    success: true,
    message: 'Token is valid',
    data: { user: req.user }
  });
});

/**
 * @desc    Get all users (with optional filters)
 * @route   GET /api/auth/users
 * @access  Private (Admin only)
 */
exports.getAllUsers = asyncHandler(async (req, res, next) => {
  const { status, role, search, page = 1, limit = 20 } = req.query;

  // Build filter
  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (role) {
    filter.role = role;
  }

  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    User.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    data: {
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  });
});

/**
 * @desc    Get pending users (boutiques awaiting approval)
 * @route   GET /api/auth/users/pending
 * @access  Private (Admin only)
 */
exports.getPendingUsers = asyncHandler(async (req, res, next) => {
  const users = await User.find({
    status: 'pending',
    isEmailVerified: true
  })
    .select('-password')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: users.length,
    data: { users }
  });
});

/**
 * @desc    Update user status (approve, reject, block, activate)
 * @route   PATCH /api/auth/users/:userId/status
 * @access  Private (Admin only)
 */
exports.updateUserStatus = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { status, reason } = req.body;

  const validStatuses = ['active', 'inactive', 'blocked', 'pending'];
  if (!validStatuses.includes(status)) {
    return next(new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`));
  }

  const user = await User.findById(userId);

  if (!user) {
    return next(new ApiError(404, 'User not found'));
  }

  // Prevent admin from changing their own status
  if (user._id.toString() === req.user._id.toString()) {
    return next(new ApiError(400, 'You cannot change your own status'));
  }

  const previousStatus = user.status;
  user.status = status;

  // If rejecting/blocking, optionally store the reason
  if ((status === 'blocked' || status === 'inactive') && reason) {
    user.statusReason = reason;
  }

  await user.save({ validateBeforeSave: false });

  emitToUser(userId, 'user:statusChanged', { userId, status, previousStatus });

  res.status(200).json({
    success: true,
    message: `User status updated from '${previousStatus}' to '${status}'`,
    data: { user }
  });
});

/**
 * @desc    Approve a boutique account
 * @route   PATCH /api/auth/users/:userId/approve
 * @access  Private (Admin only)
 */
exports.approveUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  const user = await User.findById(userId);

  if (!user) {
    return next(new ApiError(404, 'User not found'));
  }

  if (user.status === 'active') {
    return next(new ApiError(400, 'User is already active'));
  }

  if (!user.isEmailVerified) {
    return next(new ApiError(400, 'User has not verified their email yet'));
  }

  user.status = 'active';
  user.statusReason = undefined;
  await user.save({ validateBeforeSave: false });

  // Send approval notification email
  try {
    // Get boutique name if user is a boutique owner
    let boutiqueName = null;
    if (user.role === 'boutique') {
      const Boutique = require('../models/Boutique');
      const boutique = await Boutique.findOne({ owner: user._id });
      if (boutique) {
        boutiqueName = boutique.name;
      }
    }
    await sendApprovalEmail(user.email, user.firstName, boutiqueName);
  } catch (emailError) {
    console.error('Failed to send approval email:', emailError);
    // Don't fail the request if email fails
  }

  emitToUser(userId, 'user:approved', { userId, firstName: user.firstName, role: user.role });
  emitToAdmin('user:approved', { userId, firstName: user.firstName, role: user.role });

  res.status(200).json({
    success: true,
    message: 'User approved successfully',
    data: { user }
  });
});

/**
 * @desc    Reject a boutique account
 * @route   PATCH /api/auth/users/:userId/reject
 * @access  Private (Admin only)
 */
exports.rejectUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { reason } = req.body;

  const user = await User.findById(userId);

  if (!user) {
    return next(new ApiError(404, 'User not found'));
  }

  user.status = 'inactive';
  user.statusReason = reason || 'Account rejected by administrator';
  await user.save({ validateBeforeSave: false });

  // Send rejection notification email
  try {
    await sendRejectionEmail(user.email, user.firstName, reason);
  } catch (emailError) {
    console.error('Failed to send rejection email:', emailError);
    // Don't fail the request if email fails
  }

  emitToUser(userId, 'user:rejected', { userId, reason: user.statusReason });
  emitToAdmin('user:rejected', { userId, email: user.email, reason: user.statusReason });

  res.status(200).json({
    success: true,
    message: 'User rejected successfully',
    data: { user }
  });
});

/**
 * @desc    Block a user account
 * @route   PATCH /api/auth/users/:userId/block
 * @access  Private (Admin only)
 */
exports.blockUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { reason } = req.body;

  const user = await User.findById(userId);

  if (!user) {
    return next(new ApiError(404, 'User not found'));
  }

  // Prevent admin from blocking themselves
  if (user._id.toString() === req.user._id.toString()) {
    return next(new ApiError(400, 'You cannot block your own account'));
  }

  // Prevent blocking other admins
  if (user.role === 'admin') {
    return next(new ApiError(400, 'Cannot block an admin account'));
  }

  user.status = 'blocked';
  user.statusReason = reason || 'Account blocked by administrator';
  await user.save({ validateBeforeSave: false });

  emitToUser(userId, 'user:blocked', { userId, reason: user.statusReason });
  emitToAdmin('user:blocked', { userId, email: user.email, reason: user.statusReason });

  res.status(200).json({
    success: true,
    message: 'User blocked successfully',
    data: { user }
  });
});

/**
 * @desc    Unblock a user account
 * @route   PATCH /api/auth/users/:userId/unblock
 * @access  Private (Admin only)
 */
exports.unblockUser = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;

  const user = await User.findById(userId);

  if (!user) {
    return next(new ApiError(404, 'User not found'));
  }

  if (user.status !== 'blocked') {
    return next(new ApiError(400, 'User is not blocked'));
  }

  user.status = 'active';
  user.statusReason = undefined;
  await user.save({ validateBeforeSave: false });

  emitToUser(userId, 'user:unblocked', { userId });
  emitToAdmin('user:unblocked', { userId, email: user.email });

  res.status(200).json({
    success: true,
    message: 'User unblocked successfully',
    data: { user }
  });
});

// ==================== EXPORT ====================

const buildUserFilter = (query) => {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.role) filter.role = query.role;
  if (query.search) {
    filter.$or = [
      { firstName: { $regex: query.search, $options: 'i' } },
      { lastName: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } }
    ];
  }
  return filter;
};

const ROLE_LABELS = { admin: 'Admin', boutique: 'Boutique', acheteur: 'Acheteur' };
const STATUS_LABELS = { active: 'Actif', pending: 'En attente', blocked: 'Bloqué', inactive: 'Inactif' };

exports.exportUsersExcel = asyncHandler(async (req, res) => {
  const filter = buildUserFilter(req.query);
  const users = await User.find(filter).select('-password').sort({ createdAt: -1 }).lean();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Smar\'ket';
  const sheet = workbook.addWorksheet('Utilisateurs');

  sheet.mergeCells('A1:F1');
  sheet.getCell('A1').value = 'Liste des utilisateurs — Smar\'ket';
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.mergeCells('A2:F2');
  sheet.getCell('A2').value = `Généré le ${new Date().toLocaleString('fr-FR')} — ${users.length} utilisateur(s)`;
  sheet.getCell('A2').font = { size: 10, color: { argb: 'FF666666' } };

  sheet.columns = [
    { key: 'name', width: 28 },
    { key: 'email', width: 32 },
    { key: 'phone', width: 18 },
    { key: 'role', width: 14 },
    { key: 'status', width: 14 },
    { key: 'createdAt', width: 20 }
  ];

  const headerRow = sheet.getRow(4);
  headerRow.values = ['Nom', 'Email', 'Téléphone', 'Rôle', 'Statut', 'Inscription'];
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4680FF' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center' };
  });

  let rowNum = 5;
  for (const u of users) {
    const row = sheet.getRow(rowNum);
    row.values = [
      `${u.firstName || ''} ${u.lastName || ''}`.trim() || '—',
      u.email,
      u.phone || '—',
      ROLE_LABELS[u.role] || u.role,
      STATUS_LABELS[u.status] || u.status,
      u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '—'
    ];
    rowNum++;
  }

  const totalRow = sheet.getRow(rowNum + 1);
  totalRow.getCell(1).value = `Total : ${users.length} utilisateur(s)`;
  totalRow.getCell(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=utilisateurs-${Date.now()}.xlsx`);
  res.send(Buffer.from(buffer));
});

exports.exportUsersPDF = asyncHandler(async (req, res) => {
  const filter = buildUserFilter(req.query);
  const users = await User.find(filter).select('-password').sort({ createdAt: -1 }).lean();

  const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  doc.on('end', () => {
    const result = Buffer.concat(chunks);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=utilisateurs-${Date.now()}.pdf`);
    res.send(result);
  });

  // Title
  doc.fontSize(18).font('Helvetica-Bold').text('Liste des utilisateurs — Smar\'ket', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').fillColor('#666')
    .text(`Généré le ${new Date().toLocaleString('fr-FR')} — ${users.length} utilisateur(s)`, { align: 'center' });
  doc.moveDown(1);

  // Table header
  const cols = [40, 180, 300, 380, 440, 500];
  const headers = ['Nom', 'Email', 'Rôle', 'Statut', 'Inscription'];
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#fff');
  doc.rect(35, doc.y, 525, 20).fill('#4680ff');
  const headerY = doc.y + 5;
  headers.forEach((h, i) => {
    doc.fillColor('#fff').text(h, cols[i], headerY, { width: (cols[i + 1] || 560) - cols[i], continued: false });
  });
  doc.y = headerY + 20;

  // Rows
  doc.font('Helvetica').fontSize(8).fillColor('#333');
  for (const u of users) {
    if (doc.y > 750) { doc.addPage(); doc.y = 40; }
    const y = doc.y;
    const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || '—';
    doc.text(name, cols[0], y, { width: 135 });
    doc.text(u.email, cols[1], y, { width: 115 });
    doc.text(ROLE_LABELS[u.role] || u.role, cols[2], y, { width: 75 });
    doc.text(STATUS_LABELS[u.status] || u.status, cols[3], y, { width: 55 });
    doc.text(u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '—', cols[4], y, { width: 60 });
    doc.y = y + 16;
    doc.strokeColor('#eee').moveTo(35, doc.y).lineTo(560, doc.y).stroke();
    doc.y += 2;
  }

  doc.moveDown(1);
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#333')
    .text(`Total : ${users.length} utilisateur(s)`);

  doc.end();
});