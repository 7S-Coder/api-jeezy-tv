// app/api/user/vip-status/route.ts
// Obtenir le statut VIP de l'utilisateur

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { SubscriptionService } from "@/lib/services/SubscriptionService";

export async function GET(request: NextRequest) {
  try {
    // 1️⃣  SÉCURITÉ: Vérifier l'authentification
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // 2️⃣  Obtenir le statut VIP
    const result = await SubscriptionService.getVIPStatus(userId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        vipStatus: result.data,
        userId,
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
