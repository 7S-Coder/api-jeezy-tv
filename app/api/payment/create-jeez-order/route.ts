// app/api/payment/create-jeez-order/route.ts
// Créer une commande PayPal pour acheter des Jeez

import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';

async function verifyToken(token: string) {
  try {
    const secret = process.env.NEXTAUTH_SECRET || 'test-secret-key';
    const JWT_SECRET = new TextEncoder().encode(secret);
    const verified = await jwtVerify(token, JWT_SECRET);
    return verified.payload as { userId: string; email: string };
  } catch (error) {
    console.error('[Token Verification Error]', error);
    throw new Error('Invalid token');
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: Request) {
  try {
    // Vérifier l'authentification
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    let decoded;
    try {
      decoded = await verifyToken(token);
      console.log('[Jeez Order] Decoded token:', decoded);
    } catch (error) {
      console.error('[Token Error]', error);
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Parser le body
    const body = await request.json();
    let { jeezAmount } = body; // Nombre de Jeez à acheter
    
    // Convertir en número
    jeezAmount = parseInt(jeezAmount);

    if (!jeezAmount || jeezAmount < 1) {
      return Response.json(
        { error: 'Invalid jeez amount' },
        { status: 400 }
      );
    }

    // Definir preço baseado no package
    let totalPrice: string;
    switch (jeezAmount) {
      case 100:
        totalPrice = '0.99';
        break;
      case 500:
        totalPrice = '4.95';
        break;
      case 1000:
        totalPrice = '9.90';
        break;
      case 5000:
        totalPrice = '49.50';
        break;
      default:
        return Response.json(
          { error: 'Invalid package size' },
          { status: 400 }
        );
    }

    // Récupérer l'utilisateur
    console.log('[Jeez Order] Looking for user:', decoded.userId);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      console.error('[Jeez Order] User not found:', decoded.userId);
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Créer l'ordre PayPal
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim();
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
    const apiBase = process.env.PAYPAL_API_BASE_URL || 'https://api.sandbox.paypal.com';

    // Obtenir le token d'accès
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenResponse = await fetch(`${apiBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get PayPal access token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Créer la commande
    const ngrokUrl = process.env.NGROK_URL || 'https://palmira-sappy-facilely.ngrok-free.dev';
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: `jeez-${user.id}-${Date.now()}`,
          amount: {
            currency_code: 'EUR',
            value: totalPrice,
            breakdown: {
              item_total: {
                currency_code: 'EUR',
                value: totalPrice,
              },
            },
          },
          items: [
            {
              name: `${jeezAmount} Jeez Token${jeezAmount > 1 ? 's' : ''}`,
              description: `Achat de ${jeezAmount} Jeez pour Jeezy TV`,
              sku: `JEEZ-${jeezAmount}`,
              unit_amount: {
                currency_code: 'EUR',
                value: totalPrice,
              },
              quantity: '1',
            },
          ],
          custom_id: user.id,
        },
      ],
      application_context: {
        brand_name: 'Jeezy TV',
        locale: 'fr-FR',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
        return_url: `${ngrokUrl}/api/payment/approve-jeez-order`,
        cancel_url: `${ngrokUrl}/api-tester`,
      },
    };

    const orderResponse = await fetch(`${apiBase}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    if (!orderResponse.ok) {
      const errorData = await orderResponse.text();
      console.error('[PayPal Order Error]', errorData);
      throw new Error(`Failed to create PayPal order: ${errorData}`);
    }

    const orderData = await orderResponse.json();

    console.log('[PayPal Order Response]', JSON.stringify(orderData, null, 2));

    // Trouver le lien d'approbation
    const approveLink = orderData.links?.find(
      (link: { rel: string }) => link.rel === 'approve'
    );

    if (!approveLink) {
      console.error('[PayPal Response]', JSON.stringify(orderData, null, 2));
      throw new Error('No approve link in PayPal response');
    }

    console.log('[PayPal Approve Link]', approveLink.href);

    // Enregistrer a transação em pendência
    const transactionId = `jeez-${user.id}-${Date.now()}`;
    await prisma.transaction.create({
      data: {
        transactionId,
        userId: user.id,
        transactionType: 'JEEZ_PURCHASE',
        amount: parseFloat(totalPrice),
        status: 'PENDING',
        orderId: orderData.id,
        description: `Compra de ${jeezAmount} Jeez`,
        metadata: JSON.stringify({
          jeezAmount,
          itemName: `${jeezAmount} Jeez`,
        }),
      },
    });

    return Response.json(
      {
        success: true,
        orderId: orderData.id,
        approveUrl: approveLink.href,
        amount: totalPrice,
        jeezAmount,
      },
      { 
        status: 201,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  } catch (error) {
    console.error('[Create Jeez Order Error]', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to create order' },
      { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
}
