# QUICK START GUIDE

## 1. Installation des dépendances
```bash
npm install
```

## 2. Créer et configurer la base de données

### Option A: Supabase (Gratuit, Recommended)
1. Créer un compte sur https://supabase.com
2. Créer un nouveau projet
3. Copier la DATABASE_URL depuis Settings > Database > Connection string
4. Mettre à jour .env.local

### Option B: Neon (Gratuit)
1. Créer un compte sur https://neon.tech
2. Créer une nouvelle base PostgreSQL
3. Copier la connection string
4. Mettre à jour .env.local

### Option C: PostgreSQL Local
```bash
# Installer PostgreSQL si nécessaire
# macOS: brew install postgresql
# Windows: https://www.postgresql.org/download/windows/

# Créer une base
createdb jeezytv

# DATABASE_URL="postgresql://postgres:password@localhost:5432/jeezytv"
```

## 3. Configurer les variables d'environnement
```bash
# Copier le fichier exemple
cp .env.example .env.local

# Générer NEXTAUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Mettre à jour .env.local avec:
# - DATABASE_URL
# - NEXTAUTH_SECRET
# - PayPal credentials (optionnel pour démarrer)
```

## 4. Initialiser Prisma
```bash
# Créer la migration et pousser vers la BDD
npx prisma migrate dev --name init

# Générer le client Prisma
npx prisma generate

# (Optionnel) Voir la BDD dans l'interface graphique
npx prisma studio
```

## 5. Remplir avec des données de test
```bash
npx tsx scripts/seed.ts
```

## 6. Lancer le serveur
```bash
npm run dev
```

Accéder à http://localhost:3000

---

## 📋 Configuration PayPal (Optionnelle pour démarrer)

### Créer un compte développeur
1. Aller sur https://developer.paypal.com
2. Se connecter ou créer un compte
3. Aller à **Apps & Credentials**
4. Créer une application (Type: Merchant)
5. Copier:
   - **Client ID** → NEXT_PUBLIC_PAYPAL_CLIENT_ID
   - **Secret** → PAYPAL_CLIENT_SECRET

### Créer un Webhook
1. Aller à **Webhooks** dans la section Sandbox
2. **Create new webhook**
3. URL: `https://yourdomain.com/api/webhooks/paypal`
4. Sélectionner l'événement: **CHECKOUT.ORDER.COMPLETED**
5. Copier le **Webhook ID** → PAYPAL_WEBHOOK_ID

---

## ✅ Test des comptes

Après `npm run dev`, utiliser:

```
Email: user@example.com
Password: password123

Email: vip@example.com
Password: password123

Email: admin@example.com
Password: admin123
```

---

## 🧪 Tester les endpoints

### Via curl

```bash
# 1. Vérifier que le serveur fonctionne
curl http://localhost:3000/api/health

# 2. Créer une session
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# 3. Obtenir le solde Jeez
curl -X GET http://localhost:3000/api/user/wallet \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# 4. Obtenir le statut VIP
curl -X GET http://localhost:3000/api/user/vip-status \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### Via Postman
1. Importer le fichier `postman_collection.json` (à créer)
2. Configurer les variables d'environnement
3. Tester les endpoints

---

## 📚 Fichiers importants

```
app/
  ├── api/
  │   ├── auth/[...nextauth]/route.ts       ← NextAuth.js
  │   ├── payment/create-order/route.ts      ← Créer commande PayPal
  │   ├── webhooks/paypal/route.ts           ← Recevoir notifications PayPal
  │   └── user/
  │       ├── wallet/route.ts                 ← Solde Jeez
  │       └── vip-status/route.ts             ← Statut VIP
  ├── actions/
  │   ├── auth.actions.ts                    ← Server Actions Auth
  │   └── payment.actions.ts                 ← Server Actions Payment
  └── components/
      ├── VIPGate.tsx                        ← Composant VIP
      └── JeezWallet.tsx                     ← Afficher solde

lib/
  ├── prisma.ts                              ← Client Prisma
  ├── validators.ts                          ← Schémas Zod
  ├── auth/auth.config.ts                    ← Config NextAuth
  └── services/
      ├── JeezService.ts                     ← Logique Jeez
      ├── SubscriptionService.ts             ← Logique VIP
      └── PaymentService.ts                  ← Logique PayPal

prisma/
  └── schema.prisma                          ← Schéma BDD
```

---

## 🚨 Erreurs courantes

### "DATABASE_URL is not set"
→ Vérifier que .env.local existe et contient DATABASE_URL

### "NEXTAUTH_SECRET is missing"
→ Générer une clé: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### "Prisma client is not generated"
→ Exécuter: `npx prisma generate`

### "Port 3000 already in use"
→ Changer le port: `npm run dev -- -p 3001`

---

## 📖 Documentation complète

Voir [ARCHITECTURE.md](./ARCHITECTURE.md) pour l'architecture détaillée et les principes de sécurité.
