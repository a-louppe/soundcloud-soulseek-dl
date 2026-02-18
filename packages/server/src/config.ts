import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';

// Load .env from monorepo root (npm workspaces sets cwd to package dir)
loadDotenv({ path: resolve(import.meta.dirname, '../../../.env') });

export interface AppConfig {
  port: number;
  slskdUrl: string;
  slskdApiKey: string;
  soundcloudOauthToken: string;
  soundcloudUserId: string;
  downloadDir: string;
  databasePath: string;
  ytdlpPath: string;
}

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env['PORT'] || '3000', 10),
    slskdUrl: requireEnv('SLSKD_URL'),
    slskdApiKey: requireEnv('SLSKD_API_KEY'),
    soundcloudOauthToken: requireEnv('SOUNDCLOUD_OAUTH_TOKEN'),
    soundcloudUserId: requireEnv('SOUNDCLOUD_USER_ID'),
    downloadDir: resolve(process.env['DOWNLOAD_DIR'] || './downloads'),
    databasePath: resolve(process.env['DATABASE_PATH'] || './data/tracks.db'),
    ytdlpPath: process.env['YTDLP_PATH'] || 'yt-dlp',
  };
}
