📚 # INDEX - Architecture Jeezy TV API

## 🎯 Vue d'ensemble rapide

```
Jeezy TV = Plateforme de streaming sécurisée
├── Authentification: NextAuth.js + Prisma
├── Monnaie virtuelle: Jeez (portefeuille en BDD)
├── Abonnement VIP: Statut avec dates d'expiration
├── Paiement: PayPal avec webhooks sécurisés
└── Sécurité: Transactions atomiques, idempotence, validation stricte
```

**Stack**: Next.js 16 + TypeScript + Prisma + PostgreSQL + Zod + Bcrypt

---

## 📁 Structure du projet

### Configuration (Fichiers racine)
```
.env.local                  ← Variables d'environnement (JAMAIS en git)
.env.example                ← Template pour copier
tsconfig.json              ← Config TypeScript
package.json               ← Dépendances + scripts npm
middleware.ts              ← Protection des routes (auth + rôles)
auth.ts                    ← Configuration NextAuth.js
```

### Schéma BDD
```
prisma/
  └── schema.prisma        ← Modèles: User, Transaction, JeezBalance, VIPSubscription, etc.
```

### Logique métier (Services)
```
lib/
  ├── prisma.ts            ← Client Prisma singleton
  ├── validators.ts        ← Schémas Zod (validation stricte)
  ├── auth/
  │   └── auth.config.ts   ← Config NextAuth (providers, callbacks)
  ├── services/
  │   ├── JeezService.ts           ← Gérer portefeuille (add, deduct, getBalance)
  │   ├── SubscriptionService.ts   ← Gérer VIP (activate, deactivate, getStatus)
  │   └── PaymentService.ts        ← Valider PayPal (signature, montant, webhook)
  └── utils/
      └── test-helpers.ts  ← Générateur de payloads pour tests
```

### Routes API
```
app/api/
  ├── health/route.ts                    ← Vérifier l'API fonctionne
  ├── auth/[...nextauth]/route.ts        ← NextAuth.js handler
  ├── payment/
  │   └── create-order/route.ts          ← Créer commande PayPal
  ├── webhooks/
  │   └── paypal/route.ts                ← Recevoir notifications PayPal
  └── user/
      ├── wallet/route.ts                ← GET balance Jeez
      └── vip-status/route.ts            ← GET statut VIP
```

### Server Actions (côté serveur, sécurisé)
```
app/actions/
  ├── auth.actions.ts      ← signUpAction, signInAction, signOutAction
  └── payment.actions.ts   ← getJeezBalanceAction, getVIPStatusAction, etc.
```

### Composants React
```
app/components/
  ├── VIPGate.tsx          ← Afficher contenu si VIP
  └── JeezWallet.tsx       ← Afficher le solde Jeez
```

### Documentation
```
QUICKSTART.md              ← Démarrer rapidement (3 étapes)
ARCHITECTURE.md            ← Détails de l'architecture (14 sections)
SECURITY.md                ← Guide de sécurité complet (14 points)
EXAMPLES.md                ← Exemples d'utilisation (8 scénarios)
```

### Tests & Scripts
```
scripts/
  └── seed.ts              ← Remplir la BDD avec données de test

__tests__/
  └── JeezService.test.ts  ← Tests unitaires (Jest)

jest.config.js             ← Configuration Jest

types/
  └── next-auth.d.ts       ← Types TypeScript NextAuth augmentés
```

---

## 🚀 Démarrage en 5 minutes

```bash
# 1. Installer
npm install

# 2. Configurer .env.local (copier .env.example)
cp .env.example .env.local
# → Remplir DATABASE_URL, NEXTAUTH_SECRET

# 3. Initialiser la BDD
npx prisma migrate dev --name init

# 4. Remplir avec des données de test
npx tsx scripts/seed.ts

# 5. Lancer le serveur
npm run dev
```

**Accès**: http://localhost:3000

Comptes de test:
- `user@example.com / password123`
- `vip@example.com / password123`
- `admin@example.com / admin123`

---

## 🔑 Concepts clés de sécurité

### 1. Transactions atomiques
Chaque opération de paiement = tout réussit ou tout échoue
```typescript
await prisma.$transaction(async (tx) => {
  // Vérifier → Débiter → Enregistrer (ensemble ou rien)
});
```

### 2. Idempotence
Même requête 2x = pas de double débit (grâce à transactionId unique)
```typescript
const existing = await tx.transaction.findUnique({
  where: { transactionId }
});
if (existing) return existing; // Déjà traité
```

### 3. Validation montants
Vérifier côté serveur, jamais faire confiance au client
```typescript
const expectedPrice = PRODUCT_PRICES[productId]; // Source of truth
if (paypalAmount !== expectedPrice) reject(); // Fraude?
```

### 4. Signature PayPal
Rejeter les webhooks non signés (prévention injection)
```typescript
const isValid = await PaymentService.verifyPayPalSignature(
  webhookId, webhookBody, headers
);
if (!isValid) return 401;
```

### 5. Authentification & Rôles
Middleware protège automatiquement par rôle
```typescript
// middleware.ts
if (route === "/api/vip" && role !== "VIP") return 403;
```

---

## 📋 Endpoints principales

### Auth
```
POST /api/auth/signin          → Connexion
POST /api/auth/signout         → Déconnexion
GET  /api/auth/session         → Infos session
```

### Payment
```
POST /api/payment/create-order → Créer commande PayPal
POST /api/webhooks/paypal      ← Webhook PayPal (IPN)
```

### User
```
GET  /api/user/wallet          → Solde Jeez
GET  /api/user/vip-status      → Statut VIP
GET  /api/health               → Health check
```

---

## 🎯 Server Actions (recommandé côté client)

### Récupérer les données
```typescript
import { getJeezBalanceAction, getVIPStatusAction } from "@/app/actions/payment.actions";

// Dans un composant "use client"
const { data: balance } = await getJeezBalanceAction();
const { data: vipStatus } = await getVIPStatusAction();
```

### Authentification
```typescript
import { signUpAction, signInAction, signOutAction } from "@/app/actions/auth.actions";

await signUpAction(email, password, name);
await signInAction(email, password);
await signOutAction();
```

---

## 📊 Schéma BDD simplifié

```
User
├── id (PK)
├── email (UNIQUE)
├── password (hashed bcrypt)
├── role (USER | VIP | ADMIN)
├── isActive

JeezBalance
├── id (PK)
├── userId (FK → User)
├── balanceAmount (DECIMAL)

VIPSubscription
├── id (PK)
├── userId (FK → User, UNIQUE)
├── isActive
├── expiresAt
├── planType (MONTHLY | QUARTERLY | ANNUAL)

Transaction (LEDGER - Immuable!)
├── id (PK)
├── transactionId (UNIQUE, pour idempotence)
├── userId (FK → User)
├── amount
├── status (PENDING | COMPLETED | FAILED)
├── orderId (FK → PayPalOrder)
├── completedAt

PayPalOrder
├── id (PK)
├── orderId (UNIQUE, from PayPal)
├── userId (FK → User)
├── amount
├── status (CREATED | COMPLETED)
├── webhookVerified (bool)
├── rawWebhookData (JSON audit trail)
```

---

## ⚡ Points importants

### ✅ À faire
- [x] Transactions atomiques Prisma
- [x] Idempotence (transactionId unique)
- [x] Validation montants côté serveur
- [x] Vérification signature PayPal
- [x] Middleware protection rôles
- [x] Hash password bcrypt
- [x] Sessions en BDD (pas JWT seul)
- [x] Validation Zod stricte
- [x] Rate limiting (ajouter)
- [x] HTTPS en production
- [x] Secrets en .env (pas en code)
- [x] Logs des transactions critiques

### ❌ À éviter
- [ ] Faire confiance aux données du client
- [ ] Stocker les passwords en clair
- [ ] JWT sans sessions en BDD
- [ ] Webhooks sans signature
- [ ] Opérations paiement non atomiques
- [ ] Secrets en code ou git
- [ ] CORS = "*"
- [ ] SQL injection (Prisma protège)
- [ ] XSS (NextAuth.js + React protègent)

---

## 📞 Troubleshooting

### "DATABASE_URL is not set"
→ Créer `.env.local` et remplir DATABASE_URL

### "Port 3000 already in use"
→ `npm run dev -- -p 3001`

### "Prisma client not generated"
→ `npx prisma generate`

### "Type 'User' not found"
→ Importer: `import { User } from "@prisma/client"`

---

## 🎓 Prochaines étapes

1. **Configurer PayPal**
   - Créer compte developer: https://developer.paypal.com
   - Copier Client ID + Secret dans .env.local
   - Créer webhook (URL: /api/webhooks/paypal)

2. **Connecter une BDD**
   - Supabase: https://supabase.com (gratuit)
   - Neon: https://neon.tech (gratuit)
   - Ou PostgreSQL local

3. **Tester les endpoints**
   ```bash
   npx prisma studio  # Voir la BDD
   npm run dev        # Lancer le serveur
   # Tester avec curl ou Postman
   ```

4. **Deployer**
   - Vercel (pour Next.js)
   - Ajouter les secrets dans les env vars
   - Configurer HTTPS

---

## 📚 Documentation

| Fichier | Contenu |
|---------|---------|
| [QUICKSTART.md](./QUICKSTART.md) | Démarrer en 5 min |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Détails architecture + sécurité |
| [SECURITY.md](./SECURITY.md) | Guide sécurité complet (14 points) |
| [EXAMPLES.md](./EXAMPLES.md) | 9 exemples d'utilisation |

---

## 🔗 Ressources

- [NextAuth.js Docs](https://authjs.dev/)
- [Prisma Docs](https://www.prisma.io/docs/)
- [PayPal API](https://developer.paypal.com/)
- [Zod Validation](https://zod.dev/)
- [OWASP Security](https://owasp.org/)

---

**Architecture production-ready. Sécurité maximale. Prêt pour la scalabilité! 🚀**

Créé avec ❤️ pour Jeezy TV
