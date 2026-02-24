const ContractService = require('../services/contractService');
const Contract = require('../models/Contract');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { asyncHandler } = require('../middlewares/errorHandler');

const CONTRACT_STATUS_LABELS = {
  draft: 'Brouillon',
  pending_signature: 'En attente de signature',
  pending_activation: "En attente d'activation",
  active: 'Actif',
  suspended: 'Suspendu',
  terminated: 'Résilié',
  expired: 'Expiré'
};

const formatMGA = (amount) => {
  return Math.round(amount || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ar';
};

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

/**
 * Build filtered contract query from request params
 */
function buildContractFilter(userId, query) {
  const filter = { tenant: userId };

  if (query.status) {
    filter.status = query.status;
  }

  if (query.reference) {
    filter.reference = { $regex: query.reference, $options: 'i' };
  }

  if (query.dateFrom || query.dateTo) {
    filter.endDate = {};
    if (query.dateFrom) filter.endDate.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      filter.endDate.$lte = end;
    }
  }

  return filter;
}

/**
 * @desc    Export contract history as Excel
 * @route   GET /api/contracts/my/history/export/excel?status=active&reference=REF&dateFrom=2025-01-01&dateTo=2025-12-31
 * @access  Private (boutique)
 */
exports.exportMyHistoryExcel = asyncHandler(async (req, res) => {
  const filter = buildContractFilter(req.user._id, req.query);
  const contracts = await Contract.find(filter)
    .populate('boutique', 'name')
    .sort({ createdAt: -1 })
    .lean();

  const tenantName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Smar\'ket';
  const sheet = workbook.addWorksheet('Historique contrats');

  sheet.mergeCells('A1:G1');
  sheet.getCell('A1').value = `Historique des contrats — ${tenantName || 'Locataire'}`;
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.mergeCells('A2:G2');
  sheet.getCell('A2').value = `Généré le ${new Date().toLocaleString('fr-FR')} — ${contracts.length} contrat(s)`;
  sheet.getCell('A2').font = { size: 10, color: { argb: 'FF666666' } };

  sheet.columns = [
    { key: 'reference', width: 22 },
    { key: 'status', width: 24 },
    { key: 'monthlyRent', width: 18 },
    { key: 'deposit', width: 18 },
    { key: 'startDate', width: 20 },
    { key: 'endDate', width: 20 },
    { key: 'billingDay', width: 16 }
  ];

  const headerRow = sheet.getRow(4);
  headerRow.values = ['Référence', 'Statut', 'Loyer mensuel', 'Caution', 'Date de début', 'Date de fin', 'Jour de facturation'];
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0ABDE3' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center' };
  });

  let rowNum = 5;
  for (const c of contracts) {
    const row = sheet.getRow(rowNum);
    row.values = [
      c.reference || '—',
      CONTRACT_STATUS_LABELS[c.status] || c.status,
      formatMGA(c.monthlyRent),
      formatMGA(c.deposit),
      c.startDate ? new Date(c.startDate).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—',
      c.endDate ? new Date(c.endDate).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—',
      c.billingDay ? `Jour ${c.billingDay}` : '—'
    ];
    rowNum++;
  }

  const totalRow = sheet.getRow(rowNum + 1);
  totalRow.getCell(1).value = `Total : ${contracts.length} contrat(s)`;
  totalRow.getCell(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=historique-contrats-${Date.now()}.xlsx`);
  res.send(Buffer.from(buffer));
});

/**
 * @desc    Export contract history as PDF
 * @route   GET /api/contracts/my/history/export/pdf
 * @access  Private (boutique)
 */
exports.exportMyHistoryPDF = asyncHandler(async (req, res) => {
  const filter = buildContractFilter(req.user._id, req.query);
  const contracts = await Contract.find(filter)
    .populate('boutique', 'name')
    .sort({ createdAt: -1 })
    .lean();

  const tenantName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();

  const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));
  doc.on('end', () => {
    const buffer = Buffer.concat(chunks);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=historique-contrats-${Date.now()}.pdf`);
    res.send(buffer);
  });

  const margin = 40;
  const pageWidth = doc.page.width - margin * 2;

  doc.fontSize(16).font('Helvetica-Bold').text('Historique des contrats', margin, 40);
  if (tenantName) doc.fontSize(10).font('Helvetica').text(`Locataire : ${tenantName}`, margin, 62);
  doc.fontSize(9).text(`Généré le : ${new Date().toLocaleString('fr-FR')}`, margin, 74);
  doc.fontSize(9).text(`Total : ${contracts.length} contrat(s)`, margin, 86);
  doc.moveDown();

  if (contracts.length === 0) {
    doc.font('Helvetica').text('Aucun contrat.', margin, 110);
    doc.end();
    return;
  }

  let y = 110;
  const rowHeight = 16;
  const colWidths = [85, 95, 75, 75, 75, 75];
  const headers = ['Référence', 'Statut', 'Loyer', 'Caution', 'Début', 'Fin'];

  doc.font('Helvetica-Bold').fontSize(8);
  let x = margin;
  headers.forEach((h, i) => {
    doc.text(h, x, y, { width: colWidths[i], align: 'left' });
    x += colWidths[i];
  });
  y += rowHeight;
  doc.moveTo(margin, y).lineTo(margin + pageWidth, y).stroke();
  y += 4;

  doc.font('Helvetica').fontSize(7);
  for (const c of contracts) {
    if (y > 750) { doc.addPage(); y = 40; }
    const startStr = c.startDate ? new Date(c.startDate).toLocaleDateString('fr-FR') : '—';
    const endStr = c.endDate ? new Date(c.endDate).toLocaleDateString('fr-FR') : '—';

    x = margin;
    doc.text(c.reference || '—', x, y, { width: colWidths[0] }); x += colWidths[0];
    doc.text(CONTRACT_STATUS_LABELS[c.status] || c.status, x, y, { width: colWidths[1] }); x += colWidths[1];
    doc.text(formatMGA(c.monthlyRent), x, y, { width: colWidths[2] }); x += colWidths[2];
    doc.text(formatMGA(c.deposit), x, y, { width: colWidths[3] }); x += colWidths[3];
    doc.text(startStr, x, y, { width: colWidths[4] }); x += colWidths[4];
    doc.text(endStr, x, y, { width: colWidths[5] });
    y += rowHeight;
  }

  y += 10;
  if (y > 720) { doc.addPage(); y = 40; }
  doc.moveTo(margin, y).lineTo(margin + pageWidth, y).stroke();
  y += 8;
  doc.font('Helvetica-Bold').fontSize(10).text(`Total : ${contracts.length} contrat(s)`, margin, y);

  doc.end();
});
