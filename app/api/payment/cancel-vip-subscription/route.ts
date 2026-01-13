// app/api/payment/cancel-vip-subscription/route.ts
// Annuler un abonnement VIP

import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

/**
 * POST /api/payment/cancel-vip-subscription
 * Annuler un abonnement VIP
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const token = authHeader.slice(7);
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET || "test-secret-key");
    } catch {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const body = await request.json();
    const { subscriptionId } = body;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "Subscription ID required" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, vipStatus: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    if (!user.vipStatus) {
      return NextResponse.json(
        { error: "No active VIP subscription found" },
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Annuler le VIP
    const cancelledVip = await prisma.vIPSubscription.update({
      where: { userId: user.id },
      data: {
        isActive: false,
        status: "CANCELLED",
        expiresAt: new Date(), // Expire immédiatement
      },
    });

    // Mettre à jour le rôle de l'utilisateur à USER
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "USER" },
    });

    console.log("[cancel-vip-subscription] VIP cancelled:", cancelledVip);

    return NextResponse.json(
      {
        success: true,
        message: "VIP subscription cancelled",
        vipStatus: cancelledVip,
      },
      {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (error) {
    console.error("[cancel-vip-subscription] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
