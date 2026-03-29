import express from 'express';
import cors from 'cors';
import path from 'path';
import { telegramAuthMiddleware } from './middleware/telegramAuth';
import bootstrapRouter from './routes/bootstrap';
import nutritionRouter from './routes/nutrition';
import profileRouter from './routes/profile';
import trainerRouter from './routes/trainer';
import subscriptionRouter from './routes/subscription';
import clientRouter from './routes/client';
import expertApplyRouter from './routes/expertApply';
import remindersRouter from './routes/reminders';

export function createApiServer() {
  const app = express();

  app.use(cors({
    origin: process.env.MINIAPP_ORIGIN ?? '*',
    credentials: true,
  }));
  app.use(express.json());

  // Health check (no auth)
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // All /api routes require Telegram auth
  app.use('/api', telegramAuthMiddleware as express.RequestHandler);
  app.use('/api/bootstrap', bootstrapRouter);
  app.use('/api/nutrition', nutritionRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/trainer', trainerRouter);
  app.use('/api/subscription', subscriptionRouter);
  app.use('/api/client', clientRouter);
  app.use('/api/expert', expertApplyRouter);
  app.use('/api/reminders', remindersRouter);

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
