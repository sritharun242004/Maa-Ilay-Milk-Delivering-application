#!/bin/bash

# Production Setup Helper Script
# This script helps generate secure secrets and validates production configuration

echo "🚀 Maa Ilay - Production Setup Helper"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js is installed"
echo ""

# Generate SESSION_SECRET
echo "🔐 Generating SESSION_SECRET..."
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('base64'))")
echo "SESSION_SECRET=$SESSION_SECRET"
echo ""

# Generate CSRF_SECRET
echo "🔐 Generating CSRF_SECRET..."
CSRF_SECRET=$(node -e "console.log(require('crypto').randomBytes(128).toString('hex'))")
echo "CSRF_SECRET=$CSRF_SECRET"
echo ""

# Create production .env template
echo "📝 Creating .env.production template..."
cat > .env.production.template << EOF
# ==========================================
# PRODUCTION ENVIRONMENT VARIABLES
# ==========================================
# Generated on: $(date)

# Database - REPLACE with your production database URL
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"

# Server
PORT=4000
NODE_ENV=production

# URLs - REPLACE with your actual domains
FRONTEND_URL=https://your-frontend-domain.com
BACKEND_URL=https://your-backend-domain.com

# Session Secret - Auto-generated (DO NOT SHARE!)
SESSION_SECRET="$SESSION_SECRET"

# CSRF Secret - Auto-generated (DO NOT SHARE!)
CSRF_SECRET="$CSRF_SECRET"

# Google OAuth - REPLACE with production credentials
GOOGLE_CLIENT_ID=your-production-google-client-id
GOOGLE_CLIENT_SECRET=your-production-google-client-secret
GOOGLE_CALLBACK_URL=https://your-backend-domain.com/api/auth/google/callback

# ==========================================
# CASHFREE PRODUCTION
# ==========================================
# Get these from: https://merchant.cashfree.com/ (Production mode)
CASHFREE_APP_ID=YOUR_PRODUCTION_APP_ID
CASHFREE_SECRET_KEY=YOUR_PRODUCTION_SECRET_KEY
CASHFREE_ENVIRONMENT=PRODUCTION

# ==========================================
# OPTIONAL - Email Configuration
# ==========================================
# EMAIL_USER=your-email@gmail.com
# EMAIL_PASSWORD=your-app-password
# EMAIL_FROM=noreply@maa-ilay.com

# ==========================================
# OPTIONAL - Monitoring
# ==========================================
# SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
EOF

echo "✅ Created .env.production.template"
echo ""

# Create checklist
echo "📋 Creating production checklist..."
cat > PRODUCTION_CHECKLIST.txt << EOF
PRODUCTION DEPLOYMENT CHECKLIST
================================
Generated on: $(date)

Pre-Deployment:
[ ] KYC approved by Cashfree
[ ] Production API keys obtained
[ ] SSL certificate installed
[ ] Domain DNS configured
[ ] Database backup configured
[ ] Environment variables set

Configuration:
[ ] .env.production created from template
[ ] All REPLACE_ME values updated
[ ] Secrets are secure (not in git)
[ ] Database URL is production database
[ ] FRONTEND_URL is correct domain
[ ] BACKEND_URL is correct domain
[ ] CASHFREE_ENVIRONMENT=PRODUCTION
[ ] CASHFREE_APP_ID is production key
[ ] CASHFREE_SECRET_KEY is production key

Cashfree Dashboard:
[ ] Webhook URL configured: {YOUR_BACKEND_URL}/api/payment/webhook
[ ] Webhook events subscribed: PAYMENT_SUCCESS, PAYMENT_FAILED
[ ] Test webhook button clicked (should return 200)
[ ] Production mode activated
[ ] Settlement account configured

Deployment:
[ ] Backend deployed to production
[ ] Frontend deployed to production
[ ] HTTPS working (no mixed content warnings)
[ ] API endpoints accessible
[ ] Health check returns 200: {BACKEND_URL}/health

Testing:
[ ] Small test payment (₹1) successful
[ ] Wallet credited correctly
[ ] Webhook received
[ ] Transaction history shows payment
[ ] Payment failure handled correctly

Security:
[ ] CSRF protection working
[ ] Authentication working
[ ] Rate limiting configured
[ ] Error monitoring setup (Sentry)
[ ] Logs are being collected
[ ] Sensitive data not exposed in logs

Monitoring:
[ ] Error alerts configured
[ ] Payment alerts configured
[ ] Uptime monitoring setup
[ ] Admin dashboard accessible
[ ] Support team trained

Legal/Compliance:
[ ] Terms & conditions updated
[ ] Privacy policy mentions payment processing
[ ] Refund policy documented
[ ] GST compliance (if applicable)

Go-Live:
[ ] Soft launch with beta users (1-2 days)
[ ] Monitor for issues
[ ] Full launch
[ ] Announce to all users

Emergency:
[ ] Rollback plan documented
[ ] Emergency contacts saved
[ ] Feature flag to disable payments if needed
EOF

echo "✅ Created PRODUCTION_CHECKLIST.txt"
echo ""

# Security check
echo "🔒 Security Recommendations:"
echo "----------------------------"
echo "1. Never commit .env files to git"
echo "2. Use different secrets for prod and dev"
echo "3. Rotate secrets every 90 days"
echo "4. Enable 2FA on Cashfree account"
echo "5. Limit admin access to production"
echo "6. Set up alerts for failed payments"
echo "7. Regular security audits"
echo ""

# Next steps
echo "📌 NEXT STEPS:"
echo "----------------------------"
echo "1. Edit .env.production.template:"
echo "   - Replace all YOUR_* placeholders"
echo "   - Add production database URL"
echo "   - Add production domain URLs"
echo ""
echo "2. Rename to .env.production:"
echo "   mv .env.production.template .env.production"
echo ""
echo "3. Test locally with production config:"
echo "   NODE_ENV=production npm start"
echo ""
echo "4. Deploy to production server"
echo ""
echo "5. Configure Cashfree webhook in dashboard"
echo ""
echo "6. Test with real ₹1 payment"
echo ""
echo "7. Monitor for 24 hours before full launch"
echo ""

echo "✅ Production setup files created!"
echo ""
echo "📁 Files created:"
echo "  - .env.production.template (rename and edit)"
echo "  - PRODUCTION_CHECKLIST.txt (use as guide)"
echo ""
echo "⚠️  IMPORTANT: Keep your secrets secure!"
echo "🚀 Good luck with your production deployment!"
