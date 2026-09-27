/**
 * Real media files for upload tests, made with ffmpeg (a solid colour frame),
 * so the server's header readers are checked against files they did not write.
 */
import { readFileSync } from 'node:fs';

const MEDIA_DIRECTORY = new URL('./media/', import.meta.url);

const CONTENT_TYPES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
};

/** The bytes of a fixture in tests/fixtures/media. */
export function mediaFile(name) {
    return readFileSync(new URL(name, MEDIA_DIRECTORY));
}

/** Supertest attach() options for a fixture. */
export function mediaAttachment(name) {
    return { filename: name, contentType: CONTENT_TYPES[name.slice(name.lastIndexOf('.'))] };
}

/** A valid 1280×720 PNG, for tests that upload media but don't test the media rules. */
export const VALID_PNG = mediaFile('frame-16x9.png');
