// app/api/payment/cancel-vip-subscription/route.ts
// Annuler un abonnement VIP

import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getTokenFromRequest } from "@/lib/auth/token-helper";
import { getJWTSecret } from "@/lib/auth/get-secret";

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
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, getJWTSecret());
    } catch (err) {
      console.error("[cancel-vip-subscription] JWT verify error:", err);
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    console.log("[cancel-vip-subscription] Decoded token:", decoded);
    const userId = decoded.sub || decoded.id || decoded.userId;
    const email = decoded.email;
    console.log("[cancel-vip-subscription] Extracted userId:", userId, "email:", email);

    // Si pas d'ID, chercher par email
    if (!userId && !email) {
      return NextResponse.json(
        { error: "No user identification in token" },
        { status: 401, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Vérifier que l'utilisateur existe et a une subscription VIP
    const user = await prisma.user.findUnique({
      where: userId ? { id: userId } : { email: email! },
      select: { id: true },
    });

    console.log("[cancel-vip-subscription] User found:", user);

    if (!user) {
      console.log("[cancel-vip-subscription] User not found with", userId ? "id" : "email", ":", userId || email);
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Vérifier qu'il a une subscription VIP active
    const vipSubscription = await prisma.vIPSubscription.findUnique({
      where: { userId: user.id },
    });

    if (!vipSubscription || !vipSubscription.isActive) {
      console.log("[cancel-vip-subscription] No active VIP subscription for user:", user.id);
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
