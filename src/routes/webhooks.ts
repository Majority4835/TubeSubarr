import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();

router.post('/jellyfin', async (req, res) => {
  const itemId = req.body.itemId || req.body.ItemId;
  const played = req.body.played ?? req.body.UserData?.Played;
  if (itemId) {
    await prisma.video.updateMany({
      where: { jellyfinItemId: itemId },
      data: { isWatched: Boolean(played), watchedAt: played ? new Date() : null },
    });
  }
  res.status(202).json({ ok: true });
});

export default router;
