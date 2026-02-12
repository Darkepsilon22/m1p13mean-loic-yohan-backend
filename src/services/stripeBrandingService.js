const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fs = require('fs');
const path = require('path');

// Cache des file IDs Stripe (persistant pendant la durée du processus)
let cachedLogoFileId = null;
let cachedIconFileId = null;

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo.png');
const ICON_PATH = path.join(__dirname, '..', 'assets', 'logo-icon.png');

/**
 * Upload un fichier sur Stripe si pas déjà en cache
 */
async function uploadFileToStripe(filePath, purpose) {
  const file = await stripe.files.create({
    purpose,
    file: {
      data: fs.readFileSync(filePath),
      name: path.basename(filePath),
      type: 'image/png'
    }
  });
  return file.id;
}

/**
 * Initialise le branding Stripe en uploadant logo et icône
 * Appelé une seule fois au démarrage du serveur
 */
async function initBranding() {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.log('⚠️  STRIPE_SECRET_KEY non définie, branding Stripe ignoré.');
      return;
    }

    // Upload du logo (horizontal)
    if (fs.existsSync(LOGO_PATH)) {
      cachedLogoFileId = await uploadFileToStripe(LOGO_PATH, 'business_logo');
      console.log(`✅ Logo Stripe uploadé: ${cachedLogoFileId}`);
    } else {
      console.log('⚠️  Logo non trouvé:', LOGO_PATH);
    }

    // Upload de l'icône (carré)
    if (fs.existsSync(ICON_PATH)) {
      cachedIconFileId = await uploadFileToStripe(ICON_PATH, 'business_icon');
      console.log(`✅ Icône Stripe uploadée: ${cachedIconFileId}`);
    } else {
      console.log('⚠️  Icône non trouvée:', ICON_PATH);
    }
  } catch (error) {
    console.error('❌ Erreur lors de l\'upload du branding Stripe:', error.message);
  }
}

/**
 * Retourne l'objet branding_settings pour les sessions checkout
 */
function getBrandingSettings() {
  const settings = {
    display_name: "Smar'ket"
  };

  if (cachedLogoFileId) {
    settings.logo = { type: 'file', file: cachedLogoFileId };
  }

  if (cachedIconFileId) {
    settings.icon = { type: 'file', file: cachedIconFileId };
  }

  return settings;
}

module.exports = { initBranding, getBrandingSettings };
