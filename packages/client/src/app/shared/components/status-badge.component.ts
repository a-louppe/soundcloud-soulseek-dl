import { Component, input, computed } from '@angular/core';
import { TrackStatus } from '@scsd/shared';
import { IconComponent } from './icon.component';

/**
 * StatusBadge displays a color-coded pill showing a track's current status.
 *
 * Uses desaturated pastel colors for a professional, matte appearance.
 * Each status has an associated color and icon for at-a-glance feedback.
 */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [IconComponent],
  template: `
    <span
      class="badge"
      [class]="config().bgClass"
      [class.text-surface-base]="!config().lightText"
      [class.text-txt-primary]="config().lightText"
    >
      <app-icon [name]="config().icon" [size]="12" />
      {{ config().label }}
    </span>
  `,
  styles: [`
    :host {
      display: inline-flex;
    }
  `],
})
export class StatusBadgeComponent {
  status = input.required<TrackStatus>();

  protected readonly config = computed(() => {
    const statusConfig: Record<TrackStatus, { label: string; icon: string; bgClass: string; lightText?: boolean }> = {
      [TrackStatus.PENDING]: {
        label: 'Pending',
        icon: 'schedule',
        bgClass: 'bg-status-pending',
        lightText: true,
      },
      [TrackStatus.SEARCHING]: {
        label: 'Searching',
        icon: 'sync',
        bgClass: 'bg-status-searching',
      },
      [TrackStatus.FOUND_ON_SOULSEEK]: {
        label: 'Matched',
        icon: 'check',
        bgClass: 'bg-status-matched',
      },
      [TrackStatus.NOT_FOUND]: {
        label: 'Missing',
        icon: 'help_outline',
        bgClass: 'bg-status-missing',
      },
      [TrackStatus.DOWNLOADING]: {
        label: 'Downloading',
        icon: 'downloading',
        bgClass: 'bg-status-downloading',
      },
      [TrackStatus.DOWNLOADED]: {
        label: 'Complete',
        icon: 'check_circle',
        bgClass: 'bg-status-complete',
      },
      [TrackStatus.FAILED]: {
        label: 'Failed',
        icon: 'error',
        bgClass: 'bg-status-failed',
      },
    };

    return statusConfig[this.status()];
  });
}
