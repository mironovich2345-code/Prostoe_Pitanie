/**
 * One-time script: register the MAX bot webhook subscription.
 *
 * Run after deploy (or whenever the webhook URL changes):
 *
 *   MAX_BOT_TOKEN=<token> MAX_WEBHOOK_URL=https://your-server.com/api/max/webhook \
 *     npx tsx scripts/register-max-webhook.ts
 *
 * Or set the vars in .env and run:
 *   npx tsx scripts/register-max-webhook.ts
 *
 * The call is idempotent — safe to re-run.
 *
 * Optional: set MAX_API_BASE_URL if the default (https://botapi.max.ru) has changed.
 */

import 'dotenv/config';
import { registerMaxWebhook } from '../src/services/maxClient';

async function main() {
  const webhookUrl = process.env.MAX_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('Error: MAX_WEBHOOK_URL is not set.');
    console.error('Usage: MAX_WEBHOOK_URL=https://your-server.com/api/max/webhook npx tsx scripts/register-max-webhook.ts');
    process.exit(1);
  }

  if (!process.env.MAX_BOT_TOKEN) {
    console.error('Error: MAX_BOT_TOKEN is not set.');
    process.exit(1);
  }

  console.log(`Registering MAX webhook: ${webhookUrl}`);
  await registerMaxWebhook(webhookUrl, ['bot_started', 'message_created']);
  console.log('Done.');
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
