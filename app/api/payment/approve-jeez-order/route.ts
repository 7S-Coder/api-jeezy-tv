// app/api/payment/approve-jeez-order/route.ts
// Approuver l'achat de Jeez e créditer o conta

import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('token');

    if (!orderId) {
      return new Response(
        '<html><body><h1>Erreur</h1><p>Order ID manquant</p></body></html>',
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Récupérer a transação
    const transaction = await prisma.transaction.findFirst({
      where: { paypalOrderId: orderId },
    });

    if (!transaction) {
      return new Response(
        '<html><body><h1>Erreur</h1><p>Transaction non trouvée</p></body></html>',
        { status: 404, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Récupérer o usuário
    const user = await prisma.user.findUnique({
      where: { id: transaction.userId },
    });

    if (!user) {
      return new Response(
        '<html><body><h1>Erreur</h1><p>Usuário não encontrado</p></body></html>',
        { status: 404, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Capturer la commande sur PayPal
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

    // Capturer la commande
    const captureResponse = await fetch(
      `${apiBase}/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!captureResponse.ok) {
      const errorData = await captureResponse.text();
      console.error('[PayPal Capture Error]', errorData);
      throw new Error(`PayPal capture failed: ${errorData}`);
    }

    const captureData = await captureResponse.json();

    // Mettre à jour a transação
    const jeezAmount = (transaction.metadata as any)?.jeezAmount || 0;

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: 'COMPLETED',
        orderId,
        captureId: captureData.purchase_units[0].payments.captures[0].id,
        completedAt: new Date(),
        metadata: JSON.stringify({
          ...(transaction.metadata ? JSON.parse(transaction.metadata as string) : {}),
          captureId: captureData.purchase_units[0].payments.captures[0].id,
        }),
      },
    });

    // Créditer la conta Jeez
    await prisma.jeezBalance.upsert({
      where: { userId: transaction.userId },
      update: {
        balanceAmount: {
          increment: jeezAmount,
        },
      },
      create: {
        userId: transaction.userId,
        balanceAmount: jeezAmount,
      },
    });

    // Envoyer un email de facture
    try {
      const totalPrice = transaction.amount;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; background: #000; color: #00ff41; padding: 20px;">
          <h1 style="text-shadow: 0 0 10px #00ff41;">✅ Achat confirmé!</h1>
          
          <div style="background: #0a0a0a; border: 2px solid #00ff41; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h2>Facture d'achat</h2>
            <p><strong>Produit:</strong> ${jeezAmount} Jeez Token${jeezAmount > 1 ? 's' : ''}</p>
            <p><strong>Montant:</strong> ${totalPrice.toFixed(2)}€</p>
            <p><strong>Prix unitaire:</strong> 0.99€ par Jeez</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
            <p><strong>Commande PayPal:</strong> ${orderId}</p>
          </div>

          <div style="background: rgba(0, 255, 65, 0.1); border-left: 4px solid #00ff41; padding: 15px; margin: 20px 0;">
            <p><strong>Votre nouveau solde:</strong> ${jeezAmount} Jeez crédité</p>
          </div>

          <p style="margin-top: 30px; color: #999;">
            Merci de votre achat! Si vous avez des questions, contactez-nous à support@jeezy-tv.com
          </p>
        </div>
      `;

      const apiKey = process.env.RESEND_API_KEY;
      if (apiKey) {
        const resend = new Resend(apiKey);
        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'noreply@jeezy-tv.com',
          to: user.email || 'noreply@jeezy-tv.com',
          subject: `Facture - Achat de ${jeezAmount} Jeez | Jeezy TV`,
          html: emailHtml,
        });
      } else {
        console.warn('[approve-jeez-order] RESEND_API_KEY not set, skipping email send.');
      }
    } catch (emailError) {
      console.error('[Email Error]', emailError);
      // Ne pas échouer la transaction si l'email ne s'envoie pas
    }

    // Rediriger avec succès
    return new Response(
      `<html><body style="text-align: center; margin-top: 50px;">
        <h1 style="color: #00ff41;">✅ Achat confirmé!</h1>
        <p style="font-size: 18px;">+${jeezAmount} Jeez crédité sur votre compte</p>
        <a href="http://localhost:3001/api-tester" style="
          margin-top: 20px;
          display: inline-block;
          padding: 10px 20px;
          background-color: #00ff41;
          color: #000;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
        ">Retour au testeur</a>
      </body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('[Approve Jeez Order Error]', error);
    return new Response(
      `<html><body style="text-align: center; margin-top: 50px;">
        <h1 style="color: #ff0000;">❌ Erreur</h1>
        <p>${error instanceof Error ? error.message : 'Erreur inconnue'}</p>
        <a href="http://localhost:3001/api-tester" style="
          margin-top: 20px;
          display: inline-block;
          padding: 10px 20px;
          background-color: #00ff41;
          color: #000;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
        ">Retour au testeur</a>
      </body></html>`,
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }
}
