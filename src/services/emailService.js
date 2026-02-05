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
 * Send password reset link
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {string} resetToken - Reset token (raw, will be in URL)
 */
const sendPasswordResetEmail = async (email, firstName, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/auth/reset-password?token=${resetToken}`;

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
            <p>Reinitialisation du mot de passe</p>
          </div>
          <div class="content">
            <h2>Bonjour ${firstName},</h2>
            <p>Vous avez demande a reinitialiser le mot de passe de votre compte. Cliquez sur le bouton ci-dessous pour definir un nouveau mot de passe:</p>
            <center>
              <a href="${resetUrl}" class="button">Reinitialiser mon mot de passe</a>
            </center>
            <p>Ou copiez ce lien dans votre navigateur:</p>
            <p class="link">${resetUrl}</p>
            <div class="info-box">
              <strong>Important:</strong> Ce lien expire dans 1 heure.
            </div>
            <p>Si vous n'avez pas demande cette reinitialisation, vous pouvez ignorer cet email. Votre mot de passe restera inchange.</p>
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
    subject: 'Reinitialisation du mot de passe - Centre Commercial',
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
            <h1>Centre Commercial</h1>
            <p>Reinitialisation de mot de passe</p>
          </div>
          <div class="content">
            <h2>Bonjour ${firstName},</h2>
            <p>Nous avons recu une demande de reinitialisation de mot de passe pour votre compte. Cliquez sur le bouton ci-dessous pour definir un nouveau mot de passe:</p>
            <center>
              <a href="${resetUrl}" class="button">Reinitialiser mon mot de passe</a>
            </center>
            <p>Ou copiez ce lien dans votre navigateur:</p>
            <p class="link">${resetUrl}</p>
            <div class="warning-box">
              <strong>Attention:</strong> Ce lien expire dans ${expiresIn} minutes.
            </div>
            <p>Si vous n'avez pas demande de reinitialisation, ignorez cet email. Votre mot de passe actuel reste inchange.</p>
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
 * Send invoice email with PDF attachment
 * @param {string} email - User email
 * @param {string} firstName - User first name
 * @param {Object} invoiceData - Invoice data
 * @param {Buffer} pdfBuffer - PDF invoice buffer
 */
const sendInvoiceEmail = async (email, firstName, invoiceData, pdfBuffer) => {
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
            <p>Votre facture</p>
          </div>
          <div class="content">
            <h2>Bonjour ${firstName},</h2>
            <p>Merci pour votre achat. Vous trouverez votre facture en piece jointe.</p>
            <div class="info-box">
              <strong>Facture N°:</strong> ${invoiceData.invoiceNumber}<br>
              <strong>Date:</strong> ${new Date(invoiceData.date).toLocaleDateString('fr-FR')}<br>
              <strong>Montant total:</strong> ${invoiceData.totalAmount} Ar
            </div>
            <p>Pour toute question concernant cette facture, n'hesitez pas a nous contacter.</p>
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
    subject: `Facture ${invoiceData.invoiceNumber} - Centre Commercial`,
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
 * Send welcome email after email verification
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
  sendPasswordResetEmail,
  sendOTPEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendInvoiceEmail,
  sendApprovalEmail,
  sendRejectionEmail,
  sendPendingApprovalEmail
};