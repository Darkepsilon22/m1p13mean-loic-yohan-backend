/**
 * Seed script — populate database with rich test data
 * Run: node seed-data.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const Boutique = require('./src/models/Boutique');
  const Product = require('./src/models/Product');
  const Order = require('./src/models/Order');
  const Review = require('./src/models/Review');
  const Contract = require('./src/models/Contract');
  const Invoice = require('./src/models/Invoice');
  const StockMovement = require('./src/models/StockMovement');
  const ReservationBoutique = require('./src/models/ReservationBoutique');
  const User = require('./src/models/User');

  // ── IDs ──
  const BOUTIQUE_USER = '699f15c32b045c5fb8961771';  // boutique@test.com
  const ACHETEUR_USER = '699f15c42b045c5fb8961774';  // acheteur@test.com
  const ADMIN_USER    = '699f15c22b045c5fb896176e';   // admin@test.com
  const FLOOR_ID      = '69947dfe23b6d4697c818fd7';
  const ZONE_A        = '69a1b758fc33f42489275f1e';
  const ZONE_B        = '69a1b758fc33f42489275f1f';
  const ZONE_C        = '69a1b758fc33f42489275f20';
  const ZONE_D        = '69a1b758fc33f42489275f21';
  const ZONE_RDC      = '69947e1723b6d4697c818fe6';

  // Categories
  const CAT_MODE_H     = '699dc45bbc9b8f95cf45f208';
  const CAT_MODE_F     = '699dc45bbc9b8f95cf45f20b';
  const CAT_ELECTRONIQUE = '699dc45bbc9b8f95cf45f20e';
  const CAT_ALIMENTATION = '699dc45bbc9b8f95cf45f211';
  const CAT_BEAUTE     = '699dc45bbc9b8f95cf45f214';
  const CAT_SPORT      = '699dc45bbc9b8f95cf45f217';
  const CAT_MAISON     = '699dc45cbc9b8f95cf45f21a';
  const CAT_BIJOUTERIE = '699dc45cbc9b8f95cf45f21d';

  // Boutiques to assign to boutique@test.com
  const boutiqueIds = [
    '699dc55a94dcfc77c1d2055d', // Boutique Mode Express
    '699dc55a94dcfc77c1d2055f', // Tech Corner
    '699dc55a94dcfc77c1d20561', // Café Gourmet
  ];

  // Photos from Unsplash (free use)
  const LOGOS = [
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&h=200&fit=crop',
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=200&h=200&fit=crop',
    'https://images.unsplash.com/photo-1528698827591-e19cef791f48?w=200&h=200&fit=crop',
    'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=200&h=200&fit=crop',
    'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=200&h=200&fit=crop',
    'https://images.unsplash.com/photo-1583922606661-0822ed0bd916?w=200&h=200&fit=crop',
  ];
  const COVERS = [
    'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=400&fit=crop',
  ];
  const PRODUCT_IMAGES = [
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=400&h=400&fit=crop',
    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop',
  ];

  // ═══════════════════════════════════════════
  // 1) Update boutiques — photos + assign to test user
  // ═══════════════════════════════════════════
  console.log('\n1) Updating boutiques with photos...');

  const allBoutiques = await Boutique.find({});
  for (let i = 0; i < allBoutiques.length; i++) {
    const b = allBoutiques[i];
    let changed = false;

    // Add photos if missing
    if (!b.logo || b.logo === '') {
      b.logo = LOGOS[i % LOGOS.length];
      changed = true;
    }
    if (!b.coverImage || b.coverImage === '') {
      b.coverImage = COVERS[i % COVERS.length];
      changed = true;
    }
    if (!b.photos || b.photos.length === 0) {
      b.photos = [
        PRODUCT_IMAGES[(i * 2) % PRODUCT_IMAGES.length],
        PRODUCT_IMAGES[(i * 2 + 1) % PRODUCT_IMAGES.length],
      ];
      changed = true;
    }

    // Add description if missing
    if (!b.description || b.description === 'Emplacement disponible') {
      const descriptions = [
        'Découvrez notre sélection unique de produits tendance et de qualité. Notre boutique vous propose une expérience shopping inoubliable.',
        'Votre destination mode au cœur du centre commercial. Des collections exclusives et un service personnalisé.',
        'Bienvenue dans notre espace dédié aux passionnés. Qualité, authenticité et originalité sont nos maîtres-mots.',
      ];
      b.description = descriptions[i % descriptions.length];
      b.shortDescription = b.description.substring(0, 80) + '...';
      changed = true;
    }

    // Add contact info if missing
    if (!b.contact || !b.contact.phone || b.contact.phone === '') {
      b.contact = {
        phone: `+26134${String(1000000 + i).slice(-7)}`,
        email: `contact@${(b.slug || 'boutique').replace(/[^a-z]/g, '')}.mg`,
        website: null,
        facebook: null,
        instagram: null
      };
      changed = true;
    }

    if (changed) await b.save();
  }

  // Assign 3 boutiques to boutique@test.com
  const boutiquesToAssign = ['699dc55a94dcfc77c1d2055d', '699dc55a94dcfc77c1d2055f', '699dc55a94dcfc77c1d20561'];
  for (const bid of boutiquesToAssign) {
    await Boutique.findByIdAndUpdate(bid, {
      userId: BOUTIQUE_USER,
      assignee: BOUTIQUE_USER,
      emplacementStatus: 'occupee',
      status: 'active',
    });
  }
  console.log('   ✅ 3 boutiques assigned to boutique@test.com');

  // ═══════════════════════════════════════════
  // 2) Create products for the 3 boutiques
  // ═══════════════════════════════════════════
  console.log('\n2) Creating products...');

  const productData = [
    // Boutique Mode Express
    { boutiqueId: boutiquesToAssign[0], name: 'Robe d\'été Fleurie', price: 45000, categoryId: CAT_MODE_F, categoryInternal: 'Robes', stock: 25, image: PRODUCT_IMAGES[0] },
    { boutiqueId: boutiquesToAssign[0], name: 'Veste en Jean Vintage', price: 78000, categoryId: CAT_MODE_F, categoryInternal: 'Vestes', stock: 15, image: PRODUCT_IMAGES[1] },
    { boutiqueId: boutiquesToAssign[0], name: 'Pull Cachemire Oversize', price: 92000, categoryId: CAT_MODE_F, categoryInternal: 'Pulls', stock: 12, image: PRODUCT_IMAGES[2] },
    { boutiqueId: boutiquesToAssign[0], name: 'Pantalon Cargo Urbain', price: 55000, categoryId: CAT_MODE_H, categoryInternal: 'Pantalons', stock: 30, image: PRODUCT_IMAGES[3] },
    { boutiqueId: boutiquesToAssign[0], name: 'Écharpe Soie Imprimée', price: 35000, categoryId: CAT_MODE_F, categoryInternal: 'Accessoires', stock: 40, image: PRODUCT_IMAGES[4] },

    // Tech Corner
    { boutiqueId: boutiquesToAssign[1], name: 'Écouteurs Bluetooth Pro', price: 120000, categoryId: CAT_ELECTRONIQUE, categoryInternal: 'Audio', stock: 20, image: PRODUCT_IMAGES[5] },
    { boutiqueId: boutiquesToAssign[1], name: 'Coque iPhone Premium', price: 25000, categoryId: CAT_ELECTRONIQUE, categoryInternal: 'Accessoires', stock: 50, image: PRODUCT_IMAGES[6] },
    { boutiqueId: boutiquesToAssign[1], name: 'Chargeur Rapide USB-C', price: 35000, categoryId: CAT_ELECTRONIQUE, categoryInternal: 'Chargeurs', stock: 35, image: PRODUCT_IMAGES[7] },
    { boutiqueId: boutiquesToAssign[1], name: 'Support Téléphone Voiture', price: 18000, categoryId: CAT_ELECTRONIQUE, categoryInternal: 'Accessoires', stock: 45, image: PRODUCT_IMAGES[8] },
    { boutiqueId: boutiquesToAssign[1], name: 'Batterie Externe 20000mAh', price: 65000, categoryId: CAT_ELECTRONIQUE, categoryInternal: 'Batteries', stock: 15, image: PRODUCT_IMAGES[9] },

    // Café Gourmet
    { boutiqueId: boutiquesToAssign[2], name: 'Café Arabica Premium 500g', price: 28000, categoryId: CAT_ALIMENTATION, categoryInternal: 'Café', stock: 60, image: PRODUCT_IMAGES[0] },
    { boutiqueId: boutiquesToAssign[2], name: 'Thé Vert Bio Matcha', price: 22000, categoryId: CAT_ALIMENTATION, categoryInternal: 'Thé', stock: 40, image: PRODUCT_IMAGES[1] },
    { boutiqueId: boutiquesToAssign[2], name: 'Chocolat Artisanal 70%', price: 15000, categoryId: CAT_ALIMENTATION, categoryInternal: 'Confiserie', stock: 55, image: PRODUCT_IMAGES[2] },
    { boutiqueId: boutiquesToAssign[2], name: 'Miel de Litchi 350g', price: 18000, categoryId: CAT_ALIMENTATION, categoryInternal: 'Épicerie', stock: 30, image: PRODUCT_IMAGES[3] },
    { boutiqueId: boutiquesToAssign[2], name: 'Confiture Mangue-Passion', price: 12000, categoryId: CAT_ALIMENTATION, categoryInternal: 'Confiture', stock: 35, image: PRODUCT_IMAGES[4] },
  ];

  const createdProducts = [];
  for (const pd of productData) {
    const existing = await Product.findOne({ name: pd.name, boutiqueId: pd.boutiqueId });
    if (existing) {
      // Update images if empty
      if (!existing.images || existing.images.length === 0) {
        existing.images = [pd.image];
        await existing.save();
      }
      createdProducts.push(existing);
    } else {
      const p = await Product.create({
        name: pd.name,
        boutiqueId: pd.boutiqueId,
        categoryId: pd.categoryId,
        categoryInternal: pd.categoryInternal,
        price: pd.price,
        stock: pd.stock,
        images: [pd.image],
        description: `${pd.name} — Produit de qualité disponible dans notre boutique.`,
        availability: 'available',
        isActive: true,
      });
      createdProducts.push(p);
    }
  }
  console.log(`   ✅ ${createdProducts.length} products ready`);

  // Also update existing products with images
  const existingProducts = await Product.find({ images: { $size: 0 } });
  for (let i = 0; i < existingProducts.length; i++) {
    existingProducts[i].images = [PRODUCT_IMAGES[i % PRODUCT_IMAGES.length]];
    await existingProducts[i].save();
  }
  console.log(`   ✅ Updated ${existingProducts.length} existing products with images`);

  // ═══════════════════════════════════════════
  // 3) Create reservations + contracts + invoices
  // ═══════════════════════════════════════════
  console.log('\n3) Creating reservations, contracts, invoices...');

  for (let i = 0; i < boutiquesToAssign.length; i++) {
    const bid = boutiquesToAssign[i];
    const boutique = await Boutique.findById(bid);

    // Reservation
    const reservation = await ReservationBoutique.create({
      boutique: bid,
      user: BOUTIQUE_USER,
      status: 'confirmee',
      price: boutique.price,
      boutiqueSnapshot: {
        name: boutique.name,
        location: boutique.location || { floor: 0, zone: 'RDC', number: `RDC-${i + 1}` },
        surface: 50 + i * 10,
      },
      requestedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      confirmedAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
      validatedBy: ADMIN_USER,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });

    // Contract
    const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);
    const contract = await Contract.create({
      reference: `CTR-${Date.now()}-${i}`,
      boutique: bid,
      tenant: BOUTIQUE_USER,
      reservation: reservation._id,
      monthlyRent: boutique.price,
      deposit: boutique.price * 2,
      depositStatus: 'confirmed',
      depositPaid: boutique.price * 2,
      depositPaidAt: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000),
      depositPayments: [{
        amount: boutique.price * 2,
        method: 'bank_transfer',
        reference: `DEP-${Date.now()}-${i}`,
        paidAt: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000),
        notes: 'Dépôt de garantie payé intégralement'
      }],
      startDate,
      endDate,
      billingDay: 1,
      status: 'active',
      signedAt: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000),
      signedByTenant: true,
      createdBy: ADMIN_USER,
      boutiqueSnapshot: {
        location: boutique.location || { floor: 0, zone: 'RDC', number: `RDC-${i + 1}` },
        surface: 50 + i * 10,
        category: boutique.categoryId || 'Général',
      },
      notes: `Contrat pour ${boutique.name}`
    });

    // Invoices — 2 months
    for (let m = 0; m < 2; m++) {
      const periodStart = new Date(startDate);
      periodStart.setMonth(periodStart.getMonth() + m);
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      const dueDate = new Date(periodStart);
      dueDate.setDate(dueDate.getDate() + 5);

      const isPaid = m === 0; // First month paid, second pending
      await Invoice.create({
        reference: `INV-${Date.now()}-${i}-${m}`,
        contract: contract._id,
        tenant: BOUTIQUE_USER,
        boutique: bid,
        amountDue: boutique.price,
        amountPaid: isPaid ? boutique.price : 0,
        periodStart,
        periodEnd,
        dueDate,
        status: isPaid ? 'paid' : 'pending',
        type: 'rent',
        payments: isPaid ? [{
          amount: boutique.price,
          method: 'stripe',
          reference: `PAY-${Date.now()}-${i}-${m}`,
          paidAt: new Date(periodStart.getTime() + 3 * 24 * 60 * 60 * 1000),
          notes: 'Paiement mensuel'
        }] : [],
        paidInFullAt: isPaid ? new Date(periodStart.getTime() + 3 * 24 * 60 * 60 * 1000) : null,
      });
    }

    console.log(`   ✅ Reservation + Contract + 2 Invoices for ${boutique.name}`);
  }

  // ═══════════════════════════════════════════
  // 4) Create many orders from acheteur@test.com
  // ═══════════════════════════════════════════
  console.log('\n4) Creating orders...');

  const orderStatuses = [
    { status: 'completed', paymentStatus: 'success', paymentMethod: 'stripe' },
    { status: 'completed', paymentStatus: 'success', paymentMethod: 'stripe' },
    { status: 'completed', paymentStatus: 'success', paymentMethod: 'cash' },
    { status: 'delivered', paymentStatus: 'success', paymentMethod: 'stripe' },
    { status: 'delivered', paymentStatus: 'success', paymentMethod: 'stripe' },
    { status: 'shipped', paymentStatus: 'success', paymentMethod: 'stripe' },
    { status: 'shipped', paymentStatus: 'success', paymentMethod: 'card' },
    { status: 'processing', paymentStatus: 'success', paymentMethod: 'stripe' },
    { status: 'confirmed', paymentStatus: 'success', paymentMethod: 'stripe' },
    { status: 'confirmed', paymentStatus: 'success', paymentMethod: 'cash' },
    { status: 'pending', paymentStatus: 'pending', paymentMethod: 'pending' },
    { status: 'pending', paymentStatus: 'pending', paymentMethod: 'pending' },
    { status: 'cancelled', paymentStatus: 'failed', paymentMethod: 'stripe' },
    { status: 'cancelled', paymentStatus: 'failed', paymentMethod: 'stripe' },
    { status: 'completed', paymentStatus: 'success', paymentMethod: 'stripe' },
    { status: 'completed', paymentStatus: 'success', paymentMethod: 'cash' },
    { status: 'delivered', paymentStatus: 'success', paymentMethod: 'stripe' },
    { status: 'shipped', paymentStatus: 'success', paymentMethod: 'stripe' },
    { status: 'processing', paymentStatus: 'success', paymentMethod: 'stripe' },
    { status: 'completed', paymentStatus: 'success', paymentMethod: 'stripe' },
  ];

  const now = Date.now();
  let orderCount = 0;
  for (let i = 0; i < orderStatuses.length; i++) {
    const os = orderStatuses[i];
    // Pick 1-3 random products from our created products
    const numItems = 1 + Math.floor(Math.random() * 3);
    const shuffled = [...createdProducts].sort(() => Math.random() - 0.5).slice(0, numItems);
    const items = shuffled.map(p => ({
      productId: p._id,
      boutiqueId: p.boutiqueId,
      productName: p.name,
      productImage: (p.images && p.images[0]) || '',
      quantity: 1 + Math.floor(Math.random() * 3),
      unitPrice: p.price,
      totalPrice: p.price * (1 + Math.floor(Math.random() * 3)),
    }));
    // Recalculate totalPrice properly
    items.forEach(item => { item.totalPrice = item.unitPrice * item.quantity; });

    const subtotal = items.reduce((s, it) => s + it.totalPrice, 0);
    const shippingFee = 2500;
    const totalAmount = subtotal + shippingFee;

    // Spread orders over the last 60 days
    const daysAgo = Math.floor((i / orderStatuses.length) * 60);
    const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000 - Math.random() * 12 * 60 * 60 * 1000);
    const dateStr = createdAt.toISOString().slice(0, 10).replace(/-/g, '');
    const ref = `CC-${dateStr}-${String(50 + i).padStart(5, '0')}`;

    // Check if ref exists
    const existing = await Order.findOne({ orderReference: ref });
    if (existing) continue;

    const order = await Order.create({
      orderReference: ref,
      userId: ACHETEUR_USER,
      items,
      customerName: 'Acheteur Test',
      customerEmail: 'acheteur@test.com',
      customerPhone: '+261340000099',
      shippingAddress: {
        street: '12 Rue Rainitovo',
        city: 'Antananarivo',
        postalCode: '101',
        country: 'Madagascar',
      },
      subtotal,
      shippingFee,
      totalAmount,
      status: os.status,
      paymentStatus: os.paymentStatus,
      paymentMethod: os.paymentMethod,
      createdAt,
      updatedAt: createdAt,
      confirmedAt: ['confirmed', 'processing', 'shipped', 'delivered', 'completed'].includes(os.status) ? new Date(createdAt.getTime() + 30 * 60 * 1000) : null,
      processedAt: ['processing', 'shipped', 'delivered', 'completed'].includes(os.status) ? new Date(createdAt.getTime() + 2 * 60 * 60 * 1000) : null,
      shippedAt: ['shipped', 'delivered', 'completed'].includes(os.status) ? new Date(createdAt.getTime() + 24 * 60 * 60 * 1000) : null,
      deliveredAt: ['delivered', 'completed'].includes(os.status) ? new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000) : null,
      completedAt: os.status === 'completed' ? new Date(createdAt.getTime() + 4 * 24 * 60 * 60 * 1000) : null,
      cancelledAt: os.status === 'cancelled' ? new Date(createdAt.getTime() + 60 * 60 * 1000) : null,
      expiresAt: new Date(createdAt.getTime() + 48 * 60 * 60 * 1000),
    });
    orderCount++;
  }
  console.log(`   ✅ ${orderCount} orders created`);

  // ═══════════════════════════════════════════
  // 5) Create reviews from acheteur@test.com
  // ═══════════════════════════════════════════
  console.log('\n5) Creating reviews...');

  // Reviews need unique (boutiqueId, productId, userId) — so assign a product to each review
  const productsB0 = createdProducts.filter(p => p.boutiqueId.toString() === boutiquesToAssign[0]);
  const productsB1 = createdProducts.filter(p => p.boutiqueId.toString() === boutiquesToAssign[1]);
  const productsB2 = createdProducts.filter(p => p.boutiqueId.toString() === boutiquesToAssign[2]);

  const reviewData = [
    { boutiqueId: boutiquesToAssign[0], productId: productsB0[0]?._id, rating: 5, comment: 'Excellente boutique ! Les vêtements sont de très bonne qualité et le service est impeccable. Je recommande vivement.' },
    { boutiqueId: boutiquesToAssign[0], productId: productsB0[1]?._id, rating: 4, comment: 'Bonne sélection de produits, livraison rapide. Seul bémol : les tailles sont un peu petites.' },
    { boutiqueId: boutiquesToAssign[0], productId: productsB0[2]?._id, rating: 5, comment: 'Le pull cachemire est incroyablement doux. Très satisfait de mon achat !' },
    { boutiqueId: boutiquesToAssign[1], productId: productsB1[0]?._id, rating: 5, comment: 'Super boutique tech ! Les écouteurs bluetooth sont incroyables, qualité sonore au top.' },
    { boutiqueId: boutiquesToAssign[1], productId: productsB1[1]?._id, rating: 4, comment: 'Bon rapport qualité-prix sur les accessoires. Le chargeur rapide fonctionne parfaitement.' },
    { boutiqueId: boutiquesToAssign[1], productId: productsB1[2]?._id, rating: 3, comment: 'Produits corrects mais j\'aurais aimé plus de choix en termes de marques.' },
    { boutiqueId: boutiquesToAssign[2], productId: productsB2[0]?._id, rating: 5, comment: 'Le meilleur café d\'Antananarivo ! L\'arabica premium est une merveille, je suis client fidèle.' },
    { boutiqueId: boutiquesToAssign[2], productId: productsB2[1]?._id, rating: 5, comment: 'Le chocolat artisanal 70% est divin ! Et le miel de litchi est exceptionnel. Bravo !' },
    { boutiqueId: boutiquesToAssign[2], productId: productsB2[2]?._id, rating: 4, comment: 'Très bons produits locaux. La confiture mangue-passion est délicieuse. J\'y retournerai.' },
  ];

  let reviewCount = 0;
  for (let i = 0; i < reviewData.length; i++) {
    const rd = reviewData[i];
    if (!rd.productId) continue;
    const daysAgo = Math.floor(Math.random() * 45);
    const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000);

    const existing = await Review.findOne({
      boutiqueId: rd.boutiqueId,
      productId: rd.productId,
      userId: ACHETEUR_USER,
    });
    if (existing) continue;

    await Review.create({
      boutiqueId: rd.boutiqueId,
      productId: rd.productId,
      userId: ACHETEUR_USER,
      rating: rd.rating,
      comment: rd.comment,
      status: 'published',
      createdAt,
      updatedAt: createdAt,
    });
    reviewCount++;
  }
  console.log(`   ✅ ${reviewCount} reviews created`);

  // ═══════════════════════════════════════════
  // 6) Create stock movements for stats
  // ═══════════════════════════════════════════
  console.log('\n6) Creating stock movements...');

  let smCount = 0;
  for (const product of createdProducts) {
    // Initial stock
    const existing = await StockMovement.findOne({ productId: product._id, type: 'initial' });
    if (existing) continue;

    const daysAgo = 30 + Math.floor(Math.random() * 15);
    await StockMovement.create({
      productId: product._id,
      boutiqueId: product.boutiqueId,
      type: 'initial',
      quantity: product.stock || 20,
      previousStock: 0,
      newStock: product.stock || 20,
      reason: 'Stock initial',
      userId: BOUTIQUE_USER,
      createdAt: new Date(now - daysAgo * 24 * 60 * 60 * 1000),
    });

    // Simulate sales (out movements)
    let currentStock = product.stock || 20;
    for (let j = 0; j < 5 + Math.floor(Math.random() * 8); j++) {
      const qty = 1 + Math.floor(Math.random() * 3);
      if (currentStock - qty < 0) break;
      const prevStock = currentStock;
      currentStock -= qty;
      const dayOffset = Math.floor(Math.random() * 28);
      await StockMovement.create({
        productId: product._id,
        boutiqueId: product.boutiqueId,
        type: 'out',
        quantity: -qty,
        previousStock: prevStock,
        newStock: currentStock,
        reason: 'Vente - Commande client',
        userId: BOUTIQUE_USER,
        createdAt: new Date(now - dayOffset * 24 * 60 * 60 * 1000),
      });
      smCount++;
    }

    // Occasional restock (in movements)
    if (Math.random() > 0.4) {
      const restockQty = 10 + Math.floor(Math.random() * 20);
      const prevStock = currentStock;
      currentStock += restockQty;
      await StockMovement.create({
        productId: product._id,
        boutiqueId: product.boutiqueId,
        type: 'in',
        quantity: restockQty,
        previousStock: prevStock,
        newStock: currentStock,
        reason: 'Réapprovisionnement fournisseur',
        userId: BOUTIQUE_USER,
        createdAt: new Date(now - Math.floor(Math.random() * 10) * 24 * 60 * 60 * 1000),
      });
      smCount++;
    }

    // Update product stock to match
    await Product.findByIdAndUpdate(product._id, { stock: currentStock });
  }
  console.log(`   ✅ ${smCount} stock movements created`);

  // ═══════════════════════════════════════════
  // 7) Update boutique ratings from reviews
  // ═══════════════════════════════════════════
  console.log('\n7) Updating boutique ratings...');
  for (const bid of boutiquesToAssign) {
    const reviews = await Review.find({ boutiqueId: bid, status: 'published' });
    if (reviews.length > 0) {
      const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
      await Boutique.findByIdAndUpdate(bid, {
        'rating.average': Math.round(avg * 10) / 10,
        'rating.count': reviews.length,
      });
    }
  }
  console.log('   ✅ Ratings updated');

  console.log('\n════════════════════════════════════');
  console.log('   SEED COMPLETE!');
  console.log('════════════════════════════════════');
  console.log('Test accounts:');
  console.log('  boutique@test.com / Test1234! → 3 boutiques with products, contracts, invoices');
  console.log('  acheteur@test.com / Test1234! → orders, reviews');
  console.log('  admin@test.com    / Test1234! → admin dashboard');

  await mongoose.disconnect();
}

seed().catch(e => { console.error('SEED ERROR:', e); process.exit(1); });
