// middleware.ts
// Middleware NextAuth.js - Protéger les routes sensibles par rôle
// NOTE: Edge Runtime - ne pas importer de modules node natifs

import { NextRequest, NextResponse } from "next/server";

/**
 * ⚠️  SÉCURITÉ CRITIQUE:
 * 1. Vérifier l'authentification pour les routes /api protégées
 * 2. Vérifier les rôles (USER, VIP, ADMIN) pour certains endpoints
 * 3. Rejeter les requêtes non authentifiées
 * 4. Vérifier les tokens JWT
 */

// Routes publiques (pas d'authentification requise)
const PUBLIC_ROUTES = [
  "/",
  "/auth/signin",
  "/auth/signup",
  "/api/health",
];

// Routes nécessitant l'authentification utilisateur
const PROTECTED_ROUTES = [
  "/api/user",
  "/api/wallet",
  "/api/profile",
];

// Routes VIP (utilisateur doit avoir le rôle VIP)
const VIP_ROUTES = [
  "/api/vip",
  "/app/premium",
];

// Routes ADMIN
const ADMIN_ROUTES = [
  "/api/admin",
  "/api/users",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1️⃣  Routes publiques - laisser passer
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // 2️⃣  Vérifier la présence du cookie de session NextAuth
  const token = req.cookies.get("next-auth.session-token")?.value ||
                req.cookies.get("__Secure-next-auth.session-token")?.value;

  if (!token) {
    // ❌ Pas authentifié
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }
    // Rediriger vers signin pour les pages
    return NextResponse.redirect(new URL("/auth/signin", req.url));
  }

  // ✅ Session présente - laisser les routes protégées passer
  // La vérification complète des rôles se fera côté serveur (auth()) dans les API routes
  // Le middleware fait juste vérifier la présence de la session

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protéger les routes API
    "/api/:path*",
    // Protéger les routes d'app
    "/app/:path*",
    "/admin/:path*",
    // Exclure les assets statiques
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
