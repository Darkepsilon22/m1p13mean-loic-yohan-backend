const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const Review = require('./src/models/Review');
  const Promotion = require('./src/models/Promotion');
  const Product = require('./src/models/Product');
  const Event = require('./src/models/Event');
  const Boutique = require('./src/models/Boutique');

  const acheteurId = '699f15c42b045c5fb8961774';
  const boutiqueUserId = '699f15c32b045c5fb8961771';
  const adminId = '699f15c22b045c5fb896176e';

  // Boutiques owned by boutique user
  const boutiques = await Boutique.find({ userId: boutiqueUserId }, '_id name').lean();
  console.log('Boutiques du user boutique:', boutiques.map(b => b.name));

  // All boutiques with products
  const allBoutiques = await Boutique.find({}, '_id name').lean();
  const allProducts = await Product.find({}, '_id name boutiqueId price').lean();

  // ═══════════════════════════════════════════════════
  // 1. AVIS SUR LES BOUTIQUES (sans productId)
  // ═══════════════════════════════════════════════════
  console.log('\n--- Avis boutiques ---');
  const boutiqueReviewComments = [
    { comment: 'Boutique très agréable, personnel accueillant et produits de qualité. Je reviendrai !', rating: 5 },
    { comment: 'Bonne expérience globale. Les prix sont corrects et le service est rapide.', rating: 4 },
    { comment: 'J\'adore cette boutique ! Large choix de produits et ambiance très sympa.', rating: 5 },
    { comment: 'Service client au top. Ils m\'ont très bien conseillé pour mon achat.', rating: 5 },
    { comment: 'Boutique propre et bien organisée. Facile de trouver ce qu\'on cherche.', rating: 4 },
    { comment: 'Très bonne boutique, je recommande. Les produits sont authentiques.', rating: 5 },
    { comment: 'Accueil chaleureux et produits variés. Une de mes boutiques préférées.', rating: 5 },
    { comment: 'Rapport qualité-prix imbattable. J\'y fais tous mes achats maintenant.', rating: 4 },
    { comment: 'Belle découverte ! Les produits sont uniques et de grande qualité.', rating: 5 },
    { comment: 'Bon service mais un peu d\'attente aux heures de pointe. Produits top quand même.', rating: 3 },
    { comment: 'Boutique de confiance, je commande régulièrement et jamais déçu.', rating: 5 },
    { comment: 'Excellente boutique avec un vrai savoir-faire. Mes amis adorent aussi.', rating: 5 },
  ];

  const now = new Date();
  let boutiqueReviewCount = 0;

  for (let i = 0; i < allBoutiques.length; i++) {
    const b = allBoutiques[i];
    if (b.name === 'Emplacement') continue;

    // Check if boutique-level review already exists
    const exists = await Review.findOne({ boutiqueId: b._id, productId: null, userId: acheteurId });
    if (exists) {
      console.log('Skip boutique review (exists):', b.name);
      continue;
    }

    const rc = boutiqueReviewComments[i % boutiqueReviewComments.length];
    const daysAgo = Math.floor(Math.random() * 45) + 5;
    const review = new Review({
      boutiqueId: b._id,
      productId: null,
      userId: acheteurId,
      rating: rc.rating,
      comment: rc.comment,
      status: 'published',
      createdAt: new Date(now - daysAgo * 86400000),
      updatedAt: new Date(now - daysAgo * 86400000)
    });
    await review.save();
    boutiqueReviewCount++;
    console.log('Avis boutique créé:', b.name, '| rating:', rc.rating);
  }
  console.log('Total avis boutiques créés:', boutiqueReviewCount);

  // ═══════════════════════════════════════════════════
  // 2. RÉPONSES DU PROPRIÉTAIRE BOUTIQUE
  // ═══════════════════════════════════════════════════
  console.log('\n--- Réponses boutique owner ---');
  const responses = [
    'Merci beaucoup pour votre avis ! Nous sommes ravis que vous ayez apprécié nos produits.',
    'Merci pour votre retour positif ! Nous travaillons chaque jour pour offrir le meilleur service.',
    'Nous vous remercions pour cette belle note ! Au plaisir de vous revoir bientôt.',
    'Merci ! Votre satisfaction est notre priorité. N\'hésitez pas à revenir.',
    'Un grand merci pour ce retour encourageant ! L\'équipe est touchée.',
    'Merci pour votre fidélité ! Nous sommes heureux de vous compter parmi nos clients.',
    'Merci beaucoup ! Nous prenons note de vos remarques pour nous améliorer.',
    'Votre avis nous fait très plaisir ! Merci et à bientôt dans notre boutique.',
    'Merci pour cette recommandation ! Nous espérons vous revoir très vite.',
    'Nous apprécions votre retour ! Toute l\'équipe vous remercie.',
  ];

  // Get reviews for boutiques owned by boutique user
  const boutiqueIds = boutiques.map(b => b._id);
  const reviewsToRespond = await Review.find({
    boutiqueId: { $in: boutiqueIds },
    status: 'published',
    'response.text': { $exists: false }
  }).lean();

  let responseCount = 0;
  for (let i = 0; i < reviewsToRespond.length; i++) {
    // Respond to ~70% of reviews
    if (Math.random() > 0.7) continue;

    const r = reviewsToRespond[i];
    const daysAfter = Math.floor(Math.random() * 3) + 1;
    const respondedAt = new Date(new Date(r.createdAt).getTime() + daysAfter * 86400000);

    await Review.updateOne({ _id: r._id }, {
      $set: {
        response: {
          text: responses[i % responses.length],
          respondedAt
        }
      }
    });
    responseCount++;
  }
  console.log('Réponses ajoutées:', responseCount);

  // Update boutique ratings
  for (const b of allBoutiques) {
    if (b.name === 'Emplacement') continue;
    const revs = await Review.find({ boutiqueId: b._id, status: 'published' });
    if (revs.length > 0) {
      const avg = revs.reduce((s, r) => s + r.rating, 0) / revs.length;
      await Boutique.updateOne({ _id: b._id }, {
        $set: { rating: Math.round(avg * 10) / 10, reviewCount: revs.length }
      });
    }
  }
  console.log('Ratings boutiques mis à jour');

  // ═══════════════════════════════════════════════════
  // 3. PROMOTIONS
  // ═══════════════════════════════════════════════════
  console.log('\n--- Promotions ---');

  const existingPromos = await Promotion.countDocuments();
  if (existingPromos > 0) {
    console.log('Promotions existantes:', existingPromos, '- skip');
  } else {
    const promoData = [
      // Boutique Mode Express
      {
        boutiqueId: '699dc55a94dcfc77c1d2055d',
        title: 'Soldes d\'été - Mode Express',
        description: 'Profitez de -20% sur toute la collection été ! Robes, vestes et accessoires à prix réduit.',
        type: 'percentage',
        value: 20,
        image: 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=800&h=400&fit=crop',
        startDate: new Date(now - 10 * 86400000),
        endDate: new Date(now.getTime() + 20 * 86400000),
        status: 'active'
      },
      {
        boutiqueId: '699dc55a94dcfc77c1d2055d',
        title: 'Flash Sale - Écharpes',
        description: 'Offre flash : -15% sur toutes les écharpes en soie. Stock limité !',
        type: 'percentage',
        value: 15,
        image: 'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=800&h=400&fit=crop',
        startDate: new Date(now - 2 * 86400000),
        endDate: new Date(now.getTime() + 5 * 86400000),
        status: 'active'
      },
      // Tech Corner
      {
        boutiqueId: '699dc55a94dcfc77c1d2055f',
        title: 'Promo Tech - Accessoires',
        description: 'Réduction de 2 000 Ar sur les accessoires téléphone. Coques, chargeurs et supports.',
        type: 'fixed',
        value: 2000,
        image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=400&fit=crop',
        startDate: new Date(now - 5 * 86400000),
        endDate: new Date(now.getTime() + 15 * 86400000),
        status: 'active'
      },
      {
        boutiqueId: '699dc55a94dcfc77c1d2055f',
        title: 'Offre Spéciale Bluetooth',
        description: 'Écouteurs Bluetooth Pro à prix spécial ! Qualité audio premium à petit prix.',
        type: 'percentage',
        value: 25,
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=400&fit=crop',
        startDate: new Date(now.getTime() + 3 * 86400000),
        endDate: new Date(now.getTime() + 18 * 86400000),
        status: 'scheduled'
      },
      // Café Gourmet
      {
        boutiqueId: '699dc55a94dcfc77c1d20561',
        title: 'Semaine du Café',
        description: 'Découvrez notre sélection de cafés premium avec -10% sur toute la gamme.',
        type: 'percentage',
        value: 10,
        image: 'https://images.unsplash.com/photo-1447933601403-56dc2df4e4e6?w=800&h=400&fit=crop',
        startDate: new Date(now - 3 * 86400000),
        endDate: new Date(now.getTime() + 4 * 86400000),
        status: 'active'
      },
      // Liceria
      {
        boutiqueId: '6984bab80f0eed70efb1cf70',
        title: 'Offre de lancement - Nouvelle collection',
        description: '-30% sur les t-shirts premium et chemises lin. Collection exclusive !',
        type: 'percentage',
        value: 30,
        image: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=800&h=400&fit=crop',
        startDate: new Date(now - 7 * 86400000),
        endDate: new Date(now.getTime() + 14 * 86400000),
        status: 'active'
      },
      // Ended promotion
      {
        boutiqueId: '699dc55a94dcfc77c1d2055d',
        title: 'Black Friday Mode',
        description: 'Jusqu\'à -40% sur une sélection d\'articles mode. Offre terminée.',
        type: 'percentage',
        value: 40,
        image: 'https://images.unsplash.com/photo-1607083206325-caf1edba7a0f?w=800&h=400&fit=crop',
        startDate: new Date(now - 40 * 86400000),
        endDate: new Date(now - 30 * 86400000),
        status: 'ended'
      },
    ];

    // Assign products to promotions
    const modeProducts = allProducts.filter(p => p.boutiqueId.toString() === '699dc55a94dcfc77c1d2055d');
    const techProducts = allProducts.filter(p => p.boutiqueId.toString() === '699dc55a94dcfc77c1d2055f');
    const cafeProducts = allProducts.filter(p => p.boutiqueId.toString() === '699dc55a94dcfc77c1d20561');
    const liceriaProducts = allProducts.filter(p => p.boutiqueId.toString() === '6984bab80f0eed70efb1cf70');

    promoData[0].products = modeProducts.map(p => p._id); // all mode products
    promoData[1].products = modeProducts.filter(p => p.name.includes('charpe')).map(p => p._id);
    promoData[2].products = techProducts.filter(p => p.name.includes('Coque') || p.name.includes('Support') || p.name.includes('Chargeur')).map(p => p._id);
    promoData[3].products = techProducts.filter(p => p.name.includes('couteurs')).map(p => p._id);
    promoData[4].products = cafeProducts.map(p => p._id);
    promoData[5].products = liceriaProducts.filter(p => p.name.includes('T-') || p.name.includes('Chemise')).map(p => p._id);
    promoData[6].products = modeProducts.slice(0, 3).map(p => p._id);

    for (const pd of promoData) {
      const promo = new Promotion(pd);
      await promo.save();
      console.log('Promo créée:', pd.title, '| type:', pd.type, '| status:', pd.status);
    }
  }

  // ═══════════════════════════════════════════════════
  // 4. PRODUITS EN VEDETTE
  // ═══════════════════════════════════════════════════
  console.log('\n--- Produits en vedette ---');
  const featuredNames = [
    'T-Shirt Premium - Edition Limitee',
    'Sneakers Urban Runner',
    'Montre Classique Acier',
    'Robe d\'été Fleurie',
    'Écouteurs Bluetooth Pro',
    'Café Arabica Premium 500g',
    'Chocolat Artisanal 70%',
    'Veste en Jean Vintage',
    'Lunettes de Soleil Polarisées',
    'Parfum Eau de Toilette 100ml'
  ];

  const featuredResult = await Product.updateMany(
    { name: { $in: featuredNames } },
    { $set: { isFeatured: true } }
  );
  console.log('Produits mis en vedette:', featuredResult.modifiedCount);

  // Also set originalPrice for products with promotions (to show discount)
  const promoProducts = allProducts.filter(p =>
    ['699dc55a94dcfc77c1d2055d', '699dc55a94dcfc77c1d2055f', '699dc55a94dcfc77c1d20561', '6984bab80f0eed70efb1cf70']
      .includes(p.boutiqueId.toString())
  );
  for (const p of promoProducts) {
    if (!p.originalPrice || p.originalPrice <= p.price) {
      const markup = 1 + (Math.floor(Math.random() * 3) + 1) * 0.1; // 10-30% higher
      await Product.updateOne({ _id: p._id }, { $set: { originalPrice: Math.round(p.price * markup) } });
    }
  }
  console.log('Prix originaux mis à jour pour afficher les remises');

  // ═══════════════════════════════════════════════════
  // 5. ÉVÉNEMENTS
  // ═══════════════════════════════════════════════════
  console.log('\n--- Événements ---');
  const existingEvents = await Event.countDocuments();
  if (existingEvents > 0) {
    console.log('Événements existants:', existingEvents, '- skip');
  } else {
    const events = [
      {
        title: 'Grande Ouverture du Centre Commercial',
        slug: 'grande-ouverture-centre-commercial',
        description: 'Célébrez avec nous l\'inauguration officielle du centre commercial ! Animations, dégustations gratuites, spectacles musicaux et offres exceptionnelles dans toutes les boutiques. Une journée festive à ne pas manquer pour toute la famille.',
        shortDescription: 'Inauguration officielle avec animations, dégustations et offres spéciales.',
        image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&h=600&fit=crop',
        startDate: new Date(now - 30 * 86400000),
        endDate: new Date(now - 28 * 86400000),
        visibility: 'public',
        isFeatured: true,
        createdBy: adminId,
        status: 'ended'
      },
      {
        title: 'Festival de la Mode Printemps 2026',
        slug: 'festival-mode-printemps-2026',
        description: 'Découvrez les dernières tendances mode printemps-été lors de notre festival annuel. Défilés de mode, ateliers stylisme, conseils personnalisés et remises exclusives dans les boutiques de mode participantes. Venez nombreux !',
        shortDescription: 'Défilés, ateliers stylisme et remises exclusives sur la mode printemps.',
        image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=1200&h=600&fit=crop',
        startDate: new Date(now - 2 * 86400000),
        endDate: new Date(now.getTime() + 12 * 86400000),
        visibility: 'public',
        isFeatured: true,
        createdBy: adminId,
        status: 'published'
      },
      {
        title: 'Semaine de la Tech & Innovation',
        slug: 'semaine-tech-innovation',
        description: 'Plongez dans l\'univers de la technologie pendant une semaine entière. Démonstrations de gadgets, ateliers robotique pour enfants, conférences sur l\'IA et promotions spéciales sur tous les produits tech du centre.',
        shortDescription: 'Démonstrations, ateliers et promos tech pendant toute la semaine.',
        image: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1200&h=600&fit=crop',
        startDate: new Date(now.getTime() + 5 * 86400000),
        endDate: new Date(now.getTime() + 12 * 86400000),
        visibility: 'public',
        isFeatured: false,
        createdBy: adminId,
        status: 'published'
      },
      {
        title: 'Marché Gourmand Artisanal',
        slug: 'marche-gourmand-artisanal',
        description: 'Savourez les meilleurs produits artisanaux de Madagascar. Dégustations de café, chocolat, miel et confitures faits maison. Rencontrez les producteurs locaux et découvrez des saveurs uniques. Entrée libre.',
        shortDescription: 'Dégustations et rencontres avec les producteurs locaux.',
        image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&h=600&fit=crop',
        startDate: new Date(now.getTime() + 15 * 86400000),
        endDate: new Date(now.getTime() + 17 * 86400000),
        visibility: 'public',
        isFeatured: true,
        createdBy: adminId,
        status: 'draft'
      },
      {
        title: 'Soirée VIP Bijoux & Accessoires',
        slug: 'soiree-vip-bijoux-accessoires',
        description: 'Une soirée exclusive réservée à nos meilleurs clients. Présentation de la nouvelle collection de bijoux, cocktail, musique live et réductions de -25% pour les présents. Sur invitation uniquement.',
        shortDescription: 'Soirée exclusive avec nouvelle collection bijoux et cocktail.',
        image: 'https://images.unsplash.com/photo-1515562141589-67f0d569b610?w=1200&h=600&fit=crop',
        startDate: new Date(now.getTime() + 20 * 86400000),
        endDate: new Date(now.getTime() + 20 * 86400000 + 6 * 3600000),
        visibility: 'boutiques',
        isFeatured: false,
        createdBy: adminId,
        status: 'draft'
      },
      {
        title: 'Journée Sport & Bien-être',
        slug: 'journee-sport-bien-etre',
        description: 'Participez à notre journée dédiée au sport et au bien-être. Cours de yoga gratuits, démonstrations fitness, conseils nutrition et offres spéciales dans les boutiques Sport Zone et Beauty Lounge.',
        shortDescription: 'Yoga, fitness, nutrition et promos sport & beauté.',
        image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1200&h=600&fit=crop',
        startDate: new Date(now - 15 * 86400000),
        endDate: new Date(now - 14 * 86400000),
        visibility: 'public',
        isFeatured: false,
        createdBy: adminId,
        status: 'ended'
      },
      {
        title: 'Atelier Décoration d\'Intérieur',
        slug: 'atelier-decoration-interieur',
        description: 'Apprenez à transformer votre intérieur avec nos experts en décoration. Conseils pratiques, tendances 2026, et remises exclusives sur la collection Maison & Intérieur. Places limitées, inscrivez-vous !',
        shortDescription: 'Conseils déco, tendances 2026 et remises exclusives.',
        image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&h=600&fit=crop',
        startDate: new Date(now.getTime() + 25 * 86400000),
        endDate: new Date(now.getTime() + 26 * 86400000),
        visibility: 'public',
        isFeatured: false,
        createdBy: adminId,
        status: 'draft'
      },
      {
        title: 'Black Friday Madagascar',
        slug: 'black-friday-madagascar-2026',
        description: 'Le plus grand événement shopping de l\'année ! Jusqu\'à -50% dans toutes les boutiques du centre. Offres limitées, premier arrivé, premier servi. Ouverture exceptionnelle dès 7h du matin.',
        shortDescription: 'Jusqu\'à -50% dans toutes les boutiques. Ouverture dès 7h.',
        image: 'https://images.unsplash.com/photo-1607083206325-caf1edba7a0f?w=1200&h=600&fit=crop',
        startDate: new Date(now.getTime() + 60 * 86400000),
        endDate: new Date(now.getTime() + 63 * 86400000),
        visibility: 'public',
        isFeatured: true,
        createdBy: adminId,
        status: 'draft'
      },
    ];

    for (const ev of events) {
      const event = new Event(ev);
      await event.save();
      console.log('Événement créé:', ev.title, '| status:', ev.status);
    }
  }

  await mongoose.disconnect();
  console.log('\n✓ Terminé !');
}

run().catch(e => { console.error(e); process.exit(1); });
