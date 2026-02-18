import type { AppConfig } from '../config.js';

interface SlskdSearchRequest {
  searchText: string;
  searchTimeout?: number;
  filterResponses?: boolean;
  minimumResponseFileCount?: number;
}

interface SlskdFile {
  filename: string;
  size: number;
  bitRate?: number;
  sampleRate?: number;
  bitDepth?: number;
  isVariableBitRate?: boolean;
  length?: number;
}

interface SlskdSearchResponse {
  username: string;
  files: SlskdFile[];
  freeUploadSlots: number;
  uploadSpeed: number;
  queueLength: number;
}

interface SlskdSearch {
  id: string;
  searchText: string;
  state: string;
  responseCount: number;
  fileCount: number;
  responses?: SlskdSearchResponse[];
}

interface SlskdTransfer {
  id: string;
  username: string;
  filename: string;
  state: string;
  bytesTransferred: number;
  size: number;
  percentComplete: number;
  averageSpeed: number;
}

export interface SlskdParsedResult {
  username: string;
  filename: string;
  size: number;
  bitRate: number | null;
  sampleRate: number | null;
  bitDepth: number | null;
  isVariableBitRate: boolean;
  fileExtension: string | null;
  queueLength: number | null;
  freeUploadSlots: boolean;
  uploadSpeed: number | null;
}

const AUDIO_EXTENSIONS = new Set(['mp3', 'flac', 'wav', 'aac', 'ogg', 'opus', 'wma', 'm4a', 'aiff']);

export class SlskdService {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: AppConfig) {
    this.baseUrl = config.slskdUrl.replace(/\/$/, '');
    this.apiKey = config.slskdApiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api/v0${path}`, {
      method,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`slskd API error: ${res.status} ${text}`);
    }

    const contentType = res.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return res.json() as Promise<T>;
    }
    return undefined as T;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request('GET', '/application');
      return true;
    } catch {
      return false;
    }
  }

  async search(query: string): Promise<string> {
    const body: SlskdSearchRequest = {
      searchText: query,
      searchTimeout: 15000,
      filterResponses: true,
      minimumResponseFileCount: 1,
    };

    const result = await this.request<SlskdSearch>('POST', '/searches', body);
    return result.id;
  }

  async isSearchComplete(searchId: string): Promise<boolean> {
    const result = await this.request<SlskdSearch>(
      'GET',
      `/searches/${searchId}`,
    );
    return (
      result.state === 'Completed' ||
      result.state === 'Errored' ||
      result.state === 'TimedOut'
    );
  }

  async getSearchResults(searchId: string): Promise<SlskdParsedResult[]> {
    const result = await this.request<SlskdSearch>(
      'GET',
      `/searches/${searchId}?includeResponses=true`,
    );

    const results: SlskdParsedResult[] = [];

    for (const response of result.responses || []) {
      for (const file of response.files) {
        const ext = file.filename.split('.').pop()?.toLowerCase() || '';
        if (!AUDIO_EXTENSIONS.has(ext)) continue;

        results.push({
          username: response.username,
          filename: file.filename,
          size: file.size,
          bitRate: file.bitRate ?? null,
          sampleRate: file.sampleRate ?? null,
          bitDepth: file.bitDepth ?? null,
          isVariableBitRate: file.isVariableBitRate ?? false,
          fileExtension: ext,
          queueLength: response.queueLength ?? null,
          freeUploadSlots: (response.freeUploadSlots ?? 0) > 0,
          uploadSpeed: response.uploadSpeed ?? null,
        });
      }
    }

    // Sort by quality: FLAC first, then by bitrate descending
    results.sort((a, b) => {
      const aFlac = a.fileExtension === 'flac' ? 1 : 0;
      const bFlac = b.fileExtension === 'flac' ? 1 : 0;
      if (aFlac !== bFlac) return bFlac - aFlac;
      return (b.bitRate ?? 0) - (a.bitRate ?? 0);
    });

    return results;
  }

  async deleteSearch(searchId: string): Promise<void> {
    await this.request('DELETE', `/searches/${searchId}`);
  }

  async enqueueDownload(username: string, filename: string, size: number): Promise<void> {
    await this.request('POST', `/transfers/downloads/${encodeURIComponent(username)}`, {
      filename,
      size,
    });
  }

  async getDownloadStatus(username: string, filename: string): Promise<SlskdTransfer | null> {
    const transfers = await this.request<SlskdTransfer[]>(
      'GET',
      `/transfers/downloads/${encodeURIComponent(username)}`,
    );

    return transfers.find((t) => t.filename === filename) ?? null;
  }

  async cancelDownload(username: string, id: string): Promise<void> {
    await this.request(
      'DELETE',
      `/transfers/downloads/${encodeURIComponent(username)}/${id}`,
    );
  }
}
