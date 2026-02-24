const ExcelJS = require('exceljs');
const path = require('path');

const headerStyle = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0ABDE3' } }
};

async function generateProducts() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Produits');

  ws.columns = [
    { header: 'Nom *', key: 'name', width: 35 },
    { header: 'Description', key: 'description', width: 50 },
    { header: 'Prix *', key: 'price', width: 12 },
    { header: 'Prix original', key: 'originalPrice', width: 14 },
    { header: 'Catégorie interne', key: 'categoryInternal', width: 20 },
    { header: 'Stock', key: 'stock', width: 10 },
    { header: 'Seuil stock bas', key: 'lowStockThreshold', width: 15 }
  ];

  const row1 = ws.getRow(1);
  row1.eachCell(cell => {
    cell.font = headerStyle.font;
    cell.fill = headerStyle.fill;
  });

  const products = [
    { name: 'T-shirt Premium Coton Bio', description: 'T-shirt 100% coton biologique, coupe ajustée, disponible en plusieurs couleurs', price: 35000, originalPrice: 45000, categoryInternal: 'Vêtements', stock: 120, lowStockThreshold: 10 },
    { name: 'Jean Slim Stretch', description: 'Jean slim stretch confortable avec élasthanne, taille haute', price: 65000, originalPrice: 80000, categoryInternal: 'Vêtements', stock: 75, lowStockThreshold: 8 },
    { name: 'Sneakers Urban Runner', description: 'Baskets légères avec semelle en mousse EVA, idéales pour la marche urbaine', price: 120000, originalPrice: 150000, categoryInternal: 'Chaussures', stock: 45, lowStockThreshold: 5 },
    { name: 'Sac à dos Voyage 40L', description: 'Sac à dos imperméable avec compartiment laptop 15 pouces et port USB', price: 85000, originalPrice: 95000, categoryInternal: 'Accessoires', stock: 30, lowStockThreshold: 5 },
    { name: 'Montre Classique Acier', description: 'Montre analogique avec bracelet en acier inoxydable, mouvement quartz japonais', price: 180000, originalPrice: 220000, categoryInternal: 'Bijoux', stock: 20, lowStockThreshold: 3 },
    { name: 'Casquette Snapback Logo', description: 'Casquette ajustable avec broderie logo, tissu respirant', price: 25000, originalPrice: 30000, categoryInternal: 'Accessoires', stock: 200, lowStockThreshold: 15 },
    { name: 'Chemise Lin Été', description: 'Chemise en lin naturel, coupe décontractée, parfaite pour l\'été', price: 55000, originalPrice: 70000, categoryInternal: 'Vêtements', stock: 60, lowStockThreshold: 8 },
    { name: 'Lunettes de Soleil Polarisées', description: 'Lunettes UV400 avec verres polarisés et monture légère en TR90', price: 45000, originalPrice: 60000, categoryInternal: 'Accessoires', stock: 90, lowStockThreshold: 10 },
    { name: 'Portefeuille Cuir Véritable', description: 'Portefeuille en cuir de vachette avec 8 emplacements carte et compartiment billets', price: 75000, originalPrice: 90000, categoryInternal: 'Maroquinerie', stock: 40, lowStockThreshold: 5 },
    { name: 'Parfum Eau de Toilette 100ml', description: 'Fragrance boisée et épicée avec notes de bergamote, cèdre et musc blanc', price: 95000, originalPrice: 120000, categoryInternal: 'Beauté', stock: 55, lowStockThreshold: 8 }
  ];

  products.forEach(p => ws.addRow(p));

  await wb.xlsx.writeFile(path.join(__dirname, 'test-produits.xlsx'));
  console.log('✓ test-produits.xlsx créé (10 produits)');
}

async function generateCategories() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Catégories');

  ws.columns = [
    { header: 'Nom *', key: 'name', width: 25 },
    { header: 'Description', key: 'description', width: 50 },
    { header: 'Icône', key: 'icon', width: 25 },
    { header: 'Couleur (hex)', key: 'color', width: 12 },
    { header: 'Ordre', key: 'order', width: 8 },
    { header: 'Active (oui/non)', key: 'isActive', width: 15 }
  ];

  const row1 = ws.getRow(1);
  row1.eachCell(cell => {
    cell.font = headerStyle.font;
    cell.fill = headerStyle.fill;
  });

  const categories = [
    { name: 'Mode Homme', description: 'Vêtements, chaussures et accessoires pour homme', icon: 'feather icon-user', color: '#3B82F6', order: 1, isActive: 'oui' },
    { name: 'Mode Femme', description: 'Prêt-à-porter féminin, robes, jupes et accessoires', icon: 'feather icon-heart', color: '#EC4899', order: 2, isActive: 'oui' },
    { name: 'Électronique', description: 'Smartphones, tablettes, ordinateurs et gadgets tech', icon: 'feather icon-smartphone', color: '#8B5CF6', order: 3, isActive: 'oui' },
    { name: 'Alimentation', description: 'Produits alimentaires, épicerie fine et boissons', icon: 'feather icon-coffee', color: '#F59E0B', order: 4, isActive: 'oui' },
    { name: 'Beauté & Bien-être', description: 'Cosmétiques, parfums, soins du corps et spa', icon: 'feather icon-star', color: '#EF4444', order: 5, isActive: 'oui' },
    { name: 'Sport & Loisirs', description: 'Articles de sport, fitness, outdoor et camping', icon: 'feather icon-activity', color: '#10B981', order: 6, isActive: 'oui' },
    { name: 'Maison & Déco', description: 'Mobilier, décoration intérieure et articles ménagers', icon: 'feather icon-home', color: '#6366F1', order: 7, isActive: 'oui' },
    { name: 'Bijouterie', description: 'Bijoux, montres, bagues et colliers artisanaux', icon: 'feather icon-gift', color: '#D97706', order: 8, isActive: 'oui' },
    { name: 'Librairie', description: 'Livres, BD, mangas, papeterie et fournitures scolaires', icon: 'feather icon-book', color: '#059669', order: 9, isActive: 'oui' },
    { name: 'Services', description: 'Retouches, réparations, photographie et divers services', icon: 'feather icon-tool', color: '#64748B', order: 10, isActive: 'oui' }
  ];

  categories.forEach(c => ws.addRow(c));

  await wb.xlsx.writeFile(path.join(__dirname, 'test-categories.xlsx'));
  console.log('✓ test-categories.xlsx créé (10 catégories)');
}

async function generateEmplacements() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Emplacements');

  ws.columns = [
    { header: 'Nom *', key: 'name', width: 30 },
    { header: 'Description', key: 'description', width: 50 },
    { header: 'Catégorie (nom) *', key: 'category', width: 20 },
    { header: 'Étage', key: 'floor', width: 8 },
    { header: 'Zone', key: 'zone', width: 10 },
    { header: 'Numéro', key: 'number', width: 10 },
    { header: 'Surface (m²)', key: 'surface', width: 12 },
    { header: 'Prix (Ar)', key: 'price', width: 15 }
  ];

  const row1 = ws.getRow(1);
  row1.eachCell(cell => {
    cell.font = headerStyle.font;
    cell.fill = headerStyle.fill;
  });

  const emplacements = [
    { name: 'Boutique Mode Express', description: 'Emplacement premium face à l\'entrée principale, forte visibilité', category: 'Mode Homme', floor: 0, zone: 'A', number: 'A01', surface: 45, price: 850000 },
    { name: 'Tech Corner', description: 'Espace dédié aux produits technologiques avec vitrine éclairée', category: 'Électronique', floor: 0, zone: 'A', number: 'A02', surface: 35, price: 720000 },
    { name: 'Café Gourmet', description: 'Emplacement idéal pour restauration avec accès eau et électricité renforcée', category: 'Alimentation', floor: 0, zone: 'B', number: 'B01', surface: 55, price: 950000 },
    { name: 'Bijoux & Co', description: 'Petit espace sécurisé avec vitrine blindée pour bijouterie', category: 'Bijouterie', floor: 1, zone: 'C', number: 'C01', surface: 20, price: 650000 },
    { name: 'Sport Zone', description: 'Grand espace avec hauteur sous plafond pour articles de sport', category: 'Sport & Loisirs', floor: 1, zone: 'C', number: 'C02', surface: 60, price: 1100000 },
    { name: 'Beauty Lounge', description: 'Emplacement avec point d\'eau intégré pour salon de beauté', category: 'Beauté & Bien-être', floor: 1, zone: 'D', number: 'D01', surface: 40, price: 780000 },
    { name: 'Librairie Centrale', description: 'Espace calme au 2ème étage avec éclairage naturel', category: 'Librairie', floor: 2, zone: 'E', number: 'E01', surface: 50, price: 600000 },
    { name: 'Atelier Services', description: 'Local polyvalent pour prestataires de services divers', category: 'Services', floor: 2, zone: 'E', number: 'E02', surface: 25, price: 450000 },
    { name: 'Maison & Intérieur', description: 'Grand showroom pour mobilier et décoration avec accès livraison', category: 'Maison & Déco', floor: 0, zone: 'B', number: 'B02', surface: 70, price: 1250000 },
    { name: 'Fashion Gallery', description: 'Emplacement d\'angle avec double vitrine, haute fréquentation', category: 'Mode Femme', floor: 1, zone: 'D', number: 'D02', surface: 38, price: 820000 }
  ];

  emplacements.forEach(e => ws.addRow(e));

  await wb.xlsx.writeFile(path.join(__dirname, 'test-emplacements.xlsx'));
  console.log('✓ test-emplacements.xlsx créé (10 emplacements)');
}

(async () => {
  await generateProducts();
  await generateCategories();
  await generateEmplacements();
  console.log('\n✅ Les 3 fichiers Excel de test sont prêts !');
})();
