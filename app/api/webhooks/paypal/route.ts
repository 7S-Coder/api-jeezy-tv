// app/api/webhooks/paypal/route.ts
// Webhook PayPal - Traiter les notifications de paiement
// 
// ⚠️  SÉCURITÉ MAXIMALE:
// 1. Vérifier la signature du webhook
// 2. Valider les montants
// 3. Transactions atomiques avec Prisma
// 4. Idempotence (ne pas traiter 2x le même event_id)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { PaymentService } from "@/lib/services/PaymentService";
import { JeezService } from "@/lib/services/JeezService";
import { SubscriptionService } from "@/lib/services/SubscriptionService";
import { validateData, PayPalWebhookSchema } from "@/lib/validators";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * PRIX HARDCODÉS (synchronisés avec votre boutique PayPal)
 * À remplacer par une requête BDD en production
 */
const PRODUCT_PRICES: Record<string, { amount: number; currency: string }> = {
  "jeez_100_usd": { amount: 4.99, currency: "USD" },
  "jeez_500_usd": { amount: 19.99, currency: "USD" },
  "jeez_1000_usd": { amount: 34.99, currency: "USD" },
  "vip_monthly_usd": { amount: 9.99, currency: "USD" },
  "vip_quarterly_usd": { amount: 24.99, currency: "USD" },
  "vip_annual_usd": { amount: 79.99, currency: "USD" },
};

export async function POST(request: NextRequest) {
  try {
    // 1️⃣  Lire le body du webhook
    const body = await request.text();
    const webhookData = JSON.parse(body);

    console.log("[PayPal Webhook] Received event:", webhookData.event_type);

    // 2️⃣  SÉCURITÉ: Vérifier la signature du webhook
    const headers = {
      "PAYPAL-TRANSMISSION-ID":
        request.headers.get("PAYPAL-TRANSMISSION-ID") || "",
      "PAYPAL-TRANSMISSION-TIME":
        request.headers.get("PAYPAL-TRANSMISSION-TIME") || "",
      "PAYPAL-CERT-URL": request.headers.get("PAYPAL-CERT-URL") || "",
      "PAYPAL-AUTH-ALGO": request.headers.get("PAYPAL-AUTH-ALGO") || "",
      "PAYPAL-TRANSMISSION-SIG":
        request.headers.get("PAYPAL-TRANSMISSION-SIG") || "",
    };

    const signatureValid = await PaymentService.verifyPayPalSignature(
      process.env.PAYPAL_WEBHOOK_ID || "",
      body,
      headers
    );

    if (!signatureValid.success) {
      console.error("[PayPal Webhook] Invalid signature:", signatureValid.error);
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    // 3️⃣  Valider le format du webhook
    const webhookValidation = validateData(PayPalWebhookSchema, webhookData);
    if (!webhookValidation.success) {
      return NextResponse.json(
        { error: "Invalid webhook payload", details: webhookValidation.error },
        { status: 400 }
      );
    }

    const webhook = webhookValidation.data;

    // 4️⃣  IDEMPOTENCE: Vérifier si cet événement a déjà été traité
    // (utiliser event_id de PayPal pour identifier les doublons)
    const existingWebhook = await prisma.payPalOrder.findUnique({
      where: { orderId: webhook.resource.id },
    });

    if (existingWebhook?.webhookVerified) {
      // Événement déjà traité
      console.log(
        "[PayPal Webhook] Event already processed:",
        webhook.resource.id
      );
      return NextResponse.json(
        { status: "duplicate", orderId: webhook.resource.id },
        { status: 200 }
      );
    }

    // 5️⃣  Parser le webhook et extraire les infos clés
    const parsed = PaymentService.parseWebhook(webhook);
    if (!parsed.success || !parsed.data) {
      return NextResponse.json(
        { error: "Failed to parse webhook" },
        { status: 400 }
      );
    }

    const { orderId, status, amount, currency, customId } = parsed.data;

    // 6️⃣  Filtrer les événements importants
    // Nous ne traitons que: CHECKOUT.ORDER.COMPLETED
    if (webhook.event_type !== "CHECKOUT.ORDER.COMPLETED") {
      console.log(
        "[PayPal Webhook] Ignoring event type:",
        webhook.event_type
      );
      // Mettre à jour l'ordre pour tracker (optionnel)
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    // 7️⃣  Déterminer le type de produit acheté
    const productInfo = PaymentService.parseProductType(customId);

    if (productInfo.type === "UNKNOWN") {
      console.error("[PayPal Webhook] Unknown product type:", customId);
      return NextResponse.json(
        { error: "Unknown product type" },
        { status: 400 }
      );
    }

    // 8️⃣  SÉCURITÉ: Valider le montant exact
    const expectedPrice = PRODUCT_PRICES[customId || ""];
    if (!expectedPrice) {
      console.error("[PayPal Webhook] Price not found for:", customId);
      return NextResponse.json(
        { error: "Price mismatch" },
        { status: 400 }
      );
    }

    const amountValidation = PaymentService.validateOrderAmount(
      expectedPrice.amount,
      amount?.toString() || "0",
      expectedPrice.currency,
      currency || "USD"
    );

    if (!amountValidation.success) {
      console.error("[PayPal Webhook] Amount validation failed:", {
        expected: expectedPrice.amount,
        received: amount,
        expectedCurrency: expectedPrice.currency,
        receivedCurrency: currency,
      });
      // ⚠️  Ne PAS traiter si les montants ne correspondent pas (fraude?)
      return NextResponse.json(
        { error: "Amount validation failed" },
        { status: 400 }
      );
    }

    // 9️⃣  Récupérer l'utilisateur depuis l'ordre PayPal
    const paypalOrder = await prisma.payPalOrder.findUnique({
      where: { orderId },
    });

    if (!paypalOrder) {
      console.error("[PayPal Webhook] Order not found:", orderId);
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    const userId = paypalOrder.userId;

    // 🔟 TRANSACTION ATOMIQUE: Traiter le paiement
    // Toute l'opération doit réussir ou échouer ensemble
    await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // Marquer l'ordre comme vérifié
        await tx.payPalOrder.update({
          where: { orderId },
          data: {
            status: "COMPLETED",
            webhookVerified: true,
            completedAt: new Date(),
            rawWebhookData: JSON.stringify(webhook),
          },
        });

        if (productInfo.type === "JEEZ") {
          // === ACHAT DE JEEZ ===
          const transactionId = JeezService.generateTransactionId();

          // Ajouter les Jeez au portefeuille
          await JeezService.addJeez(
            userId,
            productInfo.amount || 0,
            transactionId,
            `PayPal order ${orderId} completed`
          );

          console.log(
            `[PayPal Webhook] Jeez purchase completed: ${productInfo.amount} Jeez for user ${userId}`
          );
        } else if (productInfo.type === "VIP") {
          // === ACHAT D'ABONNEMENT VIP ===
          const plan = productInfo.plan as "MONTHLY" | "QUARTERLY" | "ANNUAL";
          const transactionId = SubscriptionService.generateTransactionId();

          // Activer l'abonnement VIP
          await SubscriptionService.activateVIP(
            userId,
            plan,
            transactionId,
            orderId
          );

          console.log(
            `[PayPal Webhook] VIP subscription activated: ${plan} for user ${userId}`
          );
        }
      },
      {
        // Configuration de la transaction
        maxWait: 5000, // Timeout de 5s
        timeout: 10000, // Transaction timeout de 10s
      }
    );

    // ✅ Succès
    return NextResponse.json(
      {
        status: "processed",
        orderId,
        productType: productInfo.type,
        userId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[PayPal Webhook] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "WEBHOOK_ERROR" },
      { status: 500 }
    );
  }
}
