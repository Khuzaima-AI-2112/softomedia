const utf8 = new TextDecoder('utf-8', { fatal: true });

/**
 * Browsers send a multipart filename as raw UTF-8, but busboy (under multer)
 * reads it as Latin-1, so "—" arrives as "â\u0080\u0094" (#20). Re-read those
 * bytes as UTF-8. A name that is already past Latin-1, or whose bytes are not
 * valid UTF-8, was never garbled and is returned unchanged, so this is also
 * safe to apply to names stored before the fix.
 */
export function decodeUploadFilename(name) {
    if (typeof name !== 'string' || /[^\x00-\xff]/.test(name) || !/[\x80-\xff]/.test(name)) return name;
    try {
        return utf8.decode(Buffer.from(name, 'latin1'));
    } catch {
        return name;
    }
}
