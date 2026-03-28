import { spawn } from 'node:child_process';
import path from 'node:path';
import { config } from '../config.js';

export type YtDlpVideo = {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  duration?: number;
  upload_date?: string;
  channel?: string;
  channel_id?: string;
  channel_url?: string;
  uploader?: string;
  uploader_id?: string;
  uploader_url?: string;
  webpage_url?: string;
  channel_follower_count?: number;
};

export type ChannelSearchResult = {
  channelId?: string;
  name: string;
  url: string;
  avatarUrl?: string;
  summary?: string;
};

function runYtDlp(args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(config.ytdlpBinary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('close', (code) => {
      if (code === 0) return resolve(stdout);
      reject(new Error(stderr || `yt-dlp exited with ${code}`));
    });
  });
}

function parseChannelSummary(metadata: any) {
  return metadata.description || metadata.channel_description || metadata.title || '';
}

function toChannelResult(metadata: any): ChannelSearchResult {
  return {
    channelId: metadata.channel_id || metadata.id,
    name: metadata.channel || metadata.uploader || metadata.title || 'Unknown channel',
    url: metadata.channel_url || metadata.uploader_url || metadata.webpage_url || metadata.url,
    avatarUrl: metadata.thumbnail,
    summary: parseChannelSummary(metadata),
  };
}

export function inferInputMode(input: string) {
  const trimmed = input.trim();
  const isUrl = /^https?:\/\//i.test(trimmed);
  const isVideoUrl = isUrl && /(watch\?v=|youtu\.be\/|\/shorts\/)/i.test(trimmed);
  if (isVideoUrl) return 'video-url';
  if (isUrl) return 'url';
  return trimmed ? 'search' : 'idle';
}

export async function probeChannel(url: string, backlogCount: number) {
  const output = await runYtDlp([
    '--dump-single-json',
    '--playlist-end',
    String(backlogCount),
    '--flat-playlist',
    url,
  ]);
  const parsed = JSON.parse(output);
  const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  return entries.map((entry: any) => ({
    id: entry.id,
    title: entry.title,
    webpage_url: entry.url || entry.webpage_url,
    channel: parsed.channel || parsed.uploader || parsed.title,
  })) as YtDlpVideo[];
}

export async function fetchVideoMetadata(url: string) {
  const output = await runYtDlp(['--dump-single-json', url]);
  return JSON.parse(output) as YtDlpVideo;
}

export async function fetchChannelMetadata(url: string) {
  const output = await runYtDlp(['--dump-single-json', '--playlist-end', '1', url]);
  return JSON.parse(output);
}

export async function searchChannels(query: string, limit: number) {
  const output = await runYtDlp(['--dump-single-json', `ytsearch${limit}:${query}`]);
  const parsed = JSON.parse(output);
  const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  const deduped = new Map<string, ChannelSearchResult>();

  for (const entry of entries) {
    const result = toChannelResult(entry);
    if (!result.url || deduped.has(result.url)) continue;
    deduped.set(result.url, result);
    if (deduped.size >= limit) break;
  }

  return Array.from(deduped.values()).slice(0, limit);
}

export async function resolveSubscriptionInput(input: string, searchLimit: number) {
  const mode = inferInputMode(input);

  if (mode === 'search') {
    return {
      mode: 'results' as const,
      query: input,
      results: await searchChannels(input, searchLimit),
    };
  }

  if (mode === 'video-url') {
    const metadata = await fetchVideoMetadata(input);
    return {
      mode,
      query: input,
      video: {
        id: metadata.id,
        title: metadata.title,
        url: metadata.webpage_url || input,
      },
      channel: {
        channelId: metadata.channel_id || metadata.uploader_id,
        name: metadata.channel || metadata.uploader || metadata.title,
        url: metadata.channel_url || metadata.uploader_url || input,
        avatarUrl: metadata.thumbnail,
        summary: metadata.description,
      },
    };
  }

  if (mode === 'url') {
    const metadata = await fetchChannelMetadata(input);
    return {
      mode,
      query: input,
      channel: toChannelResult(metadata),
    };
  }

  return { mode: 'idle' as const, query: input };
}

export async function downloadVideo(videoUrl: string, destinationDir: string) {
  const template = path.join(destinationDir, '%(title)s [%(id)s].%(ext)s');
  await runYtDlp(['-o', template, videoUrl]);
}
