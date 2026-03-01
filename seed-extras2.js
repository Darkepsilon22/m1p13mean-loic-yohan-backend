const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const Promotion = require('./src/models/Promotion');
  const Event = require('./src/models/Event');
  const Product = require('./src/models/Product');

  const now = new Date();
  const adminId = '699f15c22b045c5fb896176e';

  const allProducts = await Product.find({}, '_id name boutiqueId').lean();
  const modeProducts = allProducts.filter(p => p.boutiqueId.toString() === '699dc55a94dcfc77c1d2055d');
  const techProducts = allProducts.filter(p => p.boutiqueId.toString() === '699dc55a94dcfc77c1d2055f');
  const cafeProducts = allProducts.filter(p => p.boutiqueId.toString() === '699dc55a94dcfc77c1d20561');
  const liceriaProducts = allProducts.filter(p => p.boutiqueId.toString() === '6984bab80f0eed70efb1cf70');

  // ── PROMOTIONS ──
  console.log('--- Promotions ---');
  const promos = [
    {
      boutiqueId: '699dc55a94dcfc77c1d2055d',
      title: 'Soldes Mode Express -20%',
      description: 'Profitez de -20% sur toute la collection ! Robes, vestes et accessoires.',
      type: 'percentage', value: 20,
      image: 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=800&h=400&fit=crop',
      products: modeProducts.map(p => p._id),
      startDate: new Date(now - 10 * 86400000),
      endDate: new Date(now.getTime() + 20 * 86400000),
      status: 'active'
    },
    {
      boutiqueId: '699dc55a94dcfc77c1d2055d',
      title: 'Flash Sale Echarpes',
      description: 'Offre flash : -15% sur toutes les echarpes en soie.',
      type: 'percentage', value: 15,
      image: 'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=800&h=400&fit=crop',
      products: modeProducts.filter(p => p.name.includes('charpe')).map(p => p._id),
      startDate: new Date(now - 2 * 86400000),
      endDate: new Date(now.getTime() + 5 * 86400000),
      status: 'active'
    },
    {
      boutiqueId: '699dc55a94dcfc77c1d2055f',
      title: 'Promo Tech Accessoires',
      description: 'Reduction de 2 000 Ar sur les accessoires telephone.',
      type: 'fixed', value: 2000,
      image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=400&fit=crop',
      products: techProducts.filter(p => p.name.includes('Coque') || p.name.includes('Support') || p.name.includes('Chargeur')).map(p => p._id),
      startDate: new Date(now - 5 * 86400000),
      endDate: new Date(now.getTime() + 15 * 86400000),
      status: 'active'
    },
    {
      boutiqueId: '699dc55a94dcfc77c1d2055f',
      title: 'Offre Speciale Bluetooth',
      description: 'Ecouteurs Bluetooth Pro a prix special !',
      type: 'percentage', value: 25,
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=400&fit=crop',
      products: techProducts.filter(p => p.name.includes('couteurs')).map(p => p._id),
      startDate: new Date(now.getTime() + 3 * 86400000),
      endDate: new Date(now.getTime() + 18 * 86400000),
      status: 'scheduled'
    },
    {
      boutiqueId: '699dc55a94dcfc77c1d20561',
      title: 'Semaine du Cafe Premium',
      description: 'Decouvrez notre selection avec -10% sur toute la gamme cafe et the.',
      type: 'percentage', value: 10,
      image: 'https://images.unsplash.com/photo-1447933601403-56dc2df4e4e6?w=800&h=400&fit=crop',
      products: cafeProducts.map(p => p._id),
      startDate: new Date(now - 3 * 86400000),
      endDate: new Date(now.getTime() + 4 * 86400000),
      status: 'active'
    },
    {
      boutiqueId: '6984bab80f0eed70efb1cf70',
      title: 'Nouvelle Collection -30%',
      description: '-30% sur les t-shirts premium et chemises lin. Collection exclusive !',
      type: 'percentage', value: 30,
      image: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=800&h=400&fit=crop',
      products: liceriaProducts.filter(p => p.name.includes('T-') || p.name.includes('Chemise')).map(p => p._id),
      startDate: new Date(now - 7 * 86400000),
      endDate: new Date(now.getTime() + 14 * 86400000),
      status: 'active'
    },
  ];

  for (const pd of promos) {
    const promo = new Promotion(pd);
    await promo.save();
    console.log('Promo:', pd.title, '|', pd.status);
  }

  // ── UPDATE EXISTING EVENTS WITH IMAGES ──
  console.log('\n--- Events existants ---');
  await Event.updateOne(
    { _id: '698ae8061cca2af0dd3dd838' },
    { $set: { image: 'https://images.unsplash.com/photo-1544776193-352d25ca82cd?w=1200&h=600&fit=crop', isFeatured: true } }
  );
  await Event.updateOne(
    { _id: '698b5777d23385f310077e75' },
    { $set: { image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&h=600&fit=crop', isFeatured: true } }
  );
  console.log('Images ajoutees aux events existants');

  // ── NEW EVENTS ──
  console.log('\n--- Nouveaux events ---');
  const events = [
    {
      title: 'Festival de la Mode Printemps 2026',
      slug: 'festival-mode-printemps-2026',
      description: 'Decouvrez les dernieres tendances mode printemps-ete. Defiles, ateliers stylisme, conseils personnalises et remises exclusives dans les boutiques de mode.',
      shortDescription: 'Defiles, ateliers stylisme et remises exclusives.',
      image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=1200&h=600&fit=crop',
      startDate: new Date(now - 2 * 86400000),
      endDate: new Date(now.getTime() + 12 * 86400000),
      visibility: 'public', isFeatured: true, createdBy: adminId, status: 'published'
    },
    {
      title: 'Semaine de la Tech et Innovation',
      slug: 'semaine-tech-innovation',
      description: 'Plongez dans la technologie. Demonstrations de gadgets, ateliers robotique pour enfants, conferences IA et promotions speciales sur tous les produits tech.',
      shortDescription: 'Demonstrations, ateliers et promos tech.',
      image: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1200&h=600&fit=crop',
      startDate: new Date(now.getTime() + 5 * 86400000),
      endDate: new Date(now.getTime() + 12 * 86400000),
      visibility: 'public', isFeatured: false, createdBy: adminId, status: 'published'
    },
    {
      title: 'Marche Gourmand Artisanal',
      slug: 'marche-gourmand-artisanal',
      description: 'Savourez les meilleurs produits artisanaux de Madagascar. Degustations de cafe, chocolat, miel et confitures. Rencontrez les producteurs locaux.',
      shortDescription: 'Degustations et rencontres avec les producteurs.',
      image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&h=600&fit=crop',
      startDate: new Date(now.getTime() + 15 * 86400000),
      endDate: new Date(now.getTime() + 17 * 86400000),
      visibility: 'public', isFeatured: true, createdBy: adminId, status: 'draft'
    },
    {
      title: 'Soiree VIP Bijoux et Accessoires',
      slug: 'soiree-vip-bijoux-accessoires',
      description: 'Soiree exclusive reservee a nos meilleurs clients. Nouvelle collection de bijoux, cocktail, musique live et -25% pour les presents.',
      shortDescription: 'Soiree exclusive avec nouvelle collection bijoux.',
      image: 'https://images.unsplash.com/photo-1515562141589-67f0d569b610?w=1200&h=600&fit=crop',
      startDate: new Date(now.getTime() + 20 * 86400000),
      endDate: new Date(now.getTime() + 20 * 86400000 + 6 * 3600000),
      visibility: 'boutiques', isFeatured: false, createdBy: adminId, status: 'draft'
    },
    {
      title: 'Journee Sport et Bien-etre',
      slug: 'journee-sport-bien-etre',
      description: 'Cours de yoga gratuits, demonstrations fitness, conseils nutrition et offres speciales dans les boutiques Sport Zone et Beauty Lounge.',
      shortDescription: 'Yoga, fitness, nutrition et promos sport.',
      image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1200&h=600&fit=crop',
      startDate: new Date(now - 15 * 86400000),
      endDate: new Date(now - 14 * 86400000),
      visibility: 'public', isFeatured: false, createdBy: adminId, status: 'ended'
    },
    {
      title: 'Black Friday Madagascar 2026',
      slug: 'black-friday-madagascar-2026',
      description: 'Le plus grand evenement shopping de Madagascar ! Jusqu a -50% dans toutes les boutiques du centre. Ouverture exceptionnelle des 7h du matin.',
      shortDescription: 'Jusqu a -50% partout. Ouverture des 7h.',
      image: 'https://images.unsplash.com/photo-1607083206325-caf1edba7a0f?w=1200&h=600&fit=crop',
      startDate: new Date(now.getTime() + 60 * 86400000),
      endDate: new Date(now.getTime() + 63 * 86400000),
      visibility: 'public', isFeatured: true, createdBy: adminId, status: 'draft'
    },
  ];

  for (const ev of events) {
    const event = new Event(ev);
    await event.save();
    console.log('Event:', ev.title, '|', ev.status);
  }

  await mongoose.disconnect();
  console.log('\nDone!');
}

run().catch(e => { console.error(e); process.exit(1); });
