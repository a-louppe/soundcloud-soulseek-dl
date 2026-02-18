import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TrackStatus } from '@scsd/shared';
import { IconComponent } from '../icon.component';
import { TooltipDirective } from '../../directives';

export interface NavItem {
  status: TrackStatus | null;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [IconComponent, TooltipDirective, RouterLink],
  template: `
    <aside class="w-sidebar h-full flex flex-col bg-glass-bg backdrop-blur-glass border-r border-glass-border">
      <!-- Logo -->
      <div class="h-header flex items-center gap-2 px-4 border-b border-border-subtle">
        <app-icon name="graphic_eq" class="text-status-searching" />
        <span class="text-lg font-semibold text-txt-primary">Deep Sync</span>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 py-2 overflow-y-auto">
        @for (item of navItems(); track item.status) {
          <button
            class="w-full flex items-center justify-between px-4 py-2 text-base rounded-none
                   transition-colors duration-150
                   hover:bg-white/[0.04]"
            [class.bg-white/[0.08]]="activeStatus() === item.status"
            [class.text-txt-primary]="activeStatus() === item.status"
            [class.text-txt-secondary]="activeStatus() !== item.status"
            (click)="filterChange.emit(item.status)"
          >
            <div class="flex items-center gap-3">
              <app-icon [name]="item.icon" />
              <span>{{ item.label }}</span>
            </div>
            <span class="text-txt-muted text-sm tabular-nums">
              {{ getCount(item.status) }}
            </span>
          </button>
        }
      </nav>

      <!-- Footer -->
      <div class="border-t border-border-subtle p-2">
        <button
          class="w-full flex items-center gap-3 px-4 py-2 text-txt-secondary rounded-sm
                 hover:bg-white/[0.04] hover:text-txt-primary transition-colors"
          routerLink="/settings"
          appTooltip="Settings & Status"
        >
          <app-icon name="settings" />
          <span class="text-sm">Settings</span>
        </button>
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  navItems = input.required<NavItem[]>();
  activeStatus = input<TrackStatus | null>(null);
  statusCounts = input.required<Record<string, number>>();
  totalCount = input<number>(0);

  filterChange = output<TrackStatus | null>();

  getCount(status: TrackStatus | null): number {
    if (status === null) {
      return this.totalCount();
    }
    return this.statusCounts()[status] ?? 0;
  }
}
