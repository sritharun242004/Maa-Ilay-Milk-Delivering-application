-- Run this in your database to check payments
-- This will show recent payment orders

SELECT
  "gatewayOrderId",
  "amountPaise" / 100 as "amount_rs",
  status,
  "createdAt",
  "completedAt"
FROM "PaymentOrder"
WHERE "paymentGateway" = 'CASHFREE'
ORDER BY "createdAt" DESC
LIMIT 5;

-- Check wallet transactions
SELECT
  type,
  "amountPaise" / 100 as "amount_rs",
  description,
  "createdAt"
FROM "WalletTransaction"
WHERE type = 'WALLET_TOPUP'
ORDER BY "createdAt" DESC
LIMIT 5;
