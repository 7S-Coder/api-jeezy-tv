// app/api/auth/forgot-password/route.ts
// Demander une réinitialisation de mot de passe

import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { sendPasswordResetEmail } from "@/lib/email";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

/**
 * POST /api/auth/forgot-password
 * Envoyer un email de réinitialisation de mot de passe
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email required" },
        {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    // Chercher l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (!user) {
      // Ne pas révéler si l'email existe ou non (sécurité)
      return NextResponse.json(
        {
          message:
            "Si cet email existe dans notre système, un lien de réinitialisation a été envoyé.",
        },
        {
          status: 200,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    // Générer un token de réinitialisation
    const resetToken = generateToken();
    const resetTokenExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 heure

    // Stocker le token dans la base de données
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken: resetToken,
        verificationTokenExpires: resetTokenExpires,
      },
    });

    // Envoyer l'email
    try {
      await sendPasswordResetEmail(email, resetToken);
    } catch (emailError) {
      console.error("[forgot-password] Email failed:", emailError);
    }

    return NextResponse.json(
      {
        message:
          "Si cet email existe dans notre système, un lien de réinitialisation a été envoyé.",
      },
      {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (error) {
    console.error("[forgot-password] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}

/**
 * Générer un token aléatoire
 */
function generateToken(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}
