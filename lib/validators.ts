// lib/validators.ts
// Schémas de validation Zod pour typage strict et sécurité

import { z } from "zod";

/**
 * ⚠️  SÉCURITÉ:
 * 1. Zod valide strictement les données entrantes
 * 2. Prévient les injections et données malformées
 * 3. Type-safe pour toute l'application
 */

// ============ PAIEMENT PAYPAL ============

export const CreatePayPalOrderSchema = z.object({
  productType: z.enum(["JEEZ", "VIP"]),
  amount: z.number().positive().max(999999),
  currency: z.string().default("USD"),
  description: z.string().optional(),
});

export const PayPalWebhookSchema = z.object({
  id: z.string(),
  event_type: z.string(),
  create_time: z.string(),
  resource: z.object({
    id: z.string(),
    status: z.string(),
    amount: z
      .object({
        value: z.string(),
        currency_code: z.string(),
      })
      .optional(),
    custom_id: z.string().optional(),
  }),
});

// ============ TRANSACTIONS ============

export const JeezPurchaseSchema = z.object({
  amount: z.number().positive().min(100).max(1000000),
  currency: z.string().default("USD"),
});

export const VIPPurchaseSchema = z.object({
  plan: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]),
  currency: z.string().default("USD"),
});

// ============ UTILISATEUR ============

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  image: z.string().url().optional(),
});

// ============ VIP ============

export const VIPStatusSchema = z.object({
  userId: z.string(),
});

// ============ TYPE EXPORTS ============

export type CreatePayPalOrder = z.infer<typeof CreatePayPalOrderSchema>;
export type PayPalWebhook = z.infer<typeof PayPalWebhookSchema>;
export type JeezPurchase = z.infer<typeof JeezPurchaseSchema>;
export type VIPPurchase = z.infer<typeof VIPPurchaseSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;

/**
 * Helper pour valider et parser les données
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);

  if (!result.success) {
    console.warn("[Validation] Error:", result.error.errors);
    const message = result.error.errors
      .map((err) => `${err.path.join(".")}: ${err.message}`)
      .join(", ");
    return { success: false, error: message };
  }

  return { success: true, data: result.data };
}
