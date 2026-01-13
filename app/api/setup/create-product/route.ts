// app/api/setup/create-product/route.ts
// Route one-time pour créer le produit PayPal JEEZY_VIP

import { createPayPalProduct } from '@/lib/paypal-helpers';

export async function POST(request: Request) {
  try {
    console.log('[Setup] Creating PayPal product...');
    
    const productId = await createPayPalProduct({
      name: 'JEEZY_VIP',
      description: 'Jeezy TV VIP Subscription',
      type: 'SERVICE',
    });

    return Response.json(
      {
        success: true,
        message: 'Product created successfully',
        productId,
        instruction: `Add this to your .env file:\nPAYPAL_PRODUCT_ID=${productId}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Setup Error]', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to create product' },
      { status: 400 }
    );
  }
}
