import { Pipe, PipeTransform } from '@angular/core';

/**
 * DurationPipe converts milliseconds to human-readable duration format.
 *
 * SoundCloud stores duration in milliseconds, but we want to display
 * it as "3:45" or "1:02:30" in the UI.
 *
 * Usage: {{ track.duration | duration }}
 */
@Pipe({
  name: 'duration',
  standalone: true,
})
export class DurationPipe implements PipeTransform {
  transform(ms: number): string {
    if (!ms || ms <= 0) return '0:00';

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => n.toString().padStart(2, '0');

    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${minutes}:${pad(seconds)}`;
  }
}
