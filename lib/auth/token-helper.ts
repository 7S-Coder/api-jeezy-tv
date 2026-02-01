/**
 * Token Helper - Extraire le token du header Authorization ou du cookie
 */
import { NextRequest } from "next/server";

export function getTokenFromRequest(request: NextRequest): string | null {
  // 1️⃣  Essayer le header Authorization
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  // 2️⃣  Essayer le cookie backendToken
  const token = request.cookies.get("backendToken")?.value;
  if (token) {
    return token;
  }

  return null;
}
