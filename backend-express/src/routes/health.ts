import { Router, Request, Response } from 'express';
import prisma from '../config/prisma';
import { HEALTH } from '../config/constants';
import os from 'os';
import { execSync } from 'child_process';
import axios from 'axios';

const router = Router();

/**
 * Health Check Status
 */
type HealthStatus = 'ok' | 'degraded' | 'down';

interface HealthCheckResponse {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  environment: string;
  version?: string;
  checks?: {
    database?: { status: HealthStatus; responseTime?: number; error?: string };
    memory?: { status: HealthStatus; usagePercent?: number; free?: string; total?: string };
    disk?: { status: HealthStatus; freeSpace?: string; error?: string };
    cashfree?: { status: HealthStatus; responseTime?: number; error?: string };
  };
}

/**
 * Check database connectivity and response time
 */
async function checkDatabase(): Promise<{ status: HealthStatus; responseTime?: number; error?: string }> {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - start;

    return {
      status: responseTime < HEALTH.DB_MAX_RESPONSE_MS ? 'ok' : 'degraded',
      responseTime,
    };
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

/**
 * Check memory usage
 */
function checkMemory(): { status: HealthStatus; usagePercent: number; free: string; total: string } {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const usagePercent = Math.round((usedMem / totalMem) * 100);

  return {
    status: usagePercent > HEALTH.MAX_MEMORY_USAGE_PCT ? 'degraded' : 'ok',
    usagePercent,
    free: `${Math.round(freeMem / 1024 / 1024)}MB`,
    total: `${Math.round(totalMem / 1024 / 1024)}MB`,
  };
}

/**
 * Check disk space (Unix/Linux only)
 */
function checkDisk(): { status: HealthStatus; freeSpace?: string; error?: string } {
  try {
    // This only works on Unix/Linux systems
    if (process.platform === 'win32') {
      return { status: 'ok', freeSpace: 'N/A (Windows)' };
    }

    const output = execSync('df -m /').toString();
    const lines = output.split('\n');
    if (lines.length < 2) {
      return { status: 'ok', freeSpace: 'Unknown' };
    }

    const parts = lines[1].split(/\s+/);
    const available = parseInt(parts[3], 10); // Available space in MB

    return {
      status: available > HEALTH.MIN_DISK_SPACE_MB ? 'ok' : 'degraded',
      freeSpace: `${available}MB`,
    };
  } catch (error) {
    return {
      status: 'ok',
      error: 'Unable to check disk space',
    };
  }
}

/**
 * Check Cashfree API availability
 * Only runs if Cashfree credentials are configured
 */
async function checkCashfree(): Promise<{ status: HealthStatus; responseTime?: number; error?: string }> {
  try {
    // Skip check if Cashfree is not configured (optional service)
    if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) {
      return {
        status: 'ok',
        error: 'Cashfree not configured (optional)',
      };
    }

    const baseUrl = process.env.CASHFREE_ENVIRONMENT === 'PRODUCTION'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';

    const start = Date.now();

    // Make a lightweight API call to check connectivity
    // Using /orders endpoint with minimal data
    const response = await axios.get(`${baseUrl}/orders`, {
      headers: {
        'x-api-version': '2023-08-01',
        'x-client-id': process.env.CASHFREE_APP_ID,
        'x-client-secret': process.env.CASHFREE_SECRET_KEY,
      },
      timeout: 5000, // 5 second timeout
    });

    const responseTime = Date.now() - start;

    // If we get any response from Cashfree, consider it healthy
    return {
      status: responseTime < 3000 ? 'ok' : 'degraded', // Warn if response > 3s
      responseTime,
    };
  } catch (error: any) {
    // Cashfree might return 400/401 errors on invalid requests
    // But if we got a response, the API is reachable
    if (error.response && error.response.status) {
      return {
        status: 'ok', // API is reachable
        error: `API responded with ${error.response.status}`,
      };
    }

    // Network error or timeout - API is down
    return {
      status: 'down',
      error: error.message || 'Cashfree API unreachable',
    };
  }
}

/**
 * Calculate overall status from individual checks
 */
function calculateOverallStatus(checks: HealthCheckResponse['checks']): HealthStatus {
  if (!checks) return 'ok';

  const statuses = Object.values(checks).map(check => check.status);

  if (statuses.includes('down')) return 'down';
  if (statuses.includes('degraded')) return 'degraded';
  return 'ok';
}

/**
 * Basic health check
 * Returns 200 if app is running
 * GET /health
 */
router.get('/', async (req: Request, res: Response) => {
  const response: HealthCheckResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  };

  res.json(response);
});

/**
 * Readiness check
 * Returns 200 when app is ready to accept traffic
 * Checks database connectivity and critical services
 * GET /health/ready
 */
router.get('/ready', async (req: Request, res: Response) => {
  const checks = {
    database: await checkDatabase(),
    memory: checkMemory(),
    cashfree: await checkCashfree(), // Check payment gateway availability
  };

  const status = calculateOverallStatus(checks);

  const response: HealthCheckResponse = {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    checks,
  };

  // Return 503 if not ready
  const statusCode = status === 'ok' || status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(response);
});

/**
 * Liveness check
 * Returns 200 if process is alive
 * Used by orchestrators to determine if app should be restarted
 * GET /health/live
 */
router.get('/live', (req: Request, res: Response) => {
  const memCheck = checkMemory();

  // Only fail if memory is critically low (this would cause crashes)
  const status = memCheck.usagePercent > 95 ? 'down' : 'ok';

  const response: HealthCheckResponse = {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    checks: {
      memory: memCheck,
    },
  };

  const statusCode = status === 'ok' ? 200 : 503;
  res.status(statusCode).json(response);
});

/**
 * Startup check
 * Returns 200 when app has finished starting up
 * Used to delay traffic until app is fully initialized
 * GET /health/startup
 */
router.get('/startup', async (req: Request, res: Response) => {
  try {
    // Check if critical initialization is complete
    // For now, just check database connectivity
    const dbCheck = await checkDatabase();

    const status = dbCheck.status === 'down' ? 'down' : 'ok';

    const response: HealthCheckResponse = {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: dbCheck,
      },
    };

    const statusCode = status === 'ok' ? 200 : 503;
    res.status(statusCode).json(response);
  } catch (error) {
    res.status(503).json({
      status: 'down',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: {
          status: 'down',
          error: 'Startup check failed',
        },
      },
    });
  }
});

/**
 * Detailed health check (includes all checks)
 * GET /health/detailed
 */
router.get('/detailed', async (req: Request, res: Response) => {
  const checks = {
    database: await checkDatabase(),
    memory: checkMemory(),
    disk: checkDisk(),
    cashfree: await checkCashfree(),
  };

  const status = calculateOverallStatus(checks);

  const response: HealthCheckResponse = {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    checks,
  };

  res.json(response);
});

export default router;
