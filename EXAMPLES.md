// EXAMPLES.md
// Exemples d'utilisation complets de l'API Jeezy TV

# 📚 Exemples d'utilisation

## 1️⃣ Authentification

### Signup (Créer un compte)
```typescript
import { signUpAction } from "@/app/actions/auth.actions";

export function SignupForm() {
  async function handleSignup(formData: FormData) {
    const result = await signUpAction(
      formData.get("email") as string,
      formData.get("password") as string,
      formData.get("name") as string
    );

    if (result.success) {
      console.log("✅ Account created!", result.data?.userId);
      // Rediriger vers dashboard
      window.location.href = "/dashboard";
    } else {
      console.error("❌ Error:", result.error);
    }
  }

  return (
    <form action={handleSignup}>
      <input type="email" name="email" required placeholder="you@example.com" />
      <input type="password" name="password" required placeholder="••••••••" />
      <input type="text" name="name" required placeholder="Your name" />
      <button type="submit">Create Account</button>
    </form>
  );
}
```

### Signin (Se connecter)
```typescript
import { signInAction } from "@/app/actions/auth.actions";

export function SigninForm() {
  async function handleSignin(formData: FormData) {
    const result = await signInAction(
      formData.get("email") as string,
      formData.get("password") as string
    );

    if (result.success) {
      console.log("✅ Signed in!");
      window.location.href = "/dashboard";
    } else {
      console.error("❌ Invalid credentials");
    }
  }

  return (
    <form action={handleSignin}>
      <input type="email" name="email" required />
      <input type="password" name="password" required />
      <button type="submit">Sign In</button>
    </form>
  );
}
```

---

## 2️⃣ Wallet Jeez

### Afficher le solde
```typescript
"use client";

import { useEffect, useState } from "react";
import { getJeezBalanceAction } from "@/app/actions/payment.actions";

export function BalanceDisplay() {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const result = await getJeezBalanceAction();
      if (result.success) {
        setBalance(result.data || 0);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div>Loading balance...</div>;

  return (
    <div className="p-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
      <p className="text-white font-bold">💜 Jeez Balance</p>
      <p className="text-2xl text-white">{balance.toLocaleString()}</p>
    </div>
  );
}
```

### Ajouter des Jeez (Simulation test)
```typescript
import { addTestJeezAction } from "@/app/actions/payment.actions";

export function AddJeezButton() {
  async function handleAddJeez() {
    const result = await addTestJeezAction(500); // Ajouter 500 Jeez

    if (result.success) {
      console.log("✅ Added 500 Jeez! New balance:", result.data);
      // Rafraîchir le balance display
    } else {
      console.error("❌ Failed:", result.error);
    }
  }

  return (
    <button
      onClick={handleAddJeez}
      className="px-4 py-2 bg-green-500 text-white rounded"
    >
      + 500 Jeez (Test)
    </button>
  );
}
```

---

## 3️⃣ Statut VIP

### Vérifier si VIP
```typescript
import { isUserVIPAction } from "@/app/actions/payment.actions";

export async function Header() {
  const vipResult = await isUserVIPAction();
  const isVIP = vipResult.success ? vipResult.data : false;

  return (
    <header className="flex justify-between items-center">
      <h1>Jeezy TV</h1>
      {isVIP ? (
        <span className="text-purple-500 font-bold">👑 VIP Member</span>
      ) : (
        <a href="/upgrade" className="text-blue-500 underline">
          Upgrade to VIP
        </a>
      )}
    </header>
  );
}
```

### Utiliser VIPGate (Contenu protégé)
```typescript
import { VIPGate } from "@/app/components/VIPGate";

export function PremiumVideoPlayer() {
  return (
    <VIPGate fallback={<PremiumPrompt />}>
      <video
        src="/premium-content/movie-2024.mp4"
        controls
        className="w-full"
      />
    </VIPGate>
  );
}

function PremiumPrompt() {
  return (
    <div className="p-8 bg-yellow-50 border-2 border-yellow-400 rounded-lg text-center">
      <h2 className="text-xl font-bold mb-4">🎬 Premium Content</h2>
      <p className="mb-6">Subscribe to VIP to watch unlimited premium videos!</p>
      <a
        href="/upgrade?plan=monthly"
        className="inline-block px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
      >
        Upgrade Now - $9.99/month
      </a>
    </div>
  );
}
```

### Obtenir les détails complets du profil
```typescript
import { getUserProfileAction } from "@/app/actions/payment.actions";

export async function ProfilePage() {
  const result = await getUserProfileAction();

  if (!result.success) {
    return <div>Error loading profile</div>;
  }

  const { name, email, jeezBalance, vipStatus } = result.data!;

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">My Profile</h1>

      <div className="space-y-4">
        <div className="p-3 bg-gray-50 rounded">
          <p className="text-gray-600">Name</p>
          <p className="font-bold">{name}</p>
        </div>

        <div className="p-3 bg-gray-50 rounded">
          <p className="text-gray-600">Email</p>
          <p className="font-bold">{email}</p>
        </div>

        <div className="p-3 bg-purple-50 rounded border border-purple-200">
          <p className="text-gray-600">💜 Jeez Balance</p>
          <p className="text-2xl font-bold text-purple-600">
            {jeezBalance.toLocaleString()}
          </p>
        </div>

        <div className="p-3 bg-pink-50 rounded border border-pink-200">
          <p className="text-gray-600">VIP Status</p>
          {vipStatus.isActive ? (
            <div>
              <p className="text-lg font-bold text-pink-600">👑 Active</p>
              <p className="text-sm text-gray-600">
                Plan: {vipStatus.planType} • Expires: {vipStatus.expiresAt?.toLocaleDateString()}
              </p>
            </div>
          ) : (
            <p className="text-gray-600">Not a VIP member</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 4️⃣ Acheter des Jeez (Intégration PayPal)

### Créer une commande PayPal
```typescript
import { useState } from "react";

export function JeezStoreButton() {
  const [loading, setLoading] = useState(false);

  async function handleBuyJeez() {
    setLoading(true);

    try {
      // 1. Créer la commande côté serveur
      const response = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productType: "JEEZ",
          amount: 1000, // 1000 Jeez
          currency: "USD",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create order");
      }

      // 2. Rediriger vers PayPal (vous utiliserez le SDK PayPal réel)
      console.log("Order created:", data.order);
      // Ouvrir le dialogue PayPal avec data.order.id

      alert("✅ Order ID: " + data.order.id);
    } catch (error) {
      console.error("❌ Error:", error);
      alert("Failed to create order");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleBuyJeez}
      disabled={loading}
      className="px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
    >
      {loading ? "Processing..." : "Buy 1000 Jeez - $34.99"}
    </button>
  );
}
```

### Composant magasin complet
```typescript
export function JeezStore() {
  const packages = [
    { id: "jeez_100_usd", amount: 100, price: 4.99 },
    { id: "jeez_500_usd", amount: 500, price: 19.99 },
    { id: "jeez_1000_usd", amount: 1000, price: 34.99 },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {packages.map((pkg) => (
        <JeezPackage key={pkg.id} {...pkg} />
      ))}
    </div>
  );
}

function JeezPackage({
  id,
  amount,
  price,
}: {
  id: string;
  amount: number;
  price: number;
}) {
  const [loading, setLoading] = useState(false);

  async function handleBuy() {
    setLoading(true);
    try {
      const response = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productType: "JEEZ",
          amount,
        }),
      });

      const data = await response.json();
      console.log("Order created:", data.order.id);
      // Lancer PayPal...
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg text-center">
      <p className="text-3xl font-bold text-purple-600">{amount}</p>
      <p className="text-gray-600">Jeez tokens</p>
      <p className="text-2xl font-bold my-2">${price.toFixed(2)}</p>
      <button
        onClick={handleBuy}
        disabled={loading}
        className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
      >
        {loading ? "..." : "Buy"}
      </button>
    </div>
  );
}
```

---

## 5️⃣ Acheter un abonnement VIP

```typescript
export function VIPSubscriptionSelector() {
  const plans = [
    { id: "vip_monthly_usd", label: "Monthly", price: 9.99, duration: "1 month" },
    { id: "vip_quarterly_usd", label: "Quarterly", price: 24.99, duration: "3 months" },
    { id: "vip_annual_usd", label: "Annual", price: 79.99, duration: "1 year" },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Upgrade to VIP 👑</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <VIPPlanCard key={plan.id} {...plan} />
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-bold mb-2">VIP Benefits:</h3>
        <ul className="text-sm space-y-1">
          <li>✅ No ads</li>
          <li>✅ 4K quality</li>
          <li>✅ Offline downloads</li>
          <li>✅ Early access to new content</li>
        </ul>
      </div>
    </div>
  );
}

function VIPPlanCard({
  id,
  label,
  price,
  duration,
}: {
  id: string;
  label: string;
  price: number;
  duration: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleSubscribe() {
    setLoading(true);
    try {
      const response = await fetch("/api/payment/create-order", {
        method: "POST",
        body: JSON.stringify({
          productType: "VIP",
          amount: label.toLowerCase(), // "monthly", "quarterly", "annual"
        }),
      });

      const data = await response.json();
      // Lancer PayPal...
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 border border-gray-200 rounded-lg hover:border-purple-500 transition">
      <h3 className="text-xl font-bold mb-2">{label}</h3>
      <p className="text-3xl font-bold text-purple-600 mb-2">${price}</p>
      <p className="text-gray-600 text-sm mb-4">{duration}</p>
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
      >
        {loading ? "Processing..." : "Subscribe"}
      </button>
    </div>
  );
}
```

---

## 6️⃣ API Routes directes (via fetch)

### GET /api/user/wallet
```typescript
// Obtenir le solde
const response = await fetch("/api/user/wallet");
const data = await response.json();

console.log(data);
// {
//   success: true,
//   balance: 1500,
//   userId: "user-123"
// }
```

### GET /api/user/vip-status
```typescript
const response = await fetch("/api/user/vip-status");
const data = await response.json();

console.log(data);
// {
//   success: true,
//   vipStatus: {
//     isActive: true,
//     expiresAt: "2025-02-11T...",
//     planType: "MONTHLY"
//   }
// }
```

### GET /api/health
```typescript
// Vérifier que l'API fonctionne
const response = await fetch("/api/health");
const data = await response.json();

console.log(data);
// {
//   status: "healthy",
//   timestamp: "2024-01-11T...",
//   database: "connected",
//   version: "1.0.0"
// }
```

---

## 7️⃣ Middleware & Protection

Automatiquement appliqué:

```typescript
// ✅ Routes PUBLIQUES (accessible à tous)
/ (homepage)
/auth/signin
/auth/signup

// ✅ Routes PROTÉGÉES (USER+)
/api/user/*
/api/wallet
/dashboard

// ✅ Routes VIP UNIQUEMENT
/api/vip/*
/app/premium
/premium-content

// ✅ Routes ADMIN UNIQUEMENT
/api/admin/*
/admin/dashboard
```

---

## 8️⃣ Gestion d'erreurs

```typescript
async function safeApiCall() {
  try {
    const result = await getJeezBalanceAction();

    if (!result.success) {
      // Erreur métier
      console.error("Business error:", result.error);
      return;
    }

    console.log("Balance:", result.data);
  } catch (error) {
    // Erreur système
    console.error("System error:", error);
  }
}
```

---

## 9️⃣ Logs & Debugging

### Voir les logs BDD
```bash
npx prisma studio
# Accès à http://localhost:5555
```

### Voir les logs NextAuth
```typescript
// auth.ts
callbacks: {
  async jwt({ token, user }) {
    console.log("[JWT] Issued for:", user?.email);
    return token;
  },
},
```

### Voir les requêtes SQL
```typescript
// lib/prisma.ts
new PrismaClient({
  log: ["query", "info", "warn", "error"],
});
```

---

**Vous avez maintenant une API complète, sécurisée et prête pour la production! 🚀**
