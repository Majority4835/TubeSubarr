import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

export function slugifyChannelName(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'channel';
}

export function getCanonicalChannelPath(contentType: 'youtube' | 'podcast', slug: string) {
  const folder = contentType === 'youtube' ? 'youtube' : 'podcasts';
  return path.join(config.storeRoot, folder, 'channels', slug);
}

export function getViewPath(contentType: 'youtube' | 'podcast', userName: string, slug: string) {
  const folder = contentType === 'youtube' ? 'youtube' : 'podcasts';
  return path.join(config.viewRoot, folder, userName, slug);
}

export async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function ensureChannelViews(contentType: 'youtube' | 'podcast', slug: string, userNames: string[], canonicalPath: string) {
  await Promise.all(userNames.map(async (userName) => {
    const linkPath = getViewPath(contentType, userName, slug);
    await ensureDir(path.dirname(linkPath));
    await fs.rm(linkPath, { recursive: true, force: true });
    await fs.symlink(canonicalPath, linkPath, 'dir');
  }));
}

export async function removeChannelViews(contentType: 'youtube' | 'podcast', slug: string, userNames: string[]) {
  await Promise.all(userNames.map((userName) => fs.rm(getViewPath(contentType, userName, slug), { recursive: true, force: true })));
}
