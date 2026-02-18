import type { Track, SoulseekSearchResult, ActiveDownload } from '../models/track.js';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface SyncTracksResponse {
  newCount: number;
  updatedCount: number;
  totalCount: number;
}

export interface TrackWithResults extends Track {
  soulseekResults: SoulseekSearchResult[];
}

export interface HealthStatusResponse {
  slskd: { connected: boolean; url: string };
  soundcloud: { connected: boolean; userId: string };
  ytdlp: { available: boolean; version: string | null };
  downloadDir: string;
  trackStats: {
    total: number;
    downloaded: number;
    pending: number;
    failed: number;
  };
}

export interface ActiveDownloadsResponse {
  downloads: ActiveDownload[];
}

export type SSEEvent =
  | { type: 'track:status-changed'; data: { trackId: number; status: string } }
  | { type: 'search:progress'; data: { trackId: number; resultsCount: number; isComplete: boolean } }
  | { type: 'download:progress'; data: { trackId: number; bytesTransferred: number; totalBytes: number; percentComplete: number; speed: number; eta: number } }
  | { type: 'download:complete'; data: { trackId: number; filePath: string } }
  | { type: 'download:failed'; data: { trackId: number; error: string } }
  | { type: 'sync:complete'; data: { newCount: number; totalCount: number } };
