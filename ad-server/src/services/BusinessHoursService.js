// BusinessHoursService - Logic for calculating effective hours and validating input
import BusinessHoursRepository from '../repositories/BusinessHoursRepository.js';
import SpecialHoursRepository from '../repositories/SpecialHoursRepository.js';

class BusinessHoursServiceClass {
    /**
     * Get effective hours for a store on a given date
     * @param {string} storeId 
     * @param {string} dateString - YYYY-MM-DD
     */
    async getEffectiveHours(storeId, dateString) {
        // 1. Check for special hours (overrides)
        const special = await SpecialHoursRepository.getSpecialHours(storeId, dateString);
        if (special) {
            return {
                store_id: storeId,
                date: dateString,
                type: 'special',
                ...special
            };
        }

        // 2. Fallback to default weekly hours
        // Use a more robust way to get local day of week from YYYY-MM-DD
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const dayOfWeek = date.getDay(); // 0-6 (Sun-Sat)

        const defaults = await BusinessHoursRepository.getDefaultHours(storeId);
        const dayDefault = defaults.find(d => parseInt(d.day_of_week) === dayOfWeek);

        if (!dayDefault) {
            return {
                store_id: storeId,
                date: dateString,
                type: 'missing_default',
                is_closed: true,
                reason: 'No default schedule set'
            };
        }

        return {
            store_id: storeId,
            date: dateString,
            type: 'default',
            ...dayDefault
        };
    }

    /**
     * Get weekly schedule
     */
    async getWeeklyHours(storeId) {
        return BusinessHoursRepository.getDefaultHours(storeId);
    }

    /**
     * Update weekly schedule
     */
    async updateWeeklyHours(storeId, weeklyHours) {
        this._validateHoursBatch(weeklyHours);
        return BusinessHoursRepository.updateDefaultHours(storeId, weeklyHours);
    }

    /**
     * Update special hours
     */
    async updateSpecialHours(storeId, date, hoursData) {
        if (!hoursData.is_closed) {
            this._validateTimeRange(hoursData.open_time, hoursData.close_time);
        }
        return SpecialHoursRepository.updateSpecialHours(storeId, date, hoursData);
    }

    /**
     * List all special hours for a store
     */
    async listSpecialHours(storeId) {
        return SpecialHoursRepository.getAllStoreSpecialHours(storeId);
    }

    _validateHoursBatch(hoursArray) {
        hoursArray.forEach(h => {
            if (!h.is_closed) {
                this._validateTimeRange(h.open_time, h.close_time);
            }
        });
    }

    _validateTimeRange(open, close) {
        if (!open || !close) {
            throw new Error('Open and close times are required when not closed');
        }
        if (open >= close) {
            throw new Error(`Open time (${open}) must be before close time (${close})`);
        }
    }
}

export const BusinessHoursService = new BusinessHoursServiceClass();
export default BusinessHoursService;
