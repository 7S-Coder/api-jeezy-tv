const fs = require('fs');

function loadEnv(envPath) {
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split(/\r?\n/).forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) {
      let key = m[1].trim();
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  });
  return env;
}

async function run() {
  try {
    const env = loadEnv(require('path').resolve(__dirname, '../.env'));
    const client = env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    const secret = env.PAYPAL_CLIENT_SECRET;
    const apiBase = env.PAYPAL_API_BASE_URL || 'https://api.paypal.com';

    if (!client || !secret) {
      console.error('Missing NEXT_PUBLIC_PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET in .env');
      process.exit(1);
    }

    const auth = Buffer.from(`${client}:${secret}`).toString('base64');

    const res = await fetch(`${apiBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: 'grant_type=client_credentials'
    });

    const text = await res.text();
    if (!res.ok) {
      console.error('PayPal auth failed:', res.status, res.statusText);
      try { console.error('Body:', JSON.parse(text)); } catch(e) { console.error('Body:', text); }
      process.exit(2);
    }

    const data = JSON.parse(text);
    const token = data.access_token || '';
    console.log('PayPal auth success');
    console.log('Access token (truncated):', token.slice(0,8) + '...');
    process.exit(0);
  } catch (err) {
    console.error('Error during test:', err.message || err);
    process.exit(3);
  }
}

run();
