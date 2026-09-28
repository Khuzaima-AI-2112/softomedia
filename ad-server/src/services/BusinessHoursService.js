// BusinessHoursService - Logic for calculating effective hours and validating input
import BusinessHoursRepository from '../repositories/BusinessHoursRepository.js';
import SpecialHoursRepository from '../repositories/SpecialHoursRepository.js';

class BusinessHoursServiceClass {
    getOperatingHourRange(effectiveHours) {
        if (effectiveHours?.is_closed) {
            return { start: null, end: null, is_closed: true, total_loops: 0 };
        }

        const toMinutes = value => {
            const [hours, minutes] = value.split(':').map(Number);
            return hours * 60 + minutes;
        };
        const start = Math.ceil(toMinutes(effectiveHours.open_time) / 60);
        const closeMinutes = toMinutes(effectiveHours.close_time);
        const end = closeMinutes === 0 ? 24 : Math.floor(closeMinutes / 60);
        return { start, end, is_closed: false, total_loops: end - start };
    }

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
        const defaults = await BusinessHoursRepository.getDefaultHours(storeId);
        const dayDefault = this.weeklyHoursOn(defaults, dateString);

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
     * The entry of a weekly schedule that applies to a date, if it has one.
     * @param {Array} weeklyHours
     * @param {string} dateString - YYYY-MM-DD
     */
    weeklyHoursOn(weeklyHours, dateString) {
        const [year, month, day] = dateString.split('-').map(Number);
        const dayOfWeek = new Date(year, month - 1, day).getDay(); // 0-6 (Sun-Sat)
        return weeklyHours.find(d => parseInt(d.day_of_week) === dayOfWeek);
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
        this.validateWeeklyHours(weeklyHours);
        return BusinessHoursRepository.updateDefaultHours(storeId, weeklyHours);
    }

    /**
     * Update special hours
     */
    async updateSpecialHours(storeId, date, hoursData) {
        this.validateHours(hoursData);
        return SpecialHoursRepository.updateSpecialHours(storeId, date, hoursData);
    }

    /**
     * List all special hours for a store
     */
    async listSpecialHours(storeId) {
        return SpecialHoursRepository.getAllStoreSpecialHours(storeId);
    }

    /** Throws when a day of a weekly schedule is open without a valid time range. */
    validateWeeklyHours(hoursArray) {
        hoursArray.forEach(h => this.validateHours(h));
    }

    /** Throws when the hours are open without a valid time range. */
    validateHours(hoursData) {
        if (!hoursData.is_closed) {
            this._validateTimeRange(hoursData.open_time, hoursData.close_time);
        }
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
