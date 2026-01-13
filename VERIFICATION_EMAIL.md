# 📧 Système de Vérification d'Email

## Vue d'ensemble

Le système de vérification d'email garantit que seuls les utilisateurs ayant accès à leur adresse email peuvent créer un compte actif. C'est l'approche moderne standard utilisée par Gmail, Stripe, GitHub, etc.

## Flux complet

### 1️⃣ **Inscription (Sign Up)**
```
POST /api/auth/signup
{
  "email": "user@example.com",
  "password": "secure123",
  "name": "John Doe"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Compte créé. Veuillez vérifier votre email pour activer votre compte.",
  "data": {
    "userId": "abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": null
  }
}
```

✅ Le compte est créé immédiatement
✅ Un email de vérification est envoyé
❌ L'utilisateur NE peut pas se connecter tant que l'email n'est pas vérifié

---

### 2️⃣ **Vérifier l'Email via le Lien**

L'email reçu contient un lien du type:
```
https://localhost:3001/verify-email?token=xyz789...
```

Quand l'utilisateur clique sur ce lien:
- La page appelle automatiquement: `GET /api/auth/verify-email?token=xyz789`
- Le serveur vérifie le token
- Si valide, marque l'email comme vérifié ✅
- L'utilisateur voit une page de confirmation

**Réponse du serveur (200 OK):**
```json
{
  "message": "Email vérifié avec succès!",
  "user": {
    "id": "abc123",
    "email": "user@example.com",
    "emailVerified": "2025-01-12T21:00:00Z"
  }
}
```

---

### 3️⃣ **Se Connecter (Sign In)**

**Avant vérification:**
```
POST /api/auth/signin
{
  "email": "user@example.com",
  "password": "secure123"
}
```

**Response (403 Forbidden):**
```json
{
  "error": "Email not verified",
  "message": "Veuillez vérifier votre email avant de vous connecter.",
  "requiresVerification": true
}
```

**Après vérification:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "abc123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

---

### 4️⃣ **Renvoyer l'Email de Vérification**

Si l'utilisateur a perdu l'email ou veut en recevoir un nouveau:

```
POST /api/auth/verify-email
{
  "email": "user@example.com"
}
```

**Response (200 OK):**
```json
{
  "message": "Email de vérification envoyé"
}
```

---

## Bases de données - Champs Ajoutés

```prisma
model User {
  // Existants
  id            String    @id
  email         String    @unique
  emailVerified DateTime?  // NULL = non vérifié, DATE = vérifié le
  
  // Nouveaux
  verificationToken        String?   @unique
  verificationTokenExpires DateTime?
}
```

**Règles:**
- `emailVerified = null` → compte non actif
- `emailVerified = Date` → compte actif
- `verificationToken` généré aléatoirement (24 caractères)
- `verificationTokenExpires` = 24 heures après inscription

---

## Configuration Requise

### 1. Clé Resend API (Envoi d'emails)

Créer un compte gratuit: https://resend.com

Ajouter dans `.env`:
```
RESEND_API_KEY="re_xxxxxx..."
EMAIL_FROM="noreply@jeezy.tv"
NEXT_PUBLIC_APP_URL="http://localhost:3001"  # URL du frontend
```

### 2. Vérifier que la migration est appliquée

```bash
cd api-jeezytv
npx prisma migrate dev --name add-email-verification
```

---

## Tester avec le Testeur API

### 1. Créer un compte
- Aller sur http://localhost:3001/api-tester
- Remplir Email, Username, Password
- Clicker **Sign Up**

### 2. Récupérer le Token
- Regarder le terminal du serveur pour le lien d'email
- Ou chercher le token dans la réponse (optionnel)
- Copier le token de vérification

### 3. Vérifier l'Email
- Coller le token dans le champ "Verification Token"
- Clicker **Verify Email**
- Voir la réponse avec `emailVerified: Date`

### 4. Se Connecter
- Clicker **Sign In**
- Devrait retourner un JWT token ✅

---

## Sécurité

✅ Tokens uniques et aléatoires (crypto-secure en production)
✅ Expiration de 24 heures
✅ Impossibilité de se connecter sans vérification
✅ Emails envoyés via service tiers (Resend)
✅ Pas de tokens stockés en clair

---

## Améliorations Futures

- [ ] Rate limiting sur l'envoi d'emails
- [ ] Utiliser une vraie clé Resend (au lieu de test)
- [ ] Page de vérification d'email dans le webapp
- [ ] SMS alternative (si besoin)
- [ ] 2FA après vérification d'email
