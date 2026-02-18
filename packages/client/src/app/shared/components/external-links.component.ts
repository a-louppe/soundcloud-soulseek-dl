import { Component, input } from '@angular/core';
import { IconComponent } from './icon.component';
import { TooltipDirective } from '../directives';

/**
 * ExternalLinks displays buttons to search for a track on external platforms.
 *
 * These are "search URL generators" that open the respective site's search
 * page with the track info pre-filled.
 */
@Component({
  selector: 'app-external-links',
  standalone: true,
  imports: [IconComponent, TooltipDirective],
  template: `
    <div class="flex gap-1">
      <a
        [href]="beatportUrl()"
        target="_blank"
        rel="noopener noreferrer"
        appTooltip="Search on Beatport"
        class="btn-icon text-badge-beatport hover:bg-badge-beatport/20"
      >
        <span class="text-xs font-semibold">BP</span>
      </a>
      <a
        [href]="bandcampUrl()"
        target="_blank"
        rel="noopener noreferrer"
        appTooltip="Search on Bandcamp"
        class="btn-icon text-badge-bandcamp hover:bg-badge-bandcamp/20"
      >
        <span class="text-xs font-semibold">BC</span>
      </a>
      <a
        [href]="soundcloudUrl()"
        target="_blank"
        rel="noopener noreferrer"
        appTooltip="Open on SoundCloud"
        class="btn-icon text-status-missing hover:bg-status-missing/20"
      >
        <app-icon name="cloud" />
      </a>
    </div>
  `,
  styles: [`
    a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 4px;
      text-decoration: none;
    }
  `],
})
export class ExternalLinksComponent {
  beatportUrl = input.required<string>();
  bandcampUrl = input.required<string>();
  soundcloudUrl = input.required<string>();
}
