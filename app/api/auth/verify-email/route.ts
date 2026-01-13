// app/api/auth/verify-email/route.ts
// Vérifier l'email avec le token envoyé par email

import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

/**
 * GET /api/auth/verify-email?token=xxx
 * Vérifier le token et marquer l'email comme vérifié
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token manquant" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Chercher l'utilisateur avec ce token
    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpires: {
          gt: new Date(), // Le token n'a pas expiré
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Token invalide ou expiré" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Marquer l'email comme vérifié
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        verificationToken: null,
        verificationTokenExpires: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
      },
    });

    return NextResponse.json(
      {
        message: "Email vérifié avec succès!",
        user: updatedUser,
      },
      {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (error) {
    console.error("[verify-email] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la vérification" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}

/**
 * POST /api/auth/verify-email
 * Renvoyer l'email de vérification
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email requis" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true, verificationToken: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { message: "Email déjà vérifié" },
        {
          status: 200,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    // Générer un nouveau token (ou réutiliser l'ancien)
    const { sendVerificationEmail } = await import("@/lib/email");
    const token = user.verificationToken || generateToken();

    if (!user.verificationToken) {
      // Mettre à jour le token s'il n'existe pas
      await prisma.user.update({
        where: { id: user.id },
        data: {
          verificationToken: token,
          verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        },
      });
    }

    await sendVerificationEmail(email, token);

    return NextResponse.json(
      { message: "Email de vérification envoyé" },
      {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (error) {
    console.error("[verify-email POST] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi de l'email" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}

/**
 * Générer un token aléatoire
 */
function generateToken(): string {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}
