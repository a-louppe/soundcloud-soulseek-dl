import { Injectable, inject, signal, computed, OnDestroy, effect } from '@angular/core';
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
 * - Maintains a Map of tracks indexed by ID for O(1) lookups
 * - Subscribes to SSE events to update track states in real-time
 * - Provides computed signals for filtered views and status counts
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
    limit: 100,
  });

  /** Pagination state */
  readonly pagination = signal({ page: 1, total: 0, limit: 100 });

  /** Loading states */
  readonly isLoading = signal(false);
  readonly isSyncing = signal(false);

  /** Download progress keyed by track ID */
  readonly downloadProgress = signal<Map<number, DownloadProgress>>(new Map());

  // ========== Computed Signals ==========

  /** All tracks as an array, sorted by current sort params */
  readonly tracks = computed(() => {
    const map = this.tracksMap();
    const params = this.filterParams();
    let tracks = Array.from(map.values());

    // Apply status filter if set
    if (params.status) {
      tracks = tracks.filter((t) => t.status === params.status);
    }

    // Apply search filter if set
    if (params.search) {
      const search = params.search.toLowerCase();
      tracks = tracks.filter(
        (t) => t.title.toLowerCase().includes(search) || t.artist.toLowerCase().includes(search)
      );
    }

    // Sort
    const sortKey = params.sort ?? 'liked_at';
    const order = params.order ?? 'desc';
    tracks.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'artist':
          cmp = a.artist.localeCompare(b.artist);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'liked_at':
        default:
          const aDate = a.likedAt ? new Date(a.likedAt).getTime() : 0;
          const bDate = b.likedAt ? new Date(b.likedAt).getTime() : 0;
          cmp = aDate - bDate;
      }
      return order === 'desc' ? -cmp : cmp;
    });

    return tracks;
  });

  /** Status counts for the summary bar */
  readonly statusCounts = computed(() => {
    const map = this.tracksMap();
    const counts: Record<TrackStatus, number> = {
      [TrackStatus.PENDING]: 0,
      [TrackStatus.SEARCHING]: 0,
      [TrackStatus.FOUND_ON_SOULSEEK]: 0,
      [TrackStatus.NOT_FOUND]: 0,
      [TrackStatus.DOWNLOADING]: 0,
      [TrackStatus.DOWNLOADED]: 0,
      [TrackStatus.FAILED]: 0,
    };

    for (const track of map.values()) {
      counts[track.status]++;
    }

    return counts;
  });

  /** Total track count */
  readonly totalTracks = computed(() => this.tracksMap().size);

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

  /** Sync SoundCloud likes */
  async syncFromSoundCloud(): Promise<void> {
    this.isSyncing.set(true);
    try {
      await firstValueFrom(this.api.syncTracks());
      // Results come via SSE sync:complete event
    } catch (err) {
      this.isSyncing.set(false);
      throw err;
    }
  }

  /** Update filter params and reload */
  setFilters(params: Partial<ListTracksParams>): void {
    this.filterParams.update((current) => ({ ...current, ...params }));
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
    // Track status changes
    this.subscriptions.push(
      this.sse.trackStatusChanged$.subscribe(({ trackId, status }) => {
        this.updateTrackInMap(trackId, { status: status as TrackStatus });
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
      })
    );

    // Search progress (when results found)
    this.subscriptions.push(
      this.sse.searchProgress$.subscribe(({ trackId, resultsCount, isComplete }) => {
        if (isComplete) {
          const newStatus = resultsCount > 0 ? TrackStatus.FOUND_ON_SOULSEEK : TrackStatus.NOT_FOUND;
          this.updateTrackInMap(trackId, { status: newStatus });
        }
      })
    );

    // Sync complete
    this.subscriptions.push(
      this.sse.syncComplete$.subscribe(() => {
        this.isSyncing.set(false);
        // Reload tracks to get new ones
        this.loadTracks();
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
