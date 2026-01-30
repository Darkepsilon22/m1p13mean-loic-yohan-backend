const { google } = require('googleapis');

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
 */
const sendEmail = async (options) => {
  try {
    const oauth2Client = createOAuth2Client();
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Create email content in RFC 2822 format
    const utf8Subject = `=?utf-8?B?${Buffer.from(options.subject).toString('base64')}?=`;
    const senderName = process.env.EMAIL_SENDER_NAME || 'Centre Commercial';
    const messageParts = [
      `From: ${senderName} <${process.env.GMAIL_USER}>`,
      `To: ${options.to}`,
      `Subject: ${utf8Subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      options.html
    ];

    const message = messageParts.join('\n');
    
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
  sendWelcomeEmail
};