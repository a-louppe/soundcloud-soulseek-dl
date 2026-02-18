import { Pipe, PipeTransform } from '@angular/core';

/**
 * FileSizePipe converts bytes to human-readable file sizes.
 *
 * Soulseek results include file sizes in bytes, which we display
 * as "4.5 MB" or "320 KB" for readability.
 *
 * Usage: {{ result.size | fileSize }}
 */
@Pipe({
  name: 'fileSize',
  standalone: true,
})
export class FileSizePipe implements PipeTransform {
  transform(bytes: number | null | undefined): string {
    if (bytes === null || bytes === undefined || bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}
