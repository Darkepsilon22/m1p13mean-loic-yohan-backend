# Document Final — Présentation de l'application

## Centre Commercial en Ligne

**Projet réalisé par :** Loïc Hasimanarivo & Yohan Rakotonirina  
**Stack :** MongoDB, Express.js, Angular, Node.js (MEAN)

---

## 1) Résumé du projet

Notre application est un **centre commercial virtuel** qui permet de gérer à la fois :

- l'expérience **acheteur** (navigation, panier, commandes, paiement),
- l'espace **propriétaire de boutique** (produits, stock, promotions, suivi),
- l'espace **administrateur** (validation des comptes, emplacements, contrats, factures, statistiques).

L'objectif est de proposer une plateforme moderne, centralisée et temps réel, avec un fonctionnement proche d'un vrai centre commercial.

---

## 2) Problématique et objectif

### Problématique

Dans un contexte e-commerce, les boutiques sont souvent dispersées et peu intégrées entre elles.  
Il manque un espace unifié qui reproduit la logique d'un centre commercial : emplacement, gestion locative, animation commerciale et parcours client.

### Objectif

Créer une plateforme unique qui :

- regroupe plusieurs boutiques dans un seul environnement,
- facilite la gestion métier (stock, commandes, contrat, facturation),
- offre un parcours client fluide (recherche, achat, paiement, suivi),
- ajoute des interactions en temps réel (notifications et suivi).

---

## 3) Public cible

- **Acheteurs** : clients qui consultent les boutiques et achètent des produits.
- **Boutiques** : commerçants qui gèrent leur vitrine, leurs produits et leurs ventes.
- **Administrateurs** : responsables de la plateforme et de la gestion globale du centre.

---

## 4) Fonctionnalités principales

## 4.1 Authentification et sécurité

- Inscription et connexion multi-rôles : **Admin**, **Boutique**, **Acheteur**
- Vérification email
- Connexion sécurisée avec **OTP**
- Réinitialisation du mot de passe
- Authentification **JWT**

**Capture d'écran — Inscription**  
![Inscription](screenshots/auth-register.png)

**Capture d'écran — Connexion**  
![Connexion](screenshots/auth-login.png)

**Capture d'écran — OTP**  
![OTP](screenshots/auth-otp.png)

---

## 4.2 Gestion des utilisateurs (Admin)

- Visualisation des comptes utilisateurs
- Validation / rejet des boutiques en attente
- Gestion des statuts utilisateurs (actif, bloqué, etc.)

**Capture d'écran — Liste utilisateurs**  
![Liste utilisateurs](screenshots/admin-users-list.png)

**Capture d'écran — Boutiques en attente**  
![Boutiques en attente](screenshots/admin-pending-boutiques.png)

---

## 4.3 Gestion des boutiques

- Création et modification d'une boutique
- Gestion des informations publiques (description, contact, images)
- Réservation d'emplacement dans le centre
- Consultation publique des boutiques

**Capture d'écran — Liste boutiques**  
![Liste boutiques](screenshots/boutique-list.png)

**Capture d'écran — Création boutique**  
![Création boutique](screenshots/boutique-create.png)

**Capture d'écran — Détail boutique publique**  
![Boutique publique](screenshots/boutique-public-detail.png)

---

## 4.4 Catégories, produits et stock

### Catégories
- Gestion des catégories (arborescence, tri, activation)

**Capture d'écran — Catégories**  
![Catégories](screenshots/category-list.png)

### Produits
- CRUD produit
- Mise en avant des produits
- Recherche et filtres

**Capture d'écran — Liste produits**  
![Produits](screenshots/product-list.png)

**Capture d'écran — Création produit**  
![Création produit](screenshots/product-create.png)

**Capture d'écran — Détail produit**  
![Détail produit](screenshots/product-view.png)

### Stock
- Entrées/sorties/ajustements
- Historique complet des mouvements
- Alertes de stock bas
- Export PDF/Excel

**Capture d'écran — Gestion stock**  
![Gestion stock](screenshots/stock-management.png)

**Capture d'écran — Historique stock**  
![Historique stock](screenshots/stock-movements-history.png)

**Capture d'écran — Export stock**  
![Export stock](screenshots/stock-export.png)

---

## 4.5 Promotions et événements

### Promotions
- Création et gestion des promotions
- Remises en pourcentage ou montant fixe
- Gestion de périodes de validité

**Capture d'écran — Promotions**  
![Promotions](screenshots/promotion-list.png)

**Capture d'écran — Création promotion**  
![Création promotion](screenshots/promotion-create.png)

### Événements
- Publication d'événements du centre
- Mise en avant et bannières

**Capture d'écran — Événements**  
![Événements](screenshots/event-list.png)

**Capture d'écran — Création événement**  
![Création événement](screenshots/event-create.png)

---

## 4.6 Panier, commandes et paiement

### Panier et commandes
- Ajout/suppression d'articles
- Validation du panier
- Création et suivi de commandes
- Historique des commandes

**Capture d'écran — Panier**  
![Panier](screenshots/cart.png)

**Capture d'écran — Suivi commande**  
![Suivi commande](screenshots/order-tracking.png)

**Capture d'écran — Historique commandes**  
![Historique commandes](screenshots/order-history.png)

### Paiement Stripe
- Paiement en ligne via Stripe Checkout
- Vérification de paiement + webhook sécurisé

**Capture d'écran — Paiement Stripe**  
![Paiement Stripe](screenshots/payment-stripe.png)

**Capture d'écran — Confirmation paiement**  
![Confirmation paiement](screenshots/payment-confirmation.png)

---

## 4.7 Avis clients

- Notation des boutiques
- Commentaires
- Réponses des boutiques
- Signalement et modération

**Capture d'écran — Avis boutique**  
![Avis boutique](screenshots/review-boutique.png)

**Capture d'écran — Réponse avis**  
![Réponse avis](screenshots/review-response.png)

---

## 4.8 Plan interactif et navigation

- Visualisation des étages/zones
- Éditeur de plan (admin)
- Calcul d'itinéraire (pathfinding)

**Capture d'écran — Vue plan**  
![Vue plan](screenshots/map-view.png)

**Capture d'écran — Éditeur plan**  
![Éditeur plan](screenshots/map-editor.png)

**Capture d'écran — Navigation**  
![Navigation](screenshots/map-navigation.png)

---

## 4.9 Contrats, factures et statistiques

### Contrats et factures
- Gestion du cycle de contrat locatif
- Suivi et paiement des factures
- Relances automatiques

**Capture d'écran — Contrats**  
![Contrats](screenshots/contracts.png)

**Capture d'écran — Factures**  
![Factures](screenshots/invoices.png)

### Statistiques
- Dashboard administrateur
- Dashboard boutique
- Visualisations via graphiques

**Capture d'écran — Dashboard admin**  
![Dashboard admin](screenshots/dashboard-admin.png)

**Capture d'écran — Dashboard boutique**  
![Dashboard boutique](screenshots/dashboard-boutique.png)

---

## 4.10 Notifications en temps réel

- Notifications live via WebSocket (Socket.io)
- Événements en temps réel : commandes, paiements, avis, alertes stock

**Capture d'écran — Notifications**  
![Notifications](screenshots/notifications.png)

---

## 5) Architecture de la solution

## Frontend
- **Angular 15**
- Structure modulaire (pages + services + guards + interceptor)
- UI avec Bootstrap + composants dynamiques

## Backend
- **Node.js + Express**
- API REST organisée par domaines (auth, produits, commandes, paiements, etc.)
- Middlewares de sécurité (JWT, rôles, validation)
- Socket.io pour le temps réel

## Base de données
- **MongoDB Atlas** avec modèles Mongoose
- Gestion des entités métier : utilisateurs, boutiques, produits, commandes, paiements, contrats, factures...

---

## 6) Valeur ajoutée du projet

- Approche complète type **centre commercial digital**
- Gestion multi-rôles dans une seule application
- Parcours client réel de bout en bout (de la découverte au paiement)
- Fonctions avancées rarement combinées dans un même projet étudiant :
  - plan interactif avec navigation,
  - gestion locative (contrats/factures),
  - temps réel (WebSocket),
  - export PDF/Excel,
  - intégration Stripe.

---

## 7) Limites actuelles et pistes d'amélioration

### Limites actuelles
- Dépendance à des services tiers (Stripe, email, hébergement DB)
- Certaines interfaces peuvent encore être simplifiées UX
- Couverture de tests automatisés à renforcer

### Évolutions possibles
- Application mobile (Ionic/Flutter)
- Système de recommandation produit
- Programme fidélité / coupons personnalisés
- Dashboard analytics encore plus poussé (prédictions, KPI avancés)

---

## 8) Conclusion

Ce projet démontre la conception d'une application web complète, réaliste et orientée métier.  
Il combine e-commerce, gestion opérationnelle et fonctionnalités avancées (temps réel, paiement, cartographie) dans une architecture MEAN cohérente.

Il constitue une base solide, autant pour une soutenance académique que pour une évolution vers un produit plus industriel.

