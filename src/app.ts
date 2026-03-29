import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'node:fs';
import path from 'node:path';
import subscriptionsRouter from './routes/subscriptions.js';
import videosRouter from './routes/videos.js';
import webhooksRouter from './routes/webhooks.js';
import settingsRouter from './routes/settings.js';

const packageJsonPath = path.resolve(process.cwd(), 'package.json');
const appVersion = (() => {
  try {
    const parsed = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { version?: string };
    return parsed.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(morgan('dev'));
  app.use(express.static(path.resolve(process.cwd(), 'src/public')));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/meta', (_req, res) => res.json({ name: 'TubeSubarr', version: appVersion }));
  app.use('/subscriptions', subscriptionsRouter);
  app.use('/videos', videosRouter);
  app.use('/webhooks', webhooksRouter);
  app.use('/settings', settingsRouter);

  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(400).json({ error: error.message || 'Unexpected error' });
  });

  return app;
}
