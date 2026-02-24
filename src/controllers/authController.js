const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
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
    return next(new ApiError(400, 'Cet email est déjà enregistré'));
  }

  // Handle admin role creation
  let userRole = role;
  
  if (role === 'admin') {
    // Vérifier si une clé secrète admin est fournie
    const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'admin-secret-2024';
    
    if (adminSecretKey !== ADMIN_SECRET_KEY) {
      // Si pas de clé ou clé incorrecte, convertir en acheteur
      userRole = 'acheteur';
      console.warn(`Tentative de création de compte admin sans clé secrète valide : ${email}`);
    } else {
      // Clé valide, permettre la création d'admin
      console.log(`Création de compte admin autorisée pour : ${email}`);
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
      message: 'Inscription réussie. Veuillez vérifier votre email pour activer votre compte.',
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
    console.error('Échec de l\'envoi de l\'email :', emailError);

    emitToAdmin('user:registered', { userId: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role });

    res.status(201).json({
      success: true,
      message: 'Inscription réussie. L\'email de vérification n\'a pas pu être envoyé. Veuillez demander un nouvel email de vérification.',
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
    return next(new ApiError(400, 'Cet email est déjà enregistré'));
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
    message: 'Compte administrateur créé avec succès',
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
    return next(new ApiError(400, 'Lien de vérification invalide ou expiré'));
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
    console.error('Échec de l\'email post-vérification :', error);
  }

  // Generate token for auto-login
  const authToken = generateToken(user);

  res.status(200).json({
    success: true,
    message: user.role === 'boutique'
      ? 'Email vérifié avec succès. Votre compte boutique est en attente d\'approbation par l\'administrateur.'
      : 'Email vérifié avec succès. Vous pouvez maintenant vous connecter.',
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
    return next(new ApiError(404, 'Aucun compte trouvé avec cet email'));
  }

  if (user.isEmailVerified) {
    return next(new ApiError(400, 'L\'email est déjà vérifié'));
  }

  // Generate new verification token
  const verificationToken = user.generateVerificationToken();
  await user.save({ validateBeforeSave: false });

  // Send verification email
  await sendVerificationEmail(user.email, user.firstName, verificationToken);

  res.status(200).json({
    success: true,
    message: 'Email de vérification envoyé avec succès'
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
      message: 'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.'
    });
  }

  // Blocked users cannot reset password
  if (user.status === 'blocked') {
    return res.status(200).json({
      success: true,
      message: 'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.'
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
    console.error('Échec de l\'email de réinitialisation :', err);
    return next(new ApiError(500, 'Envoi de l\'email de réinitialisation impossible. Veuillez réessayer plus tard.'));
  }

  res.status(200).json({
    success: true,
    message: 'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.'
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
    return next(new ApiError(400, 'Lien de réinitialisation invalide ou expiré. Veuillez demander une nouvelle réinitialisation.'));
  }

  user.password = newPassword;
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.'
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
    return next(new ApiError(401, 'Email ou mot de passe incorrect'));
  }

  // Check if email is verified
  if (!user.isEmailVerified) {
    return next(new ApiError(403, 'Veuillez vérifier votre email avant de vous connecter'));
  }

  // Check if account is locked
  if (user.isLocked) {
    const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 60000);
    return next(new ApiError(423, `Compte verrouillé. Réessayez dans ${remainingTime} minute(s).`));
  }

  // Check if account is active
  if (user.status === 'inactive') {
    return next(new ApiError(403, 'Votre compte a été désactivé. Veuillez contacter l\'administrateur.'));
  }

  if (user.status === 'pending') {
    return next(new ApiError(403, 'Votre compte est en attente d\'approbation. Veuillez attendre la validation par l\'administrateur.'));
  }

  if (user.status === 'blocked') {
    return next(new ApiError(403, 'Votre compte a été bloqué. Veuillez contacter l\'administrateur.'));
  }

  // Check password
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    await user.incrementLoginAttempts();

    const attemptsLeft = 5 - (user.loginAttempts + 1);
    if (attemptsLeft > 0) {
      return next(new ApiError(401, `Email ou mot de passe incorrect. ${attemptsLeft} tentative(s) restante(s).`));
    } else {
      return next(new ApiError(423, 'Compte verrouillé après trop de tentatives. Réessayez dans 15 minutes.'));
    }
  }

  // Generate OTP
  const otp = user.generateOTP();
  await user.save({ validateBeforeSave: false });

  // Send OTP via email
  try {
    await sendOTPEmail(user.email, user.firstName, otp);

    res.status(200).json({
      success: true,
      message: 'Code OTP envoyé à votre email. Veuillez le vérifier pour terminer la connexion.',
      data: {
        email: user.email,
        otpRequired: true
      }
    });
  } catch (emailError) {
    console.error('Échec de l\'envoi de l\'OTP :', emailError);
    return next(new ApiError(500, 'Envoi du code OTP impossible. Veuillez réessayer.'));
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
    return next(new ApiError(404, 'Utilisateur introuvable'));
  }

  // Check if OTP exists
  if (!user.otp || !user.otpExpires) {
    return next(new ApiError(400, 'Aucun code OTP demandé. Veuillez vous reconnecter.'));
  }

  // Check OTP attempts
  if (user.otpAttempts >= 3) {
    user.clearOTP();
    await user.save({ validateBeforeSave: false });
    return next(new ApiError(429, 'Trop de tentatives échouées. Veuillez vous reconnecter.'));
  }

  // Verify OTP
  if (!user.verifyOTP(otp)) {
    user.otpAttempts += 1;
    await user.save({ validateBeforeSave: false });

    const attemptsLeft = 3 - user.otpAttempts;
    return next(new ApiError(401, `Code OTP invalide ou expiré. ${attemptsLeft} tentative(s) restante(s).`));
  }

  // Clear OTP and reset login attempts
  user.clearOTP();
  await user.resetLoginAttempts();
  await user.save({ validateBeforeSave: false });

  // Generate token
  const token = generateToken(user);

  res.status(200).json({
    success: true,
    message: 'Connexion réussie',
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
    return next(new ApiError(404, 'Utilisateur introuvable'));
  }

  if (!user.isEmailVerified) {
    return next(new ApiError(403, 'Veuillez d\'abord vérifier votre email'));
  }

  // Generate new OTP
  const otp = user.generateOTP();
  await user.save({ validateBeforeSave: false });

  // Send OTP via email
  await sendOTPEmail(user.email, user.firstName, otp);

  res.status(200).json({
    success: true,
    message: 'Nouveau code OTP envoyé à votre email'
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
    message: 'Profil mis à jour avec succès',
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
    return next(new ApiError(401, 'Le mot de passe actuel est incorrect'));
  }

  // Update password
  user.password = newPassword;
  await user.save();

  // Generate new token
  const token = generateToken(user);

  res.status(200).json({
    success: true,
    message: 'Mot de passe modifié avec succès',
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
    message: 'Déconnexion réussie'
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
    return next(new ApiError(400, 'Boutique déjà dans les favoris'));
  }

  user.favorites.push(boutiqueId);
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Boutique ajoutée aux favoris',
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
    return next(new ApiError(400, 'Boutique absente des favoris'));
  }

  user.favorites = user.favorites.filter(
    fav => fav.toString() !== boutiqueId
  );
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Boutique retirée des favoris',
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
    message: 'Token valide',
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
    return next(new ApiError(400, `Statut invalide. Valeurs possibles : ${validStatuses.join(', ')}`));
  }

  const user = await User.findById(userId);

  if (!user) {
    return next(new ApiError(404, 'Utilisateur introuvable'));
  }

  // Prevent admin from changing their own status
  if (user._id.toString() === req.user._id.toString()) {
    return next(new ApiError(400, 'Vous ne pouvez pas modifier votre propre statut'));
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
    message: `Statut de l'utilisateur mis à jour de '${previousStatus}' à '${status}'`,
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
    return next(new ApiError(404, 'Utilisateur introuvable'));
  }

  if (user.status === 'active') {
    return next(new ApiError(400, 'L\'utilisateur est déjà actif'));
  }

  if (!user.isEmailVerified) {
    return next(new ApiError(400, 'L\'utilisateur n\'a pas encore vérifié son email'));
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
    console.error('Échec de l\'envoi de l\'email d\'approbation :', emailError);
    // Don't fail the request if email fails
  }

  emitToUser(userId, 'user:approved', { userId, firstName: user.firstName, role: user.role });

  res.status(200).json({
    success: true,
    message: 'Utilisateur approuvé avec succès',
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
    return next(new ApiError(404, 'Utilisateur introuvable'));
  }

  user.status = 'inactive';
  user.statusReason = reason || 'Compte rejeté par l\'administrateur';
  await user.save({ validateBeforeSave: false });

  // Send rejection notification email
  try {
    await sendRejectionEmail(user.email, user.firstName, reason);
  } catch (emailError) {
    console.error('Échec de l\'envoi de l\'email de rejet :', emailError);
    // Don't fail the request if email fails
  }

  emitToUser(userId, 'user:rejected', { userId, reason: user.statusReason });

  res.status(200).json({
    success: true,
    message: 'Utilisateur rejeté avec succès',
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
    return next(new ApiError(404, 'Utilisateur introuvable'));
  }

  // Prevent admin from blocking themselves
  if (user._id.toString() === req.user._id.toString()) {
    return next(new ApiError(400, 'Vous ne pouvez pas bloquer votre propre compte'));
  }

  // Prevent blocking other admins
  if (user.role === 'admin') {
    return next(new ApiError(400, 'Impossible de bloquer un compte administrateur'));
  }

  user.status = 'blocked';
  user.statusReason = reason || 'Compte bloqué par l\'administrateur';
  await user.save({ validateBeforeSave: false });

  emitToUser(userId, 'user:blocked', { userId, reason: user.statusReason });

  res.status(200).json({
    success: true,
    message: 'Utilisateur bloqué avec succès',
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
    return next(new ApiError(404, 'Utilisateur introuvable'));
  }

  if (user.status !== 'blocked') {
    return next(new ApiError(400, 'L\'utilisateur n\'est pas bloqué'));
  }

  user.status = 'active';
  user.statusReason = undefined;
  await user.save({ validateBeforeSave: false });

  emitToUser(userId, 'user:unblocked', { userId });

  res.status(200).json({
    success: true,
    message: 'Utilisateur débloqué avec succès',
    data: { user }
  });
});