import { EventEmitter } from 'events';
import { copyFile, unlink } from 'fs/promises';
import { resolve, basename, extname } from 'path';
import { TrackStatus } from '@scsd/shared';
import type { AppConfig } from '../config.js';
import type { SlskdService } from './slskd.service.js';
import type { YtdlpService } from './ytdlp.service.js';
import type { TrackRepository } from '../db/repositories/track.repository.js';
import type { SearchResultRepository } from '../db/repositories/search-result.repository.js';
import type { DownloadRepository } from '../db/repositories/download.repository.js';
import { buildSearchQuery } from '../utils/search-query.js';
import { sanitizeFilename } from '../utils/sanitize-filename.js';

interface QueueItem {
  fn: () => Promise<void>;
}

export class DownloadManager extends EventEmitter {
  private searchQueue: QueueItem[] = [];
  private downloadQueue: QueueItem[] = [];
  private activeSearches = 0;
  private activeDownloads = 0;
  private maxConcurrentSearches = 3;
  private maxConcurrentDownloads = 2;

  constructor(
    private slskd: SlskdService,
    private ytdlp: YtdlpService,
    private trackRepo: TrackRepository,
    private searchResultRepo: SearchResultRepository,
    private downloadRepo: DownloadRepository,
    private config: AppConfig,
  ) {
    super();
  }

  private emitEvent(type: string, data: unknown): void {
    this.emit('event', { type, data });
  }

  private async processSearchQueue(): Promise<void> {
    while (this.searchQueue.length > 0 && this.activeSearches < this.maxConcurrentSearches) {
      const item = this.searchQueue.shift();
      if (!item) break;
      this.activeSearches++;
      item.fn().finally(() => {
        this.activeSearches--;
        this.processSearchQueue();
      });
    }
  }

  private async processDownloadQueue(): Promise<void> {
    while (this.downloadQueue.length > 0 && this.activeDownloads < this.maxConcurrentDownloads) {
      const item = this.downloadQueue.shift();
      if (!item) break;
      this.activeDownloads++;
      item.fn().finally(() => {
        this.activeDownloads--;
        this.processDownloadQueue();
      });
    }
  }

  async searchTrack(trackId: number): Promise<void> {
    return new Promise<void>((resolvePromise, rejectPromise) => {
      this.searchQueue.push({
        fn: async () => {
          try {
            await this._doSearch(trackId);
            resolvePromise();
          } catch (err) {
            rejectPromise(err);
          }
        },
      });
      this.processSearchQueue();
    });
  }

  async searchTrackAsync(trackId: number): Promise<void> {
    this.searchQueue.push({
      fn: () => this._doSearch(trackId),
    });
    this.processSearchQueue();
  }

  private async _doSearch(trackId: number): Promise<void> {
    const track = this.trackRepo.getTrack(trackId);
    if (!track) throw new Error(`Track ${trackId} not found`);

    // Update status to searching
    this.trackRepo.updateStatus(trackId, TrackStatus.SEARCHING);
    this.emitEvent('track:status-changed', { trackId, status: TrackStatus.SEARCHING });

    try {
      const query = buildSearchQuery(track.artist, track.title);
      const searchId = await this.slskd.search(query);

      // Poll for completion
      const maxWait = 60000;
      const pollInterval = 2000;
      let elapsed = 0;

      while (elapsed < maxWait) {
        await new Promise((r) => setTimeout(r, pollInterval));
        elapsed += pollInterval;

        const complete = await this.slskd.isSearchComplete(searchId);
        if (complete) break;
      }

      // Get and save results
      const results = await this.slskd.getSearchResults(searchId);
      this.searchResultRepo.saveResults(trackId, searchId, results);

      if (results.length > 0) {
        this.trackRepo.updateStatus(trackId, TrackStatus.FOUND_ON_SOULSEEK);
        this.emitEvent('track:status-changed', {
          trackId,
          status: TrackStatus.FOUND_ON_SOULSEEK,
        });
        this.emitEvent('search:progress', {
          trackId,
          resultsCount: results.length,
          isComplete: true,
        });
      } else {
        this.trackRepo.updateStatus(trackId, TrackStatus.NOT_FOUND);
        this.emitEvent('track:status-changed', {
          trackId,
          status: TrackStatus.NOT_FOUND,
        });
        this.emitEvent('search:progress', {
          trackId,
          resultsCount: 0,
          isComplete: true,
        });
      }

      // Clean up the search from slskd
      try {
        await this.slskd.deleteSearch(searchId);
      } catch {
        // Non-critical, ignore
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.trackRepo.updateStatus(trackId, TrackStatus.FAILED, message);
      this.emitEvent('track:status-changed', { trackId, status: TrackStatus.FAILED });
      this.emitEvent('download:failed', { trackId, error: message });
    }
  }

  async downloadFromSoulseek(trackId: number, resultId: number): Promise<void> {
    this.downloadQueue.push({
      fn: () => this._doSoulseekDownload(trackId, resultId),
    });
    this.processDownloadQueue();
  }

  private async _doSoulseekDownload(trackId: number, resultId: number): Promise<void> {
    const track = this.trackRepo.getTrack(trackId);
    if (!track) throw new Error(`Track ${trackId} not found`);

    const result = this.searchResultRepo.getResult(resultId);
    if (!result) throw new Error(`Search result ${resultId} not found`);

    this.trackRepo.updateStatus(trackId, TrackStatus.DOWNLOADING);
    this.emitEvent('track:status-changed', { trackId, status: TrackStatus.DOWNLOADING });

    const download = this.downloadRepo.createDownload(trackId, 'soulseek', {
      username: result.username,
      filename: result.filename,
    });

    try {
      // Enqueue download via slskd
      await this.slskd.enqueueDownload(result.username, result.filename, result.size);

      // Poll download progress
      const maxWait = 600000; // 10 minutes
      const pollInterval = 3000;
      let elapsed = 0;

      while (elapsed < maxWait) {
        await new Promise((r) => setTimeout(r, pollInterval));
        elapsed += pollInterval;

        const status = await this.slskd.getDownloadStatus(
          result.username,
          result.filename,
        );

        if (!status) continue;

        this.downloadRepo.updateProgress(
          download.id,
          status.bytesTransferred,
          status.size,
        );

        this.emitEvent('download:progress', {
          trackId,
          bytesTransferred: status.bytesTransferred,
          totalBytes: status.size,
          percentComplete: status.percentComplete,
          speed: status.averageSpeed,
          eta: status.averageSpeed > 0
            ? Math.round((status.size - status.bytesTransferred) / status.averageSpeed)
            : 0,
        });

        if (status.state === 'Completed' || status.state === 'Succeeded') {
          // Move file to our download directory
          const ext = result.fileExtension || extname(result.filename).slice(1) || 'mp3';
          const destFilename = sanitizeFilename(track.artist, track.title, ext);
          const destPath = resolve(this.config.downloadDir, destFilename);

          this.downloadRepo.updateState(download.id, 'complete');
          this.trackRepo.updateDownloadPath(trackId, destPath, 'soulseek');
          this.emitEvent('track:status-changed', { trackId, status: TrackStatus.DOWNLOADED });
          this.emitEvent('download:complete', { trackId, filePath: destPath });
          return;
        }

        if (
          status.state === 'Errored' ||
          status.state === 'Rejected' ||
          status.state === 'Cancelled'
        ) {
          throw new Error(`Soulseek download ${status.state}`);
        }
      }

      throw new Error('Soulseek download timed out');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.downloadRepo.updateState(download.id, 'failed');
      this.trackRepo.updateStatus(trackId, TrackStatus.FAILED, message);
      this.emitEvent('track:status-changed', { trackId, status: TrackStatus.FAILED });
      this.emitEvent('download:failed', { trackId, error: message });
    }
  }

  async downloadWithYtdlp(trackId: number, sourceUrl?: string): Promise<void> {
    this.downloadQueue.push({
      fn: () => this._doYtdlpDownload(trackId, sourceUrl),
    });
    this.processDownloadQueue();
  }

  private async _doYtdlpDownload(trackId: number, sourceUrl?: string): Promise<void> {
    const track = this.trackRepo.getTrack(trackId);
    if (!track) throw new Error(`Track ${trackId} not found`);

    this.trackRepo.updateStatus(trackId, TrackStatus.DOWNLOADING);
    this.emitEvent('track:status-changed', { trackId, status: TrackStatus.DOWNLOADING });

    const download = this.downloadRepo.createDownload(trackId, 'ytdlp');

    try {
      const url = sourceUrl || track.soundcloudUrl;
      const { events, outputPath } = this.ytdlp.download(url, track.artist, track.title);

      await new Promise<void>((resolvePromise, rejectPromise) => {
        events.on('progress', (progress: { percent: number; speed: string; eta: string }) => {
          this.emitEvent('download:progress', {
            trackId,
            bytesTransferred: 0,
            totalBytes: 0,
            percentComplete: progress.percent,
            speed: 0,
            eta: 0,
          });
        });

        events.on('complete', (path: string) => {
          this.downloadRepo.updateState(download.id, 'complete');
          this.trackRepo.updateDownloadPath(trackId, path, 'ytdlp');
          this.emitEvent('track:status-changed', { trackId, status: TrackStatus.DOWNLOADED });
          this.emitEvent('download:complete', { trackId, filePath: path });
          resolvePromise();
        });

        events.on('error', (err: Error) => {
          rejectPromise(err);
        });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.downloadRepo.updateState(download.id, 'failed');
      this.trackRepo.updateStatus(trackId, TrackStatus.FAILED, message);
      this.emitEvent('track:status-changed', { trackId, status: TrackStatus.FAILED });
      this.emitEvent('download:failed', { trackId, error: message });
    }
  }
}
