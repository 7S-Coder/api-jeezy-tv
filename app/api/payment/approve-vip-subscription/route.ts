// app/api/payment/approve-vip-subscription/route.ts
// Approuver et activer un abonnement VIP

import { prisma } from "@/lib/prisma";
import { createTransaction, completeTransaction } from "@/lib/transaction-helpers";
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { Decimal } from "@prisma/client/runtime/library";

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
 * POST /api/payment/approve-vip-subscription
 * Approuver et activer un abonnement VIP
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
      select: { id: true, email: true, vipStatus: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Calculer les dates d'expiration
    const startDate = new Date();
    const endDate = new Date(startDate);
    
    // Déterminer la durée selon le plan
    if (subscriptionId.includes("annual") || subscriptionId.includes("year")) {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Créer ou mettre à jour le statut VIP
    const vipStatus = await prisma.vIPSubscription.upsert({
      where: { userId: user.id },
      update: {
        plan: subscriptionId.includes("annual") ? "annual" : "monthly",
        subscriptionId,
        startDate,
        expiresAt: endDate,
        isActive: true,
        status: "ACTIVE",
      },
      create: {
        userId: user.id,
        plan: subscriptionId.includes("annual") ? "annual" : "monthly",
        subscriptionId,
        startDate,
        expiresAt: endDate,
        isActive: true,
        status: "ACTIVE",
      },
    });

    // Déterminer le montant selon le plan
    const isAnnual = subscriptionId.includes("annual") || subscriptionId.includes("year");
    const amount = isAnnual ? 23 : 3;
    const planName = isAnnual ? "VIP Annual" : "VIP Monthly";

    // Créer une transaction d'enregistrement
    const transactionId = `vip_${subscriptionId}_${Date.now()}`;
    await createTransaction({
      userId: user.id,
      transactionId,
      transactionType: "VIP_SUBSCRIPTION",
      amount,
      status: "COMPLETED",
      description: `Subscription to ${planName} plan`,
      paymentMethod: "PAYPAL",
      orderId: subscriptionId,
    });

    // Mettre à jour le rôle de l'utilisateur à VIP
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "VIP" },
    });

    console.log("[approve-vip-subscription] VIP activated:", vipStatus);

    return NextResponse.json(
      {
        success: true,
        message: "VIP subscription activated!",
        vipStatus,
      },
      {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (error) {
    console.error("[approve-vip-subscription] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
