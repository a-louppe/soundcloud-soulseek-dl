export enum TrackStatus {
  PENDING = 'pending',
  SEARCHING = 'searching',
  FOUND_ON_SOULSEEK = 'found_on_soulseek',
  NOT_FOUND = 'not_found',
  DOWNLOADING = 'downloading',
  DOWNLOADED = 'downloaded',
  FAILED = 'failed',
}

export interface Track {
  id: number;
  soundcloudId: number;
  title: string;
  artist: string;
  artworkUrl: string | null;
  soundcloudUrl: string;
  duration: number; // milliseconds
  status: TrackStatus;
  errorMessage: string | null;
  downloadPath: string | null;
  downloadSource: 'soulseek' | 'ytdlp' | null;
  beatportSearchUrl: string;
  bandcampSearchUrl: string;
  likedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SoulseekSearchResult {
  id: number;
  trackId: number;
  username: string;
  filename: string;
  size: number;
  bitRate: number | null;
  sampleRate: number | null;
  bitDepth: number | null;
  isVariableBitRate: boolean;
  fileExtension: string | null;
  queueLength: number | null;
  freeUploadSlots: boolean;
  uploadSpeed: number | null;
}

export interface DownloadProgress {
  trackId: number;
  source: 'soulseek' | 'ytdlp';
  bytesTransferred: number;
  totalBytes: number;
  percentComplete: number;
  speed: number; // bytes per second
  eta: number; // seconds remaining
  state: 'queued' | 'downloading' | 'complete' | 'failed' | 'cancelled';
}

export interface ActiveDownload {
  id: number;
  trackId: number;
  source: 'soulseek' | 'ytdlp';
  bytesTransferred: number;
  totalBytes: number;
  state: 'queued' | 'downloading' | 'complete' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt: string | null;
}
