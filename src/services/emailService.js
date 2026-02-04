const { google } = require('googleapis');
const PDFDocument = require('pdfkit');

/**
 * Create OAuth2 client for Gmail API
 */
const createOAuth2Client = () => {
  const OAuth2 = google.auth.OAuth2;
  
  const oauth2Client = new OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.NODE_ENV === 'production' 
      ? process.env.GMAIL_REDIRECT_URI_PROD 
      : process.env.GMAIL_REDIRECT_URI_LOCAL
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN
  });

  return oauth2Client;
};

/**
 * Send email using Gmail API
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content (optional)
 * @param {Array} options.attachments - Attachments array (optional)
 * @param {string} options.attachments[].filename - Attachment filename
 * @param {Buffer} options.attachments[].content - Attachment content as Buffer
 * @param {string} options.attachments[].contentType - MIME type
 */
const sendEmail = async (options) => {
  try {
    const oauth2Client = createOAuth2Client();
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const utf8Subject = `=?utf-8?B?${Buffer.from(options.subject).toString('base64')}?=`;
    const senderName = process.env.EMAIL_SENDER_NAME || 'Centre Commercial';
    const boundary = `boundary_${Date.now().toString(16)}`;

    let message;

    if (options.attachments && options.attachments.length > 0) {
      // Email with attachments (multipart/mixed)
      const messageParts = [
        `From: ${senderName} <${process.env.GMAIL_USER}>`,
        `To: ${options.to}`,
        `Subject: ${utf8Subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=utf-8',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(options.html).toString('base64'),
      ];

      // Add attachments
      for (const attachment of options.attachments) {
        messageParts.push(
          `--${boundary}`,
          `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
          'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="${attachment.filename}"`,
          '',
          attachment.content.toString('base64')
        );
      }

      messageParts.push(`--${boundary}--`);
      message = messageParts.join('\r\n');
    } else {
      // Simple email without attachments
      const messageParts = [
        `From: ${senderName} <${process.env.GMAIL_USER}>`,
        `To: ${options.to}`,
        `Subject: ${utf8Subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        options.html
      ];
      message = messageParts.join('\n');
    }

    // Encode message in base64url format
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send email
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log('Email sent via Gmail API:', result.data.id);
    return { success: true, messageId: result.data.id };
  } catch (error) {
    console.error('Gmail API error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

// Common email styles - Professional minimalist design
const emailStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
  .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
  .card { background: #ffffff; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
  .header { background: #1a1a1a; color: #ffffff; padding: 30px; text-align: center; }
  .header h1 { margin: 0; font-size: 24px; font-weight: 500; }
  .header p { margin: 10px 0 0; opacity: 0.8; font-size: 14px; }
  .content { padding: 30px; }
  .content h2 { margin: 0 0 20px; font-size: 18px; font-weight: 500; color: #1a1a1a; }
  .content p { margin: 0 0 15px; color: #555; }
  .button { display: inline-block; background: #1a1a1a; color: #ffffff !important; padding: 12px 28px; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: 500; margin: 20px 0; }
  .button:hover { background: #333; }
  .info-box { background: #f8f9fa; border-left: 3px solid #1a1a1a; padding: 15px; margin: 20px 0; }
  .warning-box { background: #fff8e6; border-left: 3px solid #f0ad4e; padding: 15px; margin: 20px 0; }
  .success-box { background: #f0f9f0; border-left: 3px solid #28a745; padding: 15px; margin: 20px 0; }
  .list { margin: 20px 0; padding: 0; list-style: none; }
  .list li { padding: 10px 0; border-bottom: 1px solid #eee; color: #555; }
  .list li:last-child { border-bottom: none; }
  .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
  .link { color: #1a1a1a; word-break: break-all; }
  .code-box { background: #f8f9fa; border: 1px solid #e9ecef; padding: 20px; text-align: center; margin: 20px 0; border-radius: 4px; }
  .code { font-size: 32px; font-weight: 600; letter-spacing: 6px; color: #1a1a1a; }
`;

/**
 * Send email verification link
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string} verificationToken - Verification token
 */
const sendVerificationEmail = async (email, firstName, verificationToken) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/auth/verify-email?token=${verificationToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${emailStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <h1>Centre Commercial</h1>
            <p>Verification de votre adresse email</p>
          </div>
          <div class="content">
            <h2>Bonjour ${firstName},</h2>
            <p>Merci de vous etre inscrit sur Centre Commercial. Pour activer votre compte, veuillez cliquer sur le bouton ci-dessous:</p>
            <center>
              <a href="${verificationUrl}" class="button">Verifier mon email</a>
            </center>
            <p>Ou copiez ce lien dans votre navigateur:</p>
            <p class="link">${verificationUrl}</p>
            <div class="info-box">
              <strong>Important:</strong> Ce lien expire dans 24 heures.
            </div>
            <p>Si vous n'avez pas cree de compte, vous pouvez ignorer cet email.</p>
          </div>
          <div class="footer">
            <p>${new Date().getFullYear()} Centre Commercial. Tous droits reserves.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: 'Verifiez votre adresse email - Centre Commercial',
    html
  });
};

/**
 * Send OTP for login
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string} otp - One-time password
 */
const sendOTPEmail = async (email, firstName, otp) => {
  const expiresIn = process.env.OTP_EXPIRES_IN || 5;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${emailStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <h1>Centre Commercial</h1>
            <p>Code de verification</p>
          </div>
          <div class="content">
            <h2>Bonjour ${firstName},</h2>
            <p>Vous avez demande a vous connecter a votre compte. Voici votre code de verification:</p>
            <div class="code-box">
              <div class="code">${otp}</div>
            </div>
            <div class="info-box">
              <strong>Important:</strong> Ce code expire dans ${expiresIn} minutes.
            </div>
            <div class="warning-box">
              <strong>Securite:</strong> Ne partagez jamais ce code avec personne. Notre equipe ne vous demandera jamais votre code.
            </div>
            <p>Si vous n'avez pas tente de vous connecter, veuillez securiser votre compte immediatement.</p>
          </div>
          <div class="footer">
            <p>${new Date().getFullYear()} Centre Commercial. Tous droits reserves.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `${otp} - Votre code de connexion Centre Commercial`,
    html
  });
};

/**
 * Generate invoice PDF
 * @param {Object} order - Order document
 * @param {Object} payment - Payment document
 * @returns {Promise<Buffer>} PDF buffer
 */
const generateInvoicePDF = (order, payment) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        bufferPages: true,
        autoFirstPage: true
      });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 40;
      const contentWidth = pageWidth - (margin * 2);

      const formatCurrency = (amount, currency = 'MGA') => {
        return new Intl.NumberFormat('fr-MG', {
          style: 'decimal',
          minimumFractionDigits: 0
        }).format(amount) + ' ' + currency;
      };

      const formatDate = (date) => {
        return new Date(date).toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      };

      const paymentMethodLabels = {
        mvola: 'MVola',
        orange: 'Orange Money',
        airtel: 'Airtel Money',
        card: 'Carte bancaire',
        cash: 'Paiement à la livraison',
        bank_transfer: 'Virement bancaire'
      };

      // Colors - Professional minimalist
      const primaryColor = '#1a1a1a';
      const textColor = '#333333';

      // Header - compact
      doc.rect(0, 0, pageWidth, 70).fill(primaryColor);
      doc.fillColor('white').fontSize(22).font('Helvetica-Bold');
      doc.text('FACTURE', margin, 20, { width: contentWidth, align: 'center', lineBreak: false });
      doc.fontSize(10).font('Helvetica');
      doc.text('Centre Commercial - Paiement confirme', margin, 48, { width: contentWidth, align: 'center', lineBreak: false });

      // Invoice info - compact
      let yPos = 85;
      doc.fillColor(textColor).fontSize(9);

      doc.font('Helvetica-Bold').text('Ref commande: ', margin, yPos, { continued: true, lineBreak: false });
      doc.font('Helvetica').text(order.orderReference, { lineBreak: false });

      doc.font('Helvetica-Bold').text('Ref paiement: ', margin + 250, yPos, { continued: true, lineBreak: false });
      doc.font('Helvetica').text(payment.reference, { lineBreak: false });

      yPos += 14;
      doc.font('Helvetica-Bold').text('Date commande: ', margin, yPos, { continued: true, lineBreak: false });
      doc.font('Helvetica').text(formatDate(order.createdAt), { lineBreak: false });

      doc.font('Helvetica-Bold').text('Date paiement: ', margin + 250, yPos, { continued: true, lineBreak: false });
      doc.font('Helvetica').text(formatDate(payment.completedAt || new Date()), { lineBreak: false });

      // Items table - compact
      yPos += 25;
      doc.font('Helvetica-Bold').fontSize(11).fillColor(primaryColor);
      doc.text('Articles commandes', margin, yPos, { lineBreak: false });

      yPos += 18;
      const col1 = margin;
      const col2 = margin + 280;
      const col3 = margin + 330;
      const col4 = margin + 420;
      const rowHeight = 18;

      // Table header
      doc.rect(margin, yPos, contentWidth, 20).fill(primaryColor);
      doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
      doc.text('Produit', col1 + 5, yPos + 6, { lineBreak: false });
      doc.text('Qte', col2, yPos + 6, { lineBreak: false });
      doc.text('Prix unit.', col3, yPos + 6, { lineBreak: false });
      doc.text('Total', col4, yPos + 6, { lineBreak: false });

      yPos += 20;
      doc.fillColor(textColor).font('Helvetica').fontSize(8);

      // Limit items to fit on one page (max 10 items displayed)
      const maxItems = Math.min(order.items.length, 10);
      for (let i = 0; i < maxItems; i++) {
        const item = order.items[i];

        if (i % 2 === 0) {
          doc.rect(margin, yPos, contentWidth, rowHeight).fill('#f9f9f9');
        }
        doc.fillColor(textColor);

        const productName = item.productName.length > 45
          ? item.productName.substring(0, 42) + '...'
          : item.productName;

        doc.text(productName, col1 + 5, yPos + 5, { lineBreak: false });
        doc.text(item.quantity.toString(), col2, yPos + 5, { lineBreak: false });
        doc.text(formatCurrency(item.unitPrice, order.currency), col3, yPos + 5, { lineBreak: false });
        doc.text(formatCurrency(item.totalPrice, order.currency), col4, yPos + 5, { lineBreak: false });

        yPos += rowHeight;
      }

      // If more items, show count
      if (order.items.length > maxItems) {
        doc.fontSize(8).fillColor('#666');
        doc.text(`... et ${order.items.length - maxItems} autre(s) article(s)`, col1 + 5, yPos + 2, { lineBreak: false });
        yPos += 15;
      }

      // Totals section
      yPos += 10;
      doc.moveTo(margin, yPos).lineTo(margin + contentWidth, yPos).stroke('#ddd');
      yPos += 10;

      doc.fontSize(9).font('Helvetica').fillColor(textColor);
      doc.text('Sous-total:', col3, yPos, { lineBreak: false });
      doc.text(formatCurrency(order.subtotal, order.currency), col4, yPos, { lineBreak: false });
      yPos += 14;

      if (order.shippingFee > 0) {
        doc.text('Livraison:', col3, yPos, { lineBreak: false });
        doc.text(formatCurrency(order.shippingFee, order.currency), col4, yPos, { lineBreak: false });
        yPos += 14;
      }

      if (order.discount > 0) {
        doc.text('Remise:', col3, yPos, { lineBreak: false });
        doc.text('-' + formatCurrency(order.discount, order.currency), col4, yPos, { lineBreak: false });
        yPos += 14;
      }

      doc.moveTo(col3, yPos).lineTo(margin + contentWidth, yPos).stroke(primaryColor);
      yPos += 8;

      doc.font('Helvetica-Bold').fontSize(12).fillColor(primaryColor);
      doc.text('TOTAL:', col3, yPos, { lineBreak: false });
      doc.text(formatCurrency(order.totalAmount, order.currency), col4, yPos, { lineBreak: false });

      // Payment & Shipping info - side by side, compact
      yPos += 30;
      const boxWidth = (contentWidth - 10) / 2;
      const boxHeight = 70;

      // Payment info box
      doc.rect(margin, yPos, boxWidth, boxHeight).fill('#f8f9fa');
      doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(9);
      doc.text('Paiement', margin + 8, yPos + 8, { lineBreak: false });
      doc.fillColor(textColor).font('Helvetica').fontSize(8);
      doc.text(`Methode: ${paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod}`, margin + 8, yPos + 24, { lineBreak: false });
      doc.text('Statut: Paye', margin + 8, yPos + 38, { lineBreak: false });
      doc.text(`Montant: ${formatCurrency(payment.amount, payment.currency)}`, margin + 8, yPos + 52, { lineBreak: false });

      // Shipping info box
      const box2X = margin + boxWidth + 10;
      doc.rect(box2X, yPos, boxWidth, boxHeight).fill('#f8f9fa');
      doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(9);
      doc.text('Livraison', box2X + 8, yPos + 8, { lineBreak: false });
      doc.fillColor(textColor).font('Helvetica').fontSize(8);
      doc.text(order.customerName, box2X + 8, yPos + 24, { lineBreak: false });
      const addressLine = order.shippingAddress.street.length > 35
        ? order.shippingAddress.street.substring(0, 32) + '...'
        : order.shippingAddress.street;
      doc.text(addressLine, box2X + 8, yPos + 38, { lineBreak: false });
      doc.text(`${order.shippingAddress.city} - Tel: ${order.customerPhone}`, box2X + 8, yPos + 52, { lineBreak: false });

      // Footer - at bottom
      const footerY = pageHeight - 50;
      doc.moveTo(margin, footerY).lineTo(margin + contentWidth, footerY).stroke('#ddd');
      doc.fillColor('#666').fontSize(7).font('Helvetica');
      doc.text(`${new Date().getFullYear()} Centre Commercial - Facture generee automatiquement`, margin, footerY + 10, {
        width: contentWidth,
        align: 'center',
        lineBreak: false
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Send invoice/order confirmation email after successful payment
 * @param {Object} order - Order document
 * @param {Object} payment - Payment document
 */
const sendInvoiceEmail = async (order, payment) => {
  const orderDate = new Date(order.createdAt).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const paymentDate = new Date(payment.completedAt || new Date()).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const paymentMethodLabels = {
    mvola: 'MVola',
    orange: 'Orange Money',
    airtel: 'Airtel Money',
    card: 'Carte bancaire',
    cash: 'Paiement à la livraison',
    bank_transfer: 'Virement bancaire'
  };

  const formatCurrency = (amount, currency = 'MGA') => {
    return new Intl.NumberFormat('fr-MG', {
      style: 'decimal',
      minimumFractionDigits: 0
    }).format(amount) + ' ' + currency;
  };

  // Build items table rows
  const itemsRows = order.items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">
        ${item.productName}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
        ${item.quantity}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
        ${formatCurrency(item.unitPrice, order.currency)}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
        ${formatCurrency(item.totalPrice, order.currency)}
      </td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${emailStyles}
        .order-info { background: #f8f9fa; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
        .order-info p { margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #1a1a1a; color: white; padding: 12px; text-align: left; font-weight: 500; }
        th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: center; }
        th:last-child { text-align: right; }
        td { padding: 12px; border-bottom: 1px solid #eee; }
        .totals { margin-top: 20px; }
        .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .totals-row.total { font-size: 18px; font-weight: 600; color: #1a1a1a; border-bottom: none; border-top: 2px solid #1a1a1a; padding-top: 15px; margin-top: 10px; }
        .info-section { background: #f8f9fa; padding: 15px; border-radius: 4px; margin-top: 20px; }
        .info-section h4 { color: #1a1a1a; margin: 0 0 10px; font-weight: 500; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <h1>Facture</h1>
            <p>Commande confirmee</p>
          </div>
          <div class="content">
            <div class="order-info">
              <p><strong>Reference commande:</strong> ${order.orderReference}</p>
              <p><strong>Reference paiement:</strong> ${payment.reference}</p>
              <p><strong>Date de commande:</strong> ${orderDate}</p>
              <p><strong>Date de paiement:</strong> ${paymentDate}</p>
            </div>

            <h3 style="margin: 20px 0 10px; font-weight: 500;">Articles commandes</h3>
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Quantite</th>
                  <th>Prix unitaire</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>

            <div class="totals">
              <div class="totals-row">
                <span>Sous-total:</span>
                <span>${formatCurrency(order.subtotal, order.currency)}</span>
              </div>
              ${order.shippingFee > 0 ? `
              <div class="totals-row">
                <span>Frais de livraison:</span>
                <span>${formatCurrency(order.shippingFee, order.currency)}</span>
              </div>
              ` : ''}
              ${order.discount > 0 ? `
              <div class="totals-row">
                <span>Remise:</span>
                <span>-${formatCurrency(order.discount, order.currency)}</span>
              </div>
              ` : ''}
              <div class="totals-row total">
                <span>TOTAL:</span>
                <span>${formatCurrency(order.totalAmount, order.currency)}</span>
              </div>
            </div>

            <div class="info-section">
              <h4>Informations de paiement</h4>
              <p><strong>Methode:</strong> ${paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod}</p>
              <p><strong>Statut:</strong> Paye</p>
              <p><strong>Montant:</strong> ${formatCurrency(payment.amount, payment.currency)}</p>
            </div>

            <div class="info-section">
              <h4>Adresse de livraison</h4>
              <p><strong>${order.customerName}</strong></p>
              <p>${order.shippingAddress.street}</p>
              <p>${order.shippingAddress.city}${order.shippingAddress.postalCode ? ', ' + order.shippingAddress.postalCode : ''}</p>
              <p>${order.shippingAddress.country}</p>
              ${order.shippingAddress.additionalInfo ? `<p><em>${order.shippingAddress.additionalInfo}</em></p>` : ''}
              <p><strong>Telephone:</strong> ${order.customerPhone}</p>
            </div>

            <p style="text-align: center; color: #666; margin-top: 20px;">
              Vous pouvez suivre votre commande depuis votre espace client.<br>
              Pour toute question, contactez notre service client.
            </p>
          </div>
          <div class="footer">
            <p>${new Date().getFullYear()} Centre Commercial. Tous droits reserves.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  // Generate PDF invoice
  const pdfBuffer = await generateInvoicePDF(order, payment);

  await sendEmail({
    to: order.customerEmail,
    subject: `Facture - Commande ${order.orderReference}`,
    html,
    attachments: [
      {
        filename: `Facture_${order.orderReference}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  });
};

/**
 * Send welcome email after verification
 * @param {string} email - User email
 * @param {string} firstName - User first name
 */
const sendWelcomeEmail = async (email, firstName) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${emailStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <h1>Bienvenue</h1>
            <p>Votre compte est maintenant actif</p>
          </div>
          <div class="content">
            <h2>Bonjour ${firstName},</h2>
            <p>Votre adresse email a ete verifiee avec succes. Vous pouvez maintenant profiter de toutes les fonctionnalites de Centre Commercial.</p>
            <ul class="list">
              <li>Decouvrez toutes les boutiques du centre</li>
              <li>Consultez les promotions en cours</li>
              <li>Ajoutez vos boutiques favorites</li>
              <li>Laissez des avis sur vos experiences</li>
            </ul>
            <center>
              <a href="${process.env.FRONTEND_URL}" class="button">Commencer</a>
            </center>
          </div>
          <div class="footer">
            <p>${new Date().getFullYear()} Centre Commercial. Tous droits reserves.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: 'Bienvenue sur Centre Commercial',
    html
  });
};

/**
 * Send approval email when admin approves a boutique account
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string} boutiqueName - Boutique name (optional)
 */
const sendApprovalEmail = async (email, firstName, boutiqueName = null) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${emailStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <h1>Compte Approuve</h1>
            <p>Votre demande a ete acceptee</p>
          </div>
          <div class="content">
            <h2>Bonjour ${firstName},</h2>
            <div class="success-box">
              <strong>Bonne nouvelle.</strong> Votre compte${boutiqueName ? ` pour la boutique "${boutiqueName}"` : ''} a ete approuve par notre equipe d'administration.
            </div>
            <p>Vous pouvez maintenant vous connecter et acceder a toutes les fonctionnalites de votre espace professionnel.</p>
            <ul class="list">
              <li>Gerer votre boutique et vos informations</li>
              <li>Ajouter et gerer vos produits</li>
              <li>Creer des promotions et evenements</li>
              <li>Consulter les avis clients</li>
              <li>Suivre vos commandes et ventes</li>
            </ul>
            <center>
              <a href="${process.env.FRONTEND_URL}/auth/signin/boutique" class="button">Se connecter</a>
            </center>
          </div>
          <div class="footer">
            <p>${new Date().getFullYear()} Centre Commercial. Tous droits reserves.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: 'Votre compte boutique a ete approuve - Centre Commercial',
    html
  });
};

/**
 * Send rejection email when admin rejects a boutique account
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string} reason - Rejection reason
 */
const sendRejectionEmail = async (email, firstName, reason = null) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${emailStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <h1>Demande non approuvee</h1>
            <p>Information importante</p>
          </div>
          <div class="content">
            <h2>Bonjour ${firstName},</h2>
            <div class="info-box">
              Nous sommes desoles de vous informer que votre demande de creation de compte boutique n'a pas ete approuvee.
            </div>
            ${reason ? `
            <p><strong>Raison:</strong></p>
            <div class="info-box">${reason}</div>
            ` : ''}
            <p>Si vous pensez qu'il s'agit d'une erreur ou si vous souhaitez soumettre une nouvelle demande avec des informations corrigees, n'hesitez pas a nous contacter.</p>
            <center>
              <a href="${process.env.FRONTEND_URL}/contact" class="button">Nous contacter</a>
            </center>
          </div>
          <div class="footer">
            <p>${new Date().getFullYear()} Centre Commercial. Tous droits reserves.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: 'Information concernant votre demande - Centre Commercial',
    html
  });
};

/**
 * Send pending approval email for boutique accounts after email verification
 * @param {string} email - User email
 * @param {string} firstName - User first name
 */
const sendPendingApprovalEmail = async (email, firstName) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${emailStyles}
        .steps { margin: 20px 0; }
        .step { display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid #eee; }
        .step:last-child { border-bottom: none; }
        .step-icon { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px; font-size: 12px; font-weight: 600; }
        .step-done { background: #1a1a1a; color: white; }
        .step-pending { background: #e9ecef; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <h1>Email verifie</h1>
            <p>Compte en attente de validation</p>
          </div>
          <div class="content">
            <h2>Bonjour ${firstName},</h2>
            <div class="info-box">
              <strong>Votre adresse email a ete verifiee avec succes.</strong><br>
              Votre demande de compte boutique est maintenant en cours d'examen par notre equipe.
            </div>

            <p>Etapes de validation:</p>
            <div class="steps">
              <div class="step">
                <div class="step-icon step-done">1</div>
                <div><strong>Inscription</strong> - Terminee</div>
              </div>
              <div class="step">
                <div class="step-icon step-done">2</div>
                <div><strong>Verification email</strong> - Terminee</div>
              </div>
              <div class="step">
                <div class="step-icon step-pending">3</div>
                <div><strong>Validation admin</strong> - En cours</div>
              </div>
            </div>

            <p>Vous recevrez un email de confirmation des que votre compte sera valide. Ce processus prend generalement <strong>24 a 48 heures</strong>.</p>
          </div>
          <div class="footer">
            <p>${new Date().getFullYear()} Centre Commercial. Tous droits reserves.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: 'Email verifie - Compte en attente de validation',
    html
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendOTPEmail,
  sendWelcomeEmail,
  sendInvoiceEmail,
  sendApprovalEmail,
  sendRejectionEmail,
  sendPendingApprovalEmail
};