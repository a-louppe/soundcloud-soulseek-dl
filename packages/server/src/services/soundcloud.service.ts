import type { AppConfig } from '../config.js';

interface SoundCloudTrack {
  id: number;
  title: string;
  user: { username: string };
  artwork_url: string | null;
  permalink_url: string;
  duration: number;
  created_at: string;
}

interface SoundCloudLikesResponse {
  collection: Array<{ track: SoundCloudTrack; created_at: string }>;
  next_href: string | null;
}

export interface ParsedTrack {
  soundcloudId: number;
  title: string;
  artist: string;
  artworkUrl: string | null;
  soundcloudUrl: string;
  duration: number;
  likedAt: string | null;
}

export class SoundCloudService {
  private token: string;
  private userId: string;
  private baseUrl = 'https://api.soundcloud.com';

  constructor(config: AppConfig) {
    this.token = config.soundcloudOauthToken;
    this.userId = config.soundcloudUserId;
  }

  private async request<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      headers: {
        Authorization: `OAuth ${this.token}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`SoundCloud API error: ${res.status} ${res.statusText}`);
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
        tracks.push({
          soundcloudId: t.id,
          title: t.title,
          artist: t.user.username,
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
    }
  }
}
