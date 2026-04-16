const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_DOCUMENT_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/** Max decoded bytes for avatar images (512 KB) */
export const AVATAR_MAX_BYTES = 512 * 1024;

/** Max decoded bytes for photo/document uploads (2 MB) */
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/** Max decoded bytes for expert documents — diplomas, certificates (5 MB) */
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Validates a base64 data URL image:
 * - Must be a string starting with data:image/<allowed-mime>;base64,
 * - MIME type must be in the whitelist
 * - Approximate decoded size must not exceed maxDecodedBytes
 *
 * Returns true if valid, false otherwise.
 */
export function validateImageDataUrl(value: unknown, maxDecodedBytes: number): boolean {
  if (typeof value !== 'string') return false;
  if (!value.startsWith('data:image/')) return false;

  const semi = value.indexOf(';');
  if (semi === -1) return false;
  const mime = value.slice(5, semi); // strip leading 'data:'
  if (!ALLOWED_IMAGE_MIMES.includes(mime)) return false;

  const comma = value.indexOf(',');
  if (comma === -1) return false;
  const b64 = value.slice(comma + 1);
  if (!b64) return false;

  // base64 encodes 3 bytes as 4 chars → decoded ≈ b64.length * 0.75
  if (b64.length * 0.75 > maxDecodedBytes) return false;

  return true;
}

/**
 * Validates a base64 data URL for expert documents (images or PDF):
 * - Must be a string starting with data:<allowed-mime>;base64,
 * - MIME type must be in the document whitelist (images + application/pdf)
 * - Approximate decoded size must not exceed maxDecodedBytes
 *
 * Returns true if valid, false otherwise.
 */
export function validateDocumentDataUrl(value: unknown, maxDecodedBytes: number): boolean {
  if (typeof value !== 'string') return false;
  if (!value.startsWith('data:')) return false;

  const semi = value.indexOf(';');
  if (semi === -1) return false;
  const mime = value.slice(5, semi); // strip leading 'data:'
  if (!ALLOWED_DOCUMENT_MIMES.includes(mime)) return false;

  const comma = value.indexOf(',');
  if (comma === -1) return false;
  const b64 = value.slice(comma + 1);
  if (!b64) return false;

  // base64 encodes 3 bytes as 4 chars → decoded ≈ b64.length * 0.75
  if (b64.length * 0.75 > maxDecodedBytes) return false;

  return true;
}
