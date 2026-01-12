// auth.ts
// Configuration NextAuth.js complète - Point d'entrée unique

import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authConfig } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

/**
 * ⚠️  SÉCURITÉ:
 * 1. Credentials Provider pour démo (utiliser OAuth en production: Google, GitHub)
 * 2. Validation stricte des credentials
 * 3. Sessions en base de données
 * 4. JWT signé et chiffré
 */

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    /**
     * Provider Credentials pour démo/développement
     * ⚠️  EN PRODUCTION: Utiliser OAuth (Google, GitHub) ou passkeys
     */
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "user@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        // Chercher l'utilisateur
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password) {
          throw new Error("User not found");
        }

        // Vérifier le mot de passe (bcrypt)
        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error("Invalid password");
        }

        if (!user.isActive) {
          throw new Error("User account is disabled");
        }

        // Retourner l'utilisateur (sera stocké dans la session)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          isActive: user.isActive,
        };
      },
    }),
  ],
});
