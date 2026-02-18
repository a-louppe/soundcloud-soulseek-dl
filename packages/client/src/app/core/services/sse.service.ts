import { Injectable, NgZone, inject, OnDestroy } from '@angular/core';
import { Observable, Subject, share, filter, map } from 'rxjs';
import type { SSEEvent } from '@scsd/shared';

/**
 * SseService manages a single EventSource connection to the server's SSE endpoint.
 *
 * Server-Sent Events (SSE) provide a unidirectional stream from server to client,
 * perfect for real-time updates like download progress or status changes. Unlike WebSockets,
 * SSE automatically reconnects on disconnection and works over standard HTTP.
 *
 * The service exposes typed Observable streams for each event type, allowing components
 * to subscribe only to the events they care about.
 */
@Injectable({ providedIn: 'root' })
export class SseService implements OnDestroy {
  private readonly ngZone = inject(NgZone);
  private eventSource: EventSource | null = null;
  private readonly events$ = new Subject<SSEEvent>();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Shared observable for all SSE events - automatically reconnects on disconnect */
  readonly allEvents$ = this.events$.asObservable().pipe(share());

  // ========== Typed event streams ==========
  // Each stream filters the main event stream to its specific type,
  // providing type-safe access to the event data.

  readonly trackStatusChanged$ = this.allEvents$.pipe(
    filter((e): e is Extract<SSEEvent, { type: 'track:status-changed' }> => e.type === 'track:status-changed'),
    map((e) => e.data)
  );

  readonly searchProgress$ = this.allEvents$.pipe(
    filter((e): e is Extract<SSEEvent, { type: 'search:progress' }> => e.type === 'search:progress'),
    map((e) => e.data)
  );

  readonly downloadProgress$ = this.allEvents$.pipe(
    filter((e): e is Extract<SSEEvent, { type: 'download:progress' }> => e.type === 'download:progress'),
    map((e) => e.data)
  );

  readonly downloadComplete$ = this.allEvents$.pipe(
    filter((e): e is Extract<SSEEvent, { type: 'download:complete' }> => e.type === 'download:complete'),
    map((e) => e.data)
  );

  readonly downloadFailed$ = this.allEvents$.pipe(
    filter((e): e is Extract<SSEEvent, { type: 'download:failed' }> => e.type === 'download:failed'),
    map((e) => e.data)
  );

  readonly syncComplete$ = this.allEvents$.pipe(
    filter((e): e is Extract<SSEEvent, { type: 'sync:complete' }> => e.type === 'sync:complete'),
    map((e) => e.data)
  );

  /** Connect to SSE endpoint and start receiving events */
  connect(): void {
    if (this.eventSource) {
      return; // Already connected
    }

    // Run EventSource creation outside Angular zone to avoid triggering
    // unnecessary change detection on each heartbeat/message
    this.ngZone.runOutsideAngular(() => {
      this.eventSource = new EventSource('/api/events/stream');

      this.eventSource.onopen = () => {
        console.log('[SSE] Connected');
        this.reconnectAttempts = 0;
      };

      this.eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as SSEEvent;
          // Re-enter Angular zone when emitting events so subscribers
          // can trigger change detection if needed
          this.ngZone.run(() => {
            this.events$.next(parsed);
          });
        } catch (err) {
          console.warn('[SSE] Failed to parse event:', event.data, err);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error);
        this.eventSource?.close();
        this.eventSource = null;
        this.scheduleReconnect();
      };
    });
  }

  /** Disconnect from SSE and stop reconnection attempts */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.reconnectAttempts = 0;
  }

  /** Exponential backoff reconnection strategy */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SSE] Max reconnection attempts reached');
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, ... capped at 30s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimeout = setTimeout(() => this.connect(), delay);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
