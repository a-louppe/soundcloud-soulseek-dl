import type Database from 'better-sqlite3';
import type { SoulseekSearchResult } from '@scsd/shared';

interface ResultRow {
  id: number;
  track_id: number;
  slskd_search_id: string | null;
  username: string;
  filename: string;
  size: number;
  bit_rate: number | null;
  sample_rate: number | null;
  bit_depth: number | null;
  is_variable_bit_rate: number;
  file_extension: string | null;
  queue_length: number | null;
  free_upload_slots: number;
  upload_speed: number | null;
}

function rowToResult(row: ResultRow): SoulseekSearchResult {
  return {
    id: row.id,
    trackId: row.track_id,
    username: row.username,
    filename: row.filename,
    size: row.size,
    bitRate: row.bit_rate,
    sampleRate: row.sample_rate,
    bitDepth: row.bit_depth,
    isVariableBitRate: row.is_variable_bit_rate === 1,
    fileExtension: row.file_extension,
    queueLength: row.queue_length,
    freeUploadSlots: row.free_upload_slots === 1,
    uploadSpeed: row.upload_speed,
  };
}

export class SearchResultRepository {
  constructor(private db: Database.Database) {}

  saveResults(
    trackId: number,
    searchId: string,
    results: Array<{
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
    }>,
  ): void {
    const deleteOld = this.db.prepare('DELETE FROM soulseek_results WHERE track_id = ?');
    const insert = this.db.prepare(`
      INSERT INTO soulseek_results
        (track_id, slskd_search_id, username, filename, size, bit_rate, sample_rate,
         bit_depth, is_variable_bit_rate, file_extension, queue_length, free_upload_slots, upload_speed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const saveAll = this.db.transaction(() => {
      deleteOld.run(trackId);
      for (const r of results) {
        insert.run(
          trackId,
          searchId,
          r.username,
          r.filename,
          r.size,
          r.bitRate,
          r.sampleRate,
          r.bitDepth,
          r.isVariableBitRate ? 1 : 0,
          r.fileExtension,
          r.queueLength,
          r.freeUploadSlots ? 1 : 0,
          r.uploadSpeed,
        );
      }
    });

    saveAll();
  }

  getResults(trackId: number): SoulseekSearchResult[] {
    const rows = this.db
      .prepare('SELECT * FROM soulseek_results WHERE track_id = ? ORDER BY bit_rate DESC NULLS LAST, size DESC')
      .all(trackId) as ResultRow[];
    return rows.map(rowToResult);
  }

  getResult(resultId: number): SoulseekSearchResult | null {
    const row = this.db
      .prepare('SELECT * FROM soulseek_results WHERE id = ?')
      .get(resultId) as ResultRow | undefined;
    return row ? rowToResult(row) : null;
  }
}
