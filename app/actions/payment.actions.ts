// app/actions/payment.actions.ts
// Server Actions pour les paiements (Jeez et VIP)

"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { JeezService } from "@/lib/services/JeezService";
import { SubscriptionService } from "@/lib/services/SubscriptionService";

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Obtenir le solde Jeez de l'utilisateur connecté
 * 
 * Server Action = exécuté côté serveur, sécurisé
 * Pas d'exposition de données sensibles au client
 */
export async function getJeezBalanceAction(): Promise<
  ActionResponse<number>
> {
  try {
    // 1️⃣  Vérifier l'authentification
    const session = await auth();

    if (!session?.user?.email) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    const userId = (session.user as any).id;

    // 2️⃣  Récupérer le solde
    const result = await JeezService.getBalance(userId);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    console.error("[getJeezBalanceAction] Error:", error);
    return {
      success: false,
      error: "Failed to fetch balance",
    };
  }
}

/**
 * Obtenir le statut VIP de l'utilisateur connecté
 */
export async function getVIPStatusAction(): Promise<
  ActionResponse<{
    isActive: boolean;
    expiresAt: Date | null;
    planType: string | null;
  }>
> {
  try {
    // 1️⃣  Vérifier l'authentification
    const session = await auth();

    if (!session?.user?.email) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    const userId = (session.user as any).id;

    // 2️⃣  Récupérer le statut VIP
    const result = await SubscriptionService.getVIPStatus(userId);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    console.error("[getVIPStatusAction] Error:", error);
    return {
      success: false,
      error: "Failed to fetch VIP status",
    };
  }
}

/**
 * Vérifier si l'utilisateur est VIP
 * 
 * Utile pour les pages/composants qui affichent du contenu conditionnel
 */
export async function isUserVIPAction(): Promise<ActionResponse<boolean>> {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return {
        success: true,
        data: false, // Pas connecté = pas VIP
      };
    }

    const userId = (session.user as any).id;
    const result = await SubscriptionService.getVIPStatus(userId);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      data: result.data?.isActive || false,
    };
  } catch (error) {
    console.error("[isUserVIPAction] Error:", error);
    return {
      success: true,
      data: false,
    };
  }
}

/**
 * Obtenir les détails du profil (avec solde et VIP status)
 */
export async function getUserProfileAction(): Promise<
  ActionResponse<{
    userId: string;
    email: string;
    name: string | null;
    role: string;
    jeezBalance: number;
    vipStatus: {
      isActive: boolean;
      expiresAt: Date | null;
      planType: string | null;
    };
  }>
> {
  try {
    // 1️⃣  Vérifier l'authentification
    const session = await auth();

    if (!session?.user?.email) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    const userId = (session.user as any).id;

    // 2️⃣  Récupérer les infos utilisateur
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return {
        success: false,
        error: "User not found",
      };
    }

    // 3️⃣  Récupérer le solde Jeez
    const jeezResult = await JeezService.getBalance(userId);
    const jeezBalance = jeezResult.success ? jeezResult.data || 0 : 0;

    // 4️⃣  Récupérer le statut VIP
    const vipResult = await SubscriptionService.getVIPStatus(userId);
    const vipStatus: any = vipResult.success
      ? vipResult.data
      : { isActive: false, expiresAt: null, planType: null };

    return {
      success: true,
      data: {
        userId: user.id,
        email: user.email || "",
        name: user.name,
        role: user.role,
        jeezBalance,
        vipStatus,
      },
    };
  } catch (error) {
    console.error("[getUserProfileAction] Error:", error);
    return {
      success: false,
      error: "Failed to fetch profile",
    };
  }
}

/**
 * Envoyer une demande de test (exemple de transaction fictive)
 * Utile pour tester sans PayPal
 */
export async function addTestJeezAction(
  amount: number
): Promise<ActionResponse<number>> {
  try {
    // 🔐 SÉCURITÉ: Vérifier l'authentification
    const session = await auth();

    if (!session?.user?.email) {
      return {
        success: false,
        error: "Unauthorized",
      };
    }

    // ⚠️  EN PRODUCTION: Vérifier si l'utilisateur est ADMIN
    const userId = (session.user as any).id;

    // 🔐 SÉCURITÉ: Limiter les montants de test
    if (amount <= 0 || amount > 100000) {
      return {
        success: false,
        error: "Invalid test amount",
      };
    }

    const transactionId = `test_${Date.now()}`;
    const result = await JeezService.addJeez(
      userId,
      amount,
      transactionId,
      "Test transaction"
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      data: result.data?.newBalance,
    };
  } catch (error) {
    console.error("[addTestJeezAction] Error:", error);
    return {
      success: false,
      error: "Failed to add test Jeez",
    };
  }
}
