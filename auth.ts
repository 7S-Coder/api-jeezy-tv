// auth.ts
// Configuration NextAuth.js v4 - Point d'entrée unique

import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";

const secret = process.env.NEXTAUTH_SECRET || "fallback-secret-key-min-32-characters-here-12345";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        emailOrUsername: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.emailOrUsername || !credentials?.password) {
          return null;
        }

        try {
          // Lazy load prisma to avoid connection at build time
          const { prisma } = await import("@/lib/prisma");
          
          // Chercher l'utilisateur par email OU par name (username)
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { email: credentials.emailOrUsername as string },
                { name: credentials.emailOrUsername as string },
              ],
            },
          });

          if (!user || !user.password) {
            return null;
          }

          // Vérifier le mot de passe (bcrypt)
          const isPasswordValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );

          if (!isPasswordValid) {
            return null;
          }

          if (!user.isActive) {
            return null;
          }

          // Retourner l'utilisateur
          return {
            id: user.id,
            email: user.email || "",
            name: user.name || "",
            role: user.role || "USER",
            isActive: user.isActive,
          };
        } catch (error) {
          console.error("[Auth Error]", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
    error: "/auth/error",
  },
  secret,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

// Export signIn and signOut
import { signIn as nextSignIn, signOut as nextSignOut } from "next-auth/react";
export { nextSignIn as signIn, nextSignOut as signOut };

// Export auth wrapper for server-side usage
import { getServerSession } from "next-auth";
export async function auth() {
  return await getServerSession(authOptions);
}
