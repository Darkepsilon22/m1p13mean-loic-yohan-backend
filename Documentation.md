# Centre Commercial en Ligne — Documentation Backend
> m1p13mean-loic-yohan-backend
> Pour le projet MEAN du Master de L'It-University
> La partie serveur du centre commercial, construite avec **Node.js**, **Express 5** et **MongoDB**.
> Réalisé par **Loïc Hasimanarivo** et **Yohan Rakotonirina**.

---

## Table des matières

1. [Présentation](#1-présentation)
2. [Architecture et organisation du code](#2-architecture-et-organisation-du-code)
3. [Installation et configuration](#3-installation-et-configuration)
4. [Les middlewares](#4-les-middlewares)
5. [Authentification et utilisateurs](#5-authentification-et-utilisateurs)
6. [Les boutiques et les emplacements](#6-les-boutiques-et-les-emplacements)
7. [Les catégories](#7-les-catégories)
8. [Les produits](#8-les-produits)
9. [La gestion du stock](#9-la-gestion-du-stock)
10. [Les promotions](#10-les-promotions)
11. [Les événements](#11-les-événements)
12. [Le panier et les commandes](#12-le-panier-et-les-commandes)
13. [Le paiement avec Stripe](#13-le-paiement-avec-stripe)
14. [Les avis clients](#14-les-avis-clients)
15. [Le plan et la navigation (Map)](#15-le-plan-et-la-navigation-map)
16. [Les contrats et la facturation](#16-les-contrats-et-la-facturation)
17. [Les statistiques](#17-les-statistiques)
18. [Les WebSockets (temps réel)](#18-les-websockets-temps-réel)
19. [Les services (email, export, etc.)](#19-les-services-email-export-etc)
20. [Les tâches planifiées (CRON)](#20-les-tâches-planifiées-cron)
21. [Référence API complète](#21-référence-api-complète)
22. [La base de données](#22-la-base-de-données)

---

## 1. Présentation

### Le projet en quelques mots

Ce backend est le cœur du centre commercial en ligne. C'est lui qui gère toute la logique métier : les comptes utilisateurs, les boutiques, les produits, les commandes, les paiements, les contrats de location, les notifications en temps réel, et bien plus encore.

Il expose une **API REST** que le frontend Angular consomme, et maintient des **connexions WebSocket** pour les notifications en temps réel.

### Les technologies

| Brique | Technologie | Version |
|--------|-------------|---------|
| **Framework web** | Express.js | 5.2.1 |
| **Base de données** | MongoDB (Atlas) via Mongoose | 9.1.5 |
| **Authentification** | JSON Web Tokens (JWT) | 9.0.3 |
| **Mots de passe** | bcryptjs | 3.0.3 |
| **Temps réel** | Socket.io | 4.8.3 |
| **Paiement** | Stripe | 20.3.1 |
| **Emails** | API Brevo (ex Sendinblue) via Axios | 1.13.4 |
| **Génération PDF** | PDFKit | 0.17.2 |
| **Génération Excel** | ExcelJS | 4.4.0 |
| **Validation** | express-validator | 7.3.1 |
| **Upload de fichiers** | Multer | 2.0.2 |
| **Tâches planifiées** | node-cron | 4.2.1 |
| **Slugs** | slugify | 1.6.6 |

---

## 2. Architecture et organisation du code

### Le point d'entrée

Tout commence dans `server.js`. Ce fichier fait trois choses :
1. Il crée un serveur HTTP à partir de l'application Express
2. Il initialise **Socket.io** pour les WebSockets
3. Il lance les **tâches CRON** (comme l'expiration automatique des réservations)

L'application Express elle-même est configurée dans `src/app.js` : le CORS, le parsing du body (avec une exception pour le webhook Stripe qui a besoin du body brut), le montage des routes sous `/api`, et la gestion des erreurs.

### L'arborescence

```
m1p13mean-loic-yohan-backend/
├── server.js                  ← Lance le serveur
├── package.json
├── .env                       ← Variables d'environnement
├── .env.example               ← Modèle pour le .env
└── src/
    ├── app.js                 ← Configuration Express routes, erreurs
    ├── config/
    │   └── database.js        ← Connexion MongoDB via Mongoose
    │
    ├── controllers/           ← 19 contrôleurs
    │   ├── authController.js          (inscription, login, OTP, profil, utilisateurs)
    │   ├── boutiqueController.js      (CRUD boutiques, réservations)
    │   ├── categoryController.js      (CRUD catégories, arborescence)
    │   ├── productController.js       (CRUD produits, recherche, stats)
    │   ├── stockController.js         (mouvements de stock, alertes, exports)
    │   ├── promotionController.js     (CRUD promotions)
    │   ├── eventController.js         (CRUD événements)
    │   ├── cartController.js          (panier : ajout, modif, validation)
    │   ├── orderController.js         (commandes, suivi, exports)
    │   ├── paymentController.js       (paiements classiques)
    │   ├── stripeController.js        (checkout Stripe, webhook, vérification)
    │   ├── reviewController.js        (avis, réponses, signalements)
    │   ├── statsController.js         (dashboards admin et boutique)
    │   ├── contractController.js      (contrats de location)
    │   ├── invoiceController.js       (factures de loyer)
    │   ├── floorController.js         (étages du centre)
    │   ├── zoneController.js          (zones par étage)
    │   ├── specialSpaceController.js  (escaliers, ascenseurs, entrées...)
    │   ├── mapController.js           (plan + pathfinding)
    │   └── navigationController.js    (graphe)
    │
    ├── models/                ← 18 modèles MongoDB
    │   ├── User.js, Boutique.js, Category.js, Product.js
    │   ├── Order.js, Cart.js, Payment.js
    │   ├── Review.js, Promotion.js, Event.js, StockMovement.js
    │   ├── Contract.js, ReservationBoutique.js, Invoice.js
    │   └── Floor.js, Zone.js, SpecialSpace.js
    │       NavigationNode.js, NavigationEdge.js
    │
    ├── routes/                ← 19 fichiers de routes + index.js
    │   └── index.js           ← Monte tous les modules sous /api
    │
    ├── middlewares/
    │   ├── auth.js            ← verifyToken, optionalAuth (JWT)
    │   ├── roles.js           ← isAdmin, isBoutique, isAcheteur, authorize()
    │   ├── validation.js      ← Validations communes (register, login, objectId...)
    │   ├── errorHandler.js    ← ApiError, asyncHandler, gestion globale des erreurs
    │   └── *Validation.js     ← Validations spécifiques par domaine (12 fichiers)
    │
    ├── services/
    │   ├── emailService.js              ← Tous les emails (Brevo API + PDFKit)
    │   ├── stripeBrandingService.js     ← Branding Stripe (logo, icône)
    │   ├── stockExportService.js        ← Export stock en PDF et Excel
    │   ├── orderExportService.js        ← Export commandes en PDF et Excel
    │   ├── invoiceService.js            ← Gestion des factures
    │   ├── contractService.js           ← Gestion des contrats
    │   └── boutiqueReservationService.js ← Réservation d'emplacements
    │
    ├── socket/
    │   └── index.js           ← Socket.io : auth JWT, rooms, helpers d'émission
    │
    └── jobs/                  ← 7 tâches
        ├── boutiqueReservationCron.js   (expiration des réservations)
        ├── orderExpiration.js           (expiration des commandes)
        ├── invoiceGenerationCron.js     (génération des factures)
        ├── latePaymentCron.js           (relances de paiement)
        ├── reminderCron.js              (rappels de loyer)
        ├── depositDeadlineCron.js       (vérification des dépôts)
        └── autoTerminationCron.js       (résiliation automatique)
```

---



## 3. Installation et configuration

### Prérequis

- **Node.js** version 18 ou plus (on recommande la 20+)
- **npm** version 9+
- Un accès à une base **MongoDB** (en local ou sur MongoDB Atlas)
- Un compte **Stripe** (même un compte de test suffit)
- Un compte **Brevo** (ex Sendinblue) pour l'envoi d'emails

### Installation

```bash
cd m1p13mean-loic-yohan-backend
npm install
```

### Le fichier .env

Créez un fichier `.env` à la racine du backend avec les variables suivantes :

```env
# Serveur
PORT=5000
NODE_ENV=development

# Base de données
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<database>

# JWT
JWT_SECRET=un_secret_bien_long_et_complexe
JWT_EXPIRES_IN=24h

# URL du frontend (pour le CORS et les liens dans les emails)
FRONTEND_URL=http://localhost:4200

# Email (Gmail OAuth2)
GMAIL_CLIENT_ID=votre_client_id
GMAIL_CLIENT_SECRET=votre_client_secret
GMAIL_REDIRECT_URI_LOCAL=http://localhost:5000/oauth2callback
GMAIL_REDIRECT_URI_PROD=https://votre-domaine.com/oauth2callback
GMAIL_REFRESH_TOKEN=votre_refresh_token
GMAIL_USER=votre_email@gmail.com
EMAIL_SENDER_NAME=Centre Commercial

# Email (Brevo)
BREVO_API_KEY=votre_cle_api_brevo
BREVO_SENDER_EMAIL=votre_email_expediteur

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# OTP (durée de validité en minutes)
OTP_EXPIRES_IN=5

# Admin (clé secrète pour créer des comptes admin)
ADMIN_SECRET_KEY=votre_cle_admin_secrete
```

### Lancer le serveur

```bash
# En développement (avec rechargement automatique via nodemon)
npm run dev

# En production
npm start
```

Le backend tourne sur `http://localhost:5000`. Un health check est disponible sur `GET /` qui renvoie un JSON de confirmation.

---


## 4. Les middlewares

Les middlewares sont la colonne vertébrale du backend. Ils interceptent les requêtes avant qu'elles n'atteignent les contrôleurs pour vérifier l'authentification, les permissions et la validité des données.

### Authentification (`auth.js`)

- **`verifyToken`** : vérifie le token JWT dans le header `Authorization: Bearer <token>`. Il charge l'utilisateur depuis la base, vérifie qu'il existe, qu'il est actif et qu'il n'est pas verrouillé. Si tout va bien, il attache `req.user` et `req.userId` à la requête.
- **`optionalAuth`** : même principe, mais si le token est absent ou invalide, la requête continue quand même (utile pour les pages publiques qui affichent des contenus différents selon que l'utilisateur est connecté ou non).

### Rôles (`roles.js`)

- **`isAdmin`**, **`isBoutique`**, **`isAcheteur`** : vérifient que l'utilisateur a le bon rôle
- **`authorize(...roles)`** : vérifie que l'utilisateur a l'un des rôles passés en paramètre
- **`isAdminOrOwner(paramName)`** : autorise si admin ou si l'utilisateur est le propriétaire de la ressource
- **`isAdminOrBoutique`** : autorise les admins et les propriétaires de boutiques

### Validation

Chaque module a son propre fichier de validation (ex : `productValidation.js`, `orderValidation.js`…). Ils utilisent **express-validator** pour vérifier les champs des requêtes (types, longueurs, formats, etc.). Les erreurs sont formatées et renvoyées par `handleValidationErrors`.

### Gestion des erreurs (`errorHandler.js`)

- **`ApiError`** : une classe d'erreur personnalisée avec un code HTTP et un message
- **`asyncHandler`** : un wrapper pour les fonctions asynchrones qui attrape automatiquement les erreurs et les passe au middleware d'erreur
- **`errorHandler`** : le middleware final qui gère tous les types d'erreurs (Mongoose, JWT, erreurs personnalisées…) et renvoie une réponse JSON propre. En mode développement, il inclut la stack trace.
- **`notFound`** : renvoie une 404 pour les routes qui n'existent pas

---

## 5. Authentification et utilisateurs

### Le système d'authentification

L'authentification fonctionne en plusieurs étapes :

1. **Inscription** : l'utilisateur crée un compte avec email, mot de passe, nom, prénom, téléphone et rôle (acheteur, boutique ou admin). Le mot de passe est hashé avec **bcrypt** avant d'être stocké. Un email de vérification est envoyé.

2. **Vérification de l'email** : l'utilisateur clique sur le lien reçu par email. Son compte est alors marqué comme vérifié.

3. **Connexion (étape 1)** : l'utilisateur entre son email et son mot de passe. Si c'est correct, un **code OTP** à 6 chiffres est généré, stocké en base (hashé) et envoyé par email.

4. **Vérification OTP (étape 2)** : l'utilisateur saisit le code reçu. Si c'est bon, un **token JWT** est généré et renvoyé. Ce token a une durée de vie configurable (`JWT_EXPIRES_IN`).

5. **Mot de passe oublié** : un token de réinitialisation est envoyé par email. L'utilisateur peut alors choisir un nouveau mot de passe.


### Sécurité

- Les mots de passe sont hashés avec **bcrypt** (jamais stockés en clair)
- Les codes OTP sont aussi hashés
- Le compte se verrouille temporairement après trop de tentatives (`lockUntil`)
- Les tokens de réinitialisation expirent après un délai configurable
- Le nombre de tentatives OTP est limité (`otpAttempts`)

### Gestion des utilisateurs (admin)

L'admin peut :
- Lister tous les utilisateurs, avec filtrage par rôle et statut
- Voir les comptes en attente d'approbation (surtout les boutiques)
- Approuver ou rejeter un compte (avec notification par email)
- Bloquer ou débloquer un utilisateur

### Les routes

| Méthode | Route | Ce que ça fait |
|---------|-------|----------------|
| POST | `/api/auth/register` | Créer un compte |
| POST | `/api/auth/login` | Se connecter (étape 1 → envoie l'OTP) |
| POST | `/api/auth/verify-otp` | Valider le code OTP (étape 2 → renvoie le JWT) |
| POST | `/api/auth/resend-otp` | Renvoyer le code OTP |
| GET | `/api/auth/verify-email` | Vérifier son email via le lien |
| POST | `/api/auth/resend-verification` | Renvoyer l'email de vérification |
| POST | `/api/auth/forgot-password` | Demander un lien de réinitialisation |
| POST | `/api/auth/reset-password` | Choisir un nouveau mot de passe |
| GET | `/api/auth/me` | Récupérer les infos de l'utilisateur connecté |
| PUT | `/api/auth/profile` | Mettre à jour son profil |
| PUT | `/api/auth/change-password` | Changer son mot de passe |
| POST | `/api/auth/logout` | Se déconnecter |
| GET | `/api/auth/users` | Liste de tous les utilisateurs (admin) |
| GET | `/api/auth/users/pending` | Comptes en attente (admin) |
| PATCH | `/api/auth/users/:userId/approve` | Approuver un compte (admin) |
| PATCH | `/api/auth/users/:userId/status` | Modifier le statut (admin) |
| GET | `/api/auth/favorites` | Mes boutiques favorites |
| POST | `/api/auth/favorites` | Ajouter une boutique aux favoris |
| DELETE | `/api/auth/favorites/:boutiqueId` | Retirer des favoris |

---

## 6. Les boutiques et les emplacements

### La logique métier

Une boutique appartient à un utilisateur avec le rôle "boutique". Elle a un nom, une description, une catégorie, des images (logo, couverture, galerie), des infos de contact, des horaires d'ouverture, et une localisation sur le plan du centre.

Le système de réservation d'emplacement fonctionne comme suit :
1. Le propriétaire regarde les emplacements disponibles
2. Il en réserve un (la réservation est temporaire, avec une date d'expiration)
3. L'admin valide ou rejette la réservation
4. Si validé, le propriétaire confirme
5. Si la réservation expire sans confirmation, elle est automatiquement libérée par le CRON

### Les statuts

| Statut | Ce que ça veut dire |
|--------|---------------------|
| `active` | La boutique est visible et opérationnelle |
| `inactive` | Temporairement désactivée |
| `pending` | En attente d'approbation par l'admin |
| `suspended` | Suspendue par l'admin |

### Les routes

| Méthode | Route | Ce que ça fait |
|---------|-------|----------------|
| GET | `/api/boutiques` | Lister toutes les boutiques |
| GET | `/api/boutiques/:id` | Détail d'une boutique |
| POST | `/api/boutiques` | Créer une boutique |
| PUT | `/api/boutiques/:id` | Modifier |
| DELETE | `/api/boutiques/:id` | Supprimer |
| PATCH | `/api/boutiques/:id/status` | Changer le statut |
| PATCH | `/api/boutiques/:id/location` | Modifier la position sur le plan |
| GET | `/api/boutiques/emplacements/available` | Emplacements libres |
| GET | `/api/boutiques/emplacements/stats` | Stats des emplacements |
| GET | `/api/boutiques/emplacements/admin/all` | Tous les emplacements (admin) |
| POST | `/api/boutiques/:id/reserve` | Réserver un emplacement |
| POST | `/api/boutiques/:id/confirm` | Confirmer la réservation |
| POST | `/api/boutiques/:id/cancel` | Annuler la réservation |
| POST | `/api/boutiques/:id/validate` | Valider (admin) |
| POST | `/api/boutiques/:id/reject` | Rejeter (admin) |
| POST | `/api/boutiques/:id/release` | Libérer un emplacement (admin) |

---

## 7. Les catégories

Les catégories classent les boutiques (Mode, Restauration, High-Tech…). Elles supportent une **arborescence parent/enfant** et un **slug** généré automatiquement à partir du nom.

| Méthode | Route | Ce que ça fait |
|---------|-------|----------------|
| GET | `/api/categories` | Lister |
| GET | `/api/categories/tree` | Arborescence complète |
| GET | `/api/categories/stats` | Statistiques |
| GET | `/api/categories/:id` | Détail |
| GET | `/api/categories/slug/:slug` | Chercher par slug |
| GET | `/api/categories/:id/children` | Sous-catégories |
| POST | `/api/categories` | Créer |
| PUT | `/api/categories/:id` | Modifier |
| PATCH | `/api/categories/:id/status` | Activer/Désactiver |
| PATCH | `/api/categories/:id/order` | Modifier l'ordre |
| PATCH | `/api/categories/reorder` | Réorganiser |
| DELETE | `/api/categories/:id` | Supprimer |

---

## 8. Les produits

Chaque boutique gère son propre catalogue. Un produit a un nom, un slug, un prix (actuel + d'origine), des photos, un stock avec seuil d'alerte, une disponibilité, et peut être marqué comme vedette ou archivé.

La recherche supporte plusieurs critères simultanés : nom, boutique, catégorie, gamme de prix, disponibilité, produits vedettes.

| Méthode | Route | Ce que ça fait |
|---------|-------|----------------|
| GET | `/api/products` | Lister (avec filtres) |
| GET | `/api/products/featured` | Produits vedettes |
| GET | `/api/products/:id` | Détail |
| GET | `/api/products/slug/:slug` | Par slug |
| GET | `/api/products/boutique/:boutiqueId` | Produits d'une boutique |
| GET | `/api/products/my-products` | Mes produits (boutique) |
| GET | `/api/products/my-products/stats` | Mes stats |
| GET | `/api/products/admin/all` | Tous les produits (admin) |
| GET | `/api/products/admin/stats` | Stats globales (admin) |
| GET | `/api/products/stats/:boutiqueId` | Stats d'une boutique |
| POST | `/api/products` | Créer |
| PUT | `/api/products/:id` | Modifier |
| PATCH | `/api/products/:id/availability` | Changer la disponibilité |
| PATCH | `/api/products/:id/featured` | Mettre en vedette |
| PATCH | `/api/products/:id/archive` | Archiver |
| PATCH | `/api/products/:id/restore` | Restaurer |
| DELETE | `/api/products/:id` | Supprimer |

---

## 9. La gestion du stock

Chaque mouvement de stock est tracé : quel produit, quelle quantité, le stock avant et après, la raison, et qui l'a fait. Il y a quatre types de mouvements : `in` (entrée), `out` (sortie), `adjustment` (correction), `initial` (stock de départ).

Quand le stock descend en dessous du seuil, un email d'alerte est envoyé au propriétaire.

Les données peuvent être exportées en **PDF** (via PDFKit) ou en **Excel** (via ExcelJS).

| Méthode | Route | Ce que ça fait |
|---------|-------|----------------|
| POST | `/api/stock/:productId/add` | Ajouter du stock |
| POST | `/api/stock/:productId/remove` | Retirer |
| POST | `/api/stock/:productId/adjust` | Ajuster |
| POST | `/api/stock/:productId/initial` | Stock initial |
| GET | `/api/stock/:productId/history` | Historique d'un produit |
| GET | `/api/stock/boutique/:boutiqueId` | Stock d'une boutique |
| GET | `/api/stock/boutique/:boutiqueId/movements` | Mouvements |
| GET | `/api/stock/download/pdf` | Export PDF |
| GET | `/api/stock/download/excel` | Export Excel |

---

## 10. Les promotions

Les boutiques peuvent créer des promotions avec un titre, un type de remise (pourcentage ou montant fixe), une valeur, et des dates de début/fin. Le système bascule automatiquement les promotions de "active" à "expirée".

| Méthode | Route | Ce que ça fait |
|---------|-------|----------------|
| GET | `/api/promotions` | Lister |
| GET | `/api/promotions/active` | Actives uniquement |
| GET | `/api/promotions/boutique/:boutiqueId` | D'une boutique |
| GET | `/api/promotions/:id` | Détail |
| POST | `/api/promotions/update-statuses` | Mettre à jour les statuts |
| POST | `/api/promotions` | Créer |
| PUT | `/api/promotions/:id` | Modifier |
| PATCH | `/api/promotions/:id/cancel` | Annuler |
| DELETE | `/api/promotions/:id` | Supprimer |
| GET | `/api/promotions/stats/:boutiqueId` | Stats |

---

## 11. Les événements

L'admin crée des événements pour le centre (soldes, animations…). Un événement peut être mis en vedette ou affiché en bannière. Les statuts se mettent à jour automatiquement (brouillon → publié → en cours → terminé).

| Méthode | Route | Ce que ça fait |
|---------|-------|----------------|
| GET | `/api/events` | Lister |
| GET | `/api/events/upcoming` | À venir |
| GET | `/api/events/current` | En cours |
| GET | `/api/events/featured` | En vedette |
| GET | `/api/events/banners` | Bannières |
| GET | `/api/events/:id` | Détail |
| POST | `/api/events/update-statuses` | Rafraîchir les statuts |
| POST | `/api/events` | Créer |
| PUT | `/api/events/:id` | Modifier |
| PATCH | `/api/events/:id/status` | Changer le statut |
| PATCH | `/api/events/:id/publish` | Publier |
| PATCH | `/api/events/:id/cancel` | Annuler |
| DELETE | `/api/events/:id` | Supprimer |

---

## 12. Le panier et les commandes

### Le panier

Le panier est persistant en base de données (modèle `Cart`). Chaque acheteur a un seul panier. Le système vérifie le stock disponible lors de la validation.

| Méthode | Route | Ce que ça fait |
|---------|-------|----------------|
| GET | `/api/cart` | Voir mon panier |
| GET | `/api/cart/summary` | Résumé (totaux) |
| POST | `/api/cart/items` | Ajouter un article |
| POST | `/api/cart/validate` | Valider (vérif stock) |
| PUT | `/api/cart/items/:productId` | Modifier la quantité |
| DELETE | `/api/cart/items/:productId` | Retirer un article |
| DELETE | `/api/cart` | Vider le panier |

### Les commandes

Chaque commande a une référence unique, des articles, des adresses, un montant total, un statut et une méthode de paiement. Les statuts suivent le cycle : `pending` → `confirmed` → `processing` → `shipped` → `delivered` (ou `cancelled`).

L'historique est exportable en PDF et Excel, et les boutiques peuvent générer des rapports mensuels.

| Méthode | Route | Ce que ça fait |
|---------|-------|----------------|
| POST | `/api/orders` | Passer commande |
| GET | `/api/orders/my-orders` | Mes commandes |
| GET | `/api/orders/my-orders/export/pdf` | Export PDF |
| GET | `/api/orders/my-orders/export/excel` | Export Excel |
| GET | `/api/orders/reference/:reference` | Par référence |
| GET | `/api/orders/:id` | Détail |
| PATCH | `/api/orders/:id/cancel` | Annuler |
| PATCH | `/api/orders/:id/confirm-reception` | Confirmer la réception |
| GET | `/api/orders/boutique` | Commandes reçues (boutique) |
| GET | `/api/orders/boutique/stats` | Stats boutique |
| GET | `/api/orders/boutique/report/pdf` | Rapport mensuel PDF |
| GET | `/api/orders/boutique/report/excel` | Rapport mensuel Excel |
| PATCH | `/api/orders/boutique/:id/status` | Changer le statut |
| GET | `/api/orders/boutique/:id` | Détail boutique |
| GET | `/api/orders/admin` | Toutes les commandes (admin) |
| GET | `/api/orders/admin/stats` | Stats globales (admin) |
| POST | `/api/orders/admin/expire-pending` | Expirer les commandes en attente |
| PATCH | `/api/orders/admin/:id/status` | Changer le statut (admin) |

---


## 13. Le paiement avec Stripe

### Le flux

On utilise **Stripe Checkout**. Le backend crée une session de paiement chez Stripe, qui renvoie une URL. Le client est redirigé vers cette page sécurisée de Stripe, paye, puis revient sur notre application. Le backend vérifie ensuite auprès de Stripe que le paiement a bien eu lieu.

### Le webhook

En parallèle, un **webhook** Stripe notifie notre serveur directement. C'est le filet de sécurité : même si le client ferme son navigateur avant de revenir, on est informé du paiement.

Point technique important : le endpoint du webhook (`/api/payments/stripe/webhook`) reçoit le body en format **brut** (pas parsé en JSON). C'est indispensable pour que Stripe puisse vérifier la signature de la requête. Dans `app.js`, ce path est exclu du middleware `express.json()`.

La devise utilisée est le **MGA** (Ariary malgache), qui est une devise "zero-decimal" chez Stripe (pas de centimes).

| Méthode | Route | Ce que ça fait |
|---------|-------|----------------|
| GET | `/api/payments/stripe/config` | Clé publique Stripe |
| POST | `/api/payments/stripe/create-checkout-session` | Créer une session |
| GET | `/api/payments/stripe/verify/:sessionId` | Vérifier un paiement |
| POST | `/api/payments/stripe/webhook` | Webhook (body brut) |
| GET | `/api/payments/methods` | Méthodes disponibles |
| POST | `/api/payments/webhook` | Webhook générique |
| POST | `/api/payments/initialize` | Initialiser un paiement |
| GET | `/api/payments/history` | Historique |
| GET | `/api/payments/:reference` | Détail |
| POST | `/api/payments/:reference/confirm` | Confirmer |
| POST | `/api/payments/:reference/fail` | Marquer en échec |
| POST | `/api/payments/:reference/refund` | Rembourser |
| GET | `/api/payments/admin/all` | Tous les paiements (admin) |
| GET | `/api/payments/admin/stats` | Stats (admin) |
| POST | `/api/payments/admin/expire-pending` | Expirer les paiements en attente |

---

## 14. Les avis clients

Les acheteurs notent les boutiques (1 à 5) avec un commentaire. Les propriétaires peuvent répondre. Les avis peuvent être signalés comme inappropriés. L'admin modère (approuve, masque ou supprime).

| Méthode | Route | Ce que ça fait |
|---------|-------|----------------|
| GET | `/api/reviews` | Lister |
| GET | `/api/reviews/my-reviews` | Mes avis |
| GET | `/api/reviews/:id` | Détail |
| POST | `/api/reviews` | Laisser un avis |
| PUT | `/api/reviews/:id` | Modifier |
| POST | `/api/reviews/:id/report` | Signaler |
| PATCH | `/api/reviews/:id/response` | Répondre (boutique) |
| PATCH | `/api/reviews/:id/status` | Modérer (admin) |
| DELETE | `/api/reviews/:id` | Supprimer |

---


## 15. Le plan et la navigation (Map)

### La modélisation

Le centre commercial est modélisé en couches :
- **Étages** (`Floor`) : chaque niveau du bâtiment
- **Zones** (`Zone`) : des subdivisions d'un étage (aile nord, sud…)
- **Espaces spéciaux** (`SpecialSpace`) : escaliers, ascenseurs, entrées, parkings, points d'info

### Le graphe de navigation

Pour le pathfinding, on a construit un **graphe** composé de :
- **Nœuds** (`NavigationNode`) : des points sur la carte (intersections, couloirs, escaliers, ascenseurs, entrées…)
- **Arêtes** (`NavigationEdge`) : des connexions entre nœuds, avec un coût et un flag d'accessibilité

Le pathfinding fonctionne **entre les étages** (via escaliers ou ascenseurs) et propose des options d'accessibilité (éviter les escaliers, chemin accessible uniquement).

| Méthode | Route | Ce que ça fait |
|---------|-------|----------------|
| GET | `/api/map/floor/:floorId` | Plan d'un étage |
| POST | `/api/map/route` | Segment de route |
| POST | `/api/map/route/pathfinding` | Itinéraire complet multi-étages |
| GET/POST/PUT/DELETE | `/api/floors/*` | CRUD étages |
| GET/POST/PUT/DELETE | `/api/zones/*` | CRUD zones |
| GET/POST/PUT/DELETE | `/api/special-spaces/*` | CRUD espaces spéciaux |
| GET/POST/PUT/DELETE | `/api/navigation/nodes/*` | CRUD nœuds |
| GET/POST/PUT/DELETE | `/api/navigation/edges/*` | CRUD arêtes |

---

## 16. Les contrats et la facturation

### Les contrats

Quand un emplacement est validé, un contrat de location est créé. Son cycle de vie : `draft` → `pending_signature` → `signed` → `active` (après paiement du dépôt) → `terminated` ou `expired`. L'admin peut aussi suspendre et réactiver un contrat.

### La facturation

Les factures de loyer sont générées automatiquement par un CRON. Le système envoie des rappels avant l'échéance et des relances en cas de retard (J+1, J+7, J+30). Après un trop long retard, le contrat peut être automatiquement résilié.

| Méthode | Route | Ce que ça fait |
|---------|-------|----------------|
| GET | `/api/contracts` | Tous les contrats (admin) |
| POST | `/api/contracts` | Créer |
| GET | `/api/contracts/:id` | Détail |
| POST | `/api/contracts/:id/send-signature` | Envoyer pour signature |
| POST | `/api/contracts/:id/sign` | Signer |
| POST | `/api/contracts/:id/confirm-deposit` | Confirmer le dépôt |
| POST | `/api/contracts/:id/suspend` | Suspendre |
| POST | `/api/contracts/:id/reactivate` | Réactiver |
| POST | `/api/contracts/:id/terminate` | Résilier |
| GET | `/api/contracts/my/active` | Mon contrat actif |
| GET | `/api/contracts/my/history` | Mon historique |
| POST | `/api/contracts/my/:id/pay-deposit` | Payer le dépôt |
| GET | `/api/invoices` | Toutes les factures (admin) |
| GET | `/api/invoices/admin/late` | Factures en retard |
| GET | `/api/invoices/:id` | Détail |
| POST | `/api/invoices/:id/pay` | Enregistrer un paiement |
| POST | `/api/invoices/:id/cancel` | Annuler |
| GET | `/api/invoices/my` | Mes factures (boutique) |
| GET | `/api/invoices/my/:id` | Détail de ma facture |
| POST | `/api/invoices/my/:id/pay` | Payer ma facture |

---

## 17. Les statistiques

Le backend fournit des données agrégées pour les dashboards admin et boutique : revenus, métriques clients, comparaisons de périodes, tendances des boutiques, taux d'occupation, marges, produits les plus vendus…

| Méthode | Route | Ce que ça fait |
|---------|-------|----------------|
| GET | `/api/stats/admin/dashboard` | Dashboard admin complet |
| GET | `/api/stats/admin/revenue` | Revenus globaux |
| GET | `/api/stats/admin/customers` | Métriques clients |
| GET | `/api/stats/admin/comparison` | Comparaison de périodes |
| GET | `/api/stats/admin/boutiques-trends` | Tendances boutiques |
| GET | `/api/stats/admin/rental-dashboard` | Dashboard location |
| GET | `/api/stats/boutique/dashboard` | Dashboard boutique |
| GET | `/api/stats/boutique/revenue` | Revenus boutique |
| GET | `/api/stats/boutique/trends` | Tendances de vente |
| GET | `/api/stats/boutique/margins` | Marges |
| GET | `/api/stats/boutique/products-trends` | Tendances produits |

---


## 18. Les WebSockets (temps réel)

### Comment c'est mis en place

Socket.io est initialisé dans `src/socket/index.js`. À la connexion, le serveur vérifie le **token JWT** envoyé par le client (via `socket.handshake.auth.token` ou en query param). Si le token est valide, le socket rejoint automatiquement les rooms appropriées.

### Les rooms

| Room | Qui y est | À quoi ça sert |
|------|-----------|----------------|
| `user:<userId>` | Un utilisateur précis | Notifications personnelles |
| `boutique:<boutiqueId>` | Le propriétaire d'une boutique | Nouvelles commandes, avis, stock… |
| `admin` | Tous les admins | Nouveaux comptes, réservations… |
| `public` | Tout le monde | Événements, nouveautés globales |

### Les helpers

Le module exporte des fonctions pratiques :
- `getIO()` : récupère l'instance Socket.io
- `emitToAdmin(event, data)` : émet vers tous les admins
- `emitToUser(userId, event, data)` : émet vers un utilisateur précis
- `emitToBoutique(boutiqueId, event, data)` : émet vers une boutique
- `emitToPublic(event, data)` : émet vers tout le monde

### Exemples d'événements

| Événement | Quand il est émis |
|-----------|-------------------|
| `order:created` | Quand une commande est passée |
| `order:statusChanged` | Quand le statut d'une commande change |
| `stripe:paymentVerified` | Quand un paiement Stripe est confirmé |
| `stock:lowAlert` | Quand le stock descend en dessous du seuil |
| `review:created` | Quand un nouvel avis est posté |
| `user:approved` | Quand l'admin approuve un compte |
| `boutique:created` | Quand une boutique est créée |
| `product:created` | Quand un produit est ajouté |

---


## 19. Les services (email, export, etc.)

### Le service email (`emailService.js`)

C'est le service le plus riche. Il utilise l'API **Brevo** pour envoyer tous les emails transactionnels de l'application. Voici la liste complète :

| Fonction | Ce qu'elle envoie |
|----------|-------------------|
| `sendVerificationEmail` | Lien de vérification d'email |
| `sendOTPEmail` | Code OTP pour la connexion |
| `sendPasswordResetEmail` | Lien de réinitialisation du mot de passe |
| `sendWelcomeEmail` | Email de bienvenue après vérification |
| `sendInvoiceEmail` | Facture en pièce jointe (PDF généré à la volée) |
| `sendApprovalEmail` | Notification d'approbation du compte |
| `sendRejectionEmail` | Notification de rejet avec motif |
| `sendPendingApprovalEmail` | Notification de mise en attente |
| `sendLowStockAlertEmail` | Alerte de stock bas |
| `sendReservationApprovedEmail` | Confirmation de réservation |
| `sendContractCreatedEmail` | Détails du nouveau contrat |
| `sendContractSignedEmail` | Notification de signature (→ admin) |
| `sendDepositPartialEmail` | Dépôt partiellement payé |
| `sendContractActivatedEmail` | Contrat activé |
| `sendRentReminderEmail` | Rappel avant échéance de loyer |
| `sendRentLateDay1/7/30Email` | Relances à J+1, J+7, J+30 |
| `sendContractExpiringEmail` | Contrat bientôt expiré |
| `sendContractTerminatedEmail` | Contrat résilié |
| `sendOrderStatusEmail` | Changement de statut de commande |

### Les services d'export

- **`stockExportService.js`** : génère des PDF et des fichiers Excel avec les données de stock (produits, mouvements)
- **`orderExportService.js`** : pareil pour les commandes (historique acheteur, rapports mensuels boutique)

### Les services métier

- **`contractService.js`** : gère tout le cycle de vie des contrats (création, signature, dépôt, suspension, résiliation…)
- **`invoiceService.js`** : gère les factures de loyer (création, paiement, annulation, listing des factures en retard)
- **`boutiqueReservationService.js`** : gère les réservations d'emplacements, y compris la libération automatique des réservations expirées
- **`stripeBrandingService.js`** : configure le branding Stripe (logo et icône sur la page de paiement)

---