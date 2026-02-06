/**
 * Test script to verify Cashfree API integration
 * Run with: node test-cashfree.js
 */

require('dotenv').config();
const axios = require('axios');

const APP_ID = process.env.CASHFREE_APP_ID;
const SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const ENVIRONMENT = process.env.CASHFREE_ENVIRONMENT || 'TEST';

const CASHFREE_BASE_URL = ENVIRONMENT === 'PRODUCTION'
  ? 'https://api.cashfree.com/pg'
  : 'https://sandbox.cashfree.com/pg';

console.log('🔍 Testing Cashfree Integration...\n');
console.log('Environment:', ENVIRONMENT);
console.log('Base URL:', CASHFREE_BASE_URL);
console.log('App ID:', APP_ID ? `${APP_ID.slice(0, 10)}...` : 'NOT SET');
console.log('Secret Key:', SECRET_KEY ? `${SECRET_KEY.slice(0, 10)}...` : 'NOT SET');
console.log('\n');

if (!APP_ID || !SECRET_KEY) {
  console.error('❌ ERROR: Cashfree credentials not set in .env file');
  console.error('Please set CASHFREE_APP_ID and CASHFREE_SECRET_KEY');
  process.exit(1);
}

async function testCashfreeAPI() {
  try {
    const orderId = `test_order_${Date.now()}`;

    const requestData = {
      order_amount: 100.00,
      order_currency: 'INR',
      order_id: orderId,
      customer_details: {
        customer_id: 'test_customer_123',
        customer_name: 'Test Customer',
        customer_email: 'test@example.com',
        customer_phone: '9999999999',
      },
      order_meta: {
        return_url: 'https://example.com/callback',
        notify_url: 'https://example.com/webhook',
      },
      order_note: 'Test order',
    };

    console.log('📤 Sending test order to Cashfree...');
    console.log('Request:', JSON.stringify(requestData, null, 2));
    console.log('\n');

    const response = await axios.post(
      `${CASHFREE_BASE_URL}/orders`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-version': '2023-08-01',
          'x-client-id': APP_ID,
          'x-client-secret': SECRET_KEY,
        },
      }
    );

    console.log('✅ SUCCESS! Cashfree API is working correctly.\n');
    console.log('Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('\n');
    console.log('Payment Session ID:', response.data.payment_session_id);
    console.log('Order ID:', response.data.order_id);

  } catch (error) {
    console.error('❌ ERROR: Cashfree API call failed\n');

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error Data:', JSON.stringify(error.response.data, null, 2));

      if (error.response.status === 401) {
        console.error('\n🔐 Authentication Error:');
        console.error('Your Cashfree credentials are incorrect.');
        console.error('Please verify CASHFREE_APP_ID and CASHFREE_SECRET_KEY in .env');
      } else if (error.response.status === 403) {
        console.error('\n🚫 Permission Error:');
        console.error('Your API keys may not have permission for this operation.');
      }
    } else {
      console.error('Error:', error.message);
    }

    process.exit(1);
  }
}

testCashfreeAPI();
