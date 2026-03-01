const InvoiceService = require('../services/invoiceService');
const { generateInvoicesPDF, generateInvoicesExcel, STATUS_LABELS } = require('../services/invoiceExportService');
const { asyncHandler } = require('../middlewares/errorHandler');
const { emitToAdmin, emitToUser } = require('../socket');
const Invoice = require('../models/Invoice');
const User = require('../models/User');

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

/**
 * @desc    Exporter mes factures en Excel
 * @route   GET /api/invoices/my/export/excel
 * @access  Private (boutique)
 */
exports.exportMyInvoicesExcel = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const query = { tenant: req.user._id };
  if (status) query.status = status;

  const invoices = await Invoice.find(query)
    .populate('contract', 'reference')
    .populate('boutique', 'name location')
    .sort({ createdAt: -1 });

  const user = await User.findById(req.user._id);
  const tenantName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Locataire';
  const statusLabel = status ? (STATUS_LABELS[status] || status) : null;

  const buffer = await generateInvoicesExcel(invoices, tenantName, statusLabel);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=mes-factures-${new Date().toISOString().slice(0, 10)}.xlsx`);
  res.send(buffer);
});

/**
 * @desc    Exporter mes factures en PDF
 * @route   GET /api/invoices/my/export/pdf
 * @access  Private (boutique)
 */
exports.exportMyInvoicesPdf = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const query = { tenant: req.user._id };
  if (status) query.status = status;

  const invoices = await Invoice.find(query)
    .populate('contract', 'reference')
    .populate('boutique', 'name location')
    .sort({ createdAt: -1 });

  const user = await User.findById(req.user._id);
  const tenantName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Locataire';
  const statusLabel = status ? (STATUS_LABELS[status] || status) : null;

  const buffer = await generateInvoicesPDF(invoices, tenantName, statusLabel);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=mes-factures-${new Date().toISOString().slice(0, 10)}.pdf`);
  res.send(buffer);
});
