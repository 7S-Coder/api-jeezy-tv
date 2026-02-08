// app/api/payment/create-vip-subscription/route.ts
// Créer un abonnement VIP avec PayPal

import { prisma } from "@/lib/prisma";
import { createPayPalSubscription } from "@/lib/paypal-helpers";
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getTokenFromRequest } from "@/lib/auth/token-helper";
import { getJWTSecret } from "@/lib/auth/get-secret";

// PayPal VIP Plan IDs (created with updated prices)
// Monthly: €2.99/month, Annual: €33.99/year
// Prefer environment variables so we can change plans without editing code.
const VIP_MONTHLY_PLAN_ID = process.env.PAYPAL_VIP_MONTHLY_PLAN_ID || process.env.PAYPAL_MONTHLY_PLAN_ID || 'P-2MC93743TL870722ANFV2JRQ';
const VIP_ANNUAL_PLAN_ID = process.env.PAYPAL_VIP_ANNUAL_PLAN_ID || process.env.PAYPAL_ANNUAL_PLAN_ID || 'P-9EB60680XC860510TNFV2JRQ';

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
 * POST /api/payment/create-vip-subscription
 * Créer un lien d'abonnement VIP PayPal
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
    } catch {
      const FRONTEND = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401, headers: { "Access-Control-Allow-Origin": FRONTEND, "Access-Control-Allow-Credentials": "true" } }
      );
    }

    const body = await request.json();
    const { plan } = body;

    if (!plan) {
      const FRONTEND = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
      return NextResponse.json(
        { error: "Plan required (vip_monthly or vip_annual)" },
        { status: 400, headers: { "Access-Control-Allow-Origin": FRONTEND, "Access-Control-Allow-Credentials": "true" } }
      );
    }

    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      const FRONTEND = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: { "Access-Control-Allow-Origin": FRONTEND, "Access-Control-Allow-Credentials": "true" } }
      );
    }

    // Mapper les plans aux IDs PayPal et données
    const planConfig: Record<string, { planId: string; name: string; price: string; interval: string }> = {
      vip_monthly: { planId: VIP_MONTHLY_PLAN_ID, name: "VIP Monthly", price: "2.99", interval: "MONTH" },
      vip_annual: { planId: VIP_ANNUAL_PLAN_ID, name: "VIP Annual", price: "33.99", interval: "YEAR" },
    };

    const config = planConfig[plan];
    if (!config) {
      const FRONTEND = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
      return NextResponse.json(
        { error: "Invalid plan. Use vip_monthly or vip_annual" },
        { status: 400, headers: { "Access-Control-Allow-Origin": FRONTEND, "Access-Control-Allow-Credentials": "true" } }
      );
    }

    try {
      // Utiliser le plan PayPal existant (pas de création dynamique)
      const planId = config.planId;

      // Créer la souscription PayPal
      if (!user.email) {
        const FRONTEND = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
        return NextResponse.json(
          { error: "User email is required" },
          { status: 400, headers: { "Access-Control-Allow-Origin": FRONTEND, "Access-Control-Allow-Credentials": "true" } }
        );
      }

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


      const FRONTEND = process.env.NEXT_PUBLIC_APP_URL || '';
      return NextResponse.json(subscriptionData, {
        status: 200,
        headers: { "Access-Control-Allow-Origin": FRONTEND, "Access-Control-Allow-Credentials": "true" },
      });
    } catch (paypalError) {
      console.error("[create-vip-subscription] PayPal Error:", paypalError);
      const FRONTEND = process.env.NEXT_PUBLIC_APP_URL || '';
      return NextResponse.json(
        { error: String(paypalError) },
        { status: 400, headers: { "Access-Control-Allow-Origin": FRONTEND, "Access-Control-Allow-Credentials": "true" } }
      );
    }
  } catch (error) {
    console.error("[create-vip-subscription] Error:", error);
    const FRONTEND = process.env.NEXT_PUBLIC_APP_URL || '';
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Access-Control-Allow-Origin": FRONTEND, "Access-Control-Allow-Credentials": "true" } }
    );
  }
}
