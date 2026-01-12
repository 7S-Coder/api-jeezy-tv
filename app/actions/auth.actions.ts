// app/actions/auth.actions.ts
// Server Actions pour l'authentification

"use server";

import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { validateData, CreateUserSchema } from "@/lib/validators";

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Créer un compte utilisateur
 * 
 * ⚠️  SÉCURITÉ:
 * 1. Vérifier que l'email n'existe pas
 * 2. Hash le mot de passe avec bcrypt
 * 3. Initialiser le portefeuille Jeez
 */
export async function signUpAction(
  email: string,
  password: string,
  name: string
): Promise<ActionResponse<{ userId: string; email: string }>> {
  try {
    // 1️⃣  Valider les données
    const validation = validateData(CreateUserSchema, {
      email,
      password,
      name,
    });

    if (!validation.success) {
      return {
        success: false,
        error: validation.error,
      };
    }

    // 2️⃣  Vérifier que l'email n'existe pas déjà
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return {
        success: false,
        error: "Email already in use",
      };
    }

    // 3️⃣  Hash du mot de passe (bcrypt)
    const hashedPassword = await bcrypt.hash(password, 12);

    // 4️⃣  Créer l'utilisateur ET initialiser son portefeuille (transaction atomique)
    const user = await prisma.$transaction(async (tx: any) => {
      const newUser = await tx.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          role: "USER",
          isActive: true,
        },
      });

      // Initialiser le portefeuille Jeez (0 tokens)
      await tx.jeezBalance.create({
        data: {
          userId: newUser.id,
          balanceAmount: 0,
        },
      });

      return newUser;
    });

    return {
      success: true,
      data: {
        userId: user.id,
        email: user.email || "",
      },
    };
  } catch (error) {
    console.error("[signUpAction] Error:", error);
    return {
      success: false,
      error: "Failed to create account",
    };
  }
}

/**
 * Connexion avec email/password
 */
export async function signInAction(
  email: string,
  password: string
): Promise<ActionResponse<{ success: boolean }>> {
  try {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (!result || (result as any)?.error) {
      return {
        success: false,
        error: "Invalid credentials",
      };
    }

    return {
      success: true,
      data: { success: true },
    };
  } catch (error) {
    console.error("[signInAction] Error:", error);
    return {
      success: false,
      error: "Authentication failed",
    };
  }
}

/**
 * Déconnexion
 */
export async function signOutAction(): Promise<ActionResponse<boolean>> {
  try {
    await signOut({ redirectTo: "/" });
    return { success: true, data: true };
  } catch (error) {
    console.error("[signOutAction] Error:", error);
    return { success: false, error: "Sign out failed" };
  }
}
