import { BaseRepository } from './BaseRepository.js';
import { DEFAULT_DAYPARTS, DAYPART_NAMES } from '../services/Dayparts.js';
import { DEMO_RESET_SCOPE, DEMO_RESET_SCOPE_FIELD } from '../services/DemoBaseline.js';

const DOCUMENT_ID = 'dayparts';

/** The network's Dayparts, kept with the platform configuration. */
export class DaypartRepository extends BaseRepository {
    constructor() {
        super('platform_config');
    }

    /** The saved Dayparts, or the defaults until the Super Administrator sets them. */
    async get() {
        const saved = await this.findById(DOCUMENT_ID);
        const source = saved || DEFAULT_DAYPARTS;
        return Object.fromEntries(DAYPART_NAMES.map(name => [
            name, { start: source[name].start, end: source[name].end },
        ]));
    }

    /** Saves validated Dayparts. Demo reset removes them, restoring the defaults. */
    async save(dayparts) {
        await this.update(DOCUMENT_ID, {
            ...Object.fromEntries(DAYPART_NAMES.map(name => [
                name, { start: dayparts[name].start, end: dayparts[name].end },
            ])),
            [DEMO_RESET_SCOPE_FIELD]: DEMO_RESET_SCOPE,
        });
        return this.get();
    }
}

export const daypartRepository = new DaypartRepository();
