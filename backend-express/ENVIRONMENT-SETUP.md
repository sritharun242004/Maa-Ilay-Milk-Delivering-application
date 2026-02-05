# Environment Variables Setup Guide

This guide explains how to set up environment variables for different environments.

## Quick Start

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Generate secrets:**
   ```bash
   # Generate SESSION_SECRET
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

   # Generate CSRF_SECRET
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

3. **Fill in your database URL and other values**

4. **Start the server:**
   ```bash
   npm run dev
   ```

---

## Environment Files

### `.env` (Local Development)
- Your personal development environment
- **NOT** committed to git
- Copy from `.env.example`

### `.env.development` (Development Template)
- Template for development environment
- Safe to commit (no real credentials)
- Used as reference

### `.env.staging` (Staging Environment)
- Configuration for staging server
- **NOT** committed to git
- Use secrets management in production

### `.env.production` (Production Environment)
- Configuration for production server
- **NOT** committed to git
- **CRITICAL**: Use secrets management service

---

## Required Variables

These variables **MUST** be set for the application to start:

### `DATABASE_URL`
PostgreSQL connection string

**Format:**
```
DATABASE_URL="postgresql://user:password@host:port/database?schema=public"
```

**Examples:**
- Development: `postgresql://dev:dev123@localhost:5432/maa_ilay_dev?schema=public`
- Production: `postgresql://prod:***@db.example.com:5432/maa_ilay_prod?schema=public`

---

### `SESSION_SECRET`
Secret for signing session cookies

**Requirements:**
- Minimum 32 characters
- Should be at least 64 characters for production
- Must be cryptographically random

**Generate:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**⚠️ Security Notes:**
- Use different secrets for each environment
- Never share or commit production secrets
- Rotate secrets periodically

---

### `CSRF_SECRET`
Secret for CSRF token generation

**Requirements:**
- Minimum 32 characters
- Should be at least 64 characters for production
- Must be cryptographically random
- Must be different from SESSION_SECRET

**Generate:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

### `FRONTEND_URL`
URL of the frontend application (for CORS)

**Examples:**
- Development: `http://localhost:5173`
- Staging: `https://staging.maailay.com`
- Production: `https://maailay.com`

**⚠️ Important:**
- Must match exactly (including protocol and port)
- No trailing slash

---

## Optional Variables

### `NODE_ENV`
Environment name

**Values:**
- `development` - Local development
- `staging` - Staging server
- `production` - Production server

**Default:** `development`

---

### `PORT`
Server port number

**Default:** `4000`

**Examples:**
- Development: `4000`
- Production: `80` or `443` (with reverse proxy)

---

### `LOG_LEVEL`
Logging verbosity

**Values:**
- `debug` - Very verbose (development)
- `info` - Informational messages
- `warn` - Warnings and errors only
- `error` - Errors only

**Default:** `info`

**Recommended:**
- Development: `debug`
- Staging: `info`
- Production: `warn`

---

### `DISABLE_RATE_LIMITING`
Disable rate limiting for testing

**Values:**
- `true` - Disable rate limiting
- `false` - Enable rate limiting

**Default:** `false`

**⚠️ Warning:**
- Should ALWAYS be `false` in production
- Only use `true` for local testing

---

## Environment-Specific Setup

### Local Development

1. Copy example file:
   ```bash
   cp .env.example .env
   ```

2. Generate secrets:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

3. Update `.env`:
   ```bash
   DATABASE_URL="postgresql://user:password@localhost:5432/maa_ilay_dev?schema=public"
   SESSION_SECRET=<generated-secret>
   CSRF_SECRET=<generated-secret>
   FRONTEND_URL=http://localhost:5173
   NODE_ENV=development
   PORT=4000
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

---

### Staging Server

**Option 1: Environment Variables (Recommended)**

Set variables in your hosting platform:
- Heroku: `heroku config:set KEY=value`
- Vercel: Add in Project Settings → Environment Variables
- AWS: Use AWS Secrets Manager
- Docker: Pass via `-e` flag or docker-compose.yml

**Option 2: .env File**

1. SSH into staging server
2. Create `.env` file:
   ```bash
   cp .env.staging .env
   ```
3. Fill in real values
4. Restart application

---

### Production Server

**⚠️ CRITICAL: Use Secrets Management**

**DO NOT** use `.env` files in production. Instead:

**AWS:**
- Use AWS Secrets Manager or Parameter Store
- Example: `aws secretsmanager get-secret-value --secret-id prod/maa-ilay/db`

**Heroku:**
```bash
heroku config:set DATABASE_URL=<value>
heroku config:set SESSION_SECRET=<value>
```

**Vercel:**
- Add secrets in Project Settings → Environment Variables
- Mark as "Production" environment

**Docker:**
```bash
docker run -e DATABASE_URL=<value> -e SESSION_SECRET=<value> ...
```

**Kubernetes:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: maa-ilay-secrets
type: Opaque
data:
  database-url: <base64-encoded>
  session-secret: <base64-encoded>
```

---

## Validation

The application validates environment variables on startup.

**If validation fails:**
```
✗ Environment validation failed: Missing required environment variables: SESSION_SECRET, CSRF_SECRET
Please check your .env file and ensure all required variables are set
```

**Solution:**
1. Check that all required variables are set
2. Verify SESSION_SECRET is at least 32 characters
3. Verify CSRF_SECRET is at least 32 characters
4. Ensure DATABASE_URL is valid

---

## Security Best Practices

### ✅ DO:
- Use different secrets for each environment
- Generate secrets using cryptographically secure methods
- Use secrets management services in production
- Rotate secrets periodically (every 90 days)
- Keep secrets in encrypted storage
- Use principle of least privilege
- Audit secret access regularly

### ❌ DON'T:
- Commit `.env` files to git
- Share secrets via email or chat
- Reuse secrets across environments
- Use weak or predictable secrets
- Store secrets in plain text
- Hard-code secrets in source code

---

## Troubleshooting

### "Missing required environment variables"
**Cause:** Required variables not set

**Solution:**
1. Copy `.env.example` to `.env`
2. Fill in all required values
3. Restart server

---

### "SESSION_SECRET must be at least 32 characters"
**Cause:** Secret too short

**Solution:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

### "Database connection failed"
**Cause:** Invalid DATABASE_URL

**Solution:**
1. Check database is running
2. Verify connection string format
3. Test connection: `psql <DATABASE_URL>`

---

### "CORS error"
**Cause:** FRONTEND_URL doesn't match

**Solution:**
1. Check FRONTEND_URL matches exactly
2. Include protocol (http:// or https://)
3. Include port if not default (80/443)
4. No trailing slash

---

## References

- [Twelve-Factor App - Config](https://12factor.net/config)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
