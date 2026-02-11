const ContractService = require('../services/contractService');
const { asyncHandler } = require('../middlewares/errorHandler');

/**
 * @desc    Créer un contrat
 * @route   POST /api/contracts
 * @access  Private (admin)
 */
exports.createContract = asyncHandler(async (req, res) => {
  const { boutiqueId, tenantId, reservationId, monthlyRent, deposit, startDate, endDate, billingDay, notes } = req.body;

  if (!boutiqueId || !tenantId || !startDate || !endDate) {
    return res.status(400).json({ success: false, message: 'boutiqueId, tenantId, startDate et endDate sont requis' });
  }

  const contract = await ContractService.createContract(
    { boutiqueId, tenantId, reservationId, monthlyRent, deposit, startDate, endDate, billingDay, notes },
    req.user._id
  );

  res.status(201).json({ success: true, message: 'Contrat créé avec succès', data: contract });
});

/**
 * @desc    Obtenir tous les contrats (admin)
 * @route   GET /api/contracts
 * @access  Private (admin)
 */
exports.getAll = asyncHandler(async (req, res) => {
  const { status, tenant, boutique, page, limit } = req.query;
  const result = await ContractService.getAll({ status, tenant, boutique, page, limit });
  res.status(200).json({ success: true, data: result });
});

/**
 * @desc    Obtenir un contrat par ID
 * @route   GET /api/contracts/:id
 * @access  Private (admin ou propriétaire)
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await ContractService.getById(req.params.id);
  res.status(200).json({ success: true, data: result });
});

/**
 * @desc    Envoyer le contrat pour signature
 * @route   POST /api/contracts/:id/send-signature
 * @access  Private (admin)
 */
exports.sendForSignature = asyncHandler(async (req, res) => {
  const contract = await ContractService.sendForSignature(req.params.id, req.user._id);
  res.status(200).json({ success: true, message: 'Contrat envoyé pour signature', data: contract });
});

/**
 * @desc    Le locataire signe le contrat
 * @route   POST /api/contracts/:id/sign
 * @access  Private (boutique - propriétaire)
 */
exports.signContract = asyncHandler(async (req, res) => {
  const contract = await ContractService.signContract(req.params.id, req.user._id);
  res.status(200).json({ success: true, message: 'Contrat signé avec succès', data: contract });
});

/**
 * @desc    La boutique paie le dépôt de garantie (peut être partiel)
 * @route   POST /api/contracts/my/:id/pay-deposit
 * @access  Private (boutique)
 */
exports.payDeposit = asyncHandler(async (req, res) => {
  const { amount, method, reference, notes } = req.body;
  if (!amount || !method) {
    return res.status(400).json({ success: false, message: 'amount et method sont requis' });
  }
  const contract = await ContractService.payDeposit(req.params.id, req.user._id, { amount, method, reference, notes });
  res.status(200).json({ success: true, message: 'Paiement du dépôt enregistré', data: contract });
});

/**
 * @desc    Admin confirme/valide le dépôt de garantie
 * @route   POST /api/contracts/:id/confirm-deposit
 * @access  Private (admin)
 */
exports.confirmDeposit = asyncHandler(async (req, res) => {
  const contract = await ContractService.confirmDeposit(req.params.id, req.user._id);
  res.status(200).json({ success: true, message: 'Dépôt confirmé et contrat activé', data: contract });
});

/**
 * @desc    Suspendre un contrat
 * @route   POST /api/contracts/:id/suspend
 * @access  Private (admin)
 */
exports.suspendContract = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const contract = await ContractService.suspendContract(req.params.id, req.user._id, reason);
  res.status(200).json({ success: true, message: 'Contrat suspendu', data: contract });
});

/**
 * @desc    Réactiver un contrat suspendu
 * @route   POST /api/contracts/:id/reactivate
 * @access  Private (admin)
 */
exports.reactivateContract = asyncHandler(async (req, res) => {
  const contract = await ContractService.reactivateContract(req.params.id, req.user._id);
  res.status(200).json({ success: true, message: 'Contrat réactivé', data: contract });
});

/**
 * @desc    Résilier un contrat
 * @route   POST /api/contracts/:id/terminate
 * @access  Private (admin)
 */
exports.terminateContract = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const contract = await ContractService.terminateContract(req.params.id, req.user._id, reason);
  res.status(200).json({ success: true, message: 'Contrat résilié', data: contract });
});

/**
 * @desc    Obtenir mon contrat actif (boutique)
 * @route   GET /api/contracts/my/active
 * @access  Private (boutique)
 */
exports.getMyContract = asyncHandler(async (req, res) => {
  const contract = await ContractService.getMyActiveContract(req.user._id);
  res.status(200).json({ success: true, data: contract });
});

/**
 * @desc    Obtenir mon historique de contrats (boutique)
 * @route   GET /api/contracts/my/history
 * @access  Private (boutique)
 */
exports.getMyHistory = asyncHandler(async (req, res) => {
  const contracts = await ContractService.getMyHistory(req.user._id);
  res.status(200).json({ success: true, data: contracts });
});
