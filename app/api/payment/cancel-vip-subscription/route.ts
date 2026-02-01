// app/api/payment/cancel-vip-subscription/route.ts
// Annuler un abonnement VIP

import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getTokenFromRequest } from "@/lib/auth/token-helper";
import { getJWTSecret } from "@/lib/auth/get-secret";

export async function OPTIONS(request: NextRequest) {
  const FRONTEND = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": FRONTEND,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
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
      const FRONTEND = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401, headers: { "Access-Control-Allow-Origin": FRONTEND, "Access-Control-Allow-Credentials": "true" } }
      );
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, getJWTSecret());
    } catch (err) {
      console.error("[cancel-vip-subscription] JWT verify error:", err);
      const FRONTEND = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401, headers: { "Access-Control-Allow-Origin": FRONTEND, "Access-Control-Allow-Credentials": "true" } }
      );
    }

    console.log("[cancel-vip-subscription] Decoded token:", decoded);
    const userId = decoded.sub || decoded.id || decoded.userId;
    const email = decoded.email;
    console.log("[cancel-vip-subscription] Extracted userId:", userId, "email:", email);

    // Si pas d'ID, chercher par email
    if (!userId && !email) {
      const FRONTEND = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
      return NextResponse.json(
        { error: "No user identification in token" },
        { status: 401, headers: { "Access-Control-Allow-Origin": FRONTEND, "Access-Control-Allow-Credentials": "true" } }
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
      const FRONTEND = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: { "Access-Control-Allow-Origin": FRONTEND, "Access-Control-Allow-Credentials": "true" } }
      );
    }

    // Vérifier qu'il a une subscription VIP active
    const vipSubscription = await prisma.vIPSubscription.findUnique({
      where: { userId: user.id },
    });

    if (!vipSubscription || !vipSubscription.isActive) {
      console.log("[cancel-vip-subscription] No active VIP subscription for user:", user.id);
      const FRONTEND = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
      return NextResponse.json(
        { error: "No active VIP subscription found" },
        { status: 404, headers: { "Access-Control-Allow-Origin": FRONTEND, "Access-Control-Allow-Credentials": "true" } }
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

    const FRONTEND = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
    return NextResponse.json(
      {
        success: true,
        message: "VIP subscription cancelled",
        vipStatus: cancelledVip,
      },
      {
        status: 200,
        headers: { "Access-Control-Allow-Origin": FRONTEND, "Access-Control-Allow-Credentials": "true" },
      }
    );
  } catch (error) {
    console.error("[cancel-vip-subscription] Error:", error);
    const FRONTEND = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Access-Control-Allow-Origin": FRONTEND, "Access-Control-Allow-Credentials": "true" } }
    );
  }
}
