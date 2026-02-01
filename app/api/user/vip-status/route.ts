// app/api/user/vip-status/route.ts
// Obtenir le statut VIP de l'utilisateur

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SubscriptionService } from "@/lib/services/SubscriptionService";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest } from "@/lib/auth/token-helper";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "");

export async function OPTIONS(request: NextRequest) {
  const FRONTEND = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': FRONTEND,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}

export async function GET(request: NextRequest) {
  const FRONTEND = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
  try {
    // 1️⃣  SÉCURITÉ: Vérifier l'authentification via JWT (du header ou du cookie)
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { 'Access-Control-Allow-Origin': FRONTEND, 'Access-Control-Allow-Credentials': 'true' } });
    }

    const decoded = await jwtVerify(token, secret);
    // Le token peut contenir différentes clés selon où il a été signé
    const payload: any = decoded.payload;
    const userId = payload.userId || payload.sub || payload.id || payload.jti;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { 'Access-Control-Allow-Origin': FRONTEND, 'Access-Control-Allow-Credentials': 'true' } });
    }

    // 2️⃣  Obtenir le statut VIP
    const result = await SubscriptionService.getVIPStatus(userId);

    if (!result.success) {
      return NextResponse.json(
        { isVIP: false, vip: null },
        { status: 200, headers: { 'Access-Control-Allow-Origin': FRONTEND, 'Access-Control-Allow-Credentials': 'true' } }
      );
    }

    const vipData = result.data;
    const isVIP = vipData?.isActive || false;

    // Récupérer les détails complets de l'abonnement VIP si actif
    let vipSubscription = null;
    if (isVIP) {
      vipSubscription = await prisma.vIPSubscription.findUnique({
        where: { userId },
      });
    }

    return NextResponse.json(
      {
        success: true,
        isVIP,
        vip: vipSubscription,
      },
      { status: 200, headers: { 'Access-Control-Allow-Origin': FRONTEND, 'Access-Control-Allow-Credentials': 'true' } }
    );
  } catch (error) {
    console.error("[VIP Status API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch VIP status" },
      { status: 500, headers: { 'Access-Control-Allow-Origin': FRONTEND, 'Access-Control-Allow-Credentials': 'true' } }
    );
  }
}
