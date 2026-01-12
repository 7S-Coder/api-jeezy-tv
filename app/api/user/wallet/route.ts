// app/api/user/wallet/route.ts
// Obtenir le solde Jeez de l'utilisateur

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { JeezService } from "@/lib/services/JeezService";

export async function GET(request: NextRequest) {
  try {
    // 1️⃣  SÉCURITÉ: Vérifier l'authentification
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // 2️⃣  Obtenir le solde
    const result = await JeezService.getBalance(userId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        balance: result.data,
        userId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Wallet API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch wallet" },
      { status: 500 }
    );
  }
}
