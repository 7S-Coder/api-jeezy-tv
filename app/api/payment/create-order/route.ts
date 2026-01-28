// app/api/payment/create-order/route.ts
// Créer une commande PayPal côté serveur
// 
// ⚠️  SÉCURITÉ:
// 1. Vérifier l'authentification utilisateur
// 2. Créer l'ordre dans la BDD AVANT PayPal
// 3. Valider le montant
// 4. Retourner seulement l'ordre ID (pas le token)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { getTokenFromRequest } from "@/lib/auth/token-helper";
import { getJWTSecret } from "@/lib/auth/get-secret";

/**
 * PRIX SYNCHRONISÉS avec le webhook
 */
const PRODUCT_PRICES: Record<
  string,
  { amount: string; currency: string; productId: string }
> = {
  "jeez_100_usd": {
    amount: "4.99",
    currency: "USD",
    productId: "jeez_100_usd",
  },
  "jeez_500_usd": {
    amount: "19.99",
    currency: "USD",
    productId: "jeez_500_usd",
  },
  "jeez_1000_usd": {
    amount: "34.99",
    currency: "USD",
    productId: "jeez_1000_usd",
  },
  "vip_monthly_usd": {
    amount: "9.99",
    currency: "USD",
    productId: "vip_monthly_usd",
  },
  "vip_quarterly_usd": {
    amount: "24.99",
    currency: "USD",
    productId: "vip_quarterly_usd",
  },
  "vip_annual_usd": {
    amount: "79.99",
    currency: "USD",
    productId: "vip_annual_usd",
  },
};

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
    // 1️⃣  SÉCURITÉ: Vérifier l'authentification JWT (du header ou du cookie)
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
    } catch {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const userId = decoded.userId;

    // 2️⃣  Valider la requête
    const body = await request.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json(
        { error: "Product ID required" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const productPrice = PRODUCT_PRICES[productId];

    if (!productPrice) {
      return NextResponse.json(
        {
          error: "Product not found",
          available: Object.keys(PRODUCT_PRICES),
        },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // 3️⃣  Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // 4️⃣  Créer l'ordre PayPal dans la BDD
    const paypalOrder = await prisma.payPalOrder.create({
      data: {
        orderId: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId,
        amount: new (require("@prisma/client").Decimal)(productPrice.amount),
        currency: productPrice.currency,
        status: "CREATED",
        payerEmail: user.email,
        intent: "CAPTURE",
      },
    });

    // 5️⃣  Retourner l'ordre créé
    return NextResponse.json(
      {
        success: true,
        order: {
          id: paypalOrder.orderId,
          amount: productPrice.amount,
          currency: productPrice.currency,
          productId,
          description: productId.includes("jeez")
            ? `${productId.split("_")[1]} Jeez tokens`
            : `VIP subscription`,
        },
      },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error) {
    console.error("[PayPal Create Order] Error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
