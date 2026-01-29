const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middlewares/auth');
const { isAdmin } = require('../middlewares/roles');
const {
  registerValidation,
  loginValidation,
  updateProfileValidation,
  changePasswordValidation,
  validateObjectId
} = require('../middlewares/validation');

// Public routes
router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);

// Email verification routes (public)
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);

// OTP verification routes (public)
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP);

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

module.exports = router;