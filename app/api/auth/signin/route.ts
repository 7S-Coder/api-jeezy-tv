// app/api/auth/signin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getJWTSecret } from "@/lib/auth/get-secret";

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true"
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
    if (!user.password) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { 
          status: 401,
          headers: { "Access-Control-Allow-Origin": "*" }
        }
      );
    }

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

    // Créer un token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      getJWTSecret(),
      { expiresIn: "7d" }
    );

    // Créer la réponse avec le cookie HTTP-only
    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      {
        status: 200,
        headers: { 
          "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001",
          "Access-Control-Allow-Credentials": "true"
        }
      }
    );

    // Définir le cookie HTTP-only (sécurisé)
    response.cookies.set({
      name: 'backendToken',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only en production
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 jours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error("[SIGNIN]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
