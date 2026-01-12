// lib/prisma.ts
// Client Prisma singleton pour éviter les connexions multiples

import { PrismaClient } from "@prisma/client";

// Éviter les multiples instances en développement (Next.js hot reload)
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production")
  globalForPrisma.prisma = prisma;
