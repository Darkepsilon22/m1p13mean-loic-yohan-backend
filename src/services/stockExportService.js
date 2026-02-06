const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const StockMovement = require('../models/StockMovement');

const TYPE_LABELS = {
  in: 'Entrée',
  out: 'Sortie',
  adjustment: 'Ajustement',
  initial: 'Initial'
};

/**
 * Get filtered stock movements for a boutique (date range, products, category)
 * @param {string} boutiqueId - Boutique ID
 * @param {Date} dateDebut - Start date (inclusive)
 * @param {Date} dateFin - End date (inclusive)
 * @param {string[]|null} productIds - Optional array of product IDs
 * @param {string|null} category - Optional categoryInternal filter
 * @returns {Promise<Array>} Movements with populated productId
 */
async function getMovementsForExport(boutiqueId, dateDebut, dateFin, productIds, category) {
  const query = { boutiqueId };

  query.createdAt = {};
  if (dateDebut) query.createdAt.$gte = new Date(dateDebut);
  if (dateFin) {
    const end = new Date(dateFin);
    end.setHours(23, 59, 59, 999);
    query.createdAt.$lte = end;
  }

  if (productIds && productIds.length > 0) {
    query.productId = { $in: productIds };
  }

  let movements = await StockMovement.find(query)
    .populate('productId', 'name categoryInternal')
    .populate('userId', 'firstName lastName')
    .sort('createdAt')
    .lean();

  if (category && category.trim()) {
    movements = movements.filter(m => m.productId && m.productId.categoryInternal === category);
  }

  return movements;
}

/**
 * Generate PDF buffer for stock movements
 */
function generateStockPDF(movements, boutiqueName) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const margin = 40;
      const pageWidth = doc.page.width - margin * 2;

      doc.fontSize(16).font('Helvetica-Bold').text('Export mouvements de stock', margin, 40);
      if (boutiqueName) doc.fontSize(10).font('Helvetica').text(`Boutique : ${boutiqueName}`, margin, 62);
      doc.fontSize(9).text(`Généré le : ${new Date().toLocaleString('fr-FR')}`, margin, 74);
      doc.moveDown();

      if (movements.length === 0) {
        doc.font('Helvetica').text('Aucun mouvement sur la période.', margin, 100);
        doc.end();
        return;
      }

      let y = 100;
      const rowHeight = 18;
      const colWidths = [70, 90, 55, 50, 45, 55, 55, 80];
      const headers = ['Date', 'Produit', 'Catégorie', 'Type', 'Qté', 'Avant', 'Après', 'Motif'];

      doc.font('Helvetica-Bold').fontSize(8);
      let x = margin;
      headers.forEach((h, i) => {
        doc.text(h, x, y, { width: colWidths[i], align: 'left' });
        x += colWidths[i];
      });
      y += rowHeight;
      doc.moveTo(margin, y).lineTo(margin + pageWidth, y).stroke();
      y += 6;

      doc.font('Helvetica').fontSize(7);
      for (const m of movements) {
        if (y > 750) {
          doc.addPage();
          y = 40;
        }
        const dateStr = m.createdAt ? new Date(m.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
        const productName = (m.productId && m.productId.name) ? m.productId.name.substring(0, 20) : '—';
        const cat = (m.productId && m.productId.categoryInternal) || '—';
        const type = TYPE_LABELS[m.type] || m.type;
        const reason = (m.reason || m.reference || '—').substring(0, 25);

        x = margin;
        doc.text(dateStr, x, y, { width: colWidths[0] }); x += colWidths[0];
        doc.text(productName, x, y, { width: colWidths[1] }); x += colWidths[1];
        doc.text(cat, x, y, { width: colWidths[2] }); x += colWidths[2];
        doc.text(type, x, y, { width: colWidths[3] }); x += colWidths[3];
        doc.text(String(m.quantity), x, y, { width: colWidths[4] }); x += colWidths[4];
        doc.text(String(m.previousStock), x, y, { width: colWidths[5] }); x += colWidths[5];
        doc.text(String(m.newStock), x, y, { width: colWidths[6] }); x += colWidths[6];
        doc.text(reason, x, y, { width: colWidths[7] });
        y += rowHeight;
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate Excel buffer for stock movements
 */
async function generateStockExcel(movements, boutiqueName) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Centre Commercial';
  const sheet = workbook.addWorksheet('Mouvements stock', { headerRows: 1 });

  sheet.columns = [
    { header: 'Date', key: 'date', width: 18 },
    { header: 'Produit', key: 'productName', width: 25 },
    { header: 'Catégorie', key: 'category', width: 15 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Quantité', key: 'quantity', width: 10 },
    { header: 'Stock avant', key: 'previousStock', width: 12 },
    { header: 'Stock après', key: 'newStock', width: 12 },
    { header: 'Motif', key: 'reason', width: 30 }
  ];
  sheet.getRow(1).font = { bold: true };

  movements.forEach(m => {
    sheet.addRow({
      date: m.createdAt ? new Date(m.createdAt) : '',
      productName: (m.productId && m.productId.name) || '—',
      category: (m.productId && m.productId.categoryInternal) || '—',
      type: TYPE_LABELS[m.type] || m.type,
      quantity: m.quantity,
      previousStock: m.previousStock,
      newStock: m.newStock,
      reason: m.reason || m.reference || '—'
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

module.exports = {
  getMovementsForExport,
  generateStockPDF,
  generateStockExcel
};
