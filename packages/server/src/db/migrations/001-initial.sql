CREATE TABLE IF NOT EXISTS tracks (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  soundcloud_id     INTEGER UNIQUE NOT NULL,
  title             TEXT NOT NULL,
  artist            TEXT NOT NULL,
  artwork_url       TEXT,
  soundcloud_url    TEXT NOT NULL,
  duration          INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','searching','found_on_soulseek',
                                     'not_found','downloading','downloaded','failed')),
  error_message     TEXT,
  download_path     TEXT,
  download_source   TEXT CHECK(download_source IN ('soulseek','ytdlp')),
  liked_at          TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tracks_status ON tracks(status);
CREATE INDEX IF NOT EXISTS idx_tracks_soundcloud_id ON tracks(soundcloud_id);

CREATE TABLE IF NOT EXISTS soulseek_results (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id          INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  slskd_search_id   TEXT,
  username          TEXT NOT NULL,
  filename          TEXT NOT NULL,
  size              INTEGER NOT NULL,
  bit_rate          INTEGER,
  sample_rate       INTEGER,
  bit_depth         INTEGER,
  is_variable_bit_rate INTEGER DEFAULT 0,
  file_extension    TEXT,
  queue_length      INTEGER,
  free_upload_slots INTEGER DEFAULT 0,
  upload_speed      INTEGER,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_soulseek_results_track_id ON soulseek_results(track_id);

CREATE TABLE IF NOT EXISTS active_downloads (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id          INTEGER NOT NULL REFERENCES tracks(id),
  source            TEXT NOT NULL CHECK(source IN ('soulseek','ytdlp')),
  slskd_username    TEXT,
  slskd_filename    TEXT,
  bytes_transferred INTEGER DEFAULT 0,
  total_bytes       INTEGER DEFAULT 0,
  state             TEXT NOT NULL DEFAULT 'queued'
                    CHECK(state IN ('queued','downloading','complete','failed','cancelled')),
  started_at        TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_active_downloads_track_id ON active_downloads(track_id);
CREATE INDEX IF NOT EXISTS idx_active_downloads_state ON active_downloads(state);
