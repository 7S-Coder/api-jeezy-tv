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
    const HANDLED_EVENTS = [
      "CHECKOUT.ORDER.COMPLETED",           // Commandes one-shot (Jeez)
      "BILLING.SUBSCRIPTION.ACTIVATED",     // Abonnement VIP activé
      "BILLING.SUBSCRIPTION.RENEWED",       // Renouvellement automatique
      "PAYMENT.SALE.COMPLETED",             // Paiement récurrent reçu
    ];

    if (!HANDLED_EVENTS.includes(webhook.event_type)) {
      console.log(
        "[PayPal Webhook] Ignoring event type:",
        webhook.event_type
      );
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    // ================================================================
    // 🆕 GESTION DES ABONNEMENTS (BILLING.SUBSCRIPTION.*)
    // ================================================================
    if (
      webhook.event_type === "BILLING.SUBSCRIPTION.ACTIVATED" ||
      webhook.event_type === "BILLING.SUBSCRIPTION.RENEWED" ||
      webhook.event_type === "PAYMENT.SALE.COMPLETED"
    ) {
      const resource = webhook.resource as any;
      const subscriptionId = resource.id;

      // Extraire le custom_id qui contient "userId|plan"
      // Pour PAYMENT.SALE.COMPLETED, le custom_id peut être dans billing_agreement_id
      let subCustomId: string | undefined = resource.custom_id;
      let planId: string | undefined = resource.plan_id;

      // Si c'est un PAYMENT.SALE.COMPLETED, on doit chercher la subscription associée
      if (webhook.event_type === "PAYMENT.SALE.COMPLETED" && !subCustomId) {
        console.log("[PayPal Webhook] PAYMENT.SALE.COMPLETED - billing_agreement_id:", resource.billing_agreement_id);
        // Le custom_id n'est pas dans PAYMENT.SALE, on skip la vérification
        // et on cherche via l'email du payeur ou subscription existante
        const payerEmail = resource.payer?.email_address;
        if (payerEmail) {
          const userByEmail = await prisma.user.findUnique({ where: { email: payerEmail } });
          if (userByEmail) {
            const existingSub = await prisma.vIPSubscription.findUnique({ where: { userId: userByEmail.id } });
            if (existingSub) {
              // Renouvellement d'un abonnement existant
              const plan = existingSub.planType as "MONTHLY" | "QUARTERLY" | "ANNUAL";
              const transactionId = SubscriptionService.generateTransactionId();
              await SubscriptionService.activateVIP(userByEmail.id, plan, transactionId, subscriptionId);
              console.log(`[PayPal Webhook] VIP renewed via PAYMENT.SALE for user ${userByEmail.id}`);
              return NextResponse.json({ status: "processed", type: "vip_renewal", userId: userByEmail.id }, { status: 200 });
            }
          }
        }
        console.log("[PayPal Webhook] PAYMENT.SALE.COMPLETED - could not map to user, ignoring");
        return NextResponse.json({ status: "ignored", reason: "no_user_mapping" }, { status: 200 });
      }

      if (!subCustomId) {
        console.error("[PayPal Webhook] No custom_id in subscription event:", subscriptionId);
        return NextResponse.json({ error: "Missing custom_id" }, { status: 400 });
      }

      // Parser le custom_id: format "userId|plan" (ex: "cmkexc52j...|vip_monthly")
      const parts = subCustomId.split("|");
      const userId = parts[0];
      const planRaw = parts[1]; // ex: "vip_monthly" ou "vip_annual"

      if (!userId) {
        console.error("[PayPal Webhook] Invalid custom_id format:", subCustomId);
        return NextResponse.json({ error: "Invalid custom_id" }, { status: 400 });
      }

      // Vérifier que l'utilisateur existe
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        console.error("[PayPal Webhook] User not found:", userId);
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Déterminer le plan VIP
      let plan: "MONTHLY" | "QUARTERLY" | "ANNUAL" = "MONTHLY";
      if (planRaw?.includes("annual") || planRaw?.includes("year")) {
        plan = "ANNUAL";
      } else if (planRaw?.includes("quarterly")) {
        plan = "QUARTERLY";
      }

      // Activer/renouveler le VIP
      const transactionId = SubscriptionService.generateTransactionId();
      const result = await SubscriptionService.activateVIP(userId, plan, transactionId, subscriptionId);

      if (!result.success) {
        console.error("[PayPal Webhook] Failed to activate VIP:", result.error);
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      console.log(`[PayPal Webhook] VIP ${plan} activated for user ${userId} via ${webhook.event_type}`);
      return NextResponse.json(
        { status: "processed", type: "vip_subscription", plan, userId },
        { status: 200 }
      );
    }

    // ================================================================
    // GESTION DES COMMANDES ONE-SHOT (CHECKOUT.ORDER.COMPLETED)
    // ================================================================

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

    // 🔟 TRANSACTION ATOMIQUE: Traiter le paiement (one-shot)
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
          // === ACHAT D'ABONNEMENT VIP (one-shot) ===
          const plan = productInfo.plan as "MONTHLY" | "QUARTERLY" | "ANNUAL";
          const transactionId = SubscriptionService.generateTransactionId();

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
        maxWait: 5000,
        timeout: 10000,
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
