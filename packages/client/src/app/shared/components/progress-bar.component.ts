import { Component, input, computed } from '@angular/core';
import type { DownloadProgress } from '@scsd/shared';

/**
 * ProgressBar displays download progress with speed and ETA information.
 *
 * Shows a slim progress bar with human-readable stats like
 * "2.5 MB / 10 MB • 500 KB/s • 15s remaining"
 */
@Component({
  selector: 'app-progress-bar',
  standalone: true,
  imports: [],
  template: `
    <div class="w-full">
      <div class="h-1 bg-surface-overlay rounded-sm overflow-hidden">
        <div
          class="h-full bg-status-downloading transition-[width] duration-200"
          [style.width.%]="progress().percentComplete"
        ></div>
      </div>
      <div class="flex justify-between text-xs text-txt-muted mt-1">
        <span>{{ formattedSize() }}</span>
        <span class="text-status-downloading">{{ formattedSpeed() }}</span>
        <span>{{ formattedEta() }}</span>
      </div>
    </div>
  `,
})
export class ProgressBarComponent {
  progress = input.required<DownloadProgress>();

  protected readonly formattedSize = computed(() => {
    const p = this.progress();
    return `${this.formatBytes(p.bytesTransferred)} / ${this.formatBytes(p.totalBytes)}`;
  });

  protected readonly formattedSpeed = computed(() => {
    const speed = this.progress().speed;
    return `${this.formatBytes(speed)}/s`;
  });

  protected readonly formattedEta = computed(() => {
    const eta = this.progress().eta;
    if (eta <= 0) return 'calculating...';
    if (eta < 60) return `${Math.round(eta)}s remaining`;
    if (eta < 3600) return `${Math.round(eta / 60)}m remaining`;
    return `${Math.round(eta / 3600)}h remaining`;
  });

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}
