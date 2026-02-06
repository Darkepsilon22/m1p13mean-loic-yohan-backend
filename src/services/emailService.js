const axios = require('axios');
const PDFDocument = require('pdfkit');

/**
 * Brevo API Configuration
 */
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Send email using Brevo API
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
    const senderName = process.env.EMAIL_SENDER_NAME || 'Centre Commercial';
    const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@centrecommercial.com';

    // Prepare attachments in Brevo format
    let attachments = [];
    if (options.attachments && options.attachments.length > 0) {
      attachments = options.attachments.map(att => ({
        name: att.filename,
        content: att.content.toString('base64')
      }));
    }

    // Prepare Brevo API request payload
    const payload = {
      sender: {
        name: senderName,
        email: senderEmail
      },
      to: [
        {
          email: options.to
        }
      ],
      subject: options.subject,
      htmlContent: options.html
    };

    // Add attachments if present
    if (attachments.length > 0) {
      payload.attachment = attachments;
    }

    // Add plain text if provided
    if (options.text) {
      payload.textContent = options.text;
    }

    // Send email via Brevo API
    const response = await axios.post(BREVO_API_URL, payload, {
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      }
    });

    console.log('Email sent via Brevo API:', response.data.messageId);
    return { success: true, messageId: response.data.messageId };
  } catch (error) {
    console.error('Brevo API error:', error.response?.data || error.message);
    throw new Error(`Failed to send email: ${error.response?.data?.message || error.message}`);
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
            <p>Si vous n'avez pas demande ce code, ignorez cet email et assurez-vous que votre compte est securise.</p>
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
    subject: 'Votre code de verification - Centre Commercial',
    html
  });
};

/**
 * Send password reset email
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string} resetToken - Reset token
 */
const sendPasswordResetEmail = async (email, firstName, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;
  const expiresIn = process.env.PASSWORD_RESET_EXPIRES_IN || 60;

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
            <h1>Reinitialisation du mot de passe</h1>
            <p>Vous avez demande a reinitialiser votre mot de passe</p>
          </div>
          <div class="content">
            <h2>Bonjour ${firstName},</h2>
            <p>Vous avez demande a reinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour creer un nouveau mot de passe:</p>
            <center>
              <a href="${resetUrl}" class="button">Reinitialiser mon mot de passe</a>
            </center>
            <p>Ou copiez ce lien dans votre navigateur:</p>
            <p class="link">${resetUrl}</p>
            <div class="warning-box">
              <strong>Attention:</strong> Ce lien expire dans ${expiresIn} minutes.
            </div>
            <p>Si vous n'avez pas demande cette reinitialisation, ignorez cet email. Votre mot de passe restera inchange.</p>
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
    subject: 'Reinitialisation de votre mot de passe - Centre Commercial',
    html
  });
};

/**
 * Format number with space as thousands separator (e.g. 15 000 Ar)
 */
const formatMGA = (amount) => {
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ar';
};

/**
 * Generate invoice PDF
 * @param {Object} invoiceData - Invoice data
 * @returns {Promise<Buffer>} PDF buffer
 */
const generateInvoicePDF = (invoiceData) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - 100; // 50 margin each side

      // ===== HEADER =====
      doc.rect(50, 50, pageWidth, 70).fill('#1a1a1a');
      doc.fontSize(24).fill('#ffffff').text("Smar'ket", 70, 65, { width: pageWidth - 40 });
      doc.fontSize(10).fill('#cccccc').text('Centre Commercial en ligne', 70, 95);
      doc.fontSize(18).fill('#ffffff').text('FACTURE', 350, 72, { width: 180, align: 'right' });

      // ===== INVOICE INFO =====
      doc.fill('#333333');
      const infoY = 145;
      doc.fontSize(10).fill('#888888').text('Numero de facture', 50, infoY);
      doc.fontSize(11).fill('#1a1a1a').text(invoiceData.invoiceNumber, 50, infoY + 15);

      doc.fontSize(10).fill('#888888').text('Date', 250, infoY);
      doc.fontSize(11).fill('#1a1a1a').text(new Date(invoiceData.date).toLocaleDateString('fr-FR'), 250, infoY + 15);

      doc.fontSize(10).fill('#888888').text('Statut', 420, infoY);
      doc.fontSize(11).fill('#28a745').text('PAYEE', 420, infoY + 15);

      // Separator
      doc.moveTo(50, infoY + 45).lineTo(50 + pageWidth, infoY + 45).lineWidth(0.5).strokeColor('#e0e0e0').stroke();

      // ===== CLIENT INFO =====
      const clientY = infoY + 60;
      doc.fontSize(10).fill('#888888').text('Facture a', 50, clientY);
      doc.fontSize(11).fill('#1a1a1a');
      doc.text(invoiceData.customerName, 50, clientY + 15);
      doc.fontSize(10).fill('#555555');
      doc.text(invoiceData.customerEmail, 50, clientY + 30);
      if (invoiceData.customerAddress) {
        doc.text(invoiceData.customerAddress, 50, clientY + 45);
      }

      // ===== TABLE =====
      const tableTop = clientY + 75;

      // Table header background
      doc.rect(50, tableTop, pageWidth, 25).fill('#f5f5f5');

      // Table header text
      doc.fontSize(9).fill('#666666');
      doc.text('DESCRIPTION', 60, tableTop + 8, { width: 220 });
      doc.text('QTE', 290, tableTop + 8, { width: 50, align: 'center' });
      doc.text('PRIX UNITAIRE', 350, tableTop + 8, { width: 90, align: 'right' });
      doc.text('TOTAL', 450, tableTop + 8, { width: 90, align: 'right' });

      // Table items
      let yPosition = tableTop + 35;
      doc.fontSize(10).fill('#333333');
      invoiceData.items.forEach((item, index) => {
        // Alternate row background
        if (index % 2 === 1) {
          doc.rect(50, yPosition - 5, pageWidth, 22).fill('#fafafa');
          doc.fill('#333333');
        }
        doc.text(item.description, 60, yPosition, { width: 220 });
        doc.text(item.quantity.toString(), 290, yPosition, { width: 50, align: 'center' });
        doc.text(formatMGA(item.unitPrice), 350, yPosition, { width: 90, align: 'right' });
        doc.text(formatMGA(item.total), 450, yPosition, { width: 90, align: 'right' });
        yPosition += 22;
      });

      // Line after items
      doc.moveTo(50, yPosition + 5).lineTo(50 + pageWidth, yPosition + 5).lineWidth(0.5).strokeColor('#e0e0e0').stroke();
      yPosition += 20;

      // Subtotal
      doc.fontSize(10).fill('#666666');
      doc.text('Sous-total', 350, yPosition, { width: 90, align: 'right' });
      doc.fill('#333333').text(formatMGA(invoiceData.subtotal), 450, yPosition, { width: 90, align: 'right' });
      yPosition += 20;

      // Tax
      if (invoiceData.tax > 0) {
        doc.fill('#666666').text(`TVA (${invoiceData.taxRate}%)`, 350, yPosition, { width: 90, align: 'right' });
        doc.fill('#333333').text(formatMGA(invoiceData.tax), 450, yPosition, { width: 90, align: 'right' });
        yPosition += 20;
      }

      // Total line
      doc.moveTo(350, yPosition).lineTo(50 + pageWidth, yPosition).lineWidth(1).strokeColor('#1a1a1a').stroke();
      yPosition += 10;

      // Total
      doc.fontSize(13).font('Helvetica-Bold').fill('#1a1a1a');
      doc.text('TOTAL', 350, yPosition, { width: 90, align: 'right' });
      doc.text(formatMGA(invoiceData.total), 450, yPosition, { width: 90, align: 'right' });

      // ===== FOOTER =====
      doc.font('Helvetica');
      const footerY = doc.page.height - 100;
      doc.moveTo(50, footerY).lineTo(50 + pageWidth, footerY).lineWidth(0.5).strokeColor('#e0e0e0').stroke();
      doc.fontSize(9).fill('#999999');
      doc.text('Merci pour votre confiance !', 50, footerY + 15, { align: 'center', width: pageWidth });
      doc.text("Smar'ket - Centre Commercial en ligne | Madagascar", 50, footerY + 30, { align: 'center', width: pageWidth });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Send invoice email with PDF attachment
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {Object} invoiceData - Invoice data
 */
const sendInvoiceEmail = async (email, firstName, invoiceData) => {
  const pdfBuffer = await generateInvoicePDF(invoiceData);

  // Build items HTML table for email
  const itemsHtml = invoiceData.items.map(item => `
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #333;">${item.description}</td>
      <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: center; color: #555;">${item.quantity}</td>
      <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; color: #555;">${formatMGA(item.unitPrice)}</td>
      <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 500; color: #333;">${formatMGA(item.total)}</td>
    </tr>
  `).join('');

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
            <h1>Confirmation de paiement</h1>
            <p>Votre commande a ete payee avec succes</p>
          </div>
          <div class="content">
            <h2>Bonjour ${firstName},</h2>
            <p>Merci pour votre achat. Votre paiement a ete confirme et votre commande est en cours de traitement.</p>

            <div class="success-box">
              <strong>Paiement confirme</strong>
              <p style="margin: 5px 0 0; font-size: 13px;">Votre facture est jointe a cet email au format PDF.</p>
            </div>

            <table style="width: 100%; margin: 20px 0; font-size: 13px;">
              <tr>
                <td style="padding: 5px 0; color: #888;">Numero de facture</td>
                <td style="padding: 5px 0; text-align: right; font-weight: 500;">${invoiceData.invoiceNumber}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #888;">Date</td>
                <td style="padding: 5px 0; text-align: right;">${new Date(invoiceData.date).toLocaleDateString('fr-FR')}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #888;">Montant total</td>
                <td style="padding: 5px 0; text-align: right; font-weight: 600; font-size: 15px; color: #1a1a1a;">${formatMGA(invoiceData.total)}</td>
              </tr>
            </table>

            <h3 style="font-size: 14px; margin: 25px 0 10px; color: #1a1a1a;">Detail de la commande</h3>
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
              <thead>
                <tr style="background: #f8f9fa;">
                  <th style="padding: 8px; text-align: left; color: #666; font-weight: 500;">Article</th>
                  <th style="padding: 8px; text-align: center; color: #666; font-weight: 500;">Qte</th>
                  <th style="padding: 8px; text-align: right; color: #666; font-weight: 500;">Prix</th>
                  <th style="padding: 8px; text-align: right; color: #666; font-weight: 500;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <table style="width: 100%; margin-top: 15px; font-size: 13px;">
              <tr>
                <td style="padding: 5px 0; color: #888;">Sous-total</td>
                <td style="padding: 5px 0; text-align: right;">${formatMGA(invoiceData.subtotal)}</td>
              </tr>
              <tr style="border-top: 2px solid #1a1a1a;">
                <td style="padding: 10px 0; font-weight: 600; font-size: 15px;">Total paye</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 600; font-size: 15px; color: #1a1a1a;">${formatMGA(invoiceData.total)}</td>
              </tr>
            </table>

            <center>
              <a href="${process.env.FRONTEND_URL}/home" class="button">Continuer mes achats</a>
            </center>
          </div>
          <div class="footer">
            <p>${new Date().getFullYear()} Smar'ket. Tous droits reserves.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `Facture ${invoiceData.invoiceNumber} - Smar'ket`,
    html,
    attachments: [
      {
        filename: `facture-${invoiceData.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  });
};

/**
 * Send welcome email after successful verification
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

/**
 * Send low stock alert email to boutique owner
 * @param {string} email - Boutique owner email
 * @param {string} firstName - Boutique owner first name
 * @param {Object} alertData - Alert data
 * @param {string} alertData.productName - Product name
 * @param {number} alertData.currentStock - Current stock level
 * @param {number} alertData.threshold - Low stock threshold
 * @param {string} alertData.boutiqueName - Boutique name
 */
const sendLowStockAlertEmail = async (email, firstName, alertData) => {
  const isOutOfStock = alertData.currentStock === 0;

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
            <h1>${isOutOfStock ? 'Rupture de stock' : 'Alerte stock bas'}</h1>
            <p>Un de vos produits necessite votre attention</p>
          </div>
          <div class="content">
            <h2>Bonjour ${firstName},</h2>
            <div class="${isOutOfStock ? 'warning-box' : 'info-box'}">
              <strong>${isOutOfStock ? 'Rupture de stock !' : 'Stock bas !'}</strong><br>
              Le produit <strong>"${alertData.productName}"</strong> de votre boutique <strong>"${alertData.boutiqueName}"</strong>
              ${isOutOfStock
                ? ' est en <strong>rupture de stock</strong>.'
                : ` a atteint le seuil d'alerte (${alertData.threshold} unites).`
              }
            </div>

            <table style="width: 100%; margin: 20px 0; font-size: 13px;">
              <tr>
                <td style="padding: 8px 0; color: #888; border-bottom: 1px solid #eee;">Produit</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 500; border-bottom: 1px solid #eee;">${alertData.productName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; border-bottom: 1px solid #eee;">Boutique</td>
                <td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #eee;">${alertData.boutiqueName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888; border-bottom: 1px solid #eee;">Stock actuel</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600; color: ${isOutOfStock ? '#dc3545' : '#f0ad4e'}; border-bottom: 1px solid #eee;">${alertData.currentStock} unite(s)</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #888;">Seuil d'alerte</td>
                <td style="padding: 8px 0; text-align: right;">${alertData.threshold} unite(s)</td>
              </tr>
            </table>

            <p>Nous vous recommandons de reapprovisionner ce produit rapidement pour ne pas perdre de ventes.</p>
            <center>
              <a href="${process.env.FRONTEND_URL}/products/my-products" class="button">Gerer mes produits</a>
            </center>
          </div>
          <div class="footer">
            <p>${new Date().getFullYear()} Smar'ket. Tous droits reserves.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `${isOutOfStock ? 'Rupture de stock' : 'Alerte stock bas'} - ${alertData.productName} - Smar'ket`,
    html
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendOTPEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendInvoiceEmail,
  sendApprovalEmail,
  sendRejectionEmail,
  sendPendingApprovalEmail,
  sendLowStockAlertEmail
};
