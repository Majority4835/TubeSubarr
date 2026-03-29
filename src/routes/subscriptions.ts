import { Router } from 'express';
import { prisma } from '../db.js';
import { createSubscription, deleteSubscription, getSubscriptionVideos, listSubscriptions, updateSubscription } from '../services/subscriptionService.js';
import { getAppSettings } from '../services/settingsService.js';
import { resolveSubscriptionInput } from '../services/ytdlpService.js';
import { z } from 'zod';

const router = Router();

const baseSettingsSchema = z.object({
  contentType: z.enum(['youtube', 'podcast']).optional(),
  contentFilter: z.enum(['all', 'podcast_only', 'exclude_podcasts']).optional(),
  backlogCount: z.number().int().min(0).max(200).optional(),
  keepIfPlaylisted: z.boolean().optional(),
  keepIfPinned: z.boolean().optional(),
  isActive: z.boolean().optional(),
  downloadOnlyNewVideos: z.boolean().optional(),
  titleFilter: z.string().nullable().optional(),
  includeShorts: z.boolean().optional(),
  keepAfterWatched: z.boolean().optional(),
  unwatchedRetentionDays: z.number().int().min(1).max(3650).optional(),
  pauseDownloadsThreshold: z.number().int().min(1).max(5000).nullable().optional(),
  mediaMusic: z.boolean().optional(),
  mediaShow: z.boolean().optional(),
  mediaPodcast: z.boolean().optional(),
  podcastTitleKeywords: z.string().nullable().optional(),
  podcastMinLengthSeconds: z.number().int().min(0).nullable().optional(),
  podcastMaxLengthSeconds: z.number().int().min(0).nullable().optional(),
});

const createPayloadSchema = baseSettingsSchema.extend({
  url: z.string().url(),
  userIds: z.array(z.string()).min(1),
  seedVideoUrl: z.string().url().nullable().optional(),
});

router.get('/', async (_req, res) => {
  const [subscriptions, users, appSettings] = await Promise.all([
    listSubscriptions(),
    prisma.user.findMany({ orderBy: { name: 'asc' } }),
    getAppSettings(),
  ]);
  res.json({ subscriptions, users, appSettings });
});

router.post('/resolve', async (req, res) => {
  const payload = z.object({
    input: z.string().min(1),
    limit: z.number().int().min(1).max(25).optional(),
  }).parse(req.body);

  const settings = await getAppSettings();
  res.json(await resolveSubscriptionInput(payload.input, payload.limit ?? settings.searchResultLimitDefault));
});

router.get('/:id/videos', async (req, res) => {
  res.json(await getSubscriptionVideos(req.params.id));
});

router.post('/', async (req, res) => {
  const payload = createPayloadSchema.parse(req.body);
  const subscription = await createSubscription(payload);
  res.status(201).json(subscription);
});

router.patch('/:id', async (req, res) => {
  const payload = baseSettingsSchema.extend({ userIds: z.array(z.string()).min(1).optional() }).partial().parse(req.body);
  const subscription = await updateSubscription(req.params.id, payload as any);
  res.json(subscription);
});

router.delete('/:id', async (req, res) => {
  await deleteSubscription(req.params.id);
  res.status(204).send();
});

export default router;
