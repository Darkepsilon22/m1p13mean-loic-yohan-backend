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

Mbola ho ampiana



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
