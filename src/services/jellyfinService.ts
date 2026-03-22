import { config } from '../config.js';

const headers = {
  'Content-Type': 'application/json',
  ...(config.jellyfinApiKey ? { 'X-Emby-Token': config.jellyfinApiKey } : {}),
};

export async function triggerLibraryRefresh() {
  if (!config.jellyfinApiKey) return;
  await fetch(`${config.jellyfinBaseUrl}/Library/Refresh`, { method: 'POST', headers });
}

export async function fetchItemPlayback(itemId: string) {
  if (!config.jellyfinApiKey || !itemId) return null;
  const response = await fetch(`${config.jellyfinBaseUrl}/Items/${itemId}`, { headers });
  if (!response.ok) return null;
  return response.json();
}
