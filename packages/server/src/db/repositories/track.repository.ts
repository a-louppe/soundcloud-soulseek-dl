import type Database from 'better-sqlite3';
import type { Track, TrackStatus } from '@scsd/shared';
import type { PaginatedResponse } from '@scsd/shared';

interface TrackRow {
  id: number;
  soundcloud_id: number;
  title: string;
  artist: string;
  original_artist: string | null;
  label: string | null;
  artwork_url: string | null;
  soundcloud_url: string;
  duration: number;
  status: string;
  error_message: string | null;
  download_path: string | null;
  download_source: string | null;
  liked_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToTrack(row: TrackRow): Track {
  return {
    id: row.id,
    soundcloudId: row.soundcloud_id,
    title: row.title,
    artist: row.artist,
    originalArtist: row.original_artist,
    label: row.label,
    artworkUrl: row.artwork_url,
    soundcloudUrl: row.soundcloud_url,
    duration: row.duration,
    status: row.status as TrackStatus,
    errorMessage: row.error_message,
    downloadPath: row.download_path,
    downloadSource: row.download_source as Track['downloadSource'],
    beatportSearchUrl: `https://www.beatport.com/search?q=${encodeURIComponent(row.artist + ' ' + row.title)}`,
    bandcampSearchUrl: `https://bandcamp.com/search?q=${encodeURIComponent(row.artist + ' ' + row.title)}`,
    likedAt: row.liked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TrackRepository {
  private stmts: {
    getById: Database.Statement;
    getBySoundcloudId: Database.Statement;
    updateStatus: Database.Statement;
    updateDownload: Database.Statement;
    deleteById: Database.Statement;
    countByStatus: Database.Statement;
    countAll: Database.Statement;
  };

  constructor(private db: Database.Database) {
    this.stmts = {
      getById: db.prepare('SELECT * FROM tracks WHERE id = ?'),
      getBySoundcloudId: db.prepare('SELECT * FROM tracks WHERE soundcloud_id = ?'),
      updateStatus: db.prepare(
        "UPDATE tracks SET status = ?, error_message = ?, updated_at = datetime('now') WHERE id = ?",
      ),
      updateDownload: db.prepare(
        "UPDATE tracks SET status = 'downloaded', download_path = ?, download_source = ?, updated_at = datetime('now') WHERE id = ?",
      ),
      deleteById: db.prepare('DELETE FROM tracks WHERE id = ?'),
      countByStatus: db.prepare('SELECT status, COUNT(*) as count FROM tracks GROUP BY status'),
      countAll: db.prepare('SELECT COUNT(*) as count FROM tracks'),
    };
  }

  getTrack(id: number): Track | null {
    const row = this.stmts.getById.get(id) as TrackRow | undefined;
    return row ? rowToTrack(row) : null;
  }

  getTrackBySoundcloudId(soundcloudId: number): Track | null {
    const row = this.stmts.getBySoundcloudId.get(soundcloudId) as TrackRow | undefined;
    return row ? rowToTrack(row) : null;
  }

  listTracks(filters: {
    status?: string;
    sort?: string;
    order?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): PaginatedResponse<Track> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (filters.status) {
      whereClause += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.search) {
      whereClause += ' AND (title LIKE ? OR artist LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    const allowedSorts: Record<string, string> = {
      title: 'title',
      artist: 'artist',
      status: 'status',
      liked_at: 'liked_at',
      created_at: 'created_at',
    };
    const sortCol = allowedSorts[filters.sort || 'created_at'] || 'created_at';
    const order = filters.order === 'asc' ? 'ASC' : 'DESC';

    const countRow = this.db
      .prepare(`SELECT COUNT(*) as count FROM tracks ${whereClause}`)
      .get(...params) as { count: number };

    const rows = this.db
      .prepare(
        `SELECT * FROM tracks ${whereClause} ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as TrackRow[];

    return {
      data: rows.map(rowToTrack),
      total: countRow.count,
      page,
      limit,
    };
  }

  updateStatus(id: number, status: TrackStatus, errorMessage?: string): void {
    this.stmts.updateStatus.run(status, errorMessage || null, id);
  }

  updateDownloadPath(id: number, path: string, source: 'soulseek' | 'ytdlp'): void {
    this.stmts.updateDownload.run(path, source, id);
  }

  deleteTrack(id: number): void {
    this.stmts.deleteById.run(id);
  }

  bulkUpsert(
    tracks: Array<{
      soundcloudId: number;
      title: string;
      artist: string;
      originalArtist: string;
      label: string | null;
      artworkUrl: string | null;
      soundcloudUrl: string;
      duration: number;
      likedAt: string | null;
    }>,
  ): { newCount: number; updatedCount: number; upsertedTracks: Track[] } {
    let newCount = 0;
    let updatedCount = 0;
    const upsertedTracks: Track[] = [];

    const insert = this.db.prepare(`
      INSERT INTO tracks (soundcloud_id, title, artist, original_artist, label, artwork_url, soundcloud_url, duration, liked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(soundcloud_id) DO UPDATE SET
        title = excluded.title,
        artist = excluded.artist,
        original_artist = excluded.original_artist,
        label = excluded.label,
        artwork_url = excluded.artwork_url,
        duration = excluded.duration,
        liked_at = excluded.liked_at,
        updated_at = datetime('now')
    `);

    const upsertAll = this.db.transaction(
      (
        items: typeof tracks,
      ) => {
        for (const t of items) {
          const existing = this.stmts.getBySoundcloudId.get(t.soundcloudId) as
            | TrackRow
            | undefined;
          insert.run(
            t.soundcloudId,
            t.title,
            t.artist,
            t.originalArtist,
            t.label,
            t.artworkUrl,
            t.soundcloudUrl,
            t.duration,
            t.likedAt,
          );
          if (existing) {
            updatedCount++;
          } else {
            newCount++;
          }
          // Re-fetch to get the full row with DB-assigned ID and timestamps
          const row = this.stmts.getBySoundcloudId.get(t.soundcloudId) as TrackRow;
          upsertedTracks.push(rowToTrack(row));
        }
      },
    );

    upsertAll(tracks);
    return { newCount, updatedCount, upsertedTracks };
  }

  getStatusCounts(): Record<string, number> {
    const rows = this.stmts.countByStatus.all() as Array<{
      status: string;
      count: number;
    }>;
    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.status] = row.count;
    }
    return counts;
  }

  getTotalCount(): number {
    const row = this.stmts.countAll.get() as { count: number };
    return row.count;
  }
}
