export interface ListTracksParams {
  status?: string;
  sort?: 'title' | 'artist' | 'status' | 'liked_at';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  search?: string;
}

export interface BulkSearchRequest {
  trackIds?: number[];
}

export interface SoulseekDownloadRequest {
  trackId: number;
  resultId: number;
}

export interface YtdlpDownloadRequest {
  trackId: number;
  sourceUrl?: string;
}

export interface BulkUpdateStatusRequest {
  trackIds: number[];
  status: string;
}

export interface UpdateTrackMetadataRequest {
  title?: string;
  artist?: string;
  label?: string | null;
}
