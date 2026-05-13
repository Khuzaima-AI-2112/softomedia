/**
 * validateAdUpload.js  —  Sprint 7
 *
 * Enforces MVP content compliance rules before an ad is written to Firestore:
 *   1. Required fields present (name, campaign_id, advertiser_id, duration_ms, format)
 *   2. Duration exactly 5 000 ms  (MVP loop = 12 × 5s slots)
 *   3. Format is one of the allowed MIME types
 *   4. file_size_bytes within the per-format cap
 *
 * Usage (in ads.js):
 *   import { validateAdUpload } from '../middleware/validateAdUpload.js';
 *   router.post('/', validateAdUpload, async (req, res) => { … });
 */

// Allowed MIME types and their max file sizes (bytes)
const ALLOWED_FORMATS = {
  'video/mp4':  50 * 1024 * 1024,   // 50 MB
  'video/webm': 50 * 1024 * 1024,   // 50 MB
  'image/jpeg': 5  * 1024 * 1024,   // 5 MB  (static fallback ad)
  'image/png':  5  * 1024 * 1024,   // 5 MB
  'image/gif':  10 * 1024 * 1024,   // 10 MB (animated)
};

const REQUIRED_DURATION_MS = 5000;
const DURATION_TOLERANCE_MS = 200; // ±200 ms grace window for encoder rounding

export function validateAdUpload(req, res, next) {
  const errors = [];
  const body = req.body || {};

  // 1. Required fields
  const required = ['name', 'campaign_id', 'advertiser_id', 'duration_ms', 'format'];
  for (const field of required) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // 2. Duration must be 5 s (within tolerance)
  if (body.duration_ms !== undefined) {
    const dur = Number(body.duration_ms);
    if (isNaN(dur)) {
      errors.push('duration_ms must be a number');
    } else if (Math.abs(dur - REQUIRED_DURATION_MS) > DURATION_TOLERANCE_MS) {
      errors.push(
        `duration_ms must be ${REQUIRED_DURATION_MS} ms (±${DURATION_TOLERANCE_MS} ms). ` +
        `Received: ${dur} ms. Trim or pad the creative to exactly 5 seconds.`
      );
    }
  }

  // 3. Format must be an allowed MIME type
  if (body.format && !ALLOWED_FORMATS[body.format]) {
    errors.push(
      `Unsupported format: "${body.format}". ` +
      `Allowed formats: ${Object.keys(ALLOWED_FORMATS).join(', ')}`
    );
  }

  // 4. File size cap (optional field — only validated when present)
  if (body.format && body.file_size_bytes !== undefined) {
    const size = Number(body.file_size_bytes);
    const cap  = ALLOWED_FORMATS[body.format];
    if (cap && !isNaN(size) && size > cap) {
      errors.push(
        `file_size_bytes (${size}) exceeds the ${cap / (1024 * 1024)} MB cap for ${body.format}`
      );
    }
  }

  if (errors.length > 0) {
    return res.status(422).json({
      error: 'Ad content validation failed',
      validation_errors: errors,
      hint: 'All ads must be exactly 5 seconds and use an approved format (mp4, webm, jpeg, png, gif).'
    });
  }

  next();
}
