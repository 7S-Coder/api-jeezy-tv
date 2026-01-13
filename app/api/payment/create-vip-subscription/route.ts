// app/api/payment/create-vip-subscription/route.ts
// Créer un abonnement VIP avec PayPal

import { prisma } from "@/lib/prisma";
import { createPayPalPlan, createPayPalSubscription } from "@/lib/paypal-helpers";
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
 * POST /api/payment/create-vip-subscription
 * Créer un lien d'abonnement VIP PayPal
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
    const { plan } = body;

    if (!plan) {
      return NextResponse.json(
        { error: "Plan required (vip_monthly or vip_annual)" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Mapper les plans aux données PayPal
    const planConfig: Record<string, { name: string; price: string; interval: string }> = {
      vip_monthly: { name: "VIP Monthly", price: "3.00", interval: "MONTH" },
      vip_annual: { name: "VIP Annual", price: "23.00", interval: "YEAR" },
    };

    const config = planConfig[plan];
    if (!config) {
      return NextResponse.json(
        { error: "Invalid plan. Use vip_monthly or vip_annual" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    try {
      // Créer le plan PayPal
      const planId = await createPayPalPlan({
        name: config.name,
        description: `${config.name} - Jeezy TV VIP Subscription`,
        price: config.price,
        interval: config.interval as 'MONTH' | 'YEAR',
        currency: 'EUR',
      });

      // Créer la souscription PayPal
      const { subscriptionId, approveUrl } = await createPayPalSubscription({
        planId,
        subscriberEmail: user.email,
        subscriberName: user.name || 'User',
        returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payment/return`,
      });

      const subscriptionData = {
        subscriptionId,
        planId,
        plan,
        planName: config.name,
        price: config.price,
        interval: config.interval,
        userId: user.id,
        userEmail: user.email,
        approveUrl,
        status: "CREATED",
        message: "Abonnement créé. Cliquez sur approveUrl pour approuver chez PayPal.",
      };

      console.log("[create-vip-subscription] Subscription created:", subscriptionData);

      return NextResponse.json(subscriptionData, {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    } catch (paypalError) {
      console.error("[create-vip-subscription] PayPal Error:", paypalError);
      return NextResponse.json(
        { error: String(paypalError) },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }
  } catch (error) {
    console.error("[create-vip-subscription] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
