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

export function createApiServer() {
  const app = express();

  app.use(cors({
    origin: process.env.MINIAPP_ORIGIN ?? '*',
    credentials: true,
  }));
  app.use(express.json({ limit: '8mb' })); // raised from 3mb to support expert document uploads (≤5 MB decoded → ≤7 MB base64)

  // Health check (no auth)
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // YooKassa webhooks — registered BEFORE platformAuthMiddleware (YooKassa has no user token)
  // Primary path:  POST /api/webhooks/yookassa
  // Legacy alias:  POST /api/payments/yookassa/webhook  ← what was configured in YooKassa dashboard
  // Both point to the same handler.
  app.use('/api/webhooks', webhooksRouter);
  app.post('/api/payments/yookassa/webhook', handleYooKassaWebhook as express.RequestHandler);

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

  // Serve mini app static files in production
  const miniappDist = path.join(__dirname, '..', '..', 'miniapp', 'dist');
  app.use(express.static(miniappDist));

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
