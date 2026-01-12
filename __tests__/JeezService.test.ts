// __tests__/JeezService.test.ts
// Tests unitaires pour JeezService
// 
// Usage: npm test -- JeezService.test.ts

import { describe, it, expect, beforeEach } from "@jest/globals";
import { JeezService } from "@/lib/services/JeezService";
import { prisma } from "@/lib/prisma";

// Mock Prisma
jest.mock("@/lib/prisma");

describe("JeezService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getBalance", () => {
    it("should return the balance for a user", async () => {
      const mockBalance = {
        id: "1",
        userId: "user-123",
        balanceAmount: { toNumber: () => 1000 },
        lastUpdated: new Date(),
        createdAt: new Date(),
      };

      (prisma.jeezBalance.findUnique as jest.Mock).mockResolvedValue(
        mockBalance
      );

      const result = await JeezService.getBalance("user-123");

      expect(result.success).toBe(true);
      expect(result.data).toBe(1000);
    });

    it("should return error if balance not found", async () => {
      (prisma.jeezBalance.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await JeezService.getBalance("user-123");

      expect(result.success).toBe(false);
      expect(result.code).toBe("BALANCE_NOT_FOUND");
    });
  });

  describe("addJeez", () => {
    it("should add Jeez to wallet", async () => {
      const userId = "user-123";
      const amount = 100;
      const transactionId = "txn_123";

      (prisma.$transaction as jest.Mock).mockResolvedValue({
        newBalance: 1100,
        transactionId,
        isDuplicate: false,
      });

      const result = await JeezService.addJeez(
        userId,
        amount,
        transactionId,
        "Test purchase"
      );

      expect(result.success).toBe(true);
      expect(result.data?.newBalance).toBe(1100);
    });

    it("should prevent negative amounts", async () => {
      const result = await JeezService.addJeez(
        "user-123",
        -100,
        "txn_123",
        "Test"
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe("INVALID_AMOUNT");
    });

    it("should handle idempotence", async () => {
      const userId = "user-123";
      const transactionId = "txn_123";

      // Simuler une transaction déjà traitée
      (prisma.$transaction as jest.Mock).mockResolvedValue({
        newBalance: 1000,
        transactionId,
        isDuplicate: true,
      });

      const result = await JeezService.addJeez(
        userId,
        100,
        transactionId,
        "Test"
      );

      expect(result.success).toBe(true);
      expect(result.data?.newBalance).toBe(1000);
    });
  });

  describe("deductJeez", () => {
    it("should deduct Jeez from wallet", async () => {
      const userId = "user-123";
      const amount = 100;
      const transactionId = "txn_123";

      (prisma.$transaction as jest.Mock).mockResolvedValue({
        newBalance: 900,
        transactionId,
      });

      const result = await JeezService.deductJeez(
        userId,
        amount,
        transactionId,
        "Test deduction"
      );

      expect(result.success).toBe(true);
      expect(result.data?.newBalance).toBe(900);
    });

    it("should prevent insufficient balance", async () => {
      const userId = "user-123";
      const amount = 100;
      const transactionId = "txn_123";

      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error("INSUFFICIENT_BALANCE")
      );

      const result = await JeezService.deductJeez(
        userId,
        amount,
        transactionId,
        "Test"
      );

      expect(result.success).toBe(false);
    });
  });

  describe("generateTransactionId", () => {
    it("should generate unique transaction IDs", () => {
      const id1 = JeezService.generateTransactionId();
      const id2 = JeezService.generateTransactionId();

      expect(id1).toMatch(/^jeez_/);
      expect(id2).toMatch(/^jeez_/);
      expect(id1).not.toBe(id2);
    });
  });
});
