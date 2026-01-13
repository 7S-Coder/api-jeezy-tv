// app/api/payment/transactions/route.ts
// Récupérer l'historique des transactions/factures de l'utilisateur

import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

/**
 * GET /api/payment/transactions?page=1&limit=10
 * Récupère l'historique des transactions de l'utilisateur
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

    // Récupérer les paramètres de pagination
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, parseInt(searchParams.get("limit") || "10"));
    const skip = (page - 1) * limit;

    // Récupérer le total des transactions
    const total = await prisma.transaction.count({
      where: { userId: decoded.userId },
    });

    // Récupérer les transactions
    const transactions = await prisma.transaction.findMany({
      where: { userId: decoded.userId },
      select: {
        id: true,
        transactionId: true,
        transactionType: true,
        amount: true,
        status: true,
        paymentMethod: true,
        description: true,
        createdAt: true,
        completedAt: true,
        failureReason: true,
        orderId: true,
        paypalOrder: {
          select: {
            status: true,
            payerEmail: true,
            payerName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: skip,
    });

    // Formater les transactions
    const formattedTransactions = transactions.map((tx) => ({
      id: tx.id,
      transactionId: tx.transactionId,
      type: tx.transactionType,
      amount: parseFloat(tx.amount.toString()),
      status: tx.status,
      paymentMethod: tx.paymentMethod,
      description: tx.description,
      createdAt: tx.createdAt,
      completedAt: tx.completedAt,
      failureReason: tx.failureReason,
      orderId: tx.orderId,
      paypal: tx.paypalOrder ? {
        status: tx.paypalOrder.status,
        payerEmail: tx.paypalOrder.payerEmail,
        payerName: tx.paypalOrder.payerName,
      } : null,
    }));

    return NextResponse.json(
      {
        success: true,
        transactions: formattedTransactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + limit < total,
        },
      },
      {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (error) {
    console.error("[TRANSACTIONS]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
