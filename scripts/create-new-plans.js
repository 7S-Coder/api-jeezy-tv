#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load environment variables from .env
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  
  envContent.split(/\r?\n/).forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      
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
const PRODUCT_ID = env.PAYPAL_PRODUCT_ID;

if (!CLIENT_ID || !CLIENT_SECRET || !PRODUCT_ID) {
  console.error('❌ Missing required environment variables in .env');
  console.error(`  NEXT_PUBLIC_PAYPAL_CLIENT_ID: ${CLIENT_ID ? '✓' : '✗'}`);
  console.error(`  PAYPAL_CLIENT_SECRET: ${CLIENT_SECRET ? '✓' : '✗'}`);
  console.error(`  PAYPAL_PRODUCT_ID: ${PRODUCT_ID ? '✓' : '✗'}`);
  process.exit(1);
}

// Get PayPal access token
async function getAccessToken() {
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get access token: ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Create a billing plan
async function createPlan(accessToken, name, price, interval) {
  const planData = {
    product_id: PRODUCT_ID,
    name: name,
    description: `${name} - €${price}/${interval.toLowerCase()}`,
    type: 'INFINITE',
    payment_preferences: {
      setup_fee: {
        currency_code: 'EUR',
        value: '0',
      },
      setup_fee_failure_action: 'CONTINUE',
      payment_failure_threshold: 3,
    },
    taxes: {
      percentage: '0',
    },
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
  };

  const response = await fetch(`${PAYPAL_API_BASE}/v1/billing/plans`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `plan-${Date.now()}`,
    },
    body: JSON.stringify(planData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`PayPal Error (${response.status}):`, errorText);
    throw new Error(`Failed to create ${name} plan`);
  }

  const data = await response.json();
  return data.id;
}

// Main execution
async function main() {
  console.log('🔄 Creating new PayPal billing plans...\n');

  try {
    console.log('🔐 Authenticating with PayPal...');
    const accessToken = await getAccessToken();
    console.log('✅ Authentication successful\n');

    console.log('📝 Creating Monthly Plan (€2.99)...');
    const monthlyPlanId = await createPlan(
      accessToken,
      'VIP Monthly',
      '2.99',
      'MONTH'
    );
    console.log(`✅ Monthly Plan ID: ${monthlyPlanId}\n`);

    console.log('📝 Creating Annual Plan (€33.99)...');
    const annualPlanId = await createPlan(
      accessToken,
      'VIP Annual',
      '33.99',
      'YEAR'
    );
    console.log(`✅ Annual Plan ID: ${annualPlanId}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ PLANS CREATED SUCCESSFULLY!\n');
    console.log('Update your backend files with these new plan IDs:\n');
    console.log('File: /app/api/payment/create-vip-subscription/route.ts');
    console.log('─────────────────────────────────────────────────────');
    console.log(`const VIP_MONTHLY_PLAN_ID = '${monthlyPlanId}';`);
    console.log(`const VIP_ANNUAL_PLAN_ID = '${annualPlanId}';\n`);
    console.log('Or use environment variables:');
    console.log(`PAYPAL_VIP_MONTHLY_PLAN_ID=${monthlyPlanId}`);
    console.log(`PAYPAL_VIP_ANNUAL_PLAN_ID=${annualPlanId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
