# 🎬 Jeezy TV - API Architecture Sécurisée

Plateforme de streaming avec gestion sécurisée des monnaies virtuelles et abonnements VIP.

## 📋 Table des matières

- [Architecture](#architecture)
- [Stack technique](#stack-technique)
- [Setup initial](#setup-initial)
- [Sécurité](#sécurité)
- [API endpoints](#api-endpoints)
- [Server Actions](#server-actions)
- [Webhooks PayPal](#webhooks-paypal)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   NEXT.JS APP ROUTER                    │
├──────────────────────┬──────────────────────────────────┤
│    Client Components │    Server Components & Actions   │
│  (VIPGate, Wallet)   │  (Protected Business Logic)      │
└──────────────────────┴──────────────────────────────────┘
                         ↓
                  MIDDLEWARE.TS
         (Auth + Role-based Access Control)
                         ↓
┌─────────────────────────────────────────────────────────┐
│                      API ROUTES                         │
│  /api/auth/[...nextauth]  ← NextAuth.js                │
│  /api/payment/create-order  ← PayPal order creation    │
│  /api/webhooks/paypal       ← Webhook verification    │
│  /api/user/wallet           ← Jeezy balance           │
│  /api/user/vip-status       ← VIP subscription status  │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                   SERVICES LAYER                        │
│  JeezService      - Gestion portefeuille Jeez         │
│  SubscriptionService - Gestion abonnements VIP        │
│  PaymentService   - Validation PayPal                 │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                   PRISMA ORM                            │
│              PostgreSQL Database                        │
└─────────────────────────────────────────────────────────┘
```

### 📊 Modèles de données

**User** - Utilisateur avec rôle (USER, VIP, ADMIN)
```
id, email, password, name, role, vipStatus, isActive, createdAt
```

**JeezBalance** - Portefeuille virtuel
```
id, userId, balanceAmount, lastUpdated
```

**VIPSubscription** - Abonnement VIP
```
id, userId, isActive, expiresAt, planType (MONTHLY/QUARTERLY/ANNUAL), autoRenew
```

**Transaction** - Ledger atomique
```
id, transactionId (unique!), userId, transactionType, amount, status
paymentMethod, orderId, metadata, createdAt, completedAt
```

**PayPalOrder** - Tracking des commandes PayPal
```
id, orderId, userId, amount, currency, status, webhookVerified, rawWebhookData
```

---

## 🛠️ Stack technique

### Obligatoire
- **Framework**: Next.js 16 (App Router)
- **Runtime**: Node.js 18+
- **Language**: TypeScript

### Database
- **PostgreSQL** via Supabase ou Neon (tier gratuit)
- **ORM**: Prisma
- **Migrations**: `npx prisma migrate dev`

### Authentication & Security
- **Auth**: NextAuth.js v5 (Prisma adapter)
- **Validation**: Zod (schémas strictement typés)
- **Hashing**: bcrypt (mots de passe)
- **JWT**: Signé avec NEXTAUTH_SECRET

### Payment
- **Provider**: PayPal (REST SDK)
- **Webhook**: Signature verification (HMAC-SHA256)

---

## 🚀 Setup initial

### 1. Installation des dépendances
```bash
npm install
```

### 2. Configuration Prisma
```bash
# Configurer DATABASE_URL dans .env.local
cp .env.example .env.local

# Créer la base de données
npx prisma migrate dev --name init

# Générer le client Prisma
npx prisma generate
```

### 3. Variables d'environnement (.env.local)
```env
# DATABASE
DATABASE_URL="postgresql://user:password@host/dbname"

# NEXTAUTH
NEXTAUTH_SECRET="min_32_chars_random_string"
NEXTAUTH_URL="http://localhost:3000"

# PAYPAL
NEXT_PUBLIC_PAYPAL_CLIENT_ID="your_client_id"
PAYPAL_CLIENT_SECRET="your_secret"
PAYPAL_API_BASE_URL="https://api.sandbox.paypal.com"
PAYPAL_WEBHOOK_ID="your_webhook_id"

# APP
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Générer NEXTAUTH_SECRET
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Démarrer le serveur
```bash
npm run dev
```

---

## 🔐 Sécurité

### 1. **Transactions atomiques** (Prisma)
```typescript
await prisma.$transaction(async (tx) => {
  // Vérifier solde
  // Débiter
  // Enregistrer transaction
  // ↑ Tout réussit ou tout échoue (ACID)
});
```
**Objectif**: Prévenir le double-spending et les incohérences.

---

### 2. **Idempotence**
Chaque transaction a un `transactionId` UNIQUE.

**Scenario**:
- Utilisateur achète 100 Jeez
- La requête rencontre un timeout
- Utilisateur renvoit la requête
- ❌ SANS idempotence: 200 Jeez crédités
- ✅ AVEC idempotence: 100 Jeez crédités (duplicate detected)

```typescript
const existingTx = await tx.transaction.findUnique({
  where: { transactionId }
});

if (existingTx) {
  // Transaction déjà traitée → retourner le résultat précédent
  return existingTx;
}
```

---

### 3. **Validation des montants PayPal**
TOUJOURS vérifier côté serveur que le montant PayPal correspond.

```typescript
// ❌ DANGEREUX: Faire confiance au client
const amount = req.body.amount; // Peut être manipulé!

// ✅ BON: Vérifier côté serveur
const expectedPrice = PRODUCT_PRICES[productId];
if (Math.abs(paypalAmount - expectedPrice.amount) > 0.01) {
  // Rejeter la transaction
}
```

---

### 4. **Vérification de signature PayPal**
Rejeter les webhooks non signés (prévenir l'injection de fausses notifications).

```typescript
const signatureValid = await PaymentService.verifyPayPalSignature(
  webhookId,
  webhookBody,
  headers // PAYPAL-TRANSMISSION-SIG, PAYPAL-CERT-URL, etc.
);

if (!signatureValid.success) {
  return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
}
```

---

### 5. **Authentification & Rôles (Middleware)**
```typescript
// middleware.ts
export default auth(async (req) => {
  if (!req.auth) {
    // ❌ Pas d'accès
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = req.auth.user.role;

  // Vérifier les rôles pour les routes VIP/ADMIN
  if (pathname.startsWith("/api/vip") && role !== "VIP") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
});
```

---

### 6. **Validation d'entrées (Zod)**
```typescript
// Avant: const amount = req.body.amount; // any type!

// Après:
const validation = validateData(CreatePayPalOrderSchema, body);
if (!validation.success) {
  return NextResponse.json({ error: validation.error }, { status: 400 });
}

// amount est maintenant type-safe et validé
const { amount } = validation.data;
```

---

### 7. **Sessions sécurisées**
- **Strategy**: `database` (sessions stockées en BDD, pas en JWT)
- **Session timeout**: 30 jours
- **HTTPS requis** en production
- **SameSite=Strict** par défaut

---

### 8. **Secrets & Variables d'environnement**
✅ **À stocker en .env.local ou secrets manager**:
- NEXTAUTH_SECRET
- DATABASE_URL
- PAYPAL_CLIENT_SECRET
- API keys

❌ **JAMAIS en code ou repo**:
```bash
# ❌ DANGER
const secret = "abc123def456"; // Hardcodé!

# ✅ BON
const secret = process.env.NEXTAUTH_SECRET;
```

---

## 📡 API Endpoints

### Auth
```
POST /api/auth/signin
POST /api/auth/signout
GET  /api/auth/session
```

### Payment
```
POST /api/payment/create-order
  Body: { productType: "JEEZ" | "VIP", amount: number }
  Return: { order: { id, amount, currency, productId } }

POST /api/webhooks/paypal
  Webhook de PayPal (traitement automatique)
  ⚠️  Vérifier signature + montant + idempotence
```

### User
```
GET /api/user/wallet
  Return: { success: true, balance: 1000, userId }

GET /api/user/vip-status
  Return: { success: true, vipStatus: { isActive, expiresAt, planType } }
```

---

## 🎯 Server Actions

### Payment Actions
```typescript
import { getJeezBalanceAction, getVIPStatusAction, isUserVIPAction } from "@/app/actions/payment.actions";

// Obtenir le solde
const { success, data: balance } = await getJeezBalanceAction();

// Vérifier VIP
const { data: isVIP } = await isUserVIPAction();

// Profil complet
const { data: profile } = await getUserProfileAction();
// { userId, email, jeezBalance, vipStatus }
```

### Auth Actions
```typescript
import { signUpAction, signInAction, signOutAction } from "@/app/actions/auth.actions";

// Signup
const { success } = await signUpAction(email, password, name);

// Signin
const { success } = await signInAction(email, password);

// Signout
await signOutAction();
```

---

## 📍 Webhooks PayPal

### 1. Configuration
- Se connecter à [developer.paypal.com](https://developer.paypal.com)
- Aller à **Webhooks** → **Create new webhook**
- URL: `https://yourdomain.com/api/webhooks/paypal`
- **Events**: `CHECKOUT.ORDER.COMPLETED`
- Copier le **Webhook ID** dans `PAYPAL_WEBHOOK_ID`

### 2. Payload exemple
```json
{
  "id": "WH-ABC123",
  "event_type": "CHECKOUT.ORDER.COMPLETED",
  "create_time": "2024-01-11T12:00:00Z",
  "resource": {
    "id": "7BR123",
    "status": "COMPLETED",
    "amount": {
      "value": "9.99",
      "currency_code": "USD"
    },
    "custom_id": "vip_monthly_usd"
  }
}
```

### 3. Traitement côté serveur
```
1. Vérifier la signature (prévenir injections)
2. Parser le webhook (valider format)
3. Vérifier l'idempotence (event_id ou orderId unique?)
4. Valider le montant exact
5. Créer transaction atomique (Prisma)
   - Ajouter Jeez OU activer VIP
   - Enregistrer dans ledger
6. Retourner 200 OK
```

---

## 📋 Checklist Production

- [ ] **Database**: PostgreSQL en production (Supabase/Neon)
- [ ] **Secrets**: Utiliser un secret manager (AWS Secrets Manager, Vercel Secrets)
- [ ] **HTTPS**: Obligatoire (NextAuth.js trustHost = true)
- [ ] **PayPal**: Passer de Sandbox à Production
- [ ] **Monitoring**: Logger les transactions critiques
- [ ] **Rate limiting**: Protéger les endpoints (npm install express-rate-limit)
- [ ] **CORS**: Configurer les origines autorisées
- [ ] **Audit**: Vérifier les transactions sensibles
- [ ] **Backup**: Sauvegardes régulières de la BD
- [ ] **Tests**: Suite de tests E2E pour les paiements

---

## 🧪 Exemples d'utilisation

### Dans un composant React
```tsx
"use client";

import { useState } from "react";
import { getJeezBalanceAction, isUserVIPAction } from "@/app/actions/payment.actions";

export function MyComponent() {
  const [balance, setBalance] = useState(0);
  const [isVIP, setIsVIP] = useState(false);

  async function handleLoad() {
    // Charger le solde
    const balanceResult = await getJeezBalanceAction();
    if (balanceResult.success) {
      setBalance(balanceResult.data || 0);
    }

    // Vérifier VIP
    const vipResult = await isUserVIPAction();
    if (vipResult.success) {
      setIsVIP(vipResult.data);
    }
  }

  return (
    <div>
      <p>Balance: {balance} Jeez</p>
      <p>VIP: {isVIP ? "✅ Yes" : "❌ No"}</p>
      <button onClick={handleLoad}>Load Profile</button>
    </div>
  );
}
```

### Utiliser VIPGate
```tsx
import { VIPGate } from "@/app/components/VIPGate";

export function PremiumContent() {
  return (
    <VIPGate fallback={<p>Subscribe to VIP to watch!</p>}>
      <video src="/premium-video.mp4" controls />
    </VIPGate>
  );
}
```

---

## 🐛 Debugging

### Logs Prisma
```typescript
// Dans lib/prisma.ts
new PrismaClient({
  log: ["query", "info", "warn", "error"], // Afficher les requêtes SQL
});
```

### Logs NextAuth
```typescript
// Dans auth.ts
callbacks: {
  async jwt({ token, user }) {
    console.log("[JWT] Token created for user:", user?.email);
    return token;
  },
},
```

### Voir les sessions en BDD
```bash
npx prisma studio
# Accéder à http://localhost:5555
```

---

## 📚 Ressources

- [Next.js App Router](https://nextjs.org/docs/app)
- [NextAuth.js Documentation](https://authjs.dev/)
- [Prisma ORM](https://www.prisma.io/docs/)
- [Zod Validation](https://zod.dev/)
- [PayPal Developer](https://developer.paypal.com/)
- [PostgreSQL](https://www.postgresql.org/docs/)

---

## 📞 Support

Pour toute question, ouvrir une issue ou contacter l'équipe.

**Built with ❤️ for Jeezy TV**
