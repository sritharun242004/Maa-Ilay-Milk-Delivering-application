import { checkAndChargePenalties } from './penaltyService';

/**
 * Daily penalty check scheduler
 * Runs every day at 1:00 AM to check and charge penalties for overdue bottles
 */
export function startPenaltyScheduler() {
  const checkPenaltiesDaily = async () => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Run at 1:00 AM (01:00) daily
    if (hour === 1 && minute === 0) {
      console.log('[Scheduler] Running daily penalty check at', now.toISOString());
      try {
        const results = await checkAndChargePenalties();
        const successCount = results.filter(r => r.success).length;
        const totalCharged = results.reduce((sum, r) => sum + (r.success ? r.totalPenaltyPaise : 0), 0);

        console.log(`[Scheduler] Penalty check completed. Charged ${successCount} customers. Total: ₹${totalCharged / 100}`);
      } catch (error) {
        console.error('[Scheduler] Error running penalty check:', error);
      }
    }
  };

  // Check every minute to see if it's time to run
  setInterval(checkPenaltiesDaily, 60 * 1000);

  console.log('[Scheduler] Penalty scheduler started. Will run daily at 1:00 AM');
}
