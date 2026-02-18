import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { TooltipDirective } from '../../shared/directives';
import { MatSortModule, Sort } from '@angular/material/sort';
import { SpinnerComponent } from '../../shared/components';
import type { Track, SoulseekSearchResult } from '@scsd/shared';
import { ApiService } from '../../core/services/api.service';
import { FileSizePipe } from '../../shared/pipes';
import { IconComponent } from '../../shared/components/icon.component';

/**
 * Data passed to the dialog when opening it.
 */
export interface SearchResultsDialogData {
  track: Track;
}

/**
 * SearchResultsDialog displays Soulseek search results in a sortable table.
 *
 * Users can view file details (size, bitrate, format) and select a result
 * to download. The dialog fetches results from the API and displays them
 * with quality indicators (bitrate, sample rate, free slots).
 *
 * Results are sorted by a quality score by default, prioritizing:
 * - High bitrate (320 kbps > 256 > 192 > etc.)
 * - Lossless formats (FLAC, WAV)
 * - Users with free upload slots
 * - Fast upload speeds
 */
@Component({
  selector: 'app-search-results-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatTableModule,
    MatSortModule,
    FileSizePipe,
    IconComponent,
    SpinnerComponent,
    TooltipDirective,
  ],
  templateUrl: './search-results-dialog.component.html',
  styleUrl: './search-results-dialog.component.scss',
})
export class SearchResultsDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<SearchResultsDialogComponent>);
  private readonly api = inject(ApiService);
  readonly data = inject<SearchResultsDialogData>(MAT_DIALOG_DATA);

  // ========== State ==========
  readonly isLoading = signal(true);
  readonly results = signal<SoulseekSearchResult[]>([]);
  readonly sortState = signal<Sort>({ active: 'quality', direction: 'desc' });

  // Table columns
  readonly displayedColumns = ['filename', 'size', 'bitRate', 'format', 'user', 'actions'];

  // ========== Computed ==========

  /** Results sorted by current sort state */
  readonly sortedResults = computed(() => {
    const results = [...this.results()];
    const sort = this.sortState();

    if (!sort.active || sort.direction === '') {
      return results;
    }

    return results.sort((a, b) => {
      let cmp = 0;
      switch (sort.active) {
        case 'quality':
          cmp = this.getQualityScore(a) - this.getQualityScore(b);
          break;
        case 'size':
          cmp = a.size - b.size;
          break;
        case 'bitRate':
          cmp = (a.bitRate ?? 0) - (b.bitRate ?? 0);
          break;
        case 'filename':
          cmp = a.filename.localeCompare(b.filename);
          break;
        case 'user':
          cmp = a.username.localeCompare(b.username);
          break;
        default:
          cmp = 0;
      }
      return sort.direction === 'desc' ? -cmp : cmp;
    });
  });

  ngOnInit(): void {
    this.loadResults();
  }

  // ========== Methods ==========

  async loadResults(): Promise<void> {
    try {
      const results = await this.api.getSearchResults(this.data.track.id).toPromise();
      // Sort by quality score by default
      const scored = (results ?? []).map((r) => ({
        ...r,
        qualityScore: this.getQualityScore(r),
      }));
      scored.sort((a, b) => b.qualityScore - a.qualityScore);
      this.results.set(scored);
    } finally {
      this.isLoading.set(false);
    }
  }

  onSortChange(sort: Sort): void {
    this.sortState.set(sort);
  }

  onDownloadClick(result: SoulseekSearchResult): void {
    // Close dialog and return the selected result
    this.dialogRef.close(result);
  }

  onClose(): void {
    this.dialogRef.close();
  }

  /** Extract just the filename from full path */
  getFilename(path: string): string {
    return path.split(/[/\\]/).pop() ?? path;
  }

  /** Get format badge (FLAC, MP3, etc.) */
  getFormat(result: SoulseekSearchResult): string {
    return result.fileExtension?.toUpperCase() ?? 'Unknown';
  }

  /** Check if format is lossless */
  isLossless(result: SoulseekSearchResult): boolean {
    const ext = result.fileExtension?.toLowerCase();
    return ext === 'flac' || ext === 'wav' || ext === 'alac';
  }

  /** Format bitrate display */
  formatBitrate(result: SoulseekSearchResult): string {
    if (!result.bitRate) return '-';
    const vbr = result.isVariableBitRate ? ' VBR' : '';
    return `${result.bitRate}${vbr}`;
  }

  /** Calculate quality score for sorting (higher = better) */
  private getQualityScore(result: SoulseekSearchResult): number {
    let score = 0;

    // Bitrate scoring (0-100 points)
    if (result.bitRate) {
      score += Math.min(result.bitRate / 3.2, 100);
    }

    // Lossless bonus (50 points)
    if (this.isLossless(result)) {
      score += 50;
    }

    // Free upload slots bonus (20 points)
    if (result.freeUploadSlots) {
      score += 20;
    }

    // Upload speed scoring (0-30 points)
    if (result.uploadSpeed) {
      // 1 MB/s = 1048576 bytes/s → 30 points
      score += Math.min((result.uploadSpeed / 1048576) * 30, 30);
    }

    // Prefer shorter queue (penalty for long queues)
    if (result.queueLength && result.queueLength > 0) {
      score -= Math.min(result.queueLength * 2, 20);
    }

    return score;
  }
}
