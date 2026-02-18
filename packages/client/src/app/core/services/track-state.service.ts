import { Injectable, inject, signal, computed, OnDestroy, effect } from '@angular/core';
import { Subscription } from 'rxjs';
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
      const response = await this.api.getTracks(params).toPromise();
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
      await this.api.syncTracks().toPromise();
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
    this.updateTrackStatus(trackId, TrackStatus.SEARCHING);
    await this.api.searchTrack(trackId).toPromise();
  }

  /** Bulk search all pending/not_found tracks */
  async bulkSearch(): Promise<void> {
    await this.api.bulkSearch().toPromise();
  }

  /** Download via Soulseek */
  async downloadSoulseek(trackId: number, resultId: number): Promise<void> {
    this.updateTrackStatus(trackId, TrackStatus.DOWNLOADING);
    await this.api.downloadSoulseek({ trackId, resultId }).toPromise();
  }

  /** Download via yt-dlp */
  async downloadYtdlp(trackId: number): Promise<void> {
    this.updateTrackStatus(trackId, TrackStatus.DOWNLOADING);
    await this.api.downloadYtdlp({ trackId }).toPromise();
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
        this.updateTrackStatus(trackId, status as TrackStatus);
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
          this.updateTrackStatus(trackId, newStatus);
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

  private updateTrackStatus(trackId: number, status: TrackStatus): void {
    this.updateTrackInMap(trackId, { status });
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
