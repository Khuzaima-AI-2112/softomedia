
import html2canvas from 'html2canvas';

/**
 * SnapshotService
 * Handles the visual capture of the application state.
 * Implements safety measures to prevent UI freezing during capture.
 */
export const captureScreen = async () => {
    try {
        // 1. Safety Check: Verify document exists
        if (typeof document === 'undefined') return null;

        const root = document.body;

        // 2. Optimization: Configure html2canvas for speed over precision
        const canvas = await html2canvas(root, {
            scale: 1, // Standard resolution (don't need retina for AI)
            logging: false,
            useCORS: true, // Allow cross-origin images if CORS headers are present
            allowTaint: false, // Don't crash on tainted images, just skip them
            ignoreElements: (element) => {
                // EXCLUSION: Don't capture the Gemini Widget itself
                if (element.classList.contains('gemini-ignore-capture')) return true;

                // EXCLUSION: Skip heavy media that might bloat the payload
                if (element.tagName === 'VIDEO') return true;

                return false;
            },
            onclone: (clonedDoc) => {
                // PRE-CAPTURE DOM MANIPULATION
                // We can hide sensitive elements or clean up the DOM here before rendering
                const widget = clonedDoc.querySelector('.gemini-widget-container');
                if (widget) widget.style.display = 'none';
            }
        });

        // 3. Compression: Convert to JPEG instead of PNG for smaller payload
        // Quality 0.7 is sufficient for text readability
        const base64Image = canvas.toDataURL('image/jpeg', 0.7);

        return base64Image;

    } catch (error) {
        // Known Issue: html2canvas vs Tailwind OKLCH colors
        // We suppress this specific error to maintain the "Quiet/Ghost" philosophy
        if (error.message?.includes('oklch')) {
            console.warn('[SnapshotService] Skipped capture due to unsupported CSS (oklch). Passing text-only context.');
        } else {
            console.error('[SnapshotService] Capture failed:', error);
        }

        // Fail Open: Return null, don't crash the widget or the app
        return null;
    }
};
