import { Component, input, output, computed } from '@angular/core';
import { TrackStatus, type Track, type DownloadProgress } from '@scsd/shared';
import { StatusBadgeComponent, ProgressBarComponent, ExternalLinksComponent, IconComponent } from '../../shared/components';
import { TooltipDirective } from '../../shared/directives';
import { DurationPipe } from '../../shared/pipes';

/**
 * TrackCard displays a single track with artwork, info, status, and action buttons.
 *
 * This is the primary UI element in the dashboard's track list. Each card shows:
 * - Album artwork (or placeholder if none)
 * - Track title and artist
 * - Duration and liked date
 * - Current status as a color-coded badge
 * - Context-aware action buttons based on status
 * - Download progress when actively downloading
 */
@Component({
  selector: 'app-track-card',
  standalone: true,
  imports: [
    StatusBadgeComponent,
    ProgressBarComponent,
    ExternalLinksComponent,
    IconComponent,
    TooltipDirective,
    DurationPipe,
  ],
  templateUrl: './track-card.component.html',
  styleUrl: './track-card.component.scss',
})
export class TrackCardComponent {
  // Expose enum to template
  protected readonly TrackStatus = TrackStatus;

  // ========== Inputs ==========
  track = input.required<Track>();
  downloadProgress = input<DownloadProgress | undefined>();

  // ========== Outputs ==========
  searchClicked = output<number>();
  viewResultsClicked = output<number>();
  downloadYtdlpClicked = output<number>();

  // ========== Computed ==========

  /** Check if track can be searched (pending or not_found status) */
  protected readonly canSearch = computed(() => {
    const status = this.track().status;
    return status === TrackStatus.PENDING || status === TrackStatus.NOT_FOUND;
  });

  /** Check if track has Soulseek results to view */
  protected readonly hasResults = computed(() => {
    return this.track().status === TrackStatus.FOUND_ON_SOULSEEK;
  });

  /** Check if track is currently downloading */
  protected readonly isDownloading = computed(() => {
    return this.track().status === TrackStatus.DOWNLOADING;
  });

  /** Check if track is already downloaded */
  protected readonly isDownloaded = computed(() => {
    return this.track().status === TrackStatus.DOWNLOADED;
  });

  /** Check if yt-dlp fallback is available (not found or failed) */
  protected readonly canUseYtdlp = computed(() => {
    const status = this.track().status;
    return status === TrackStatus.NOT_FOUND || status === TrackStatus.FAILED;
  });

  /** Check if currently searching */
  protected readonly isSearching = computed(() => {
    return this.track().status === TrackStatus.SEARCHING;
  });

  /** Artwork URL with fallback */
  protected readonly artworkUrl = computed(() => {
    const url = this.track().artworkUrl;
    // SoundCloud artwork URLs can have size parameters like -large, -t500x500
    // We want a reasonable size for thumbnails
    if (url) {
      return url.replace('-large', '-t200x200');
    }
    return 'assets/placeholder-artwork.svg';
  });

  // ========== Event Handlers ==========

  onSearchClick(): void {
    this.searchClicked.emit(this.track().id);
  }

  onViewResultsClick(): void {
    this.viewResultsClicked.emit(this.track().id);
  }

  onDownloadYtdlpClick(): void {
    this.downloadYtdlpClicked.emit(this.track().id);
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = 'assets/placeholder-artwork.svg';
  }
}
