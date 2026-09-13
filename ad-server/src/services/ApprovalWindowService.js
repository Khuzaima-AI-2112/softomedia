import { dailyScheduleRepository } from '../repositories/DailyScheduleRepository.js';
import { loopRepository } from '../repositories/LoopRepository.js';
import { schedulingAuditRepository } from '../repositories/SchedulingAuditRepository.js';
import { BusinessHoursService } from './BusinessHoursService.js';

export class ApprovalWindowError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = 'ApprovalWindowError';
        this.status = status;
    }
}

function previousDate(date) {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

/** Convert an unambiguous Store-local wall-clock value to an instant. */
export function storeLocalInstant(date, hour, minute, timeZone) {
    const [year, month, day] = date.split('-').map(Number);
    const targetWallClock = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    let instant = new Date(targetWallClock);
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const parts = Object.fromEntries(
            formatter.formatToParts(instant)
                .filter(part => part.type !== 'literal')
                .map(part => [part.type, Number(part.value)]),
        );
        const representedWallClock = Date.UTC(
            parts.year,
            parts.month - 1,
            parts.day,
            parts.hour,
            parts.minute,
            parts.second,
        );
        const correction = targetWallClock - representedWallClock;
        if (correction === 0) return instant;
        instant = new Date(instant.getTime() + correction);
    }
    return instant;
}

export class ApprovalWindowService {
    async firstBroadcastInstant(store, date, schedule = null) {
        const savedSchedule = schedule || await dailyScheduleRepository.findByStoreAndDate(store.id, date);
        let hours = savedSchedule?.operating_hours || [];
        if (hours.length === 0) {
            const loops = await loopRepository.findAll({
                where: [['store_id', '==', store.id], ['date', '==', date]],
            });
            hours = loops.map(loop => loop.hour);
        }
        if (hours.length === 0) {
            const effectiveHours = await BusinessHoursService.getEffectiveHours(store.id, date);
            const range = BusinessHoursService.getOperatingHourRange(effectiveHours);
            if (range.is_closed || range.start === null) {
                throw new ApprovalWindowError('Broadcast date has no scheduled hours', 409);
            }
            hours = [range.start];
        }
        return storeLocalInstant(date, Math.min(...hours), 0, store.time_zone);
    }

    normalDeadlineInstant(store, date) {
        return storeLocalInstant(previousDate(date), 18, 0, store.time_zone);
    }

    async describe(store, date, now = new Date()) {
        const schedule = await dailyScheduleRepository.findByStoreAndDate(store.id, date);
        const normalDeadline = this.normalDeadlineInstant(store, date);
        const firstBroadcast = await this.firstBroadcastInstant(store, date, schedule);
        const reopened = schedule?.approval_window?.reopened || null;
        const reopenedDeadline = reopened?.expires_at ? new Date(reopened.expires_at) : null;
        const effectiveDeadline = reopenedDeadline && reopenedDeadline > normalDeadline
            ? reopenedDeadline
            : normalDeadline;
        const state = now >= firstBroadcast
            ? 'broadcast_started'
            : now < effectiveDeadline ? 'open' : 'expired';

        return {
            normal_deadline: normalDeadline.toISOString(),
            effective_deadline: effectiveDeadline.toISOString(),
            first_broadcast: firstBroadcast.toISOString(),
            state,
            reopened,
        };
    }

    async assertOpen(store, date, now = new Date()) {
        const window = await this.describe(store, date, now);
        if (window.state !== 'open') {
            throw new ApprovalWindowError('Approval window is closed', 409);
        }
        return window;
    }

    async reopen(store, date, { reason, expiresAt, actor }, now = new Date()) {
        const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
        if (!normalizedReason) throw new ApprovalWindowError('Reason is required');

        const localExpiryMatch = typeof expiresAt === 'string'
            ? expiresAt.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/)
            : null;
        const expiry = localExpiryMatch
            ? storeLocalInstant(localExpiryMatch[1], Number(localExpiryMatch[2]), Number(localExpiryMatch[3]), store.time_zone)
            : new Date(expiresAt);
        if (!expiresAt || Number.isNaN(expiry.getTime())) {
            throw new ApprovalWindowError('A valid expiry is required');
        }

        const current = await this.describe(store, date, now);
        if (current.state === 'open') {
            throw new ApprovalWindowError('Approval window is still open', 409);
        }
        if (now >= new Date(current.first_broadcast)) {
            throw new ApprovalWindowError('Broadcasting has started', 409);
        }
        if (expiry <= now) throw new ApprovalWindowError('Expiry must be in the future');
        if (expiry > new Date(current.first_broadcast)) {
            throw new ApprovalWindowError('Expiry cannot be after first broadcast');
        }

        const reopened = {
            actor_id: actor.id,
            actor_role: actor.role,
            reason: normalizedReason,
            store_id: store.id,
            broadcast_date: date,
            expires_at: expiry.toISOString(),
            reopened_at: now.toISOString(),
        };
        const approvalWindow = {
            ...current,
            state: 'open',
            effective_deadline: expiry.toISOString(),
            reopened,
        };
        await dailyScheduleRepository.save(store.id, date, {
            approval_window: approvalWindow,
        });
        await schedulingAuditRepository.logAction('approval_window_reopened', {
            user_id: actor.id,
            actor_role: actor.role,
            reason: normalizedReason,
            store_id: store.id,
            broadcast_date: date,
            expires_at: expiry.toISOString(),
            timestamp: now.toISOString(),
        });
        return approvalWindow;
    }
}

export const approvalWindowService = new ApprovalWindowService();
