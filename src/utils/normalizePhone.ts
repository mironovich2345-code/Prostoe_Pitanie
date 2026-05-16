/**
 * Normalise a Russian phone number to E.164 (+7XXXXXXXXXX).
 *
 * Accepted inputs (after stripping spaces, dashes, parentheses, dots):
 *   +79990000000  →  +79990000000
 *    79990000000  →  +79990000000
 *    89990000000  →  +79990000000
 *
 * Throws Error('invalid_phone') for anything else.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return '+7' + digits.slice(1);
  }

  throw new Error('invalid_phone');
}
