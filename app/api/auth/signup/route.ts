// app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { validateData, CreateUserSchema } from "@/lib/validators";

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
        { status: 400 }
      );
    }

    // Vérifier que l'email n'existe pas
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur avec wallet
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
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
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          userId: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[SIGNUP]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
