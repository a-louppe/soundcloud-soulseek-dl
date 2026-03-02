import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { SpinnerComponent } from '../../shared/components';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { TooltipDirective } from '../../shared/directives';
import { TrackStatus, type SoulseekSearchResult } from '@scsd/shared';
import { TrackStateService } from '../../core/services/track-state.service';
import { TrackCardComponent } from '../track-card/track-card.component';
import {
  SearchResultsDialogComponent,
  SearchResultsDialogData,
} from '../search-results-dialog/search-results-dialog.component';
import { SidebarComponent, NavItem } from '../../shared/components/sidebar/sidebar.component';
import { IconComponent } from '../../shared/components/icon.component';

/**
 * Dashboard is the main view displaying all tracks with filters and actions.
 *
 * The dashboard provides:
 * - Status summary bar showing counts per status (pending, downloading, etc.)
 * - Quick filters to view tracks by status
 * - Text search for filtering by title/artist
 * - Bulk actions: sync from SoundCloud, bulk search on Soulseek
 * - Scrollable track list with lazy loading (future enhancement)
 *
 * State is managed centrally in TrackStateService and updated in real-time
 * via SSE events, so the UI stays in sync without polling.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    MatSnackBarModule,
    MatDialogModule,
    FormsModule,
    TrackCardComponent,
    SidebarComponent,
    IconComponent,
    SpinnerComponent,
    TooltipDirective,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly trackState = inject(TrackStateService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  // Expose TrackStatus enum to template
  readonly TrackStatus = TrackStatus;

  // Expose state service signals
  readonly tracks = this.trackState.tracks;
  readonly statusCounts = this.trackState.statusCounts;
  readonly totalTracks = this.trackState.totalTracks;
  readonly isLoading = this.trackState.isLoading;
  readonly isSyncing = this.trackState.isSyncing;
  readonly downloadProgress = this.trackState.downloadProgress;
  readonly filterParams = this.trackState.filterParams;

  // Local state
  searchText = signal('');
  activeFilter = signal<TrackStatus | null>(null);

  // Selection state — tracks selected via checkboxes for bulk actions
  readonly selectedTrackIds = signal(new Set<number>());

  /** Whether every visible track is currently selected */
  readonly isAllSelected = computed(() => {
    const visible = this.tracks();
    const selected = this.selectedTrackIds();
    return visible.length > 0 && visible.every(t => selected.has(t.id));
  });

  /** Count of currently selected tracks */
  readonly selectedCount = computed(() => this.selectedTrackIds().size);

  /** Whether some (but not all) visible tracks are selected — drives indeterminate state */
  readonly isSomeSelected = computed(() => {
    const visible = this.tracks();
    const selected = this.selectedTrackIds();
    const count = visible.filter(t => selected.has(t.id)).length;
    return count > 0 && count < visible.length;
  });

  // Status filter options for sidebar navigation
  readonly statusFilters: NavItem[] = [
    { status: null, label: 'All', icon: 'list' },
    { status: TrackStatus.PENDING, label: 'Pending', icon: 'schedule' },
    { status: TrackStatus.SEARCHING, label: 'Searching', icon: 'search' },
    { status: TrackStatus.FOUND_ON_SOULSEEK, label: 'Found', icon: 'check_circle' },
    { status: TrackStatus.NOT_FOUND, label: 'Not Found', icon: 'help_outline' },
    { status: TrackStatus.DOWNLOADING, label: 'Downloading', icon: 'downloading' },
    { status: TrackStatus.DOWNLOADED, label: 'Downloaded', icon: 'download_done' },
    { status: TrackStatus.FAILED, label: 'Failed', icon: 'error' },
  ];

  ngOnInit(): void {
    this.loadTracks();
  }

  async loadTracks(): Promise<void> {
    try {
      await this.trackState.loadTracks();
    } catch (err) {
      this.showError('Failed to load tracks');
    }
  }

  async onSyncClick(): Promise<void> {
    try {
      await this.trackState.syncFromSoundCloud();
      this.showSuccess('Syncing from SoundCloud...');
    } catch (err) {
      this.showError('Failed to start sync');
    }
  }

  async onCancelSyncClick(): Promise<void> {
    try {
      await this.trackState.cancelSync();
      this.showSuccess('Sync cancelled');
    } catch (err) {
      this.showError('Failed to cancel sync');
    }
  }

  async onBulkSearchClick(): Promise<void> {
    try {
      await this.trackState.bulkSearch();
      this.showSuccess('Bulk search started');
    } catch (err) {
      this.showError('Failed to start bulk search');
    }
  }

  onFilterChange(status: TrackStatus | null): void {
    this.activeFilter.set(status);
    this.trackState.setFilters({ status: status ?? undefined });
  }

  onSearchChange(text: string): void {
    this.searchText.set(text);
    this.trackState.setFilters({ search: text || undefined });
  }

  async onSearchTrack(trackId: number): Promise<void> {
    try {
      await this.trackState.searchTrack(trackId);
    } catch (err) {
      this.showError('Failed to search track');
    }
  }

  onViewResults(trackId: number): void {
    const track = this.trackState.getTrack(trackId);
    if (!track) return;

    const dialogRef = this.dialog.open(SearchResultsDialogComponent, {
      data: { track } as SearchResultsDialogData,
      width: '800px',
    });

    dialogRef.afterClosed().subscribe(async (result: SoulseekSearchResult | undefined) => {
      if (result) {
        try {
          await this.trackState.downloadSoulseek(trackId, result.id);
          this.showSuccess('Download started');
        } catch (err) {
          this.showError('Failed to start download');
        }
      }
    });
  }

  async onDownloadYtdlp(trackId: number): Promise<void> {
    try {
      await this.trackState.downloadYtdlp(trackId);
      this.showSuccess('yt-dlp download started');
    } catch (err) {
      this.showError('Failed to start yt-dlp download');
    }
  }

  onToggleTrackSelection(trackId: number): void {
    const next = new Set(this.selectedTrackIds());
    if (next.has(trackId)) {
      next.delete(trackId);
    } else {
      next.add(trackId);
    }
    this.selectedTrackIds.set(next);
  }

  onToggleSelectAll(): void {
    const visible = this.tracks();
    if (this.isAllSelected()) {
      // Deselect all visible
      const next = new Set(this.selectedTrackIds());
      for (const t of visible) next.delete(t.id);
      this.selectedTrackIds.set(next);
    } else {
      // Select all visible
      const next = new Set(this.selectedTrackIds());
      for (const t of visible) next.add(t.id);
      this.selectedTrackIds.set(next);
    }
  }

  // ========== Bulk Actions ==========

  /** Helper to get selected IDs as an array */
  private getSelectedIds(): number[] {
    return Array.from(this.selectedTrackIds());
  }

  async onBulkDownloadSoulseek(): Promise<void> {
    const ids = this.getSelectedIds();
    if (ids.length === 0) return;
    try {
      await this.trackState.bulkSearchTracks(ids);
      this.showSuccess(`Searching Soulseek for ${ids.length} tracks...`);
    } catch (err) {
      this.showError('Failed to start bulk Soulseek search');
    }
  }

  async onBulkDownloadYtdlp(): Promise<void> {
    const ids = this.getSelectedIds();
    if (ids.length === 0) return;
    try {
      await this.trackState.bulkDownloadYtdlp(ids);
      this.showSuccess(`yt-dlp download started for ${ids.length} tracks`);
    } catch (err) {
      this.showError(err instanceof Error ? err.message : 'Failed to start yt-dlp downloads');
    }
  }

  async onBulkMarkDownloaded(): Promise<void> {
    const ids = this.getSelectedIds();
    if (ids.length === 0) return;
    try {
      await this.trackState.bulkUpdateStatus(ids, TrackStatus.DOWNLOADED);
      this.selectedTrackIds.set(new Set());
      this.showSuccess(`Marked ${ids.length} tracks as downloaded`);
    } catch (err) {
      this.showError('Failed to mark tracks as downloaded');
    }
  }

  async onBulkMarkNotDownloaded(): Promise<void> {
    const ids = this.getSelectedIds();
    if (ids.length === 0) return;
    try {
      await this.trackState.bulkUpdateStatus(ids, TrackStatus.PENDING);
      this.selectedTrackIds.set(new Set());
      this.showSuccess(`Marked ${ids.length} tracks as not downloaded`);
    } catch (err) {
      this.showError('Failed to mark tracks as not downloaded');
    }
  }

  getStatusCount(status: TrackStatus | null): number {
    if (status === null) {
      return this.totalTracks();
    }
    return this.statusCounts()[status] ?? 0;
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'OK', {
      duration: 3000,
      panelClass: 'snack-success',
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Dismiss', {
      duration: 5000,
      panelClass: 'snack-error',
    });
  }
}
