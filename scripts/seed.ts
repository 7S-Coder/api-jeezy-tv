// scripts/seed.ts
// Script d'initialisation - Remplir la base avec des données de test
// 
// Usage: npx tsx scripts/seed.ts

import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

async function main() {
  console.log("🌱 Seeding database...");

  // Nettoyer les données existantes (optionnel)
  // await prisma.transaction.deleteMany();
  // await prisma.jeezBalance.deleteMany();
  // await prisma.vIPSubscription.deleteMany();
  // await prisma.user.deleteMany();

  // 1️⃣  Créer un utilisateur de test
  const testUser = await prisma.user.create({
    data: {
      email: "user@example.com",
      name: "Test User",
      password: await bcrypt.hash("password123", 12),
      role: "USER",
      isActive: true,
    },
  });

  console.log("✅ Created user:", testUser.email);

  // 2️⃣  Initialiser le portefeuille Jeez
  const jeezBalance = await prisma.jeezBalance.create({
    data: {
      userId: testUser.id,
      balanceAmount: 1000, // 1000 Jeez de démarrage
    },
  });

  console.log("✅ Created Jeez balance:", jeezBalance.balanceAmount);

  // 3️⃣  Créer un utilisateur VIP
  const vipUser = await prisma.user.create({
    data: {
      email: "vip@example.com",
      name: "VIP User",
      password: await bcrypt.hash("password123", 12),
      role: "VIP",
      isActive: true,
    },
  });

  console.log("✅ Created VIP user:", vipUser.email);

  // 4️⃣  Initialiser son portefeuille
  await prisma.jeezBalance.create({
    data: {
      userId: vipUser.id,
      balanceAmount: 5000,
    },
  });

  // 5️⃣  Activer l'abonnement VIP
  const vipSubscription = await prisma.vIPSubscription.create({
    data: {
      userId: vipUser.id,
      isActive: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
      planType: "MONTHLY",
      autoRenew: true,
    },
  });

  console.log("✅ Created VIP subscription for:", vipUser.email);

  // 6️⃣  Créer un utilisateur ADMIN
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@example.com",
      name: "Admin User",
      password: await bcrypt.hash("admin123", 12),
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log("✅ Created admin user:", adminUser.email);

  await prisma.jeezBalance.create({
    data: {
      userId: adminUser.id,
      balanceAmount: 999999,
    },
  });

  // 7️⃣  Ajouter des transactions d'exemple
  const transaction = await prisma.transaction.create({
    data: {
      transactionId: `test_${Date.now()}`,
      userId: testUser.id,
      transactionType: "JEEZ_PURCHASE",
      amount: 500,
      status: "COMPLETED",
      paymentMethod: "PAYPAL",
      description: "Initial test purchase",
      completedAt: new Date(),
    },
  });

  console.log("✅ Created transaction:", transaction.transactionId);

  console.log("\n✨ Database seeding completed!");
  console.log("\nTest Accounts:");
  console.log("1. User:  user@example.com / password123");
  console.log("2. VIP:   vip@example.com / password123");
  console.log("3. Admin: admin@example.com / admin123");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
