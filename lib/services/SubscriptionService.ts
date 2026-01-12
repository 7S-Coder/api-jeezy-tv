// lib/services/SubscriptionService.ts
// Service métier pour gérer les abonnements VIP

import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import crypto from "crypto";

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface VIPStatus {
  isActive: boolean;
  expiresAt: Date | null;
  planType: string | null;
}

export class SubscriptionService {
  /**
   * Vérifier le statut VIP de l'utilisateur
   */
  static async getVIPStatus(userId: string): Promise<ServiceResponse<VIPStatus>> {
    try {
      const subscription = await prisma.vIPSubscription.findUnique({
        where: { userId },
      });

      if (!subscription) {
        return {
          success: true,
          data: {
            isActive: false,
            expiresAt: null,
            planType: null,
          },
        };
      }

      const isActive =
        subscription.isActive && new Date() < subscription.expiresAt;

      return {
        success: true,
        data: {
          isActive,
          expiresAt: subscription.expiresAt,
          planType: subscription.planType,
        },
      };
    } catch (error) {
      console.error("[SubscriptionService] getVIPStatus error:", error);
      return {
        success: false,
        error: "Failed to fetch VIP status",
        code: "DB_ERROR",
      };
    }
  }

  /**
   * Activer/Renouveler un abonnement VIP
   * 
   * SÉCURITÉ CRITIQUE:
   * 1. Transaction atomique pour mettre à jour User role + VIPSubscription
   * 2. ID unique pour idempotence
   * 3. Horodatage précis
   */
  static async activateVIP(
    userId: string,
    planType: "MONTHLY" | "QUARTERLY" | "ANNUAL",
    transactionId: string,
    paypalOrderId?: string
  ): Promise<
    ServiceResponse<{
      userId: string;
      expiresAt: Date;
      planType: string;
    }>
  > {
    try {
      // Calculer la date d'expiration
      const now = new Date();
      const expiresAt = new Date(now);

      switch (planType) {
        case "MONTHLY":
          expiresAt.setMonth(expiresAt.getMonth() + 1);
          break;
        case "QUARTERLY":
          expiresAt.setMonth(expiresAt.getMonth() + 3);
          break;
        case "ANNUAL":
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          break;
      }

      const result = await prisma.$transaction(async (tx) => {
        // 1️⃣  Vérifier l'idempotence
        const existingTransaction = await tx.transaction.findUnique({
          where: { transactionId },
        });

        if (existingTransaction?.status === "COMPLETED") {
          // Transaction déjà traitée
          const vipSub = await tx.vIPSubscription.findUnique({
            where: { userId },
          });
          return {
            userId,
            expiresAt: vipSub?.expiresAt || new Date(),
            planType: vipSub?.planType || "MONTHLY",
            isDuplicate: true,
          };
        }

        // 2️⃣  Obtenir ou créer l'abonnement VIP
        let vipSubscription = await tx.vIPSubscription.findUnique({
          where: { userId },
        });

        if (vipSubscription) {
          // Renouveler l'abonnement existant
          vipSubscription = await tx.vIPSubscription.update({
            where: { userId },
            data: {
              isActive: true,
              expiresAt,
              planType,
              autoRenew: true,
              renewalDate: expiresAt,
            },
          });
        } else {
          // Créer un nouvel abonnement
          vipSubscription = await tx.vIPSubscription.create({
            data: {
              userId,
              isActive: true,
              expiresAt,
              planType,
              autoRenew: true,
              renewalDate: expiresAt,
            },
          });
        }

        // 3️⃣  Mettre à jour le rôle utilisateur
        await tx.user.update({
          where: { id: userId },
          data: { role: "VIP" },
        });

        // 4️⃣  Enregistrer la transaction
        await tx.transaction.create({
          data: {
            transactionId,
            userId,
            transactionType: "VIP_SUBSCRIPTION",
            amount: new Decimal(0), // Le montant est géré par PayPal
            status: "COMPLETED",
            paymentMethod: "PAYPAL",
            orderId: paypalOrderId,
            description: `VIP ${planType} subscription activated`,
            completedAt: new Date(),
            vipSubscriptionId: vipSubscription.id,
          },
        });

        return {
          userId,
          expiresAt,
          planType,
          isDuplicate: false,
        };
      });

      return {
        success: true,
        data: {
          userId: result.userId,
          expiresAt: result.expiresAt,
          planType: result.planType,
        },
      };
    } catch (error) {
      console.error("[SubscriptionService] activateVIP error:", error);
      return {
        success: false,
        error: "Failed to activate VIP subscription",
        code: "DB_ERROR",
      };
    }
  }

  /**
   * Désactiver un abonnement VIP
   */
  static async deactivateVIP(userId: string): Promise<ServiceResponse<boolean>> {
    try {
      await prisma.$transaction(async (tx) => {
        // Mettre à jour l'abonnement
        await tx.vIPSubscription.updateMany({
          where: { userId },
          data: { isActive: false },
        });

        // Rétrograder le rôle utilisateur si pas d'autre statut
        const user = await tx.user.findUnique({
          where: { id: userId },
        });

        if (user?.role === "VIP") {
          await tx.user.update({
            where: { id: userId },
            data: { role: "USER" },
          });
        }
      });

      return { success: true, data: true };
    } catch (error) {
      console.error("[SubscriptionService] deactivateVIP error:", error);
      return {
        success: false,
        error: "Failed to deactivate VIP",
        code: "DB_ERROR",
      };
    }
  }

  /**
   * Générer un ID unique pour idempotence
   */
  static generateTransactionId(): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString("hex");
    return `vip_${timestamp}_${random}`;
  }
}
