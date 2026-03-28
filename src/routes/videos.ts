import { Router } from 'express';
import { z } from 'zod';
import { listVideos, updateVideo } from '../services/videoService.js';

const router = Router();

router.get('/', async (_req, res) => {
  res.json(await listVideos());
});

router.patch('/:id', async (req, res) => {
  const payload = z.object({
    isPinned: z.boolean().optional(),
    isInPlaylist: z.boolean().optional(),
    isWatched: z.boolean().optional(),
    jellyfinItemId: z.string().optional(),
  }).parse(req.body);

  res.json(await updateVideo(req.params.id, payload));
});

export default router;
