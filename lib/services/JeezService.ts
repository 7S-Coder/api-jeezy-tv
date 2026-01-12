// lib/services/JeezService.ts
// Service métier pour gérer la monnaie virtuelle Jeez
// ⚠️  SÉCURITÉ CRITIQUE: Les transactions DOIVENT être atomiques (Prisma $transaction)

import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import crypto from "crypto";

/**
 * Structure de réponse standardisée
 */
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * JeezService - Gestion de la monnaie virtuelle
 * 
 * PRINCIPES DE SÉCURITÉ:
 * 1. Toute opération est atomique via Prisma transactions
 * 2. Vérification du solde AVANT débits
 * 3. Transaction ID unique pour idempotence
 * 4. Logging complet de chaque opération
 */
export class JeezService {
  /**
   * Obtenir le solde Jeez de l'utilisateur
   */
  static async getBalance(userId: string): Promise<ServiceResponse<number>> {
    try {
      const balance = await prisma.jeezBalance.findUnique({
        where: { userId },
      });

      if (!balance) {
        return {
          success: false,
          error: "Balance not found",
          code: "BALANCE_NOT_FOUND",
        };
      }

      return {
        success: true,
        data: balance.balanceAmount.toNumber(),
      };
    } catch (error) {
      console.error("[JeezService] getBalance error:", error);
      return {
        success: false,
        error: "Failed to fetch balance",
        code: "DB_ERROR",
      };
    }
  }

  /**
   * Ajouter des Jeez au portefeuille
   * 
   * @param userId ID de l'utilisateur
   * @param amount Montant à ajouter (nombre décimal)
   * @param transactionId ID unique pour idempotence
   * @param description Raison de l'ajout (ex: "Payment completion")
   */
  static async addJeez(
    userId: string,
    amount: number,
    transactionId: string,
    description: string
  ): Promise<ServiceResponse<{ newBalance: number; transactionId: string }>> {
    // Validation
    if (amount <= 0) {
      return {
        success: false,
        error: "Amount must be positive",
        code: "INVALID_AMOUNT",
      };
    }

    if (amount > 999999.99) {
      return {
        success: false,
        error: "Amount exceeds maximum limit",
        code: "AMOUNT_LIMIT_EXCEEDED",
      };
    }

    try {
      // Transaction atomique: vérifier l'idempotence ET ajouter les Jeez
      const result = await prisma.$transaction(async (tx) => {
        // 1️⃣  Vérifier si cette transaction a déjà été traitée (idempotence)
        const existingTx = await tx.transaction.findUnique({
          where: { transactionId },
        });

        if (existingTx) {
          // Transaction déjà traitée → retourner le résultat précédent
          const balance = await tx.jeezBalance.findUnique({
            where: { userId },
          });
          return {
            newBalance: balance?.balanceAmount.toNumber() || 0,
            transactionId,
            isDuplicate: true,
          };
        }

        // 2️⃣  Vérifier ou créer le portefeuille
        let jeezBalance = await tx.jeezBalance.findUnique({
          where: { userId },
        });

        if (!jeezBalance) {
          jeezBalance = await tx.jeezBalance.create({
            data: {
              userId,
              balanceAmount: new Decimal(0),
            },
          });
        }

        // 3️⃣  Créditer le portefeuille (transaction atomique)
        const updatedBalance = await tx.jeezBalance.update({
          where: { userId },
          data: {
            balanceAmount: {
              increment: new Decimal(amount),
            },
          },
        });

        // 4️⃣  Enregistrer la transaction dans le ledger
        await tx.transaction.create({
          data: {
            transactionId,
            userId,
            transactionType: "JEEZ_PURCHASE",
            amount: new Decimal(amount),
            status: "COMPLETED",
            paymentMethod: "PAYPAL",
            description,
            completedAt: new Date(),
          },
        });

        return {
          newBalance: updatedBalance.balanceAmount.toNumber(),
          transactionId,
          isDuplicate: false,
        };
      });

      return {
        success: true,
        data: {
          newBalance: result.newBalance,
          transactionId: result.transactionId,
        },
      };
    } catch (error) {
      console.error("[JeezService] addJeez error:", error);
      return {
        success: false,
        error: "Failed to add Jeez",
        code: "DB_ERROR",
      };
    }
  }

  /**
   * Déduire des Jeez du portefeuille
   * 
   * SÉCURITÉ: Vérifier le solde AVANT de débiter
   */
  static async deductJeez(
    userId: string,
    amount: number,
    transactionId: string,
    description: string
  ): Promise<ServiceResponse<{ newBalance: number; transactionId: string }>> {
    // Validation
    if (amount <= 0) {
      return {
        success: false,
        error: "Amount must be positive",
        code: "INVALID_AMOUNT",
      };
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1️⃣  Vérifier l'idempotence
        const existingTx = await tx.transaction.findUnique({
          where: { transactionId },
        });

        if (existingTx) {
          const balance = await tx.jeezBalance.findUnique({
            where: { userId },
          });
          return {
            newBalance: balance?.balanceAmount.toNumber() || 0,
            transactionId,
          };
        }

        // 2️⃣  Obtenir le solde ACTUEL
        const currentBalance = await tx.jeezBalance.findUnique({
          where: { userId },
        });

        if (!currentBalance) {
          throw new Error("BALANCE_NOT_FOUND");
        }

        // 3️⃣  Vérifier les fonds suffisants (PROTECTION DOUBLE-SPENDING)
        if (currentBalance.balanceAmount.toNumber() < amount) {
          throw new Error("INSUFFICIENT_BALANCE");
        }

        // 4️⃣  Débiter le portefeuille
        const updatedBalance = await tx.jeezBalance.update({
          where: { userId },
          data: {
            balanceAmount: {
              decrement: new Decimal(amount),
            },
          },
        });

        // 5️⃣  Enregistrer la transaction
        await tx.transaction.create({
          data: {
            transactionId,
            userId,
            transactionType: "JEEZ_PURCHASE",
            amount: new Decimal(amount),
            status: "COMPLETED",
            paymentMethod: "WALLET",
            description,
            completedAt: new Date(),
          },
        });

        return {
          newBalance: updatedBalance.balanceAmount.toNumber(),
          transactionId,
        };
      });

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      console.error("[JeezService] deductJeez error:", error);

      if (error.message === "INSUFFICIENT_BALANCE") {
        return {
          success: false,
          error: "Insufficient Jeez balance",
          code: "INSUFFICIENT_BALANCE",
        };
      }

      return {
        success: false,
        error: "Failed to deduct Jeez",
        code: "DB_ERROR",
      };
    }
  }

  /**
   * Générer un ID unique pour idempotence
   * Format: "jeez_" + timestamp + hash aléatoire
   */
  static generateTransactionId(): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString("hex");
    return `jeez_${timestamp}_${random}`;
  }
}
