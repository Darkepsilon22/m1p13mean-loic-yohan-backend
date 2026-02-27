const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middlewares/auth');
const { isAdmin } = require('../middlewares/roles');
const { authLimiter, otpLimiter } = require('../middlewares/rateLimiter');
const {
  registerValidation,
  loginValidation,
  updateProfileValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  validateObjectId
} = require('../middlewares/validation');

// Public routes (rate limited)
router.post('/register', authLimiter, registerValidation, authController.register);
router.post('/login', authLimiter, loginValidation, authController.login);

// Email verification routes (public)
router.get('/verify-email/:token', otpLimiter, authController.verifyEmail);
router.post('/resend-verification', otpLimiter, authController.resendVerification);

// Password reset routes (public)
router.post('/forgot-password', authLimiter, forgotPasswordValidation, authController.forgotPassword);
router.post('/reset-password', authLimiter, resetPasswordValidation, authController.resetPassword);

// OTP verification routes (public)
router.post('/verify-otp', otpLimiter, authController.verifyOTP);
router.post('/resend-otp', otpLimiter, authController.resendOTP);

// Protected routes (require authentication)
router.use(verifyToken); // All routes below require authentication

router.get('/me', authController.getMe);
router.get('/verify', authController.verifyToken);
router.put('/profile', updateProfileValidation, authController.updateProfile);
router.put('/change-password', changePasswordValidation, authController.changePassword);
router.post('/logout', authController.logout);

// Admin creation route (admin only)
router.post('/create-admin', isAdmin, registerValidation, authController.createAdmin);

// Favorites routes (for acheteurs)
router.get('/favorites', authController.getFavorites);
router.post('/favorites/:boutiqueId', validateObjectId('boutiqueId'), authController.addFavorite);
router.delete('/favorites/:boutiqueId', validateObjectId('boutiqueId'), authController.removeFavorite);

// Admin routes for user management
router.get('/users', isAdmin, authController.getAllUsers);
router.get('/users/export/excel', isAdmin, authController.exportUsersExcel);
router.get('/users/export/pdf', isAdmin, authController.exportUsersPDF);
router.get('/users/pending', isAdmin, authController.getPendingUsers);
router.patch('/users/:userId/status', isAdmin, validateObjectId('userId'), authController.updateUserStatus);
router.patch('/users/:userId/approve', isAdmin, validateObjectId('userId'), authController.approveUser);
router.patch('/users/:userId/reject', isAdmin, validateObjectId('userId'), authController.rejectUser);
router.patch('/users/:userId/block', isAdmin, validateObjectId('userId'), authController.blockUser);
router.patch('/users/:userId/unblock', isAdmin, validateObjectId('userId'), authController.unblockUser);

module.exports = router;