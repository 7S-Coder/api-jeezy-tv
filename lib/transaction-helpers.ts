// lib/transaction-helpers.ts
// Fonctions utilitaires pour gérer les transactions

import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export async function createTransaction(data: {
  userId: string;
  transactionId: string;
  transactionType: "JEEZ_PURCHASE" | "VIP_SUBSCRIPTION" | "REFUND" | "ADJUSTMENT";
  amount: number;
  status?: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
  description?: string;
  paymentMethod?: "PAYPAL" | "CREDIT_CARD" | "WALLET";
  orderId?: string;
  captureId?: string;
  failureReason?: string;
}) {
  try {
    const transaction = await prisma.transaction.create({
      data: {
        userId: data.userId,
        transactionId: data.transactionId,
        transactionType: data.transactionType,
        amount: new Decimal(data.amount),
        status: data.status || "PENDING",
        description: data.description,
        paymentMethod: data.paymentMethod || "PAYPAL",
        orderId: data.orderId,
        captureId: data.captureId,
        failureReason: data.failureReason,
      },
    });
    return transaction;
  } catch (error) {
    console.error("[CREATE_TRANSACTION]", error);
    throw error;
  }
}

export async function completeTransaction(
  transactionId: string,
  captureId?: string
) {
  try {
    const transaction = await prisma.transaction.update({
      where: { transactionId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        captureId: captureId || undefined,
      },
    });
    return transaction;
  } catch (error) {
    console.error("[COMPLETE_TRANSACTION]", error);
    throw error;
  }
}

export async function failTransaction(
  transactionId: string,
  failureReason: string
) {
  try {
    const transaction = await prisma.transaction.update({
      where: { transactionId },
      data: {
        status: "FAILED",
        failureReason,
      },
    });
    return transaction;
  } catch (error) {
    console.error("[FAIL_TRANSACTION]", error);
    throw error;
  }
}
