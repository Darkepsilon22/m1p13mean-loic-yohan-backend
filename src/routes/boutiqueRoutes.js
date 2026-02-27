const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const boutiqueController = require('../controllers/boutiqueController');
const { verifyToken } = require('../middlewares/auth');
const { isAdminOrBoutique, isAdmin, isBoutique } = require('../middlewares/roles');
const {
  validateBoutiqueId,
  createBoutique,
  updateBoutique,
  patchBoutiqueStatus,
  updateBoutiqueLocation,
  listBoutiques
} = require('../middlewares/boutiqueValidation');

const { cache } = require('../middlewares/cache');

// ==================== PUBLIC ROUTES (cached) ====================

// Routes boutiques publiques
router.get('/', listBoutiques, cache(30), boutiqueController.getAll);

router.get('/:id', validateBoutiqueId('id'), cache(30), boutiqueController.getById);

// ==================== PROTECTED ROUTES ====================
router.use(verifyToken);

// ==================== EMPLACEMENTS DISPONIBLES (Admin et Boutique) ====================

// Obtenir les emplacements (boutiques) libres - Admin ET Boutique peuvent voir
router.get('/emplacements/available', isAdminOrBoutique, boutiqueController.getAvailableBoutiques);

// ==================== BOUTIQUE ROUTES (réservation) ====================

// Ma réservation active
router.get('/my/reservation', isBoutique, boutiqueController.getMyActiveReservation);

// Mon historique de réservations
router.get('/my/history', isBoutique, boutiqueController.getMyReservationHistory);

// Réserver une boutique (emplacement) - Étape 1: pré-réservation temporaire
router.post('/:id/reserve', validateBoutiqueId('id'), isBoutique, boutiqueController.reserveBoutique);

// Confirmer une réservation - Étape 2: demande ferme (passe en attente de validation)
router.post('/:id/confirm', validateBoutiqueId('id'), isBoutique, boutiqueController.confirmReservation);

// Annuler une réservation
router.post('/:id/cancel', validateBoutiqueId('id'), isBoutique, boutiqueController.cancelReservation);

// ==================== ADMIN ROUTES (gestion emplacements et validation) ====================

// Statistiques (Admin)
router.get('/emplacements/stats', isAdmin, boutiqueController.getEmplacementStats);

// Tous les emplacements avec filtres (Admin)
router.get('/emplacements/admin/all', isAdmin, boutiqueController.getAllEmplacementsAdmin);

// Réservations en attente de validation (Admin)
router.get('/reservations/pending', isAdmin, boutiqueController.getPendingReservations);

// Valider une réservation - Étape 3a: admin valide
router.post('/:id/validate', validateBoutiqueId('id'), isAdmin, boutiqueController.validateReservation);

// Refuser une réservation - Étape 3b: admin refuse
router.post('/:id/reject', validateBoutiqueId('id'), isAdmin, boutiqueController.rejectReservation);

// Libérer une boutique occupée (Admin - résiliation)
router.post('/:id/release', validateBoutiqueId('id'), isAdmin, boutiqueController.releaseBoutique);

// ==================== ADMIN ONLY ROUTES (création/suppression) ====================

// Import Excel - Admin seulement
router.get('/import/template', isAdmin, boutiqueController.importTemplate);
router.post('/import', isAdmin, upload.single('file'), boutiqueController.importExcel);

// Créer une boutique (emplacement) - Admin seulement
router.post('/', isAdmin, createBoutique, boutiqueController.create);

// Supprimer une boutique - Admin seulement
router.delete('/:id', validateBoutiqueId('id'), isAdmin, boutiqueController.delete);

// ==================== BOUTIQUE OWNER ROUTES (modification de SA boutique) ====================

// Modifier une boutique - Admin ou propriétaire (admin pour placement carte, propriétaire pour ses infos)
router.put('/:id', validateBoutiqueId('id'), isAdminOrBoutique, updateBoutique, boutiqueController.update);

// Modifier le statut (admin pour validation/rejet boutique, propriétaire pour activer/désactiver)
router.patch('/:id/status', validateBoutiqueId('id'), isAdminOrBoutique, patchBoutiqueStatus, boutiqueController.patchStatus);

// Modifier la localisation - Admin seulement (c'est l'emplacement physique)
router.patch('/:id/location', validateBoutiqueId('id'), isAdmin, updateBoutiqueLocation, boutiqueController.updateLocation);

module.exports = router;
