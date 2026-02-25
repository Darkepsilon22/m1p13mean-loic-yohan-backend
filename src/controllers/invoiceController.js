const InvoiceService = require('../services/invoiceService');
const { asyncHandler } = require('../middlewares/errorHandler');
const { emitToAdmin, emitToUser } = require('../socket');

/**
 * @desc    Obtenir toutes les factures (admin)
 * @route   GET /api/invoices
 * @access  Private (admin)
 */
exports.getAll = asyncHandler(async (req, res) => {
  const { status, tenant, contract, type, page, limit } = req.query;
  const result = await InvoiceService.getAll({ status, tenant, contract, type, page, limit });
  res.status(200).json({ success: true, data: result });
});

/**
 * @desc    Obtenir les factures en retard (admin)
 * @route   GET /api/invoices/admin/late
 * @access  Private (admin)
 */
exports.getLateInvoices = asyncHandler(async (req, res) => {
  const invoices = await InvoiceService.getLateInvoices();
  res.status(200).json({ success: true, data: invoices });
});

/**
 * @desc    Obtenir une facture par ID
 * @route   GET /api/invoices/:id
 * @access  Private (admin ou propriétaire)
 */
exports.getById = asyncHandler(async (req, res) => {
  const invoice = await InvoiceService.getById(req.params.id);
  res.status(200).json({ success: true, data: invoice });
});

/**
 * @desc    Enregistrer un paiement sur une facture
 * @route   POST /api/invoices/:id/pay
 * @access  Private (admin)
 */
exports.recordPayment = asyncHandler(async (req, res) => {
  const { amount, method, reference, notes } = req.body;

  if (!amount || !method) {
    return res.status(400).json({ success: false, message: 'amount et method sont requis' });
  }

  const invoice = await InvoiceService.recordPayment(req.params.id, { amount, method, reference, notes }, req.user._id);

  emitToUser(invoice.tenant.toString(), 'invoice:paymentRecorded', { invoiceId: invoice._id, reference: invoice.reference, amount });
  if (invoice.status === 'paid') {
    emitToUser(invoice.tenant.toString(), 'invoice:paid', { invoiceId: invoice._id, reference: invoice.reference });
  }

  res.status(200).json({ success: true, message: 'Paiement enregistré', data: invoice });
});

/**
 * @desc    Annuler une facture
 * @route   POST /api/invoices/:id/cancel
 * @access  Private (admin)
 */
exports.cancelInvoice = asyncHandler(async (req, res) => {
  const invoice = await InvoiceService.cancelInvoice(req.params.id);

  emitToUser(invoice.tenant.toString(), 'invoice:cancelled', { invoiceId: invoice._id, reference: invoice.reference });

  res.status(200).json({ success: true, message: 'Facture annulée', data: invoice });
});

/**
 * @desc    Obtenir mes factures (boutique)
 * @route   GET /api/invoices/my
 * @access  Private (boutique)
 */
exports.getMyInvoices = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const result = await InvoiceService.getMyInvoices(req.user._id, { status, page, limit });
  res.status(200).json({ success: true, data: result });
});

/**
 * @desc    Obtenir une de mes factures par ID (boutique)
 * @route   GET /api/invoices/my/:id
 * @access  Private (boutique)
 */
exports.getMyInvoiceById = asyncHandler(async (req, res) => {
  const invoice = await InvoiceService.getById(req.params.id);

  if (invoice.tenant._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Accès refusé' });
  }

  res.status(200).json({ success: true, data: invoice });
});

/**
 * @desc    Payer une de mes factures (boutique)
 * @route   POST /api/invoices/my/:id/pay
 * @access  Private (boutique)
 */
exports.payMyInvoice = asyncHandler(async (req, res) => {
  const { amount, method, reference, notes } = req.body;

  if (!amount || !method) {
    return res.status(400).json({ success: false, message: 'amount et method sont requis' });
  }

  const invoice = await InvoiceService.getById(req.params.id);

  if (invoice.tenant._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Accès refusé' });
  }

  const updated = await InvoiceService.recordPayment(req.params.id, { amount, method, reference, notes }, req.user._id);

  emitToAdmin('invoice:paymentRecorded', { invoiceId: updated._id, reference: updated.reference, amount });
  if (updated.status === 'paid') {
    emitToAdmin('invoice:paid', { invoiceId: updated._id, reference: updated.reference });
  }

  res.status(200).json({ success: true, message: 'Paiement enregistré', data: updated });
});
