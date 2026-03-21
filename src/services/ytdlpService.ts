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
  webpage_url?: string;
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

export async function downloadVideo(videoUrl: string, destinationDir: string) {
  const template = path.join(destinationDir, '%(title)s [%(id)s].%(ext)s');
  await runYtDlp(['-o', template, videoUrl]);
}
