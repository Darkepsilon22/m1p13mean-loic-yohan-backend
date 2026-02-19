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
 * Format amount like invoice emails: "15 000 Ar"
 */
const formatMGA = (amount) => {
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ar';
};

/**
 * Generate PDF buffer for order history
 */
function generateOrdersPDF(orders, customerName, statusLabel) {
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
      const title = statusLabel ? `Historique des achats — ${statusLabel}` : 'Historique des achats';
      doc.fontSize(16).font('Helvetica-Bold').text(title, margin, 40);
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
        doc.text(formatMGA(o.totalAmount || 0), x, y, { width: colWidths[5] }); x += colWidths[5];
        doc.text(o.paymentMethod || '—', x, y, { width: colWidths[6] });
        y += rowHeight;

        // Detail items
        if (o.items && o.items.length > 0) {
          doc.font('Helvetica').fontSize(6).fillColor('#666666');
          for (const item of o.items) {
            if (y > 750) { doc.addPage(); y = 40; }
            doc.text(`   → ${item.productName || 'Produit'} x${item.quantity} — ${formatMGA(item.unitPrice || 0)}/u`, margin + 10, y, { width: pageWidth - 10 });
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
      doc.font('Helvetica-Bold').fontSize(10).text(`Total général : ${formatMGA(totalAmount)}`, margin, y);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate Excel buffer for order history
 */
async function generateOrdersExcel(orders, customerName, statusLabel) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Smar\'ket';
  const sheet = workbook.addWorksheet('Historique achats');

  // Summary row
  sheet.mergeCells('A1:G1');
  const excelTitle = statusLabel
    ? `Historique des achats — ${statusLabel} — ${customerName || 'Client'}`
    : `Historique des achats — ${customerName || 'Client'}`;
  sheet.getCell('A1').value = excelTitle;
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
  headerRow.values = ['Référence', 'Date', 'Statut', 'Paiement', 'Articles', 'Total (Ar)', 'Méthode'];
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
      formatMGA(o.totalAmount || 0),
      o.paymentMethod || '—'
    ];
    rowNum++;
  }

  // Total row
  const totalRow = sheet.getRow(rowNum + 1);
  totalRow.getCell(5).value = 'Total général :';
  totalRow.getCell(5).font = { bold: true };
  totalRow.getCell(6).value = formatMGA(orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0));
  totalRow.getCell(6).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generate monthly report PDF for a boutique
 * @param {Object} reportData - { boutiqueName, month, year, orders, totalRevenue, totalOrders, totalProducts, productsSold }
 */
function generateMonthlyReportPDF(reportData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const margin = 40;
      const pageWidth = doc.page.width - margin * 2;
      const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
      const monthLabel = monthNames[reportData.month - 1] + ' ' + reportData.year;

      // ===== HEADER =====
      doc.fontSize(18).font('Helvetica-Bold').text(`Rapport mensuel — ${monthLabel}`, margin, 40);
      doc.fontSize(11).font('Helvetica').text(`Boutique : ${reportData.boutiqueName}`, margin, 65);
      doc.fontSize(9).text(`Généré le : ${new Date().toLocaleString('fr-FR')}`, margin, 80);

      // ===== RÉSUMÉ =====
      let y = 110;
      doc.moveTo(margin, y).lineTo(margin + pageWidth, y).stroke();
      y += 12;

      doc.fontSize(13).font('Helvetica-Bold').text('Résumé du mois', margin, y);
      y += 22;

      const summaryItems = [
        ['Revenus totaux', formatMGA(reportData.totalRevenue)],
        ['Nombre de commandes', String(reportData.totalOrders)],
        ['Produits vendus (unités)', String(reportData.totalProducts)],
        ['Commandes terminées', String(reportData.completedOrders || 0)],
        ['Commandes annulées', String(reportData.cancelledOrders || 0)]
      ];

      doc.fontSize(10);
      for (const [label, value] of summaryItems) {
        doc.font('Helvetica').text(label + ' :', margin, y, { continued: true, width: 200 });
        doc.font('Helvetica-Bold').text('  ' + value, { width: 200 });
        y += 18;
      }

      // ===== TOP PRODUITS VENDUS =====
      if (reportData.productsSold && reportData.productsSold.length > 0) {
        y += 15;
        if (y > 650) { doc.addPage(); y = 40; }
        doc.moveTo(margin, y).lineTo(margin + pageWidth, y).stroke();
        y += 12;
        doc.fontSize(13).font('Helvetica-Bold').text('Produits les plus vendus', margin, y);
        y += 22;

        const pColWidths = [30, 200, 80, 80, 80];
        const pHeaders = ['#', 'Produit', 'Qté vendue', 'Prix unit.', 'Total'];

        doc.font('Helvetica-Bold').fontSize(8);
        let x = margin;
        pHeaders.forEach((h, i) => {
          doc.text(h, x, y, { width: pColWidths[i], align: 'left' });
          x += pColWidths[i];
        });
        y += 14;
        doc.moveTo(margin, y).lineTo(margin + pageWidth, y).stroke();
        y += 4;

        doc.font('Helvetica').fontSize(8);
        reportData.productsSold.slice(0, 20).forEach((p, idx) => {
          if (y > 750) { doc.addPage(); y = 40; }
          x = margin;
          doc.text(String(idx + 1), x, y, { width: pColWidths[0] }); x += pColWidths[0];
          doc.text(p.productName || 'Produit', x, y, { width: pColWidths[1] }); x += pColWidths[1];
          doc.text(String(p.quantity), x, y, { width: pColWidths[2] }); x += pColWidths[2];
          doc.text(formatMGA(p.unitPrice || 0), x, y, { width: pColWidths[3] }); x += pColWidths[3];
          doc.text(formatMGA(p.totalRevenue || 0), x, y, { width: pColWidths[4] });
          y += 14;
        });
      }

      // ===== DÉTAIL DES COMMANDES =====
      y += 15;
      if (y > 650) { doc.addPage(); y = 40; }
      doc.moveTo(margin, y).lineTo(margin + pageWidth, y).stroke();
      y += 12;
      doc.fontSize(13).font('Helvetica-Bold').text('Détail des commandes', margin, y);
      y += 22;

      if (reportData.orders.length === 0) {
        doc.font('Helvetica').fontSize(9).text('Aucune commande pour ce mois.', margin, y);
      } else {
        const colWidths = [100, 70, 70, 75, 75, 75];
        const headers = ['Référence', 'Date', 'Statut', 'Paiement', 'Articles', 'Montant'];

        doc.font('Helvetica-Bold').fontSize(8);
        let x = margin;
        headers.forEach((h, i) => {
          doc.text(h, x, y, { width: colWidths[i], align: 'left' });
          x += colWidths[i];
        });
        y += 14;
        doc.moveTo(margin, y).lineTo(margin + pageWidth, y).stroke();
        y += 4;

        doc.font('Helvetica').fontSize(7);
        for (const o of reportData.orders) {
          if (y > 750) { doc.addPage(); y = 40; }
          const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString('fr-FR') : '—';
          const itemCount = o.items ? o.items.reduce((sum, item) => sum + item.quantity, 0) : 0;

          x = margin;
          doc.text(o.orderReference || '—', x, y, { width: colWidths[0] }); x += colWidths[0];
          doc.text(dateStr, x, y, { width: colWidths[1] }); x += colWidths[1];
          doc.text(STATUS_LABELS[o.status] || o.status, x, y, { width: colWidths[2] }); x += colWidths[2];
          doc.text(PAYMENT_LABELS[o.paymentStatus] || o.paymentStatus, x, y, { width: colWidths[3] }); x += colWidths[3];
          doc.text(`${itemCount} art.`, x, y, { width: colWidths[4] }); x += colWidths[4];
          doc.text(formatMGA(o.boutiqueTotal || o.totalAmount || 0), x, y, { width: colWidths[5] });
          y += 14;
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate monthly report Excel for a boutique
 */
async function generateMonthlyReportExcel(reportData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Smar\'ket';
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const monthLabel = monthNames[reportData.month - 1] + ' ' + reportData.year;

  // ===== Feuille Résumé =====
  const summarySheet = workbook.addWorksheet('Résumé');
  summarySheet.mergeCells('A1:D1');
  summarySheet.getCell('A1').value = `Rapport mensuel — ${monthLabel}`;
  summarySheet.getCell('A1').font = { bold: true, size: 16 };
  summarySheet.mergeCells('A2:D2');
  summarySheet.getCell('A2').value = `Boutique : ${reportData.boutiqueName}`;
  summarySheet.getCell('A2').font = { size: 11, color: { argb: 'FF333333' } };
  summarySheet.mergeCells('A3:D3');
  summarySheet.getCell('A3').value = `Généré le ${new Date().toLocaleString('fr-FR')}`;
  summarySheet.getCell('A3').font = { size: 9, color: { argb: 'FF666666' } };

  summarySheet.columns = [
    { key: 'label', width: 30 },
    { key: 'value', width: 25 }
  ];

  const summaryData = [
    ['Revenus totaux', formatMGA(reportData.totalRevenue)],
    ['Nombre de commandes', reportData.totalOrders],
    ['Produits vendus (unités)', reportData.totalProducts],
    ['Commandes terminées', reportData.completedOrders || 0],
    ['Commandes annulées', reportData.cancelledOrders || 0]
  ];

  let row = 5;
  const headerRow = summarySheet.getRow(row);
  headerRow.values = ['Indicateur', 'Valeur'];
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });
  row++;

  for (const [label, value] of summaryData) {
    const r = summarySheet.getRow(row);
    r.values = [label, value];
    row++;
  }

  // ===== Feuille Produits vendus =====
  if (reportData.productsSold && reportData.productsSold.length > 0) {
    const prodSheet = workbook.addWorksheet('Produits vendus');
    prodSheet.columns = [
      { key: 'rank', width: 8 },
      { key: 'product', width: 35 },
      { key: 'quantity', width: 15 },
      { key: 'unitPrice', width: 18 },
      { key: 'total', width: 18 }
    ];

    const prodHeader = prodSheet.getRow(1);
    prodHeader.values = ['#', 'Produit', 'Qté vendue', 'Prix unitaire', 'Total'];
    prodHeader.font = { bold: true };
    prodHeader.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center' };
    });

    reportData.productsSold.forEach((p, idx) => {
      const r = prodSheet.getRow(idx + 2);
      r.values = [idx + 1, p.productName || 'Produit', p.quantity, formatMGA(p.unitPrice || 0), formatMGA(p.totalRevenue || 0)];
    });
  }

  // ===== Feuille Commandes =====
  const ordersSheet = workbook.addWorksheet('Commandes');
  ordersSheet.columns = [
    { key: 'reference', width: 22 },
    { key: 'date', width: 14 },
    { key: 'status', width: 14 },
    { key: 'payment', width: 14 },
    { key: 'items', width: 35 },
    { key: 'total', width: 16 }
  ];

  const oHeader = ordersSheet.getRow(1);
  oHeader.values = ['Référence', 'Date', 'Statut', 'Paiement', 'Articles', 'Montant'];
  oHeader.font = { bold: true };
  oHeader.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center' };
  });

  reportData.orders.forEach((o, idx) => {
    const itemsStr = (o.items || []).map(i => `${i.productName || 'Produit'} x${i.quantity}`).join(', ');
    const r = ordersSheet.getRow(idx + 2);
    r.values = [
      o.orderReference || '—',
      o.createdAt ? new Date(o.createdAt).toLocaleDateString('fr-FR') : '—',
      STATUS_LABELS[o.status] || o.status,
      PAYMENT_LABELS[o.paymentStatus] || o.paymentStatus,
      itemsStr,
      formatMGA(o.boutiqueTotal || o.totalAmount || 0)
    ];
  });

  // Total row
  const totalRow = ordersSheet.getRow(reportData.orders.length + 3);
  totalRow.getCell(5).value = 'Total :';
  totalRow.getCell(5).font = { bold: true };
  totalRow.getCell(6).value = formatMGA(reportData.totalRevenue);
  totalRow.getCell(6).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

module.exports = {
  generateOrdersPDF,
  generateOrdersExcel,
  generateMonthlyReportPDF,
  generateMonthlyReportExcel,
  STATUS_LABELS
};
