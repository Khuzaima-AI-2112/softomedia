export class LoopGenerator {
    /**
     * Generate the 60-second loop structure
     * 12 slots * 5 seconds = 60 seconds
     */
    generateLoop(content) {
        const slots = Array(12).fill(null).map((_, i) => ({
            slot: i + 1,
            type: 'EMPTY',
            duration: 5
        }));

        // Basic filling strategy for MVP
        content.forEach((item, index) => {
            if (index < 12) {
                slots[index] = {
                    ...slots[index],
                    type: item.type || 'PAID_AD',
                    content: item
                };
            }
        });

        return slots;
    }
}

export const loopGenerator = new LoopGenerator();
