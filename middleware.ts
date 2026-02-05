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
  // ----- CORS: autoriser uniquement nos domaines (préflight + réponses) -----
  const origin = req.headers.get('origin') ?? '';
  const ALLOWED_ORIGINS = new Set([
    'https://jeezy-tv.com',
    'https://www.jeezy-tv.com',
  ]);

  // Répondre aux préflight OPTIONS immédiatement
  if (req.method === 'OPTIONS') {
    const headers = new Headers();
    if (ALLOWED_ORIGINS.has(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Credentials', 'true');
      headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PUT,DELETE');
      headers.set('Access-Control-Allow-Headers', 'Authorization,Content-Type,Accept');
    }
    return new NextResponse(null, { status: 204, headers });
  }

  const { pathname } = req.nextUrl;

  // 1️⃣  Routes publiques - laisser passer
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    const res = NextResponse.next();
    if (ALLOWED_ORIGINS.has(origin)) {
      res.headers.set('Access-Control-Allow-Origin', origin);
      res.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    return res;
  }

  // 2️⃣  Vérifier la présence du cookie de session NextAuth
  const token = req.cookies.get("next-auth.session-token")?.value ||
                req.cookies.get("__Secure-next-auth.session-token")?.value;

  if (!token) {
    // ❌ Pas authentifié
    if (pathname.startsWith('/api')) {
      const headers = new Headers();
      if (ALLOWED_ORIGINS.has(origin)) {
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Access-Control-Allow-Credentials', 'true');
      }
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHENTICATED' },
        { status: 401, headers }
      );
    }
    // Rediriger vers signin pour les pages
    const redirectRes = NextResponse.redirect(new URL('/auth/signin', req.url));
    if (ALLOWED_ORIGINS.has(origin)) {
      redirectRes.headers.set('Access-Control-Allow-Origin', origin);
      redirectRes.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    return redirectRes;
  }

  // ✅ Session présente - laisser les routes protégées passer
  // La vérification complète des rôles se fera côté serveur (auth()) dans les API routes
  // Le middleware fait juste vérifier la présence de la session

  const finalRes = NextResponse.next();
  if (ALLOWED_ORIGINS.has(origin)) {
    finalRes.headers.set('Access-Control-Allow-Origin', origin);
    finalRes.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  return finalRes;
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
