// lib/utils/test-helpers.ts
// Utilitaires pour tester l'API

export interface TestPayload {
  productType: "JEEZ" | "VIP";
  amount: number;
  currency?: string;
}

export interface TestWebhookPayload {
  id: string;
  event_type: string;
  create_time: string;
  resource: {
    id: string;
    status: string;
    amount: {
      value: string;
      currency_code: string;
    };
    custom_id: string;
  };
}

/**
 * Générer un payload de test PayPal pour les webhooks
 */
export function generateTestWebhookPayload(
  orderId: string,
  productId: string,
  amount: string
): TestWebhookPayload {
  return {
    id: `WH-${Date.now()}`,
    event_type: "CHECKOUT.ORDER.COMPLETED",
    create_time: new Date().toISOString(),
    resource: {
      id: orderId,
      status: "COMPLETED",
      amount: {
        value: amount,
        currency_code: "USD",
      },
      custom_id: productId,
    },
  };
}

/**
 * Générer des headers de webhook simulés
 * ⚠️  IMPORTANT: Ces headers sont SIMULÉS pour les tests
 * En production, PayPal les fournit avec de vraies signatures
 */
export function generateTestWebhookHeaders(webhookId: string): Record<
  string,
  string
> {
  return {
    "PAYPAL-TRANSMISSION-ID": `TID-${Date.now()}`,
    "PAYPAL-TRANSMISSION-TIME": new Date().toISOString(),
    "PAYPAL-CERT-URL": "https://api.sandbox.paypal.com/cert/fake",
    "PAYPAL-AUTH-ALGO": "SHA256withRSA",
    "PAYPAL-TRANSMISSION-SIG": "FAKE_SIGNATURE_FOR_TESTING",
  };
}

/**
 * Générer un ID de commande PayPal
 */
export function generateOrderId(): string {
  return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Générer un ID de transaction unique (idempotence)
 */
export function generateTransactionId(prefix: string = "test"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Simuler l'attente du serveur
 */
export async function delay(ms: number = 1000): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
