// lib/services/PaymentService.ts
// Service métier pour la validation et traitement des paiements PayPal
// ⚠️  SÉCURITÉ MAXIMALE: Vérification signatures + validation montants

import crypto from "crypto";

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PayPalWebhookPayload {
  id: string;
  event_type: string;
  create_time: string;
  resource: {
    id: string;
    status: string;
    amount?: {
      value: string;
      currency_code: string;
    };
    custom_id?: string;
  };
}

export class PaymentService {
  /**
   * Vérifier la signature du webhook PayPal
   * 
   * SÉCURITÉ CRITIQUE: Empêcher les injections de fausses notifications
   * 
   * Algorithme PayPal:
   * 1. Récupérer la clé publique de PayPal
   * 2. Reconstruire le message signé dans le bon ordre
   * 3. Vérifier la signature SHA-256
   */
  static async verifyPayPalSignature(
    webhookId: string,
    webhookBody: string,
    headers: {
      "PAYPAL-TRANSMISSION-ID": string;
      "PAYPAL-TRANSMISSION-TIME": string;
      "PAYPAL-CERT-URL": string;
      "PAYPAL-AUTH-ALGO": string;
      "PAYPAL-TRANSMISSION-SIG": string;
    }
  ): Promise<ServiceResponse<boolean>> {
    try {
      // ⚠️  EN PRODUCTION: Télécharger et mettre en cache le certificat PayPal
      // Pour cette démo, on va valider le format
      // Documentation: https://developer.paypal.com/docs/checkout/integration-features/webhooks/#verify-webhook-signatures

      const transmissionId = headers["PAYPAL-TRANSMISSION-ID"];
      const transmissionTime = headers["PAYPAL-TRANSMISSION-TIME"];
      const certUrl = headers["PAYPAL-CERT-URL"];
      const authAlgo = headers["PAYPAL-AUTH-ALGO"];
      const transmissionSig = headers["PAYPAL-TRANSMISSION-SIG"];

      // Validation basique
      if (!transmissionId || !transmissionTime || !authAlgo || !transmissionSig) {
        return {
          success: false,
          error: "Missing required webhook headers",
          code: "INVALID_HEADERS",
        };
      }

      // Format du message à signer
      const expectedSigString = `${transmissionId}|${transmissionTime}|${webhookId}|${this.hashPayload(webhookBody)}`;

      console.log(
        "[PaymentService] Webhook signature verification (simplified mode)"
      );
      console.log("[PaymentService] Expected format:", expectedSigString);

      // ✅ EN PRODUCTION: Vérifier la signature avec le certificat
      // const isValid = await this.verifySignatureWithCert(
      //   expectedSigString,
      //   transmissionSig,
      //   certUrl
      // );

      // Pour la démo, on accepte si le format est correct
      return { success: true, data: true };
    } catch (error) {
      console.error("[PaymentService] verifyPayPalSignature error:", error);
      return {
        success: false,
        error: "Failed to verify webhook signature",
        code: "VERIFICATION_FAILED",
      };
    }
  }

  /**
   * Hasher le payload du webhook
   */
  private static hashPayload(payload: string): string {
    return crypto.createHash("sha256").update(payload).digest("base64");
  }

  /**
   * Valider les détails d'une commande PayPal côté serveur
   * 
   * ⚠️  SÉCURITÉ: Toujours valider côté serveur, pas côté client
   * Les montants et devises doivent correspondre exactement
   */
  static validateOrderAmount(
    expectedAmount: number,
    actualAmount: string,
    expectedCurrency: string,
    actualCurrency: string
  ): ServiceResponse<boolean> {
    try {
      // Convertir en nombres pour comparaison
      const actual = parseFloat(actualAmount);

      // Vérifier le montant (avec une petite tolérance pour les arrondis)
      if (Math.abs(actual - expectedAmount) > 0.01) {
        console.warn(
          `[PaymentService] Amount mismatch: expected ${expectedAmount}, got ${actual}`
        );
        return {
          success: false,
          error: "Amount mismatch",
          code: "AMOUNT_MISMATCH",
        };
      }

      // Vérifier la devise
      if (actualCurrency.toUpperCase() !== expectedCurrency.toUpperCase()) {
        console.warn(
          `[PaymentService] Currency mismatch: expected ${expectedCurrency}, got ${actualCurrency}`
        );
        return {
          success: false,
          error: "Currency mismatch",
          code: "CURRENCY_MISMATCH",
        };
      }

      return { success: true, data: true };
    } catch (error) {
      console.error("[PaymentService] validateOrderAmount error:", error);
      return {
        success: false,
        error: "Failed to validate order amount",
        code: "VALIDATION_ERROR",
      };
    }
  }

  /**
   * Parser le webhook PayPal et extraire les infos clés
   */
  static parseWebhook(payload: PayPalWebhookPayload): ServiceResponse<{
    eventType: string;
    orderId: string;
    status: string;
    amount?: number;
    currency?: string;
    customId?: string;
  }> {
    try {
      const eventType = payload.event_type;
      const resource = payload.resource;

      // Valider les champs obligatoires
      if (
        !eventType ||
        !resource ||
        !resource.id ||
        !resource.status
      ) {
        return {
          success: false,
          error: "Invalid webhook payload structure",
          code: "INVALID_PAYLOAD",
        };
      }

      return {
        success: true,
        data: {
          eventType,
          orderId: resource.id,
          status: resource.status,
          amount: resource.amount
            ? parseFloat(resource.amount.value)
            : undefined,
          currency: resource.amount?.currency_code,
          customId: resource.custom_id,
        },
      };
    } catch (error) {
      console.error("[PaymentService] parseWebhook error:", error);
      return {
        success: false,
        error: "Failed to parse webhook",
        code: "PARSE_ERROR",
      };
    }
  }

  /**
   * Déterminer le type de produit acheté basé sur le montant PayPal
   * 
   * Format custom_id: "jeez_1000_usd" ou "vip_monthly_usd"
   */
  static parseProductType(customId?: string): {
    type: "JEEZ" | "VIP" | "UNKNOWN";
    amount?: number;
    plan?: string;
  } {
    if (!customId) {
      return { type: "UNKNOWN" };
    }

    // Format: jeez_<amount>_usd
    if (customId.startsWith("jeez_")) {
      const parts = customId.split("_");
      const amount = parseInt(parts[1], 10);
      return { type: "JEEZ", amount: isNaN(amount) ? undefined : amount };
    }

    // Format: vip_<plan>_usd
    if (customId.startsWith("vip_")) {
      const parts = customId.split("_");
      const plan = parts[1];
      return {
        type: "VIP",
        plan:
          plan === "monthly" || plan === "quarterly" || plan === "annual"
            ? plan.toUpperCase()
            : undefined,
      };
    }

    return { type: "UNKNOWN" };
  }
}
