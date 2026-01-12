// app/api/health/route.ts
// Endpoint santé - Vérifier que l'API fonctionne

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Tester la connexion à la BDD
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        database: "connected",
        version: "1.0.0",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Health Check] Database error:", error);

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: "Database connection failed",
      },
      { status: 503 }
    );
  }
}
