import { Router } from 'express';
import { prisma } from '../db.js';
import { createSubscription, deleteSubscription, listSubscriptions, updateSubscription } from '../services/subscriptionService.js';
import { z } from 'zod';

const router = Router();

const payloadSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  contentType: z.enum(['youtube', 'podcast']),
  contentFilter: z.enum(['all', 'podcast_only', 'exclude_podcasts']).default('all'),
  backlogCount: z.number().int().min(1).max(200).default(5),
  watchedPolicy: z.enum(['keep', 'delete_immediate', 'delete_after_delay', 'delete_after_days']).default('keep'),
  watchedDelayHours: z.number().int().min(0).default(0),
  unwatchedPolicy: z.enum(['keep', 'delete_immediate', 'delete_after_delay', 'delete_after_days']).default('keep'),
  unwatchedDays: z.number().int().min(0).default(30),
  keepIfPlaylisted: z.boolean().default(true),
  keepIfPinned: z.boolean().default(true),
  isActive: z.boolean().default(true),
  userIds: z.array(z.string()).min(1),
});

router.get('/', async (_req, res) => {
  const [subscriptions, users] = await Promise.all([listSubscriptions(), prisma.user.findMany({ orderBy: { name: 'asc' } })]);
  res.json({ subscriptions, users });
});

router.post('/', async (req, res) => {
  const payload = payloadSchema.parse(req.body);
  const subscription = await createSubscription(payload);
  res.status(201).json(subscription);
});

router.patch('/:id', async (req, res) => {
  const payload = payloadSchema.partial().parse(req.body);
  const subscription = await updateSubscription(req.params.id, payload as any);
  res.json(subscription);
});

router.delete('/:id', async (req, res) => {
  await deleteSubscription(req.params.id);
  res.status(204).send();
});

export default router;
