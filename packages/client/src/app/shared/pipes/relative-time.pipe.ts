import { Pipe, PipeTransform } from '@angular/core';

/**
 * RelativeTimePipe converts ISO date strings to relative time format.
 *
 * Displays dates as "5 minutes ago", "2 hours ago", "3 days ago", etc.
 * Falls back to the date for anything older than 30 days.
 *
 * Usage: {{ track.likedAt | relativeTime }}
 */
@Pipe({
  name: 'relativeTime',
  standalone: true,
})
export class RelativeTimePipe implements PipeTransform {
  transform(dateString: string | null | undefined): string {
    if (!dateString) return 'Unknown';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
      return 'just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else if (diffDays < 30) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    } else {
      // For older dates, show the actual date
      return date.toLocaleDateString();
    }
  }
}
