import express from 'express';
import cors from 'cors';
import path from 'path';
import { platformAuthMiddleware } from './middleware/platformAuth';
import { preAuthRateLimit, generalRateLimit, authRateLimit, aiRateLimit } from './middleware/rateLimit';
import bootstrapRouter from './routes/bootstrap';
import nutritionRouter from './routes/nutrition';
import profileRouter from './routes/profile';
import trainerRouter from './routes/trainer';
import subscriptionRouter from './routes/subscription';
import clientRouter from './routes/client';
import expertApplyRouter from './routes/expertApply';
import remindersRouter from './routes/reminders';
import referralRouter from './routes/referral';
import trainerConnectRouter from './routes/trainerConnect';
import ratingsRouter from './routes/ratings';
import reviewsRouter from './routes/reviews';
import adminRouter from './routes/admin';
import companyRouter from './routes/company';
import expertReferralRouter from './routes/expertReferral';
import accountLinkRouter from './routes/accountLink';
import paymentsRouter from './routes/payments';
import webhooksRouter, { handleYooKassaWebhook } from './routes/webhooks';
import maxWebhookRouter from './routes/maxWebhook';
import eventsRouter from './routes/events';

export function createApiServer() {
  const app = express();

  // Auth is via x-telegram-init-data / x-max-init-data headers, not cookies.
  // Using credentials:true with origin:'*' is invalid CORS spec and causes WKWebView
  // (iOS Telegram) to reject the preflight response even for non-credentialed requests.
  // credentials:false is correct here and unblocks iOS Telegram mini app bootstrap.
  //
  // MINIAPP_ORIGIN can be a single origin or a comma-separated list:
  //   MINIAPP_ORIGIN=https://eatlyy.ru
  //   MINIAPP_ORIGIN=https://eatlyy.ru,https://api.eatlyy.ru
  const rawMiniappOrigin = process.env.MINIAPP_ORIGIN;
  const allowedOrigins = rawMiniappOrigin
    ? rawMiniappOrigin.split(',').map(s => s.trim()).filter(Boolean)
    : null;
  const corsOrigin: cors.CorsOptions['origin'] = allowedOrigins
    ? allowedOrigins.length === 1
      ? allowedOrigins[0]
      : (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin)) callback(null, true);
          else callback(new Error('Not allowed by CORS'));
        }
    : '*';
  app.use(cors({ origin: corsOrigin, credentials: false }));
  app.use(express.json({ limit: '8mb' })); // raised from 3mb to support expert document uploads (≤5 MB decoded → ≤7 MB base64)

  // Health check (no auth)
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // YooKassa webhooks — registered BEFORE platformAuthMiddleware (YooKassa has no user token)
  // Primary path:  POST /api/webhooks/yookassa
  // Legacy alias:  POST /api/payments/yookassa/webhook  ← what was configured in YooKassa dashboard
  // Both point to the same handler.
  app.use('/api/webhooks', webhooksRouter);
  app.post('/api/payments/yookassa/webhook', handleYooKassaWebhook as express.RequestHandler);

  // MAX bot webhook — registered BEFORE platformAuthMiddleware (MAX server-to-server, not user auth)
  // Secured by optional MAX_WEBHOOK_SECRET header check inside the handler.
  app.use('/api/max/webhook', maxWebhookRouter);

  // Pre-auth IP rate limit — fires before Telegram auth to stop spam at entry points
  app.use('/api/bootstrap', preAuthRateLimit as express.RequestHandler);

  // All /api routes require platform auth (Telegram or MAX)
  app.use('/api', platformAuthMiddleware as express.RequestHandler);

  // Rate limiting (runs after auth so req.chatId is already set)
  app.use('/api', generalRateLimit as express.RequestHandler);
  app.use('/api/bootstrap', authRateLimit as express.RequestHandler);

  // All /api responses carry personal data — prevent caching by proxies and browsers
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    next();
  });
  app.use('/api/nutrition/analyze', aiRateLimit as express.RequestHandler);
  app.use('/api/nutrition/insight', aiRateLimit as express.RequestHandler);
  app.use('/api/company/requisites/recognize', aiRateLimit as express.RequestHandler);
  app.use('/api/trainer/requisites/recognize', aiRateLimit as express.RequestHandler);

  app.use('/api/bootstrap', bootstrapRouter);
  app.use('/api/nutrition', nutritionRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/trainer', trainerRouter);
  app.use('/api/subscription', subscriptionRouter);
  app.use('/api/client', clientRouter);
  app.use('/api/expert', expertApplyRouter);
  app.use('/api/reminders', remindersRouter);
  app.use('/api/referral', referralRouter);
  app.use('/api/trainer/my-code', trainerConnectRouter);
  app.use('/api/ratings', ratingsRouter);
  app.use('/api/reviews', reviewsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/company', companyRouter);
  app.use('/api/expert-referral', expertReferralRouter);
  app.use('/api/account-link', accountLinkRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/events', eventsRouter);

  // Serve mini app static files in production
  const miniappDist = path.join(__dirname, '..', '..', 'miniapp', 'dist');
  app.use(express.static(miniappDist, {
    setHeaders(res, filePath) {
      // Vite writes all hashed chunks to assets/ — content-addressed, safe to cache forever.
      // index.html and other non-hashed files must always revalidate.
      const normalized = filePath.replace(/\\/g, '/');
      if (normalized.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));

  // SPA fallback — serve index.html for all non-API routes
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.sendFile(path.join(miniappDist, 'index.html'), (err) => {
      if (err) res.status(503).json({ error: 'Mini app not built' });
    });
  });

  const port = parseInt(process.env.PORT ?? '3000', 10);
  app.listen(port, () => {
    console.log(`API server running on port ${port}`);
  });

  return app;
}
