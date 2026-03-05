/**
 * Quick diagnostic script to test Cashfree credentials
 * Run: node test-cashfree-auth.js
 *
 * This makes the same API call the app makes when creating a payment order
 * to verify credentials work.
 */
require('dotenv').config();
const axios = require('axios');

async function testCashfreeAuth() {
  const APP_ID = process.env.CASHFREE_APP_ID || '';
  const SECRET_KEY = process.env.CASHFREE_SECRET_KEY || '';
  const ENVIRONMENT = process.env.CASHFREE_ENVIRONMENT || 'NOT SET';

  const BASE_URL = ENVIRONMENT === 'PRODUCTION'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

  console.log('=== Cashfree Credential Diagnostic ===\n');
  console.log('CASHFREE_APP_ID:', APP_ID ? `${APP_ID.substring(0, 8)}...${APP_ID.substring(APP_ID.length - 4)} (length: ${APP_ID.length})` : '❌ NOT SET');
  console.log('CASHFREE_SECRET_KEY:', SECRET_KEY ? `${SECRET_KEY.substring(0, 8)}...${SECRET_KEY.substring(SECRET_KEY.length - 4)} (length: ${SECRET_KEY.length})` : '❌ NOT SET');
  console.log('CASHFREE_ENVIRONMENT:', ENVIRONMENT);
  console.log('Base URL:', BASE_URL);
  console.log('FRONTEND_URL:', process.env.FRONTEND_URL || '❌ NOT SET');
  console.log('BACKEND_URL:', process.env.BACKEND_URL || '❌ NOT SET');

  // Check for common issues
  if (APP_ID.startsWith('"') || APP_ID.endsWith('"') || APP_ID.startsWith("'") || APP_ID.endsWith("'")) {
    console.log('\n⚠️  WARNING: APP_ID has quotes in the value! Remove them on Render.');
  }
  if (SECRET_KEY.startsWith('"') || SECRET_KEY.endsWith('"') || SECRET_KEY.startsWith("'") || SECRET_KEY.endsWith("'")) {
    console.log('\n⚠️  WARNING: SECRET_KEY has quotes in the value! Remove them on Render.');
  }
  if (APP_ID.includes(' ') || SECRET_KEY.includes(' ')) {
    console.log('\n⚠️  WARNING: Credentials contain spaces! Check for trailing whitespace.');
  }

  if (!APP_ID || !SECRET_KEY) {
    console.log('\n❌ Missing credentials. Cannot test.');
    return;
  }

  console.log('\n--- Testing API call to Cashfree ---\n');

  try {
    // Make a minimal test order request
    const response = await axios.post(
      `${BASE_URL}/orders`,
      {
        order_amount: 1.00,
        order_currency: 'INR',
        order_id: `test_diag_${Date.now()}`,
        customer_details: {
          customer_id: 'test_customer',
          customer_name: 'Test User',
          customer_email: 'test@example.com',
          customer_phone: '9999999999',
        },
        order_meta: {
          return_url: 'https://example.com/callback?order_id={order_id}',
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-version': '2023-08-01',
          'x-client-id': APP_ID,
          'x-client-secret': SECRET_KEY,
        },
      }
    );

    console.log('✅ SUCCESS! Cashfree credentials are valid.');
    console.log('Order ID:', response.data.order_id);
    console.log('Payment Session ID:', response.data.payment_session_id ? 'received' : 'missing');
  } catch (error) {
    console.log('❌ FAILED!');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', JSON.stringify(error.response.data, null, 2));

      if (error.response.status === 401 || (error.response.data && error.response.data.message === 'authentication Failed')) {
        console.log('\n🔍 DIAGNOSIS: Cashfree rejected the credentials.');
        console.log('   Possible causes:');
        console.log('   1. APP_ID or SECRET_KEY is wrong');
        console.log('   2. Credentials have expired (regenerate on Cashfree dashboard)');
        console.log('   3. Extra whitespace or quotes in env var values');
        console.log('   4. Using sandbox keys with production URL or vice versa');
      }
    } else {
      console.log('Network error:', error.message);
    }
  }
}

testCashfreeAuth();
