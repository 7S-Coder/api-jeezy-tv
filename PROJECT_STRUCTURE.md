📦 # Structure du projet - Jeezy TV API

```
api-jeezytv/
│
├── 📋 Configuration & Docs
│   ├── .env.local                  ← Variables d'environnement (À REMPLIR)
│   ├── .env.example                ← Template
│   ├── .gitignore                  ← Exclure secrets
│   ├── tsconfig.json               ← Config TypeScript
│   ├── next.config.ts              ← Config Next.js
│   ├── package.json                ← Dépendances + scripts
│   ├── jest.config.js              ← Config tests
│   │
│   └── 📚 Documentation
│       ├── INDEX.md                ← Vue d'ensemble (COMMENCER ICI!)
│       ├── QUICKSTART.md           ← Démarrer en 5 min
│       ├── ARCHITECTURE.md         ← Architecture détaillée
│       ├── SECURITY.md             ← Guide sécurité (14 points)
│       └── EXAMPLES.md             ← 9 exemples d'utilisation
│
├── 🔐 Authentication & Auth
│   ├── auth.ts                     ← Configuration NextAuth.js (point d'entrée)
│   ├── middleware.ts               ← Middleware: protection routes + rôles
│   │
│   └── lib/auth/
│       └── auth.config.ts          ← Config détaillée NextAuth
│
├── 📦 Prisma & BDD
│   ├── prisma/
│   │   ├── schema.prisma           ← Schéma complet (User, Transaction, etc.)
│   │   └── migrations/
│   │       └── [migration_dates]/  ← Historique migrations
│   │
│   └── lib/
│       └── prisma.ts               ← Client Prisma singleton
│
├── 🎯 Services & Logique métier
│   └── lib/services/
│       ├── JeezService.ts          ← Gestion portefeuille Jeez
│       │   ├── getBalance(userId)
│       │   ├── addJeez(userId, amount, transactionId, description)
│       │   ├── deductJeez(userId, amount, transactionId, description)
│       │   └── generateTransactionId()
│       │
│       ├── SubscriptionService.ts  ← Gestion abonnement VIP
│       │   ├── getVIPStatus(userId)
│       │   ├── activateVIP(userId, planType, transactionId)
│       │   ├── deactivateVIP(userId)
│       │   └── generateTransactionId()
│       │
│       └── PaymentService.ts       ← Validation PayPal
│           ├── verifyPayPalSignature(webhookId, body, headers)
│           ├── validateOrderAmount(expected, actual, etc.)
│           ├── parseWebhook(payload)
│           ├── parseProductType(customId)
│           └── hashPayload(payload)
│
├── 🛣️ Routes API
│   └── app/api/
│       ├── health/
│       │   └── route.ts            ← GET: Vérifier API fonctionne
│       │
│       ├── auth/
│       │   └── [...nextauth]/
│       │       └── route.ts        ← NextAuth.js handler
│       │
│       ├── payment/
│       │   └── create-order/
│       │       └── route.ts        ← POST: Créer commande PayPal
│       │                               (Validation + idempotence)
│       │
│       ├── webhooks/
│       │   └── paypal/
│       │       └── route.ts        ← POST: Webhook PayPal
│       │                               (Signature verify + atomic transaction)
│       │
│       └── user/
│           ├── wallet/
│           │   └── route.ts        ← GET: Solde Jeez
│           │
│           └── vip-status/
│               └── route.ts        ← GET: Statut VIP
│
├── ⚙️ Server Actions (côté serveur sécurisé)
│   └── app/actions/
│       ├── auth.actions.ts         ← Authentification
│       │   ├── signUpAction(email, password, name)
│       │   ├── signInAction(email, password)
│       │   └── signOutAction()
│       │
│       └── payment.actions.ts      ← Paiements & Profil
│           ├── getJeezBalanceAction()
│           ├── getVIPStatusAction()
│           ├── isUserVIPAction()
│           ├── getUserProfileAction()
│           └── addTestJeezAction(amount)
│
├── ⚛️ Composants React
│   └── app/components/
│       ├── VIPGate.tsx             ← Afficher contenu si VIP
│       └── JeezWallet.tsx          ← Afficher solde Jeez
│
├── 📝 Validation & Types
│   ├── lib/validators.ts           ← Schémas Zod
│   │   ├── CreatePayPalOrderSchema
│   │   ├── PayPalWebhookSchema
│   │   ├── JeezPurchaseSchema
│   │   ├── VIPPurchaseSchema
│   │   ├── CreateUserSchema
│   │   └── validateData()
│   │
│   └── types/
│       └── next-auth.d.ts          ← Types NextAuth augmentés
│           ├── interface User { id, role, isActive }
│           ├── interface Session { user { id, role } }
│           └── interface JWT { id, role }
│
├── 🧪 Tests & Utils
│   ├── lib/utils/
│   │   └── test-helpers.ts         ← Générateurs de payloads test
│   │       ├── generateTestWebhookPayload()
│   │       ├── generateTestWebhookHeaders()
│   │       ├── generateOrderId()
│   │       └── generateTransactionId()
│   │
│   └── __tests__/
│       └── JeezService.test.ts     ← Tests unitaires Jest
│           ├── getBalance tests
│           ├── addJeez tests
│           ├── deductJeez tests
│           └── idempotence tests
│
├── 📜 Scripts
│   └── scripts/
│       └── seed.ts                 ← Remplir BDD avec données test
│           ├── Créer 3 users (USER, VIP, ADMIN)
│           ├── Initialiser balances Jeez
│           ├── Activer VIP subscription
│           └── Ajouter transactions exemple
│
└── 📁 Assets & Static
    └── public/
        └── (images, fonts, etc.)
```

---

## 🎯 Flux de données

### 1️⃣ Authentification
```
Browser → POST /api/auth/signin 
→ NextAuth validates credentials 
→ Session créée en BDD 
→ Cookie HttpOnly retourné
```

### 2️⃣ Achat de Jeez
```
Client → POST /api/payment/create-order
→ Créer PayPalOrder dans BDD
→ Retourner order ID
→ Client ouvre PayPal Checkout
→ PayPal capture le paiement
→ PayPal envoie webhook
```

### 3️⃣ Webhook PayPal
```
PayPal → POST /api/webhooks/paypal
→ Vérifier signature
→ Vérifier montant
→ Vérifier idempotence
→ Prisma $transaction:
   - Ajouter Jeez OU activer VIP
   - Enregistrer transaction
   - Mettre à jour PayPalOrder status
→ Retourner 200 OK
```

### 4️⃣ Vérifier VIP Status
```
Client → isUserVIPAction()
→ Server: SELECT VIPSubscription WHERE userId
→ Comparer expiresAt > NOW()
→ Retourner { isActive, expiresAt, planType }
```

---

## 🔐 Couches de sécurité

```
┌─────────────────────────────────────┐
│    Browser / Client                 │
├─────────────────────────────────────┤
│    HTTPS + SameSite Cookies         │  ← Transport security
├─────────────────────────────────────┤
│    middleware.ts                    │  ← Auth + Rate limit
├─────────────────────────────────────┤
│    Zod Validation (Input)           │  ← Type-safe input
├─────────────────────────────────────┤
│    Services (Business Logic)        │  ← Transactions atomiques
├─────────────────────────────────────┤
│    Prisma ORM                       │  ← SQL injection protection
├─────────────────────────────────────┤
│    PostgreSQL (BDD)                 │  ← Data encryption at rest
├─────────────────────────────────────┤
│    .env.local (Secrets)             │  ← Never in git
└─────────────────────────────────────┘
```

---

## 🚀 Déploiement (Vercel)

```
1. Connecter repo GitHub
   → Vercel auto-détecte Next.js

2. Ajouter secrets
   → Settings → Environment Variables
   → DATABASE_URL, NEXTAUTH_SECRET, PAYPAL_*, etc.

3. Deploy
   → Git push → Vercel auto-déploie

4. Configure custom domain
   → Ajouter domaine
   → Activer HTTPS automatique
```

---

## 📊 Bases de données recommandées

| Provider | Gratuit | Limite |
|----------|---------|--------|
| Supabase | Oui | 500 MB, 2 concurrent |
| Neon | Oui | 3 GB, shared compute |
| Railway | Oui | $5/month credits |
| PlanetScale | Oui | 100 branches |

---

## 🎓 Points d'apprentissage clés

1. **Transactions atomiques** → Prisma $transaction
2. **Idempotence** → Unique constraint + check before insert
3. **Validation côté serveur** → Jamais faire confiance au client
4. **Signature verification** → HMAC-SHA256 pour webhooks
5. **Middleware** → Protéger automatiquement les routes
6. **Server Actions** → Plus sûr que les API routes directes
7. **Type safety** → Zod + TypeScript ensemble
8. **Hashing** → bcrypt pour passwords (jamais MD5!)
9. **Sessions** → BDD > JWT seul
10. **Audit trail** → Logger tout pour le debugging

---

Vous avez maintenant une **architecture production-grade** pour Jeezy TV! 🎉

Commencez par [INDEX.md](./INDEX.md) ou [QUICKSTART.md](./QUICKSTART.md)
