// app/api/auth/signin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emailOrUsername, password } = body;

    if (!emailOrUsername || !password) {
      return NextResponse.json(
        { error: "Email or username and password required" },
        { 
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" }
        }
      );
    }

    // Chercher l'utilisateur par email OU par name (username)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: emailOrUsername },
          { name: emailOrUsername },
        ],
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { 
          status: 401,
          headers: { "Access-Control-Allow-Origin": "*" }
        }
      );
    }

    // Vérifier que l'email a été confirmé
    if (!user.emailVerified) {
      return NextResponse.json(
        { 
          error: "Email not verified",
          message: "Veuillez vérifier votre email avant de vous connecter. Vous pouvez demander un nouvel email de vérification.",
          requiresVerification: true,
        },
        { 
          status: 403,
          headers: { "Access-Control-Allow-Origin": "*" }
        }
      );
    }

    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { 
          status: 401,
          headers: { "Access-Control-Allow-Origin": "*" }
        }
      );
    }

    // Créer un token JWT simple (pour les tests)
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.NEXTAUTH_SECRET || "test-secret-key",
      { expiresIn: "7d" }
    );

    return NextResponse.json(
      {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" }
      }
    );
  } catch (error) {
    console.error("[SIGNIN]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
