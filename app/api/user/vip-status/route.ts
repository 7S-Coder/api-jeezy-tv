// app/api/user/vip-status/route.ts
// Obtenir le statut VIP de l'utilisateur

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SubscriptionService } from "@/lib/services/SubscriptionService";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest } from "@/lib/auth/token-helper";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "");

export async function GET(request: NextRequest) {
  try {
    // 1️⃣  SÉCURITÉ: Vérifier l'authentification via JWT (du header ou du cookie)
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await jwtVerify(token, secret);
    const userId = (decoded.payload as any).sub || (decoded.payload as any).id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2️⃣  Obtenir le statut VIP
    const result = await SubscriptionService.getVIPStatus(userId);

    if (!result.success) {
      return NextResponse.json(
        { isVIP: false, vip: null },
        { status: 200 }
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
      { status: 200 }
    );
  } catch (error) {
    console.error("[VIP Status API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch VIP status" },
      { status: 500 }
    );
  }
}
