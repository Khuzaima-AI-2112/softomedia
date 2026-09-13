import cron from 'node-cron';
import { StoreRepository } from '../repositories/StoreRepository.js';
import { loopGenerationService } from '../services/LoopGenerationService.js';
import logger from './logger.js';

/**
 * Initializes all background automated processes including MVP D-1 Loop Generators.
 */
export const initCronJobs = () => {
    logger.info('[Cron] Initializing automated schedules...');

    // Runs at midnight (00:00) every single day server-time
    cron.schedule('0 0 * * *', async () => {
        logger.info('[Cron] Triggering Automated D-1 Loop Generation (Task 1B)');
        try {
            // Target date is tomorrow (D-1 means we generate it today for tomorrow)
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const targetDate = tomorrow.toISOString().split('T')[0];

            logger.info(`[Cron] Target processing date: ${targetDate}`);

            // Fetch all active operating locations (Stores)
            const stores = await StoreRepository.findAll();

            let totalLoopsGenerated = 0;

            for (const store of stores) {
                if (store.status !== 'active') continue;

                // We extract retailer_id directly from the Store document.
                const retailerId = store.retailer_id || 'system_unassigned';
                const storeId = store.id;

                try {
                    const generated = await loopGenerationService.generateDailyLoops(targetDate, retailerId, storeId);
                    totalLoopsGenerated += (generated?.length || 0);
                } catch (storeGenError) {
                    logger.error(`[Cron] Generation failed for Store ${storeId}`, { error: storeGenError.message });
                    // Continue generating other stores even if one specific store crashes
                }
            }

            logger.info(`[Cron] Successfully concluded D-1 Generation for ${targetDate}. Minted ${totalLoopsGenerated} Total Loops.`);
        } catch (error) {
            logger.error('[Cron] FATAL ERROR in D-1 Loop Generation Job executing', { error: error.message });
        }
    });

    logger.info('[Cron] Automated schedules actively listening.');
};
