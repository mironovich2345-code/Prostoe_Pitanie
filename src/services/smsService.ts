/**
 * SMS provider abstraction.
 *
 * Env vars:
 *   SMS_PROVIDER  — 'smsaero' (more providers can be added later)
 *   SMS_API_KEY   — provider-specific key; for smsaero: "email:apikey"
 *   SMS_SENDER    — sender name / alphanumeric ID (default: 'EATLYY')
 *
 * Development (SMS_PROVIDER not set):
 *   Code is printed to console. Never logged in production.
 *
 * Production (SMS_PROVIDER not set):
 *   Throws 'sms_provider_not_configured'.
 */
export async function sendSmsCode(phone: string, code: string): Promise<void> {
  const provider = process.env.SMS_PROVIDER?.toLowerCase();

  if (!provider) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[smsService] DEV — OTP for ${phone}: ${code}`);
      return;
    }
    throw new Error('sms_provider_not_configured');
  }

  const apiKey  = process.env.SMS_API_KEY ?? '';
  const sender  = process.env.SMS_SENDER  ?? 'EATLYY';
  const text    = `Ваш код входа в EATLYY: ${code}. Никому не сообщайте этот код.`;

  if (provider === 'smsaero') {
    // SMS Aero v2 REST API — https://smsaero.ru/integration/documentation/api/
    // SMS_API_KEY format: "user@example.com:apikey"
    const colonIdx = apiKey.indexOf(':');
    if (colonIdx < 1) throw new Error('sms_provider_misconfigured');
    const email = apiKey.slice(0, colonIdx);
    const key   = apiKey.slice(colonIdx + 1);

    const params = new URLSearchParams({
      number:  phone,
      text,
      sign:    sender,
      channel: 'DIRECT',
    });
    const auth = Buffer.from(`${email}:${key}`).toString('base64');

    const resp = await fetch(`https://gate.smsaero.ru/v2/sms/send?${params.toString()}`, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({})) as Record<string, unknown>;
      throw new Error(`sms_send_failed: ${String(body.message ?? resp.status)}`);
    }
    return;
  }

  throw new Error(`sms_provider_unknown: ${provider}`);
}
