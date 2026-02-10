const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const STATUS_LABELS = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  processing: 'En préparation',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  completed: 'Terminée',
  cancelled: 'Annulée',
  refunded: 'Remboursée'
};

const PAYMENT_LABELS = {
  pending: 'En attente',
  processing: 'En cours',
  success: 'Payé',
  failed: 'Échoué',
  refunded: 'Remboursé'
};

/**
 * Generate PDF buffer for order history
 */
function generateOrdersPDF(orders, customerName) {
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
      doc.fontSize(16).font('Helvetica-Bold').text('Historique des achats', margin, 40);
      if (customerName) doc.fontSize(10).font('Helvetica').text(`Client : ${customerName}`, margin, 62);
      doc.fontSize(9).text(`Généré le : ${new Date().toLocaleString('fr-FR')}`, margin, 74);
      doc.fontSize(9).text(`Total : ${orders.length} commande(s)`, margin, 86);
      doc.moveDown();

      if (orders.length === 0) {
        doc.font('Helvetica').text('Aucune commande.', margin, 110);
        doc.end();
        return;
      }

      let y = 110;
      const rowHeight = 16;
      const colWidths = [95, 70, 70, 75, 75, 75, 55];
      const headers = ['Référence', 'Date', 'Statut', 'Paiement', 'Articles', 'Total', 'Méthode'];

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
      for (const o of orders) {
        if (y > 750) {
          doc.addPage();
          y = 40;
        }
        const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString('fr-FR') : '—';
        const itemCount = o.items ? o.items.reduce((sum, item) => sum + item.quantity, 0) : 0;

        x = margin;
        doc.text(o.orderReference || '—', x, y, { width: colWidths[0] }); x += colWidths[0];
        doc.text(dateStr, x, y, { width: colWidths[1] }); x += colWidths[1];
        doc.text(STATUS_LABELS[o.status] || o.status, x, y, { width: colWidths[2] }); x += colWidths[2];
        doc.text(PAYMENT_LABELS[o.paymentStatus] || o.paymentStatus, x, y, { width: colWidths[3] }); x += colWidths[3];
        doc.text(`${itemCount} article(s)`, x, y, { width: colWidths[4] }); x += colWidths[4];
        doc.text(`${(o.totalAmount || 0).toLocaleString('fr-FR')} MGA`, x, y, { width: colWidths[5] }); x += colWidths[5];
        doc.text(o.paymentMethod || '—', x, y, { width: colWidths[6] });
        y += rowHeight;

        // Detail items
        if (o.items && o.items.length > 0) {
          doc.font('Helvetica').fontSize(6).fillColor('#666666');
          for (const item of o.items) {
            if (y > 750) { doc.addPage(); y = 40; }
            doc.text(`   → ${item.productName || 'Produit'} x${item.quantity} — ${(item.unitPrice || 0).toLocaleString('fr-FR')} MGA/u`, margin + 10, y, { width: pageWidth - 10 });
            y += 12;
          }
          doc.fillColor('#000000').fontSize(7);
          y += 4;
        }
      }

      // Total summary
      y += 10;
      if (y > 720) { doc.addPage(); y = 40; }
      doc.moveTo(margin, y).lineTo(margin + pageWidth, y).stroke();
      y += 8;
      const totalAmount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      doc.font('Helvetica-Bold').fontSize(10).text(`Total général : ${totalAmount.toLocaleString('fr-FR')} MGA`, margin, y);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate Excel buffer for order history
 */
async function generateOrdersExcel(orders, customerName) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Smar\'ket';
  const sheet = workbook.addWorksheet('Historique achats');

  // Summary row
  sheet.mergeCells('A1:G1');
  sheet.getCell('A1').value = `Historique des achats — ${customerName || 'Client'}`;
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.mergeCells('A2:G2');
  sheet.getCell('A2').value = `Généré le ${new Date().toLocaleString('fr-FR')} — ${orders.length} commande(s)`;
  sheet.getCell('A2').font = { size: 10, color: { argb: 'FF666666' } };

  // Headers at row 4
  sheet.columns = [
    { key: 'reference', width: 22 },
    { key: 'date', width: 14 },
    { key: 'status', width: 14 },
    { key: 'payment', width: 14 },
    { key: 'items', width: 30 },
    { key: 'total', width: 16 },
    { key: 'method', width: 12 }
  ];

  const headerRow = sheet.getRow(4);
  headerRow.values = ['Référence', 'Date', 'Statut', 'Paiement', 'Articles', 'Total (MGA)', 'Méthode'];
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center' };
  });

  let rowNum = 5;
  for (const o of orders) {
    const itemsStr = (o.items || []).map(i => `${i.productName || 'Produit'} x${i.quantity}`).join(', ');
    const row = sheet.getRow(rowNum);
    row.values = [
      o.orderReference || '—',
      o.createdAt ? new Date(o.createdAt).toLocaleDateString('fr-FR') : '—',
      STATUS_LABELS[o.status] || o.status,
      PAYMENT_LABELS[o.paymentStatus] || o.paymentStatus,
      itemsStr,
      o.totalAmount || 0,
      o.paymentMethod || '—'
    ];
    rowNum++;
  }

  // Total row
  const totalRow = sheet.getRow(rowNum + 1);
  totalRow.getCell(5).value = 'Total général :';
  totalRow.getCell(5).font = { bold: true };
  totalRow.getCell(6).value = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  totalRow.getCell(6).font = { bold: true };
  totalRow.getCell(6).numFmt = '#,##0';

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

module.exports = {
  generateOrdersPDF,
  generateOrdersExcel
};
