const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const Boutique = require('./src/models/Boutique');
  const Product = require('./src/models/Product');

  // ═══════════════════════════════════════════
  // BOUTIQUE IMAGES
  // ═══════════════════════════════════════════
  const boutiqueImages = {
    'Liceria': {
      logo: 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=300&h=300&fit=crop',
      coverImage: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1200&h=500&fit=crop',
      photos: [
        'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=600&h=400&fit=crop'
      ]
    },
    'Boutique Mode Express': {
      logo: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=300&h=300&fit=crop',
      coverImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=1200&h=500&fit=crop',
      photos: [
        'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=400&fit=crop'
      ]
    },
    'Tech Corner': {
      logo: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&h=300&fit=crop',
      coverImage: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1200&h=500&fit=crop',
      photos: [
        'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600&h=400&fit=crop'
      ]
    },
    'Café Gourmet': {
      logo: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=300&h=300&fit=crop',
      coverImage: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1200&h=500&fit=crop',
      photos: [
        'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&h=400&fit=crop'
      ]
    },
    'Bijoux & Co': {
      logo: 'https://images.unsplash.com/photo-1515562141589-67f0d569b610?w=300&h=300&fit=crop',
      coverImage: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=1200&h=500&fit=crop',
      photos: [
        'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=600&h=400&fit=crop'
      ]
    },
    'Sport Zone': {
      logo: 'https://images.unsplash.com/photo-1461896836934-bd45ba7b5cf1?w=300&h=300&fit=crop',
      coverImage: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&h=500&fit=crop',
      photos: [
        'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&h=400&fit=crop'
      ]
    },
    'Beauty Lounge': {
      logo: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=300&h=300&fit=crop',
      coverImage: 'https://images.unsplash.com/photo-1560750588-73b555cae65d?w=1200&h=500&fit=crop',
      photos: [
        'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600&h=400&fit=crop'
      ]
    },
    'Librairie Centrale': {
      logo: 'https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=300&h=300&fit=crop',
      coverImage: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1200&h=500&fit=crop',
      photos: [
        'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=400&fit=crop'
      ]
    },
    'Atelier Services': {
      logo: 'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=300&h=300&fit=crop',
      coverImage: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=500&fit=crop',
      photos: [
        'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1497215842964-222b430dc094?w=600&h=400&fit=crop'
      ]
    },
    'Maison & Intérieur': {
      logo: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=300&h=300&fit=crop',
      coverImage: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&h=500&fit=crop',
      photos: [
        'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=600&h=400&fit=crop'
      ]
    },
    'Fashion Gallery': {
      logo: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=300&h=300&fit=crop',
      coverImage: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1200&h=500&fit=crop',
      photos: [
        'https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=600&h=400&fit=crop',
        'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=600&h=400&fit=crop'
      ]
    },
    'Emplacement': {
      logo: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=300&h=300&fit=crop',
      coverImage: 'https://images.unsplash.com/photo-1497215842964-222b430dc094?w=1200&h=500&fit=crop',
      photos: ['https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&h=400&fit=crop']
    }
  };

  let bCount = 0;
  for (const [name, imgs] of Object.entries(boutiqueImages)) {
    const res = await Boutique.updateOne({ name }, { $set: imgs });
    if (res.modifiedCount > 0) bCount++;
  }
  console.log(`Boutiques updated: ${bCount}`);

  // ═══════════════════════════════════════════
  // PRODUCT IMAGES
  // ═══════════════════════════════════════════
  const productImages = {
    // Liceria products
    'T-Shirt Premium - Edition Limitee': ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&h=500&fit=crop'],
    'T-Shirt Premium Coton Bio': ['https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?w=500&h=500&fit=crop'],
    'Tot  bag': ['https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&h=500&fit=crop'],
    'T-shirt Premium Coton Bio': ['https://images.unsplash.com/photo-1622445275463-afa2ab738c34?w=500&h=500&fit=crop'],
    'Jean Slim Stretch': ['https://images.unsplash.com/photo-1542272604-787c3835535d?w=500&h=500&fit=crop'],
    'Sneakers Urban Runner': ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&h=500&fit=crop'],
    'Sac à dos Voyage 40L': ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&h=500&fit=crop'],
    'Montre Classique Acier': ['https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=500&h=500&fit=crop'],
    'Casquette Snapback Logo': ['https://images.unsplash.com/photo-1588850561407-ed78c334e67a?w=500&h=500&fit=crop'],
    'Chemise Lin Été': ['https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500&h=500&fit=crop'],
    'Lunettes de Soleil Polarisées': ['https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500&h=500&fit=crop'],
    'Portefeuille Cuir Véritable': ['https://images.unsplash.com/photo-1627123424574-724758594e93?w=500&h=500&fit=crop'],
    'Parfum Eau de Toilette 100ml': ['https://images.unsplash.com/photo-1541643600914-78b084683601?w=500&h=500&fit=crop'],
    // Boutique Mode Express
    "Robe d'été Fleurie": ['https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=500&h=500&fit=crop'],
    'Veste en Jean Vintage': ['https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500&h=500&fit=crop'],
    'Pull Cachemire Oversize': ['https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=500&h=500&fit=crop'],
    'Pantalon Cargo Urbain': ['https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=500&h=500&fit=crop'],
    'Écharpe Soie Imprimée': ['https://images.unsplash.com/photo-1601924921557-45e8e0e5a8f6?w=500&h=500&fit=crop'],
    // Tech Corner
    'Écouteurs Bluetooth Pro': ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500&fit=crop'],
    'Coque iPhone Premium': ['https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=500&h=500&fit=crop'],
    'Chargeur Rapide USB-C': ['https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=500&h=500&fit=crop'],
    'Support Téléphone Voiture': ['https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=500&h=500&fit=crop'],
    'Batterie Externe 20000mAh': ['https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=500&h=500&fit=crop'],
    // Café Gourmet
    'Café Arabica Premium 500g': ['https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500&h=500&fit=crop'],
    'Thé Vert Bio Matcha': ['https://images.unsplash.com/photo-1556881286-fc6915169721?w=500&h=500&fit=crop'],
    'Chocolat Artisanal 70%': ['https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=500&h=500&fit=crop'],
    'Miel de Litchi 350g': ['https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=500&h=500&fit=crop'],
    'Confiture Mangue-Passion': ['https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=500&h=500&fit=crop'],
  };

  let pCount = 0;
  for (const [name, photos] of Object.entries(productImages)) {
    const mainPhoto = photos[0];
    const res = await Product.updateMany({ name }, { $set: { photos, mainPhoto } });
    pCount += res.modifiedCount;
  }
  console.log(`Products updated: ${pCount}`);

  await mongoose.disconnect();
  console.log('Done!');
}

run().catch(e => { console.error(e); process.exit(1); });
