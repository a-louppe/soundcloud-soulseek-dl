import type Database from 'better-sqlite3';
import type { ActiveDownload } from '@scsd/shared';

interface DownloadRow {
  id: number;
  track_id: number;
  source: string;
  slskd_username: string | null;
  slskd_filename: string | null;
  bytes_transferred: number;
  total_bytes: number;
  state: string;
  started_at: string;
  completed_at: string | null;
}

function rowToDownload(row: DownloadRow): ActiveDownload {
  return {
    id: row.id,
    trackId: row.track_id,
    source: row.source as ActiveDownload['source'],
    bytesTransferred: row.bytes_transferred,
    totalBytes: row.total_bytes,
    state: row.state as ActiveDownload['state'],
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

export class DownloadRepository {
  constructor(private db: Database.Database) {}

  createDownload(
    trackId: number,
    source: 'soulseek' | 'ytdlp',
    details?: { username?: string; filename?: string },
  ): ActiveDownload {
    const result = this.db
      .prepare(
        `INSERT INTO active_downloads (track_id, source, slskd_username, slskd_filename)
         VALUES (?, ?, ?, ?)`,
      )
      .run(trackId, source, details?.username || null, details?.filename || null);

    return this.getDownload(Number(result.lastInsertRowid))!;
  }

  getDownload(id: number): ActiveDownload | null {
    const row = this.db
      .prepare('SELECT * FROM active_downloads WHERE id = ?')
      .get(id) as DownloadRow | undefined;
    return row ? rowToDownload(row) : null;
  }

  getDownloadByTrackId(trackId: number): ActiveDownload | null {
    const row = this.db
      .prepare(
        "SELECT * FROM active_downloads WHERE track_id = ? AND state IN ('queued','downloading') ORDER BY id DESC LIMIT 1",
      )
      .get(trackId) as DownloadRow | undefined;
    return row ? rowToDownload(row) : null;
  }

  updateProgress(id: number, bytesTransferred: number, totalBytes: number): void {
    this.db
      .prepare(
        "UPDATE active_downloads SET bytes_transferred = ?, total_bytes = ?, state = 'downloading' WHERE id = ?",
      )
      .run(bytesTransferred, totalBytes, id);
  }

  updateState(id: number, state: ActiveDownload['state']): void {
    const completedAt = state === 'complete' || state === 'failed' || state === 'cancelled'
      ? new Date().toISOString()
      : null;
    this.db
      .prepare('UPDATE active_downloads SET state = ?, completed_at = ? WHERE id = ?')
      .run(state, completedAt, id);
  }

  getActiveDownloads(): ActiveDownload[] {
    const rows = this.db
      .prepare("SELECT * FROM active_downloads WHERE state IN ('queued','downloading') ORDER BY started_at DESC")
      .all() as DownloadRow[];
    return rows.map(rowToDownload);
  }
}
