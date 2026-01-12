// app/api/payment/create-order/route.ts
// Créer une commande PayPal côté serveur
// 
// ⚠️  SÉCURITÉ:
// 1. Vérifier l'authentification utilisateur
// 2. Créer l'ordre dans la BDD AVANT PayPal
// 3. Valider le montant
// 4. Retourner seulement l'ordre ID (pas le token)

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validateData, CreatePayPalOrderSchema } from "@/lib/validators";
import { Decimal } from "@prisma/client/runtime/library";

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

export async function POST(request: NextRequest) {
  try {
    // 1️⃣  SÉCURITÉ: Vérifier l'authentification
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // 2️⃣  Valider la requête
    const body = await request.json();
    const validation = validateData(CreatePayPalOrderSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error },
        { status: 400 }
      );
    }

    const { productType, amount, currency } = validation.data;

    // 3️⃣  Vérifier que le produit existe dans nos prix
    const productId =
      productType === "JEEZ"
        ? `jeez_${amount}_${(currency || "USD").toLowerCase()}`
        : `vip_${amount}_${(currency || "USD").toLowerCase()}`;

    const productPrice = PRODUCT_PRICES[productId];

    if (!productPrice) {
      return NextResponse.json(
        {
          error: "Product not found",
          available: Object.keys(PRODUCT_PRICES),
        },
        { status: 400 }
      );
    }

    // 4️⃣  Créer l'ordre PayPal dans la BDD
    // Cette étape enregistre l'intention d'achat avant de parler à PayPal
    const paypalOrder = await prisma.payPalOrder.create({
      data: {
        orderId: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId,
        amount: new Decimal(productPrice.amount),
        currency: productPrice.currency,
        status: "CREATED",
        payerEmail: session.user.email,
        intent: "CAPTURE",
      },
    });

    // 5️⃣  Préparer la réponse pour le client
    // Le client utilisera cet orderId pour appeler le bouton PayPal
    return NextResponse.json(
      {
        success: true,
        order: {
          id: paypalOrder.orderId,
          amount: productPrice.amount,
          currency: productPrice.currency,
          productId,
          description:
            productType === "JEEZ"
              ? `${amount} Jeez tokens`
              : `VIP ${amount} subscription`,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[PayPal Create Order] Error:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
