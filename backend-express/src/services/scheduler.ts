import cron from 'node-cron';
import { checkAndChargePenalties } from './penaltyService';

/**
 * Daily penalty check scheduler
 * Runs every day at 1:00 AM IST to check and charge penalties for overdue bottles
 *
 * Uses node-cron for reliable scheduling with proper timezone support
 */
export function startPenaltyScheduler() {
  // Schedule job to run at 1:00 AM every day (IST timezone)
  // Cron format: second minute hour day month weekday
  // '0 1 * * *' = At 01:00 (1:00 AM) every day
  const job = cron.schedule('0 1 * * *', async () => {
    const now = new Date();
    console.log('[Scheduler] 🕐 Running daily penalty check at', now.toISOString());

    try {
      const results = await checkAndChargePenalties();
      const successCount = results.filter(r => r.success).length;
      const totalCharged = results.reduce((sum, r) => sum + (r.success ? r.totalPenaltyPaise : 0), 0);

      console.log(`[Scheduler] ✅ Penalty check completed. Charged ${successCount} customers. Total: ₹${totalCharged / 100}`);
    } catch (error) {
      console.error('[Scheduler] ❌ Error running penalty check:', error);
      // Log error but don't crash the scheduler
      // Next run will be attempted the following day
    }
  }, {
    timezone: 'Asia/Kolkata', // IST timezone for Pondicherry
  });

  job.start();

  console.log('[Scheduler] ✅ Penalty scheduler started. Will run daily at 1:00 AM IST');

  return job;
}

/**
 * Optional: Start additional scheduled jobs
 */
export function startAllSchedulers() {
  // Start penalty scheduler
  const penaltyJob = startPenaltyScheduler();

  // Can add more schedulers here in the future:
  // - Daily delivery creation (runs at midnight)
  // - Weekly reports
  // - Monthly billing reminders
  // - Database cleanup/archival jobs

  return {
    penaltyJob,
  };
}
