// app/api/streams/status/route.ts
// Endpoint pour vérifier l'état du live
// Source de vérité centralisée : pas de vérification directe du stream côté UI

import { NextRequest, NextResponse } from "next/server";

interface StreamStatusResponse {
  isLive: boolean;
  playbackUrl?: string;
  source?: "oven" | "database";
  checkedAt: string;
}

/**
 * Vérifier l'état du stream OvenMediaEngine
 * Retourne true si le serveur répond avec un statut 2xx
 */
async function checkOvenMediaEngine(streamUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(streamUrl, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.error("[Stream Status] OvenMediaEngine check failed:", error);
    return false;
  }
}

/**
 * GET /api/streams/status
 * Endpoint sécurisé pour obtenir l'état du stream en direct
 * 
 * Réponse:
 * - { isLive: true, playbackUrl: "...", source: "oven", checkedAt: "..." }
 * - { isLive: false, checkedAt: "..." }
 */
export async function GET(request: NextRequest) {
  try {
    const streamUrl = process.env.NEXT_PUBLIC_STREAM_URL;

    if (!streamUrl) {
      return NextResponse.json(
        {
          error: "Stream URL not configured",
          isLive: false,
        },
        { status: 500 }
      );
    }

    // Vérifier si le stream est actif
    const isLive = await checkOvenMediaEngine(streamUrl);

    const response: StreamStatusResponse = {
      isLive,
      checkedAt: new Date().toISOString(),
      source: "oven",
    };

    // Ajouter l'URL de lecture seulement si le stream est actif
    if (isLive) {
      response.playbackUrl = streamUrl;
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[Stream Status] Unexpected error:", error);

    return NextResponse.json(
      {
        isLive: false,
        error: "Failed to check stream status",
        checkedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
