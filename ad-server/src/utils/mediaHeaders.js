/**
 * Reads what an uploaded file really is from its own header: the frame of an
 * image, or the duration and frame of an MP4/QuickTime video (the two share one
 * container format). Nothing the client declares is trusted, and no ffmpeg is
 * needed. Returns null when the header can't be read.
 */

/** Each ISO base media box (MP4/QuickTime) between start and end. */
function* boxes(buffer, start = 0, end = buffer.length) {
    let offset = start;
    while (offset + 8 <= end) {
        let size = buffer.readUInt32BE(offset);
        const type = buffer.toString('latin1', offset + 4, offset + 8);
        let headerSize = 8;
        if (size === 1) {
            if (offset + 16 > end) return;
            size = Number(buffer.readBigUInt64BE(offset + 8));
            headerSize = 16;
        } else if (size === 0) {
            size = end - offset;
        }
        if (size < headerSize || offset + size > end) return;
        yield { type, content: offset + headerSize, end: offset + size };
        offset += size;
    }
}

const childBox = (buffer, parent, type) => {
    for (const box of boxes(buffer, parent.content, parent.end)) if (box.type === type) return box;
    return null;
};

/**
 * A track's own duration in seconds, from its media header ('mdhd'). The movie
 * header would give the longest track, such as a longer audio track. A
 * fragmented file records no duration here, and reads as unknown.
 */
function readTrackDuration(buffer, mdhd) {
    const version = buffer[mdhd.content];
    const timescale = buffer.readUInt32BE(mdhd.content + (version === 1 ? 20 : 12));
    const duration = version === 1
        ? Number(buffer.readBigUInt64BE(mdhd.content + 24))
        : buffer.readUInt32BE(mdhd.content + 16);
    return timescale && duration ? duration / timescale : null;
}

/** The presented frame of a track, turned when its matrix rotates it a quarter turn. */
function readTrackFrame(buffer, tkhd) {
    const version = buffer[tkhd.content];
    const matrix = tkhd.content + (version === 1 ? 52 : 40);
    const size = tkhd.content + (version === 1 ? 88 : 76);
    const width = buffer.readUInt32BE(size) / 65536;
    const height = buffer.readUInt32BE(size + 4) / 65536;
    const quarterTurn = buffer.readInt32BE(matrix) === 0 && buffer.readInt32BE(matrix + 16) === 0;
    return quarterTurn ? { width: height, height: width } : { width, height };
}

function isVideoTrack(buffer, trak) {
    const mdia = childBox(buffer, trak, 'mdia');
    const hdlr = mdia && childBox(buffer, mdia, 'hdlr');
    return Boolean(hdlr) && buffer.toString('latin1', hdlr.content + 8, hdlr.content + 12) === 'vide';
}

function readVideo(buffer) {
    let moov = null;
    for (const box of boxes(buffer)) if (box.type === 'moov') moov = box;
    if (!moov) return null;
    for (const trak of boxes(buffer, moov.content, moov.end)) {
        if (trak.type !== 'trak' || !isVideoTrack(buffer, trak)) continue;
        const tkhd = childBox(buffer, trak, 'tkhd');
        const mdhd = childBox(buffer, childBox(buffer, trak, 'mdia'), 'mdhd');
        const duration = mdhd && readTrackDuration(buffer, mdhd);
        if (!tkhd || !duration) return null;
        return { duration, ...readTrackFrame(buffer, tkhd) };
    }
    return null;
}

function readPng(buffer) {
    if (buffer.toString('latin1', 12, 16) !== 'IHDR') return null;
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

// Start-of-frame markers carry the frame size; C4, C8 and CC share the range but don't.
const isStartOfFrame = marker => marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
const isStandalone = marker => marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9);

function readJpeg(buffer) {
    let offset = 2;
    while (offset + 4 <= buffer.length) {
        if (buffer[offset] !== 0xff) return null;
        const marker = buffer[offset + 1];
        if (marker === 0xff) {
            offset += 1;
            continue;
        }
        if (isStandalone(marker)) {
            offset += 2;
            continue;
        }
        if (isStartOfFrame(marker)) {
            return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        }
        offset += 2 + buffer.readUInt16BE(offset + 2);
    }
    return null;
}

/**
 * @param {Buffer} buffer - The whole uploaded file
 * @param {string} extension - Its lower-case extension, such as '.mp4'
 * @returns {{width: number, height: number, duration?: number} | null}
 */
export function readMediaHeader(buffer, extension) {
    try {
        if (extension === '.mp4' || extension === '.mov') return readVideo(buffer);
        if (extension === '.png') return readPng(buffer);
        if (extension === '.jpg' || extension === '.jpeg') return readJpeg(buffer);
        return null;
    } catch {
        return null;
    }
}
