// app/api/user/wallet/route.ts
// Obtenir le solde Jeez de l'utilisateur

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { JeezService } from "@/lib/services/JeezService";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "");

export async function GET(request: NextRequest) {
  try {
    // 1️⃣  SÉCURITÉ: Vérifier l'authentification via JWT
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const decoded = await jwtVerify(token, secret);
    const userId = (decoded.payload as any).sub || (decoded.payload as any).id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
