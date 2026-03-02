import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { firstValueFrom, Subscription } from 'rxjs';
import { TrackStatus, type Track, type DownloadProgress, type ListTracksParams } from '@scsd/shared';
import { ApiService } from './api.service';
import { SseService } from './sse.service';

/**
 * TrackStateService is the central state manager for tracks using Angular Signals.
 *
 * Signals provide fine-grained reactivity - components only re-render when the
 * specific signal they depend on changes. This is more efficient than traditional
 * RxJS-based state management for UI state.
 *
 * The service:
 * - Fetches paginated tracks from the server (filtering, sorting, pagination all server-side)
 * - Fetches status counts from a dedicated endpoint so sidebar shows DB-level totals
 * - Subscribes to SSE events to update track states in real-time
 * - Tracks download progress separately from track data
 */
@Injectable({ providedIn: 'root' })
export class TrackStateService implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly sse = inject(SseService);
  private subscriptions: Subscription[] = [];

  // ========== Core State Signals ==========

  /** Map of track ID -> Track for efficient updates */
  private readonly tracksMap = signal<Map<number, Track>>(new Map());

  /** Current filter/sort params */
  readonly filterParams = signal<ListTracksParams>({
    sort: 'liked_at',
    order: 'desc',
    limit: 50,
    page: 1,
  });

  /** Pagination state — driven by server response */
  readonly pagination = signal({ page: 1, total: 0, limit: 50 });

  /** Loading states */
  readonly isLoading = signal(false);
  readonly isSyncing = signal(false);

  /** Download progress keyed by track ID */
  readonly downloadProgress = signal<Map<number, DownloadProgress>>(new Map());

  /**
   * Server-sourced status counts — fetched from GET /api/tracks/counts.
   * Unlike client-side counting, these reflect the entire database regardless
   * of which page of tracks is currently loaded.
   */
  private readonly serverStatusCounts = signal<Record<string, number>>({});

  // ========== Computed Signals ==========

  /**
   * All tracks on the current page, in server-provided order.
   * Filtering, sorting, and pagination are handled server-side,
   * so we just return the loaded tracks as-is.
   */
  readonly tracks = computed(() => {
    return Array.from(this.tracksMap().values());
  });

  /** Status counts sourced from the server (full DB) */
  readonly statusCounts = computed(() => this.serverStatusCounts());

  /** Total track count across all statuses (full DB) */
  readonly totalTracks = computed(() => {
    const counts = this.serverStatusCounts();
    return Object.values(counts).reduce((sum, n) => sum + n, 0);
  });

  constructor() {
    // Connect to SSE and subscribe to events
    this.sse.connect();
    this.setupEventSubscriptions();
  }

  // ========== Public Methods ==========

  /** Load tracks from API with current filters */
  async loadTracks(): Promise<void> {
    this.isLoading.set(true);
    try {
      const params = this.filterParams();
      const response = await firstValueFrom(this.api.getTracks(params));
      if (response) {
        const newMap = new Map<number, Track>();
        for (const track of response.data) {
          newMap.set(track.id, track);
        }
        this.tracksMap.set(newMap);
        this.pagination.set({
          page: response.page,
          total: response.total,
          limit: response.limit,
        });
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Fetch status counts from the server — reflects full DB, not just loaded page */
  async loadCounts(): Promise<void> {
    try {
      const counts = await firstValueFrom(this.api.getStatusCounts());
      this.serverStatusCounts.set(counts);
    } catch {
      // Silently ignore — counts are non-critical
    }
  }

  /** Sync SoundCloud likes */
  async syncFromSoundCloud(): Promise<void> {
    this.isSyncing.set(true);
    try {
      await firstValueFrom(this.api.syncTracks());
      // Results come via SSE sync:progress/sync:complete events
    } catch (err) {
      this.isSyncing.set(false);
      throw err;
    }
  }

  /** Cancel an in-progress sync */
  async cancelSync(): Promise<void> {
    await firstValueFrom(this.api.cancelSync());
  }

  /** Update filter params, reset to page 1, and reload */
  setFilters(params: Partial<ListTracksParams>): void {
    this.filterParams.update((current) => ({ ...current, ...params, page: 1 }));
    this.loadTracks();
  }

  /** Called by the paginator when page or pageSize changes */
  setPage(page: number, pageSize: number): void {
    this.filterParams.update((current) => ({ ...current, page, limit: pageSize }));
    this.loadTracks();
  }

  /** Search Soulseek for a track */
  async searchTrack(trackId: number): Promise<void> {
    const prev = this.getTrack(trackId)?.status;
    this.updateTrackInMap(trackId, { status: TrackStatus.SEARCHING });
    try {
      await firstValueFrom(this.api.searchTrack(trackId));
    } catch (err) {
      if (prev) this.updateTrackInMap(trackId, { status: prev });
      throw err;
    }
  }

  /** Bulk search all pending/not_found tracks */
  async bulkSearch(): Promise<void> {
    await firstValueFrom(this.api.bulkSearch());
  }

  /** Download via Soulseek */
  async downloadSoulseek(trackId: number, resultId: number): Promise<void> {
    const prev = this.getTrack(trackId)?.status;
    this.updateTrackInMap(trackId, { status: TrackStatus.DOWNLOADING });
    try {
      await firstValueFrom(this.api.downloadSoulseek({ trackId, resultId }));
    } catch (err) {
      if (prev) this.updateTrackInMap(trackId, { status: prev });
      throw err;
    }
  }

  /** Download via yt-dlp */
  async downloadYtdlp(trackId: number): Promise<void> {
    const prev = this.getTrack(trackId)?.status;
    this.updateTrackInMap(trackId, { status: TrackStatus.DOWNLOADING });
    try {
      await firstValueFrom(this.api.downloadYtdlp({ trackId }));
    } catch (err) {
      if (prev) this.updateTrackInMap(trackId, { status: prev });
      throw err;
    }
  }

  /** Update a track's status manually (e.g. mark as downloaded) */
  async updateTrackStatus(trackId: number, status: TrackStatus): Promise<void> {
    await firstValueFrom(this.api.updateTrackStatus(trackId, status));
    this.updateTrackInMap(trackId, { status });
  }

  /** Bulk update status — single request to the server instead of N individual ones */
  async bulkUpdateStatus(trackIds: number[], status: TrackStatus): Promise<void> {
    // Snapshot previous statuses so we can rollback on failure
    const prevStatuses = new Map(
      trackIds.map(id => [id, this.getTrack(id)?.status]).filter(([, s]) => s != null) as [number, TrackStatus][],
    );
    // Optimistic UI update — flip all statuses immediately so the user sees instant feedback
    for (const id of trackIds) {
      this.updateTrackInMap(id, { status });
    }
    try {
      await firstValueFrom(this.api.bulkUpdateStatus({ trackIds, status }));
    } catch (err) {
      for (const [id, prev] of prevStatuses) {
        this.updateTrackInMap(id, { status: prev });
      }
      throw err;
    }
  }

  /**
   * Bulk download via yt-dlp — fires all requests in parallel.
   * Uses Promise.allSettled so one failure doesn't cancel the rest.
   * Failed tracks get reverted to their previous status.
   */
  async bulkDownloadYtdlp(trackIds: number[]): Promise<void> {
    const prevStatuses = new Map(
      trackIds.map(id => [id, this.getTrack(id)?.status]).filter(([, s]) => s != null) as [number, TrackStatus][],
    );
    for (const id of trackIds) {
      this.updateTrackInMap(id, { status: TrackStatus.DOWNLOADING });
    }
    const results = await Promise.allSettled(
      trackIds.map(id => firstValueFrom(this.api.downloadYtdlp({ trackId: id }))),
    );
    // Revert failed tracks to their previous status
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        const prev = prevStatuses.get(trackIds[i]);
        if (prev) this.updateTrackInMap(trackIds[i], { status: prev });
      }
    });
    const failedCount = results.filter(r => r.status === 'rejected').length;
    if (failedCount > 0) {
      throw new Error(`${failedCount} of ${trackIds.length} downloads failed to start`);
    }
  }

  /** Bulk search on Soulseek — single request, the server handles concurrency */
  async bulkSearchTracks(trackIds: number[]): Promise<void> {
    const prevStatuses = new Map(
      trackIds.map(id => [id, this.getTrack(id)?.status]).filter(([, s]) => s != null) as [number, TrackStatus][],
    );
    for (const id of trackIds) {
      this.updateTrackInMap(id, { status: TrackStatus.SEARCHING });
    }
    try {
      await firstValueFrom(this.api.bulkSearch(trackIds));
    } catch (err) {
      for (const [id, prev] of prevStatuses) {
        this.updateTrackInMap(id, { status: prev });
      }
      throw err;
    }
  }

  /** Get a single track by ID */
  getTrack(id: number): Track | undefined {
    return this.tracksMap().get(id);
  }

  /** Get download progress for a track */
  getDownloadProgress(trackId: number): DownloadProgress | undefined {
    return this.downloadProgress().get(trackId);
  }

  // ========== Private Methods ==========

  private setupEventSubscriptions(): void {
    // Track status changes — update in-memory track + refresh counts
    this.subscriptions.push(
      this.sse.trackStatusChanged$.subscribe(({ trackId, status }) => {
        this.updateTrackInMap(trackId, { status: status as TrackStatus });
        this.loadCounts();
      })
    );

    // Download progress
    this.subscriptions.push(
      this.sse.downloadProgress$.subscribe((progress) => {
        this.downloadProgress.update((map) => {
          const newMap = new Map(map);
          newMap.set(progress.trackId, {
            ...progress,
            source: 'soulseek', // Will be overwritten by actual source
            state: 'downloading',
          });
          return newMap;
        });
      })
    );

    // Download complete
    this.subscriptions.push(
      this.sse.downloadComplete$.subscribe(({ trackId, filePath }) => {
        this.updateTrackInMap(trackId, {
          status: TrackStatus.DOWNLOADED,
          downloadPath: filePath,
        });
        // Clear progress
        this.downloadProgress.update((map) => {
          const newMap = new Map(map);
          newMap.delete(trackId);
          return newMap;
        });
        this.loadCounts();
      })
    );

    // Download failed
    this.subscriptions.push(
      this.sse.downloadFailed$.subscribe(({ trackId, error }) => {
        this.updateTrackInMap(trackId, {
          status: TrackStatus.FAILED,
          errorMessage: error,
        });
        // Clear progress
        this.downloadProgress.update((map) => {
          const newMap = new Map(map);
          newMap.delete(trackId);
          return newMap;
        });
        this.loadCounts();
      })
    );

    // Search progress (when results found)
    this.subscriptions.push(
      this.sse.searchProgress$.subscribe(({ trackId, resultsCount, isComplete }) => {
        if (isComplete) {
          const newStatus = resultsCount > 0 ? TrackStatus.FOUND_ON_SOULSEEK : TrackStatus.NOT_FOUND;
          this.updateTrackInMap(trackId, { status: newStatus });
          this.loadCounts();
        }
      })
    );

    // Sync progress — merge incoming tracks into the map as they arrive
    this.subscriptions.push(
      this.sse.syncProgress$.subscribe(({ tracks }) => {
        this.tracksMap.update((map) => {
          const newMap = new Map(map);
          for (const track of tracks) {
            newMap.set(track.id, track);
          }
          return newMap;
        });
        this.loadCounts();
      })
    );

    // Sync complete
    this.subscriptions.push(
      this.sse.syncComplete$.subscribe(() => {
        this.isSyncing.set(false);
        // Final reload to ensure pagination/counts are accurate
        this.loadTracks();
        this.loadCounts();
      })
    );
  }

  private updateTrackInMap(trackId: number, updates: Partial<Track>): void {
    this.tracksMap.update((map) => {
      const track = map.get(trackId);
      if (track) {
        const newMap = new Map(map);
        newMap.set(trackId, { ...track, ...updates });
        return newMap;
      }
      return map;
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
    this.sse.disconnect();
  }
}
