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
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Centre Commercial</h1>
          <p>Bienvenue sur notre plateforme!</p>
        </div>
        <div class="content">
          <h2>Bonjour ${firstName},</h2>
          <p>Merci de vous être inscrit sur Centre Commercial. Pour activer votre compte, veuillez cliquer sur le bouton ci-dessous:</p>
          <center>
            <a href="${verificationUrl}" class="button">Vérifier mon email</a>
          </center>
          <p>Ou copiez ce lien dans votre navigateur:</p>
          <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
          <p><strong>Ce lien expire dans 24 heures.</strong></p>
          <p>Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Centre Commercial. Tous droits réservés.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: 'Vérifiez votre adresse email - Centre Commercial',
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
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 10px; }
        .otp-code { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #667eea; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 5px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Centre Commercial</h1>
          <p>Code de vérification</p>
        </div>
        <div class="content">
          <h2>Bonjour ${firstName},</h2>
          <p>Vous avez demandé à vous connecter à votre compte. Voici votre code de vérification:</p>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
          </div>
          <p><strong>Ce code expire dans ${expiresIn} minutes.</strong></p>
          <div class="warning">
            <strong> Attention:</strong> Ne partagez jamais ce code avec personne. Notre équipe ne vous demandera jamais votre code.
          </div>
          <p style="margin-top: 20px;">Si vous n'avez pas tenté de vous connecter, veuillez sécuriser votre compte immédiatement.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Centre Commercial. Tous droits réservés.</p>
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

      // Colors
      const primaryColor = '#667eea';
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
      doc.rect(margin, yPos, boxWidth, boxHeight).fill('#e8f5e9');
      doc.fillColor('#2e7d32').font('Helvetica-Bold').fontSize(9);
      doc.text('Paiement', margin + 8, yPos + 8, { lineBreak: false });
      doc.fillColor(textColor).font('Helvetica').fontSize(8);
      doc.text(`Methode: ${paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod}`, margin + 8, yPos + 24, { lineBreak: false });
      doc.text('Statut: Paye', margin + 8, yPos + 38, { lineBreak: false });
      doc.text(`Montant: ${formatCurrency(payment.amount, payment.currency)}`, margin + 8, yPos + 52, { lineBreak: false });

      // Shipping info box
      const box2X = margin + boxWidth + 10;
      doc.rect(box2X, yPos, boxWidth, boxHeight).fill('#fff3e0');
      doc.fillColor('#ef6c00').font('Helvetica-Bold').fontSize(9);
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
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 650px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .invoice-box { background: white; padding: 25px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .invoice-header { display: flex; justify-content: space-between; border-bottom: 2px solid #667eea; padding-bottom: 15px; margin-bottom: 20px; }
        .order-info { background: #f0f4ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .order-info p { margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #667eea; color: white; padding: 12px; text-align: left; }
        th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: center; }
        th:last-child { text-align: right; }
        .totals { margin-top: 20px; }
        .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .totals-row.total { font-size: 18px; font-weight: bold; color: #667eea; border-bottom: none; border-top: 2px solid #667eea; padding-top: 15px; margin-top: 10px; }
        .payment-info { background: #e8f5e9; padding: 15px; border-radius: 8px; margin-top: 20px; }
        .payment-info h4 { color: #2e7d32; margin-top: 0; }
        .shipping-info { background: #fff3e0; padding: 15px; border-radius: 8px; margin-top: 20px; }
        .shipping-info h4 { color: #ef6c00; margin-top: 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .success-badge { display: inline-block; background: #4caf50; color: white; padding: 5px 15px; border-radius: 20px; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🧾 Facture</h1>
          <p>Merci pour votre commande!</p>
          <span class="success-badge">✓ Paiement confirmé</span>
        </div>
        <div class="content">
          <div class="invoice-box">
            <div class="order-info">
              <p><strong>Référence commande:</strong> ${order.orderReference}</p>
              <p><strong>Référence paiement:</strong> ${payment.reference}</p>
              <p><strong>Date de commande:</strong> ${orderDate}</p>
              <p><strong>Date de paiement:</strong> ${paymentDate}</p>
            </div>

            <h3>📦 Articles commandés</h3>
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Quantité</th>
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

            <div class="payment-info">
              <h4>💳 Informations de paiement</h4>
              <p><strong>Méthode:</strong> ${paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod}</p>
              <p><strong>Statut:</strong> Payé ✓</p>
              <p><strong>Montant:</strong> ${formatCurrency(payment.amount, payment.currency)}</p>
            </div>

            <div class="shipping-info">
              <h4>📍 Adresse de livraison</h4>
              <p><strong>${order.customerName}</strong></p>
              <p>${order.shippingAddress.street}</p>
              <p>${order.shippingAddress.city}${order.shippingAddress.postalCode ? ', ' + order.shippingAddress.postalCode : ''}</p>
              <p>${order.shippingAddress.country}</p>
              ${order.shippingAddress.additionalInfo ? `<p><em>${order.shippingAddress.additionalInfo}</em></p>` : ''}
              <p><strong>Téléphone:</strong> ${order.customerPhone}</p>
            </div>
          </div>

          <p style="text-align: center; color: #666;">
            Vous pouvez suivre votre commande depuis votre espace client.<br>
            Pour toute question, contactez notre service client.
          </p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Centre Commercial. Tous droits réservés.</p>
          <p>Cette facture a été générée automatiquement.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Generate PDF invoice
  const pdfBuffer = await generateInvoicePDF(order, payment);

  await sendEmail({
    to: order.customerEmail,
    subject: `Facture - Commande ${order.orderReference} confirmée`,
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
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .features { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; }
        .feature { padding: 10px 0; border-bottom: 1px solid #eee; }
        .feature:last-child { border-bottom: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1> Bienvenue!</h1>
          <p>Votre compte est maintenant actif</p>
        </div>
        <div class="content">
          <h2>Félicitations ${firstName}!</h2>
          <p>Votre adresse email a été vérifiée avec succès. Vous pouvez maintenant profiter de toutes les fonctionnalités de Centre Commercial.</p>
          <div class="features">
            <div class="feature">✅ Découvrez toutes les boutiques du centre</div>
            <div class="feature">✅ Consultez les promotions en cours</div>
            <div class="feature">✅ Ajoutez vos boutiques favorites</div>
            <div class="feature">✅ Laissez des avis sur vos expériences</div>
          </div>
          <center>
            <a href="${process.env.FRONTEND_URL}" class="button">Commencer à explorer</a>
          </center>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Centre Commercial. Tous droits réservés.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: 'Bienvenue sur Centre Commercial!',
    html
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendOTPEmail,
  sendWelcomeEmail,
  sendInvoiceEmail
};