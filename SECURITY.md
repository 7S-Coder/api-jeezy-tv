// SECURITY.md
// Guide complet de sécurité pour Jeezy TV API

# 🔐 Guide de Sécurité Jeezy TV

## 🎯 Principes fondamentaux

Cette API suit les standards industrie de sécurité:
- **OWASP Top 10** (Open Web Application Security Project)
- **PCI DSS** (Payment Card Industry Data Security Standard)
- **SOC 2 Compliance**

---

## 1️⃣ Authentification & Autorisation

### NextAuth.js avec Prisma Adapter

✅ **Points forts**:
- Sessions stockées en base de données (pas en JWT seul)
- CSRF tokens automatiques
- SameSite cookies
- Refresh token rotation

❌ **À éviter**:
```typescript
// ❌ MAUVAIS: Stocker les tokens en localStorage
localStorage.setItem("token", jwt); // XSS vulnerable!

// ✅ BON: HttpOnly cookies (NextAuth.js le fait)
// Le token est en cookie HttpOnly (JS ne peut pas y accéder)
```

### Rôles et permissions
```typescript
// middleware.ts - Protéger par rôle
if (userRole !== "VIP" && userRole !== "ADMIN") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

---

## 2️⃣ Transactions atomiques (Double-spending)

### Scenario de risque
```
Attaquant tente d'acheter 100 Jeez deux fois rapidement
→ Deux requêtes arrivent au serveur simultanément
→ Solde = 0, pas de vérification atomique
→ Solde final = -200 (BUG!)
```

### Solution: Prisma $transaction
```typescript
await prisma.$transaction(async (tx) => {
  // 1. Vérifier le solde DANS la transaction
  const balance = await tx.jeezBalance.findUnique({ where: { userId } });
  
  if (balance.amount < 100) {
    throw new Error("INSUFFICIENT_BALANCE");
  }
  
  // 2. Débiter
  await tx.jeezBalance.update({
    where: { userId },
    data: { balanceAmount: { decrement: 100 } }
  });
  
  // 3. Enregistrer
  await tx.transaction.create({...});
  
  // ✅ Tout réussit ensemble ou tout échoue
}, { 
  timeout: 10000, // Éviter les deadlocks
  maxWait: 5000 
});
```

---

## 3️⃣ Idempotence (Prévention des doublons)

### Problème
```
Client → Requête achat Jeez
Serveur crée transaction ✅
Serveur → Client: ID transaction
Client NE REÇOIT PAS la réponse (timeout, réseau)
Client RENVOIE la requête
Serveur crée DEUX transactions ❌
```

### Solution: Transaction ID unique
```typescript
// Client génère/reçoit: "jeez_1704960000000_abc123def"
// BDD: UNIQUE(userId, transactionId)

const existing = await tx.transaction.findUnique({
  where: { transactionId: "jeez_1704960000000_abc123def" }
});

if (existing) {
  // Déjà traité, retourner le résultat précédent
  return existing;
}

// Nouvelle transaction
await tx.transaction.create({
  transactionId: "jeez_1704960000000_abc123def",
  ...
});
```

---

## 4️⃣ Validation des montants PayPal

### Danger: Manipulation côté client
```typescript
// ❌ TRÈS MAUVAIS
const amount = request.body.amount; // Client dit "je paie 0.01$" !
const order = await PayPal.createOrder({ amount }); // Confiance aveugle
```

### Solution: Serveur source of truth
```typescript
// ✅ BON
const PRODUCT_PRICES = {
  "jeez_100_usd": { amount: 4.99, currency: "USD" },
  "vip_monthly_usd": { amount: 9.99, currency: "USD" },
};

const productId = request.body.productId; // Client dit juste quel produit
const expectedPrice = PRODUCT_PRICES[productId]; // Serveur valide le prix

// Webhook PayPal
const amountValidation = PaymentService.validateOrderAmount(
  expectedPrice.amount,   // 9.99
  webhook.amount,         // 9.99 (from PayPal)
  expectedPrice.currency, // USD
  webhook.currency        // USD
);

if (!amountValidation.success) {
  // REJETER: Possible fraude
}
```

---

## 5️⃣ Webhooks PayPal sécurisés

### Signature verification (HMAC-SHA256)

PayPal signe tous les webhooks. Vérifier la signature:

```
Message à signer:
transmission_id|transmission_time|webhook_id|payload_hash

Signature = HMAC-SHA256(message, certificate_from_paypal)

Vérifier: signature_received == calculated_signature
```

❌ **JAMAIS faire confiance à un webhook sans vérifier la signature**

```typescript
// ❌ MAUVAIS
app.post("/api/webhooks/paypal", (req) => {
  const { amount, status } = req.body;
  // Traiter directement! N'importe qui peut envoyer ça!
});

// ✅ BON
app.post("/api/webhooks/paypal", async (req) => {
  // 1. Vérifier signature
  const isValid = await PaymentService.verifyPayPalSignature(
    webhookId,
    body,
    headers
  );
  if (!isValid.success) return 401; // Rejeter
  
  // 2. Valider montant
  // 3. Vérifier idempotence
  // 4. Traiter
});
```

---

## 6️⃣ Injection SQL (ORM Protection)

✅ **Prisma protège automatiquement** via requêtes paramétrées:

```typescript
// ✅ BON: Paramétré
const user = await prisma.user.findUnique({
  where: { email: userInput }
});

// ❌ MAUVAIS: Raw query sans paramètres
const user = await prisma.$queryRawUnsafe(
  `SELECT * FROM users WHERE email = '${userInput}'` // Injection!
);

// ✅ BON: Raw query avec paramètres
const user = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${userInput}
`;
```

---

## 7️⃣ Mot de passe sécurisé

### Hashing avec bcrypt
```typescript
import bcrypt from "bcrypt";

// Registration
const hashedPassword = await bcrypt.hash(userPassword, 12); // 12 rounds
await user.create({ password: hashedPassword });

// Login
const isValid = await bcrypt.compare(userPassword, hashedPassword);

// ⚠️ JAMAIS: Stocker les mots de passe en clair!
// ⚠️ JAMAIS: Utiliser du MD5 ou SHA1 (trop rapides, "breakable" par brute force)
```

### Politique de mots de passe
```typescript
// Zod validation
const schema = z.object({
  password: z.string()
    .min(8, "At least 8 characters")
    .regex(/[A-Z]/, "At least one uppercase")
    .regex(/[0-9]/, "At least one number")
    .regex(/[^a-zA-Z0-9]/, "At least one special character")
});
```

---

## 8️⃣ CORS (Cross-Origin Resource Sharing)

✅ **Configurer CORS strictement**:

```typescript
// next.config.ts
const nextConfig = {
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: process.env.ALLOWED_ORIGINS || "https://yourdomain.com"
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE"
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization"
          }
        ]
      }
    ];
  }
};
```

❌ **JAMAIS**:
```typescript
// ❌ DANGEREUX
"Access-Control-Allow-Origin": "*" // Tout le monde!
```

---

## 9️⃣ Rate limiting

Protéger contre les attaques par force brute et DDoS:

```typescript
// npm install express-rate-limit
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par IP
  message: "Too many requests, try again later"
});

app.post("/api/auth/signin", limiter, (req, res) => {
  // Protégé contre brute force
});
```

---

## 🔟 Variables d'environnement

✅ **À stocker en secrets**:
- NEXTAUTH_SECRET
- DATABASE_URL
- PAYPAL_CLIENT_SECRET
- API keys

❌ **JAMAIS en code**:
```bash
# ❌ DANGER
git add .
git commit -m "Add secrets" # Les secrets sont maintenant dans Git FOREVER

# ✅ BON
echo ".env.local" >> .gitignore
git config core.excludesfile ~/.gitignore_global
```

---

## 1️⃣1️⃣ HTTPS & TLS

✅ **En production**:
```typescript
// auth.ts
export const { handlers, auth } = NextAuth({
  ...authConfig,
  trustHost: process.env.NODE_ENV === "production",
  // ^^ Active la vérification HTTPS automatique
});
```

❌ **JAMAIS** en HTTP en production!

---

## 1️⃣2️⃣ Logs & Monitoring

⚠️ **Ne PAS logger les données sensibles**:

```typescript
// ❌ MAUVAIS
console.log("User signed in:", {
  email: user.email,
  password: user.password // OH NO!
});

// ✅ BON
console.log("User signed in:", {
  userId: user.id,
  email: user.email
  // Pas de password!
});
```

### Monitoring les transactions critiques:
```typescript
// Logger TOUTES les transactions
logger.info("Transaction completed", {
  transactionId,
  userId,
  amount,
  type: "JEEZ_PURCHASE",
  timestamp: new Date().toISOString()
});

// Alerter en cas d'erreur
logger.error("Transaction failed", {
  transactionId,
  reason: error.message
});
```

---

## 1️⃣3️⃣ Audit & Conformité

### Ledger complet
```typescript
// Chaque transaction enregistrée
- id: unique ID
- transactionId: idempotence key
- userId: qui a effectué
- amount: combien
- status: PENDING, COMPLETED, FAILED
- completedAt: timestamp exact
- metadata: détails supplémentaires
- rawWebhookData: données brutes PayPal (audit trail)
```

### Accès aux données
- Qui a accédé
- Quand
- Pourquoi (si possible)
- D'où (IP, device)

---

## 1️⃣4️⃣ Checklist de sécurité

- [ ] Secrets en variables d'environnement, pas en code
- [ ] HTTPS activé en production
- [ ] Validation stricte des entrées (Zod)
- [ ] Transactions atomiques pour les paiements
- [ ] Idempotence pour chaque opération
- [ ] Vérification signature PayPal webhooks
- [ ] Validation montants côté serveur
- [ ] CORS configuré strictement
- [ ] Rate limiting sur endpoints sensibles
- [ ] Passwords hashés avec bcrypt
- [ ] Sessions en base de données
- [ ] Logs des transactions critiques
- [ ] Backup BDD réguliers
- [ ] Tests de sécurité (OWASP ZAP, Burp Suite)
- [ ] Revue de code par les pairs

---

## 📞 En cas de sécurité

1. **Désactiver les comptes suspects** → `user.isActive = false`
2. **Bloquer les IPs** → Rate limiting + WAF
3. **Notifier les utilisateurs** → Email notification
4. **Auditer les logs** → Chercher les anomalies
5. **Appeler PayPal** → En cas de doute sur une transaction

---

## 📚 Ressources

- [OWASP Top 10](https://owasp.org/Top10/)
- [PayPal Security](https://developer.paypal.com/docs/checkout/integration-features/webhooks/#verify-webhook-signatures)
- [NextAuth.js Security](https://authjs.dev/concepts/session-strategies)
- [Prisma Security](https://www.prisma.io/docs/concepts/components/prisma-client/crud)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/sql-syntax.html)

---

**Sécurité = Responsabilité Continue. Audit régulièrement. 🔒**
