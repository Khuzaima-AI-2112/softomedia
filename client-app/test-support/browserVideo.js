import { vi } from 'vitest';

/**
 * jsdom has no media decoder, so this stands in for the browser's: a video
 * element given a file either loads its metadata or reports an error.
 * @returns {() => void} Restores jsdom's own behaviour
 */
export function browserCanPlayVideo(playable) {
    const original = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
    URL.createObjectURL = vi.fn(() => 'blob:chosen-file');
    URL.revokeObjectURL = vi.fn();
    Object.defineProperty(HTMLMediaElement.prototype, 'src', {
        configurable: true,
        set() {
            setTimeout(() => this.dispatchEvent(new Event(playable ? 'loadedmetadata' : 'error')));
        },
    });
    return () => Object.defineProperty(HTMLMediaElement.prototype, 'src', original);
}
