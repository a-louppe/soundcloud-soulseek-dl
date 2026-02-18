import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { HealthStatusResponse } from '@scsd/shared';
import { ApiService } from '../../core/services/api.service';
import { IconComponent, SpinnerComponent } from '../../shared/components';

/**
 * Settings component displays system health and configuration information.
 *
 * Shows connectivity status for:
 * - slskd daemon (Soulseek backend)
 * - SoundCloud API (OAuth token validity)
 * - yt-dlp binary availability
 *
 * Also displays the download directory path and track statistics.
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    RouterLink,
    IconComponent,
    SpinnerComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly isLoading = signal(true);
  readonly health = signal<HealthStatusResponse | null>(null);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadHealthStatus();
  }

  async loadHealthStatus(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const status = await this.api.getHealthStatus().toPromise();
      this.health.set(status ?? null);
    } catch (err) {
      this.error.set('Failed to load health status');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onRefreshClick(): Promise<void> {
    await this.loadHealthStatus();
  }
}
