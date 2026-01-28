// app/api/payment/toggle-auto-renewal/route.ts
// Toggle auto-renewal status for VIP subscription

import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getTokenFromRequest } from "@/lib/auth/token-helper";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "");

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

export async function POST(request: NextRequest) {
  try {
    // 1️⃣  SÉCURITÉ: Vérifier l'authentification
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    let decoded: any;
    try {
      const result = await jwtVerify(token, secret);
      decoded = result.payload;
    } catch {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const userId = (decoded as any).sub || (decoded as any).id;
    if (!userId) {
      return NextResponse.json(
        { error: "User ID not found in token" },
        { status: 401, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const body = await request.json();
    const { autoRenewal } = body;

    if (typeof autoRenewal !== "boolean") {
      return NextResponse.json(
        { error: "autoRenewal must be a boolean" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // 2️⃣  Vérifier que l'utilisateur a une subscription VIP active
    const vipSubscription = await prisma.vIPSubscription.findUnique({
      where: { userId },
    });

    if (!vipSubscription) {
      return NextResponse.json(
        { error: "No active VIP subscription found" },
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    if (!vipSubscription.isActive) {
      return NextResponse.json(
        { error: "VIP subscription is not active" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // 3️⃣  Mettre à jour le statut auto-renewal
    const updated = await prisma.vIPSubscription.update({
      where: { userId },
      data: {
        autoRenew: autoRenewal,
      },
    });

    console.log(`[toggle-auto-renewal] User ${userId} auto-renewal: ${autoRenewal}`);

    return NextResponse.json(
      {
        success: true,
        message: autoRenewal ? "Auto-renewal activated" : "Auto-renewal deactivated",
        autoRenewal: updated.autoRenew,
      },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error) {
    console.error("[toggle-auto-renewal] Error:", error);
    return NextResponse.json(
      { error: "Failed to update auto-renewal status" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
