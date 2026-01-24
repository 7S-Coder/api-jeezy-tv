// lib/auth/auth.config.ts
// Configuration NextAuth.js avec Prisma Adapter

import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { NextAuthOptions } from "next-auth";

/**
 * ⚠️  SÉCURITÉ CRITIQUE:
 * - JWT signé avec NEXTAUTH_SECRET (min 32 caractères)
 * - Sessions stockées en base de données (Prisma Adapter)
 * - Callbacks pour valider et enrichir les sessions
 * - Rôles (USER, VIP, ADMIN) assignés à la création
 */

export const authConfig: NextAuthOptions = {
  providers: [
    // 🔐 Ajouter vos fournisseurs (Google, GitHub, credentials, etc.)
    // Exemple avec Credentials Provider pour la démo
  ],
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database", // ✅ Sessions en base de données (plus sûr)
    maxAge: 30 * 24 * 60 * 60, // 30 jours
    updateAge: 24 * 60 * 60, // Rafraîchir quotidiennement
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 jours
  },
  callbacks: {
    /**
     * JWT Callback - enrichir le JWT avec les données utilisateur
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || "USER";
        token.email = user.email;
        token.profileColor = (user as any).profileColor;
      }
      return token;
    },

    /**
     * Session Callback - enrichir la session avec les données du JWT
     */
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).profileColor = token.profileColor;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
};
