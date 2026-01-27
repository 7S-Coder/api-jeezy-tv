// app/api/user/profile/route.ts
// Récupérer les infos profil de l'utilisateur avec VIP status et balance Jeez

import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

/**
 * GET /api/user/profile
 * Récupère les infos profil de l'utilisateur connecté
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const token = authHeader.slice(7);
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET || "test-secret-key");
    } catch {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Récupérer l'utilisateur avec ses infos
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profileColor: true,
        createdAt: true,
        updatedAt: true,
        image: true,
        jeezBalance: {
          select: {
            balanceAmount: true,
            lastUpdated: true,
          },
        },
        vipStatus: {
          select: {
            isActive: true,
            planType: true,
            startDate: true,
            expiresAt: true,
            autoRenew: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Vérifier si VIP est expiré
    let vipStatus = null;
    if (user.vipStatus) {
      const now = new Date();
      const isExpired = user.vipStatus.expiresAt < now;
      vipStatus = {
        ...user.vipStatus,
        isExpired,
        daysRemaining: isExpired ? 0 : Math.ceil((user.vipStatus.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      };
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          profileColor: user.profileColor,
          image: user.image,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          jeezBalance: user.jeezBalance ? {
            amount: user.jeezBalance.balanceAmount,
            lastUpdated: user.jeezBalance.lastUpdated,
          } : { amount: 0, lastUpdated: new Date() },
          vip: vipStatus,
        },
      },
      {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (error) {
    console.error("[PROFILE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}

/**
 * PUT /api/user/profile
 * Met à jour le profil de l'utilisateur (nom et/ou couleur)
 */
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const token = authHeader.slice(7);
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET || "test-secret-key");
      console.log("[PROFILE UPDATE] Token decoded successfully:", { userId: decoded.userId, email: decoded.email });
    } catch (err) {
      console.error("[PROFILE UPDATE] JWT verify error:", err);
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const body = await request.json();
    const { name, profileColor } = body;
    console.log("[PROFILE UPDATE] Request body:", { name, profileColor });

    // Validation basique
    if (!name && !profileColor) {
      return NextResponse.json(
        { error: "At least one field must be provided" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    if (name && name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name cannot be empty" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Mettre à jour l'utilisateur
    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (profileColor) updateData.profileColor = profileColor;

    console.log("[PROFILE UPDATE] Updating user:", { userId: decoded.userId, updateData });

    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        profileColor: true,
        role: true,
      },
    });

    console.log("[PROFILE UPDATE] User updated successfully:", updatedUser);

    return NextResponse.json(
      {
        success: true,
        message: "Profile updated successfully",
        data: updatedUser,
      },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error) {
    console.error("[PROFILE UPDATE] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
