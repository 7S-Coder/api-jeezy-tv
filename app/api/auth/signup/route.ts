// app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { validateData, CreateUserSchema } from "@/lib/validators";
import { sendVerificationEmail } from "@/lib/email";
import { generateUserColor } from "@/lib/colors";

// Handle CORS preflight
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
 * Générer un token aléatoire pour la vérification d'email
 */
function generateVerificationToken(): string {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    // Valider les données
    const validation = validateData(CreateUserSchema, {
      email,
      password,
      name,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { 
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" }
        }
      );
    }

    // Vérifier que l'email n'existe pas
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error: "EMAIL_ALREADY_REGISTERED",
          message: "Cet e‑mail est déjà utilisé — veuillez en choisir un autre.",
        },
        {
          status: 409,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Générer le token de vérification
    const verificationToken = generateVerificationToken();
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    
    // Générer une couleur aléatoire pour l'utilisateur (non-VIP)
    const profileColor = generateUserColor(false);

    // Créer l'utilisateur avec wallet
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        profileColor,
        verificationToken,
        verificationTokenExpires,
        emailVerified: null, // Non vérifié pour le moment
        jeezBalance: {
          create: {
            balanceAmount: 0,
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        profileColor: true,
        emailVerified: true,
      },
    });

    // Envoyer l'email de vérification
    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (emailError) {
      console.error("[SIGNUP] Failed to send verification email:", emailError);
      // On ne retourne pas d'erreur ici, le compte est créé même si l'email échoue
    }

    return NextResponse.json(
      {
        success: true,
        message: "Compte créé. Veuillez vérifier votre email pour activer votre compte.",
        data: {
          userId: user.id,
          email: user.email,
          name: user.name,
          profileColor: user.profileColor,
          emailVerified: user.emailVerified,
        },
      },
      { 
        status: 201,
        headers: { "Access-Control-Allow-Origin": "*" }
      }
    );
  } catch (error) {
    console.error("[SIGNUP]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { 
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" }
      }
    );
  }
}
