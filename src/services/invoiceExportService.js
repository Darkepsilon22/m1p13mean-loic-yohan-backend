const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const STATUS_LABELS = {
  pending: 'En attente',
  paid: 'Payée',
  partial: 'Partielle',
  late: 'En retard',
  default: 'Défaut',
  cancelled: 'Annulée'
};

const TYPE_LABELS = {
  rent: 'Loyer',
  deposit: 'Caution',
  late_fee: 'Frais retard'
};

const formatMGA = (amount) => {
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ar';
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('fr-FR');
};

/**
 * Generate PDF buffer for invoice list
 */
function generateInvoicesPDF(invoices, tenantName, statusLabel) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const margin = 40;
      const pageWidth = doc.page.width - margin * 2;

      // Header
      const title = statusLabel ? `Mes Factures — ${statusLabel}` : 'Mes Factures';
      doc.fontSize(16).font('Helvetica-Bold').text(title, margin, 40);
      if (tenantName) doc.fontSize(10).font('Helvetica').text(`Locataire : ${tenantName}`, margin, 62);
      doc.fontSize(9).text(`Généré le : ${new Date().toLocaleString('fr-FR')}`, margin, 74);
      doc.fontSize(9).text(`Total : ${invoices.length} facture(s)`, margin, 86);
      doc.moveDown();

      if (invoices.length === 0) {
        doc.font('Helvetica').text('Aucune facture.', margin, 110);
        doc.end();
        return;
      }

      let y = 110;
      const rowHeight = 16;
      const colWidths = [110, 80, 70, 60, 55, 65, 75];
      const headers = ['Référence', 'Période', 'Montant dû', 'Payé', 'Reste', 'Statut', 'Échéance'];

      // Table header
      doc.font('Helvetica-Bold').fontSize(8);
      let x = margin;
      headers.forEach((h, i) => {
        doc.text(h, x, y, { width: colWidths[i], align: 'left' });
        x += colWidths[i];
      });
      y += rowHeight;
      doc.moveTo(margin, y).lineTo(margin + pageWidth, y).stroke();
      y += 4;

      // Table rows
      doc.font('Helvetica').fontSize(7);
      for (const inv of invoices) {
        if (y > 750) {
          doc.addPage();
          y = 40;
        }

        const period = inv.periodStart && inv.periodEnd
          ? `${formatDate(inv.periodStart)} - ${formatDate(inv.periodEnd)}`
          : '—';
        const reste = (inv.amountDue || 0) - (inv.amountPaid || 0);

        x = margin;
        doc.text(inv.reference || '—', x, y, { width: colWidths[0] }); x += colWidths[0];
        doc.text(period, x, y, { width: colWidths[1] }); x += colWidths[1];
        doc.text(formatMGA(inv.amountDue || 0), x, y, { width: colWidths[2] }); x += colWidths[2];
        doc.text(formatMGA(inv.amountPaid || 0), x, y, { width: colWidths[3] }); x += colWidths[3];
        doc.text(formatMGA(reste), x, y, { width: colWidths[4] }); x += colWidths[4];
        doc.text(STATUS_LABELS[inv.status] || inv.status, x, y, { width: colWidths[5] }); x += colWidths[5];
        doc.text(formatDate(inv.dueDate), x, y, { width: colWidths[6] });
        y += rowHeight;
      }

      // Total summary
      y += 10;
      if (y > 720) { doc.addPage(); y = 40; }
      doc.moveTo(margin, y).lineTo(margin + pageWidth, y).stroke();
      y += 8;
      const totalDue = invoices.reduce((sum, inv) => sum + (inv.amountDue || 0), 0);
      const totalPaid = invoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
      doc.font('Helvetica-Bold').fontSize(10)
        .text(`Total dû : ${formatMGA(totalDue)}   |   Total payé : ${formatMGA(totalPaid)}   |   Reste : ${formatMGA(totalDue - totalPaid)}`, margin, y);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate Excel buffer for invoice list
 */
async function generateInvoicesExcel(invoices, tenantName, statusLabel) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Smar\'ket';
  const sheet = workbook.addWorksheet('Factures');

  // Title
  sheet.mergeCells('A1:H1');
  const excelTitle = statusLabel
    ? `Mes Factures — ${statusLabel} — ${tenantName || 'Locataire'}`
    : `Mes Factures — ${tenantName || 'Locataire'}`;
  sheet.getCell('A1').value = excelTitle;
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.mergeCells('A2:H2');
  sheet.getCell('A2').value = `Généré le ${new Date().toLocaleString('fr-FR')} — ${invoices.length} facture(s)`;
  sheet.getCell('A2').font = { size: 10, color: { argb: 'FF666666' } };

  // Columns
  sheet.columns = [
    { key: 'reference', width: 28 },
    { key: 'period', width: 26 },
    { key: 'amountDue', width: 16 },
    { key: 'amountPaid', width: 16 },
    { key: 'remaining', width: 16 },
    { key: 'status', width: 14 },
    { key: 'dueDate', width: 14 },
    { key: 'type', width: 12 }
  ];

  // Headers at row 4
  const headerRow = sheet.getRow(4);
  headerRow.values = ['Référence', 'Période', 'Montant dû (Ar)', 'Payé (Ar)', 'Reste (Ar)', 'Statut', 'Échéance', 'Type'];
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center' };
  });

  let rowNum = 5;
  for (const inv of invoices) {
    const period = inv.periodStart && inv.periodEnd
      ? `${formatDate(inv.periodStart)} - ${formatDate(inv.periodEnd)}`
      : '—';
    const reste = (inv.amountDue || 0) - (inv.amountPaid || 0);

    const row = sheet.getRow(rowNum);
    row.values = [
      inv.reference || '—',
      period,
      formatMGA(inv.amountDue || 0),
      formatMGA(inv.amountPaid || 0),
      formatMGA(reste),
      STATUS_LABELS[inv.status] || inv.status,
      formatDate(inv.dueDate),
      TYPE_LABELS[inv.type] || inv.type
    ];
    rowNum++;
  }

  // Total row
  const totalDue = invoices.reduce((sum, inv) => sum + (inv.amountDue || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
  const totalRow = sheet.getRow(rowNum + 1);
  totalRow.getCell(2).value = 'Total :';
  totalRow.getCell(2).font = { bold: true };
  totalRow.getCell(3).value = formatMGA(totalDue);
  totalRow.getCell(3).font = { bold: true };
  totalRow.getCell(4).value = formatMGA(totalPaid);
  totalRow.getCell(4).font = { bold: true };
  totalRow.getCell(5).value = formatMGA(totalDue - totalPaid);
  totalRow.getCell(5).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

module.exports = {
  generateInvoicesPDF,
  generateInvoicesExcel,
  STATUS_LABELS
};
