// lib/paypal-helpers.ts
// Fonctions utilitaires pour PayPal API

/**
 * Obtenir un token d'accès PayPal
 */
export async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  const apiBase = process.env.PAYPAL_API_BASE_URL || 'https://api.sandbox.paypal.com';

  if (!clientId || !clientSecret) {
    console.error('[PayPal] Missing credentials:', {
      clientId: !!clientId,
      clientSecret: !!clientSecret,
    });
    throw new Error('PayPal credentials not configured');
  }

  // Log pour debugging (sans afficher les secrets complets)
  console.log('[PayPal Auth] Attempting authentication:', {
    clientId: `${clientId.substring(0, 10)}...${clientId.substring(clientId.length - 5)}`,
    clientSecretLength: clientSecret.length,
    apiBase,
  });

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await fetch(`${apiBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('[PayPal Token Error]', {
        status: response.status,
        statusText: response.statusText,
        body: responseText,
      });
      throw new Error(`PayPal auth failed: ${response.status} - ${responseText}`);
    }

    const data = JSON.parse(responseText);
    console.log('[PayPal Auth] Success! Token obtained.');
    return data.access_token;
  } catch (error) {
    console.error('[PayPal Token Request Error]', error);
    throw error;
  }
}

/**
 * Créer un produit PayPal (ex: JEEZY_VIP)
 */
export async function createPayPalProduct(productDetails: {
  name: string;
  description?: string;
  type: 'SERVICE' | 'PHYSICAL';
}): Promise<string> {
  const accessToken = await getPayPalAccessToken();
  const apiBase = process.env.PAYPAL_API_BASE_URL || 'https://api.sandbox.paypal.com';

  const payload = {
    name: productDetails.name,
    description: productDetails.description || '',
    type: productDetails.type,
    category: 'SOFTWARE',
  };

  try {
    const response = await fetch(`${apiBase}/v1/catalogs/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('[PayPal Product Error]', {
        status: response.status,
        body: responseText,
      });
      throw new Error(`Failed to create PayPal product: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    console.log('[PayPal Product Created]', { productId: data.id });
    return data.id;
  } catch (error) {
    console.error('[PayPal Product Creation Exception]', error);
    throw error;
  }
}

/**
 * Créer un plan d'abonnement PayPal
 */
export async function createPayPalPlan(planDetails: {
  name: string;
  description: string;
  price: string;
  interval: 'MONTH' | 'YEAR';
  currency?: string;
}): Promise<string> {
  const accessToken = await getPayPalAccessToken();
  const apiBase = process.env.PAYPAL_API_BASE_URL || 'https://api.sandbox.paypal.com';
  const productId = process.env.PAYPAL_PRODUCT_ID || 'PROD_JEEZY_VIP';

  const planPayload = {
    product_id: productId,
    name: planDetails.name,
    description: planDetails.description,
    billing_cycles: [
      {
        frequency: {
          interval_unit: planDetails.interval,
          interval_count: 1,
        },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0, // 0 = infinite
        pricing_scheme: {
          fixed_price: {
            value: planDetails.price,
            currency_code: planDetails.currency || 'EUR',
          },
        },
      },
    ],
    payment_preferences: {
      auto_bill_amount: 'YES',
      setup_fee_failure_action: 'CONTINUE',
      payment_failure_threshold: 3,
    },
  };

  const response = await fetch(`${apiBase}/v1/billing/plans`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(planPayload),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('[PayPal Plan Error]', error);
    throw new Error(`Failed to create PayPal plan: ${error.message}`);
  }

  const data = await response.json();
  return data.id; // Retourne l'ID du plan
}

/**
 * Créer une souscription PayPal
 */
export async function createPayPalSubscription(subscriptionDetails: {
  planId: string;
  subscriberEmail: string;
  subscriberName: string;
  returnUrl: string;
}): Promise<{ subscriptionId: string; approveUrl: string }> {
  const accessToken = await getPayPalAccessToken();
  const apiBase = process.env.PAYPAL_API_BASE_URL || 'https://api.sandbox.paypal.com';

  const subscriptionPayload = {
    plan_id: subscriptionDetails.planId,
    subscriber: {
      email_address: subscriptionDetails.subscriberEmail,
      name: {
        given_name: subscriptionDetails.subscriberName,
      },
    },
    application_context: {
      brand_name: 'Jeezy TV',
      locale: 'fr-FR',
      user_action: 'SUBSCRIBE_NOW',
      return_url: subscriptionDetails.returnUrl,
      cancel_url: `${subscriptionDetails.returnUrl}?cancelled=true`,
    },
  };

  const response = await fetch(`${apiBase}/v1/billing/subscriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subscriptionPayload),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('[PayPal Subscription Error]', error);
    const err = new Error(`Failed to create subscription: ${error.message}`);
    // attach raw PayPal error for higher-level handlers to inspect
    try { (err as any).paypal = error; } catch (e) {}
    throw err;
  }

  const data = await response.json();
  const approveUrl = data.links?.find((link: any) => link.rel === 'approve')?.href;

  return {
    subscriptionId: data.id,
    approveUrl: approveUrl || '',
  };
}
