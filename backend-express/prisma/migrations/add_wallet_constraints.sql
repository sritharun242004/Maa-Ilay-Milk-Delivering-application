-- Add wallet balance constraints to prevent extreme negative balances
-- This provides an additional layer of protection at the database level

-- Add constraint to prevent wallet balance from going below -100000 paise (₹1000)
-- This is our absolute minimum allowed balance to prevent unlimited debt
ALTER TABLE "Wallet"
ADD CONSTRAINT wallet_balance_minimum
CHECK (balance_paise >= -100000);

-- Add unique constraint on customer_id for MonthlyPayment to ensure no duplicates
-- (This may already exist but we'll add it for safety)
-- ALTER TABLE "MonthlyPayment"
-- ADD CONSTRAINT monthly_payment_unique_customer_month
-- UNIQUE (customer_id, year, month);

-- Note: The above constraint already exists in the schema as @@unique([customerId, year, month])

-- Create partial index for active customers to improve status calculation queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_active_status
ON "Customer" (delivery_person_id, status)
WHERE status IN ('ACTIVE', 'PENDING_APPROVAL');

-- Create index for wallet balance queries (used in status calculations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_balance
ON "Wallet" (customer_id, balance_paise);

-- Create index for pause date queries (used in delivery eligibility)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pause_date_range
ON "Pause" (customer_id, pause_date)
WHERE pause_date >= CURRENT_DATE;