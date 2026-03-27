import { Router } from 'express';
import { z } from 'zod';
import { getAppSettings, updateAppSettings } from '../services/settingsService.js';

const router = Router();

const settingsSchema = z.object({
  includeShortsDefault: z.boolean().optional(),
  minVideoLengthSecondsDefault: z.number().int().min(0).nullable().optional(),
  maxVideoLengthSecondsDefault: z.number().int().min(0).nullable().optional(),
  keepAfterWatchedDefault: z.boolean().optional(),
  unwatchedRetentionDaysDefault: z.number().int().min(1).max(3650).optional(),
  searchResultLimitDefault: z.number().int().min(1).max(25).optional(),
  podcastTitleKeywordsDefault: z.string().optional(),
  podcastMinLengthSecondsDefault: z.number().int().min(0).nullable().optional(),
  podcastMaxLengthSecondsDefault: z.number().int().min(0).nullable().optional(),
  pauseDownloadsThresholdDefault: z.number().int().min(1).max(5000).nullable().optional(),
});

router.get('/', async (_req, res) => {
  res.json(await getAppSettings());
});

router.patch('/', async (req, res) => {
  res.json(await updateAppSettings(settingsSchema.parse(req.body)));
});

export default router;
