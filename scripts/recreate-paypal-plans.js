/**
 * Script pour recréer les plans PayPal avec les nouveaux tarifs
 * Usage: node scripts/recreate-paypal-plans.js
 */

const fs = require('fs');
const path = require('path');

// Charger les variables d'environnement depuis .env
function loadEnv() {
  const envPath = require('path').resolve(__dirname, '../.env');
  const envContent = require('fs').readFileSync(envPath, 'utf-8');
  const env = {};
  
  envContent.split(/\r?\n/).forEach((line) => {
    // Skip comments and empty lines
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      if (key && value) {
        env[key] = value;
      }
    }
  });
  
  return env;
}

const env = loadEnv();
const PAYPAL_API_BASE = env.PAYPAL_API_BASE_URL || 'https://api.sandbox.paypal.com';
const CLIENT_ID = env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
const CLIENT_SECRET = env.PAYPAL_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Missing NEXT_PUBLIC_PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET in .env');
  console.error('Current values:');
  console.error(`  NEXT_PUBLIC_PAYPAL_CLIENT_ID: ${CLIENT_ID ? '✓ set (' + CLIENT_ID.substring(0, 20) + '...)' : '✗ missing'}`);
  console.error(`  PAYPAL_CLIENT_SECRET: ${CLIENT_SECRET ? '✓ set (' + CLIENT_SECRET.substring(0, 20) + '...)' : '✗ missing'}`);
  console.error('\nDebug - Keys found in .env:', Object.keys(env).filter(k => k.includes('PAYPAL')));
  process.exit(1);
}

async function getAccessToken() {
  try {
    const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`PayPal auth failed: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('❌ Failed to get PayPal access token:', error);
    throw error;
  }
}

async function listPlans(accessToken) {
  try {
    const response = await fetch(
      `${PAYPAL_API_BASE}/v1/billing/plans`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`PayPal API Error (${response.status}):`, errorText);
      throw new Error(`Failed to list plans: ${response.status}`);
    }

    const data = await response.json();
    return data.plans || [];
  } catch (error) {
    console.error('❌ Failed to list plans:', error);
    throw error;
  }
}

async function updatePlanStatus(planId, status, accessToken) {
  try {
    const response = await fetch(
      `${PAYPAL_API_BASE}/v1/billing/plans/${planId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            op: 'replace',
            path: '/status',
            value: status,
          },
        ]),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update plan: ${response.status}`);
    }

    console.log(`✓ Plan ${planId} updated to ${status}`);
  } catch (error) {
    console.error(`❌ Failed to update plan ${planId}:`, error);
  }
}

async function createPlan(name, description, price, interval, accessToken) {
  try {
    const response = await fetch(
      `${PAYPAL_API_BASE}/v1/billing/plans`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: 'PROD_VIP',
          name,
          description,
          type: 'SUBSCRIPTION',
          billing_cycles: [
            {
              frequency: {
                interval_unit: interval,
                interval_count: 1,
              },
              tenure_type: 'REGULAR',
              sequence: 1,
              total_cycles: 0,
              pricing_scheme: {
                fixed_price: {
                  currency_code: 'EUR',
                  value: price,
                },
              },
            },
          ],
          payment_preferences: {
            auto_bill_amount: 'YES',
            payment_failure_threshold: 3,
            setup_fee: {
              currency_code: 'EUR',
              value: '0.00',
            },
            setup_fee_failure_action: 'CONTINUE',
          },
          taxes: {
            percentage: '0',
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to create plan: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const planId = data.id;
    console.log(`✓ Created plan: ${name} (ID: ${planId}, Price: €${price}/${interval})`);
    return planId;
  } catch (error) {
    console.error(`❌ Failed to create plan ${name}:`, error);
    throw error;
  }
}

async function main() {
  console.log('🔄 Starting PayPal plans recreation...\n');

  try {
    const accessToken = await getAccessToken();
    console.log('✓ Got PayPal access token\n');

    // List existing plans
    console.log('📋 Listing existing plans...');
    const existingPlans = await listPlans(accessToken);
    const vipPlans = existingPlans.filter((p) =>
      p.name.toLowerCase().includes('vip')
    );

    console.log(`Found ${vipPlans.length} VIP plans:\n`);
    vipPlans.forEach((plan) => {
      console.log(`  - ${plan.name} (ID: ${plan.id}, Status: ${plan.status})`);
    });

    // Archive old plans
    console.log('\n🔒 Archiving old plans...');
    for (const plan of vipPlans) {
      if (plan.status === 'ACTIVE') {
        await updatePlanStatus(plan.id, 'INACTIVE', accessToken);
      }
    }

    // Create new plans
    console.log('\n✨ Creating new plans with updated prices...\n');

    const monthlyPlanId = await createPlan(
      'VIP Monthly',
      'VIP Monthly Subscription - €2.99/month',
      '2.99',
      'MONTH',
      accessToken
    );

    const annualPlanId = await createPlan(
      'VIP Annual',
      'VIP Annual Subscription - €33.99/year',
      '33.99',
      'YEAR',
      accessToken
    );

    // Output results
    console.log('\n' + '='.repeat(60));
    console.log('✅ PLANS CREATED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\nUpdate your backend with these IDs:\n');
    console.log(`Monthly Plan ID: ${monthlyPlanId}`);
    console.log(`Annual Plan ID:  ${annualPlanId}`);
    console.log('\n📝 Update create-vip-subscription/route.ts:');
    console.log(`
const planConfig: Record<string, { planId: string; name: string; price: string; interval: string }> = {
  vip_monthly: { planId: "${monthlyPlanId}", name: "VIP Monthly", price: "2.99", interval: "MONTH" },
  vip_annual: { planId: "${annualPlanId}", name: "VIP Annual", price: "33.99", interval: "YEAR" },
};
`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }
}

main();
