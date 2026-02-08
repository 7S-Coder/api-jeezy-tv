// app/api/payment/verify-plans/route.ts
// Endpoint de diagnostic pour vérifier que les plans PayPal existent côté live

import { getPayPalAccessToken } from "@/lib/paypal-helpers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const FRONTEND = process.env.NEXT_PUBLIC_APP_URL || '';
  const headers = {
    "Access-Control-Allow-Origin": FRONTEND,
    "Access-Control-Allow-Credentials": "true",
  };

  try {
    const apiBase = process.env.PAYPAL_API_BASE_URL || 'https://api.paypal.com';
    const monthlyPlanId = process.env.PAYPAL_VIP_MONTHLY_PLAN_ID || process.env.PAYPAL_MONTHLY_PLAN_ID || '(not set)';
    const annualPlanId = process.env.PAYPAL_VIP_ANNUAL_PLAN_ID || process.env.PAYPAL_ANNUAL_PLAN_ID || '(not set)';
    const productId = process.env.PAYPAL_PRODUCT_ID || '(not set)';

    console.log('[verify-plans] Checking plans on:', apiBase);

    const accessToken = await getPayPalAccessToken();
    console.log('[verify-plans] Auth OK');

    // Vérifier le plan mensuel
    const monthlyResult = await checkPlan(apiBase, accessToken, monthlyPlanId, 'Monthly');
    
    // Vérifier le plan annuel
    const annualResult = await checkPlan(apiBase, accessToken, annualPlanId, 'Annual');

    // Vérifier le produit
    const productResult = await checkProduct(apiBase, accessToken, productId);

    return NextResponse.json({
      environment: apiBase.includes('sandbox') ? 'SANDBOX' : 'LIVE',
      apiBase,
      productId,
      product: productResult,
      plans: {
        monthly: { id: monthlyPlanId, ...monthlyResult },
        annual: { id: annualPlanId, ...annualResult },
      },
      envVars: {
        PAYPAL_API_BASE_URL: process.env.PAYPAL_API_BASE_URL || '(not set - using fallback)',
        PAYPAL_VIP_MONTHLY_PLAN_ID: process.env.PAYPAL_VIP_MONTHLY_PLAN_ID || '(not set)',
        PAYPAL_VIP_ANNUAL_PLAN_ID: process.env.PAYPAL_VIP_ANNUAL_PLAN_ID || '(not set)',
        PAYPAL_MONTHLY_PLAN_ID: process.env.PAYPAL_MONTHLY_PLAN_ID || '(not set)',
        PAYPAL_ANNUAL_PLAN_ID: process.env.PAYPAL_ANNUAL_PLAN_ID || '(not set)',
        PAYPAL_PRODUCT_ID: process.env.PAYPAL_PRODUCT_ID || '(not set)',
        NEXT_PUBLIC_PAYPAL_CLIENT_ID: (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '').substring(0, 15) + '...',
      },
    }, { status: 200, headers });
  } catch (error) {
    console.error('[verify-plans] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers }
    );
  }
}

async function checkPlan(apiBase: string, accessToken: string, planId: string, label: string) {
  if (planId === '(not set)') {
    return { exists: false, error: 'Plan ID not configured' };
  }

  try {
    const res = await fetch(`${apiBase}/v1/billing/plans/${planId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[verify-plans] ${label} plan ${planId}: ${res.status}`, body);
      return { exists: false, status: res.status, error: body };
    }

    const data = await res.json();
    return {
      exists: true,
      status: data.status,
      name: data.name,
      product_id: data.product_id,
      billing_cycles: data.billing_cycles?.map((c: any) => ({
        interval: c.frequency?.interval_unit,
        price: c.pricing_scheme?.fixed_price?.value,
        currency: c.pricing_scheme?.fixed_price?.currency_code,
      })),
    };
  } catch (err) {
    return { exists: false, error: String(err) };
  }
}

async function checkProduct(apiBase: string, accessToken: string, productId: string) {
  if (productId === '(not set)') {
    return { exists: false, error: 'Product ID not configured' };
  }

  try {
    const res = await fetch(`${apiBase}/v1/catalogs/products/${productId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const body = await res.text();
      return { exists: false, status: res.status, error: body };
    }

    const data = await res.json();
    return { exists: true, name: data.name, type: data.type, id: data.id };
  } catch (err) {
    return { exists: false, error: String(err) };
  }
}
