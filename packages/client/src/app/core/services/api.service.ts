import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  Track,
  SoulseekSearchResult,
  ListTracksParams,
  PaginatedResponse,
  TrackWithResults,
  SyncTracksResponse,
  HealthStatusResponse,
  ActiveDownloadsResponse,
  SoulseekDownloadRequest,
  YtdlpDownloadRequest,
  BulkUpdateStatusRequest,
} from '@scsd/shared';

/**
 * ApiService handles all HTTP communication with the Fastify backend.
 * All endpoints are prefixed with /api and proxied in development (see proxy.conf.json).
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  // ========== Tracks ==========

  /** Fetch paginated list of tracks with optional filters */
  getTracks(params: ListTracksParams = {}): Observable<PaginatedResponse<Track>> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    if (params.order) httpParams = httpParams.set('order', params.order);
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.search) httpParams = httpParams.set('search', params.search);

    return this.http.get<PaginatedResponse<Track>>(`${this.baseUrl}/tracks`, { params: httpParams });
  }

  /** Get single track with its Soulseek search results */
  getTrack(id: number): Observable<TrackWithResults> {
    return this.http.get<TrackWithResults>(`${this.baseUrl}/tracks/${id}`);
  }

  /** Sync SoundCloud likes - triggers background sync, returns immediately (202) */
  syncTracks(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/tracks/sync`, {});
  }

  /** Update a track's status (e.g. manually mark as downloaded/pending) */
  updateTrackStatus(id: number, status: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/tracks/${id}/status`, { status });
  }

  /** Bulk update status for multiple tracks in a single request */
  bulkUpdateStatus(request: BulkUpdateStatusRequest): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/tracks/bulk-status`, request);
  }

  /** Delete a track from the database */
  deleteTrack(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/tracks/${id}`);
  }

  // ========== Search ==========

  /** Search Soulseek for a single track - async operation, results via SSE */
  searchTrack(trackId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/search/${trackId}`, {});
  }

  /** Bulk search for multiple tracks (or all pending/not_found if no IDs given) */
  bulkSearch(trackIds?: number[]): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/search/bulk`, { trackIds });
  }

  /** Get cached Soulseek search results for a track */
  getSearchResults(trackId: number): Observable<SoulseekSearchResult[]> {
    return this.http.get<SoulseekSearchResult[]>(`${this.baseUrl}/search/${trackId}/results`);
  }

  // ========== Downloads ==========

  /** Start a Soulseek download for a specific search result */
  downloadSoulseek(request: SoulseekDownloadRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/downloads/soulseek`, request);
  }

  /** Start a yt-dlp download (uses track's SoundCloud URL or custom sourceUrl) */
  downloadYtdlp(request: YtdlpDownloadRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/downloads/ytdlp`, request);
  }

  /** Get currently active downloads with progress */
  getActiveDownloads(): Observable<ActiveDownloadsResponse> {
    return this.http.get<ActiveDownloadsResponse>(`${this.baseUrl}/downloads/active`);
  }

  /** Cancel an active download */
  cancelDownload(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/downloads/${id}/cancel`, {});
  }

  /** Retry a failed download */
  retryDownload(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/downloads/${id}/retry`, {});
  }

  // ========== Config/Health ==========

  /** Get system health status (slskd, SoundCloud, yt-dlp connectivity) */
  getHealthStatus(): Observable<HealthStatusResponse> {
    return this.http.get<HealthStatusResponse>(`${this.baseUrl}/config/status`);
  }
}
