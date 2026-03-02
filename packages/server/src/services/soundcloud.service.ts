import type { AppConfig } from '../config.js';

interface SoundCloudTrack {
  id: number;
  title: string;
  user: { username: string };
  artwork_url: string | null;
  permalink_url: string;
  duration: number;
  created_at: string;
  publisher_metadata?: {
    artist?: string;
    isrc?: string;
    contains_music?: boolean;
    explicit?: boolean;
  } | null;
  label_name?: string | null;
}

interface SoundCloudLikesResponse {
  collection: Array<{ track: SoundCloudTrack; created_at: string }>;
  next_href: string | null;
}

export interface ParsedTrack {
  soundcloudId: number;
  title: string;
  artist: string;
  originalArtist: string;
  label: string | null;
  artworkUrl: string | null;
  soundcloudUrl: string;
  duration: number;
  likedAt: string | null;
}

export class SoundCloudService {
  private token: string;
  private userId: string;
  private baseUrl = 'https://api-v2.soundcloud.com';

  constructor(config: AppConfig) {
    this.token = config.soundcloudOauthToken;
    this.userId = config.soundcloudUserId;
  }

  private async request<T>(url: string, retries = 3): Promise<T> {
    const res = await fetch(url, {
      headers: {
        Authorization: `OAuth ${this.token}`,
        Accept: 'application/json',
      },
    });

    if (res.status === 429 && retries > 0) {
      // SoundCloud returns Retry-After in seconds when rate-limited.
      // Fall back to exponential backoff (2s, 4s, 8s) if the header is absent.
      const retryAfter = res.headers.get('Retry-After');
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : (4 - retries) * 2000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return this.request<T>(url, retries - 1);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`SoundCloud API error: ${res.status} ${res.statusText}${body ? ` — ${body}` : ''}`);
    }

    return res.json() as Promise<T>;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request(`${this.baseUrl}/me`);
      return true;
    } catch {
      return false;
    }
  }

  async *fetchAllLikes(): AsyncGenerator<ParsedTrack[]> {
    let url: string | null =
      `${this.baseUrl}/users/${this.userId}/likes?limit=200&linked_partitioning=1`;

    while (url) {
      const response: SoundCloudLikesResponse = await this.request<SoundCloudLikesResponse>(url);

      const tracks: ParsedTrack[] = [];
      for (const item of response.collection) {
        if (!item.track) continue; // Skip deleted/unavailable tracks
        const t = item.track;
        const publisherArtist = t.publisher_metadata?.artist?.trim();
        tracks.push({
          soundcloudId: t.id,
          title: t.title,
          artist: publisherArtist || t.user.username,
          originalArtist: t.user.username,
          label: t.label_name?.trim() || null,
          artworkUrl: t.artwork_url
            ? t.artwork_url.replace('-large', '-t500x500')
            : null,
          soundcloudUrl: t.permalink_url,
          duration: t.duration,
          likedAt: item.created_at || null,
        });
      }

      if (tracks.length > 0) {
        yield tracks;
      }

      url = response.next_href;

      // Brief pause between pages to stay within SoundCloud's rate limits.
      if (url) await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
}
