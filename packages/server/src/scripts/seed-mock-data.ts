/**
 * Seed script to populate the database with mock track data for testing.
 *
 * This bypasses SoundCloud API entirely, inserting fictional tracks directly
 * into SQLite. Useful for testing the UI without real credentials.
 *
 * Run: npx tsx packages/server/src/scripts/seed-mock-data.ts
 */

import Database from 'better-sqlite3';
import { resolve } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { TrackStatus } from '@scsd/shared';

// Mock track data representing various electronic music
const mockTracks = [
  {
    soundcloudId: 1001,
    title: 'Midnight Drive',
    artist: 'Neon Horizon',
    artworkUrl: 'https://i1.sndcdn.com/artworks-000000000001-abcdef-large.jpg',
    soundcloudUrl: 'https://soundcloud.com/neon-horizon/midnight-drive',
    duration: 385000,
    status: TrackStatus.PENDING,
  },
  {
    soundcloudId: 1002,
    title: 'Deep Space Echo (Original Mix)',
    artist: 'Cosmic Drift',
    artworkUrl: 'https://i1.sndcdn.com/artworks-000000000002-abcdef-large.jpg',
    soundcloudUrl: 'https://soundcloud.com/cosmic-drift/deep-space-echo',
    duration: 421000,
    status: TrackStatus.PENDING,
  },
  {
    soundcloudId: 1003,
    title: 'Techno Dreams',
    artist: 'Berlin Underground',
    artworkUrl: 'https://i1.sndcdn.com/artworks-000000000003-abcdef-large.jpg',
    soundcloudUrl: 'https://soundcloud.com/berlin-underground/techno-dreams',
    duration: 512000,
    status: TrackStatus.FOUND_ON_SOULSEEK,
  },
  {
    soundcloudId: 1004,
    title: 'Summer Breeze feat. Luna',
    artist: 'Tropical House Collective',
    artworkUrl: 'https://i1.sndcdn.com/artworks-000000000004-abcdef-large.jpg',
    soundcloudUrl: 'https://soundcloud.com/tropical-house/summer-breeze',
    duration: 298000,
    status: TrackStatus.SEARCHING,
  },
  {
    soundcloudId: 1005,
    title: 'Lost in Translation [Free Download]',
    artist: 'Ambient Waves',
    artworkUrl: 'https://i1.sndcdn.com/artworks-000000000005-abcdef-large.jpg',
    soundcloudUrl: 'https://soundcloud.com/ambient-waves/lost-in-translation',
    duration: 645000,
    status: TrackStatus.NOT_FOUND,
  },
  {
    soundcloudId: 1006,
    title: 'Bass Drop',
    artist: 'Heavy Frequency',
    artworkUrl: 'https://i1.sndcdn.com/artworks-000000000006-abcdef-large.jpg',
    soundcloudUrl: 'https://soundcloud.com/heavy-frequency/bass-drop',
    duration: 267000,
    status: TrackStatus.DOWNLOADING,
  },
  {
    soundcloudId: 1007,
    title: 'Afterhours',
    artist: 'Club Culture',
    artworkUrl: 'https://i1.sndcdn.com/artworks-000000000007-abcdef-large.jpg',
    soundcloudUrl: 'https://soundcloud.com/club-culture/afterhours',
    duration: 478000,
    status: TrackStatus.DOWNLOADED,
    downloadPath: '/downloads/Club Culture - Afterhours.mp3',
    downloadSource: 'soulseek',
  },
  {
    soundcloudId: 1008,
    title: 'Error 404',
    artist: 'Glitch Mob',
    artworkUrl: 'https://i1.sndcdn.com/artworks-000000000008-abcdef-large.jpg',
    soundcloudUrl: 'https://soundcloud.com/glitch-mob/error-404',
    duration: 356000,
    status: TrackStatus.FAILED,
    errorMessage: 'Connection timed out after 30s',
  },
  {
    soundcloudId: 1009,
    title: 'Sunrise',
    artist: 'Morning Glory',
    artworkUrl: null,
    soundcloudUrl: 'https://soundcloud.com/morning-glory/sunrise',
    duration: 234000,
    status: TrackStatus.PENDING,
  },
  {
    soundcloudId: 1010,
    title: 'Dark Matter',
    artist: 'Void',
    artworkUrl: 'https://i1.sndcdn.com/artworks-000000000010-abcdef-large.jpg',
    soundcloudUrl: 'https://soundcloud.com/void/dark-matter',
    duration: 589000,
    status: TrackStatus.FOUND_ON_SOULSEEK,
  },
  {
    soundcloudId: 1011,
    title: 'Rhythm of the Night',
    artist: 'Dance Floor Kings',
    artworkUrl: 'https://i1.sndcdn.com/artworks-000000000011-abcdef-large.jpg',
    soundcloudUrl: 'https://soundcloud.com/dance-floor-kings/rhythm-of-the-night',
    duration: 312000,
    status: TrackStatus.DOWNLOADED,
    downloadPath: '/downloads/Dance Floor Kings - Rhythm of the Night.flac',
    downloadSource: 'ytdlp',
  },
  {
    soundcloudId: 1012,
    title: 'Crystal Clear',
    artist: 'Pure Sound',
    artworkUrl: 'https://i1.sndcdn.com/artworks-000000000012-abcdef-large.jpg',
    soundcloudUrl: 'https://soundcloud.com/pure-sound/crystal-clear',
    duration: 445000,
    status: TrackStatus.PENDING,
  },
];

// Mock Soulseek search results for tracks with FOUND_ON_SOULSEEK status
const mockSoulseekResults = [
  // Results for track 1003 (Techno Dreams)
  {
    trackId: 3, // Will be set after insert
    username: 'techno_master_2000',
    filename: 'Berlin Underground - Techno Dreams (320kbps).mp3',
    size: 12582912,
    bitRate: 320,
    sampleRate: 44100,
    bitDepth: 16,
    isVariableBitRate: false,
    fileExtension: 'mp3',
    queueLength: 2,
    freeUploadSlots: true,
    uploadSpeed: 524288,
  },
  {
    trackId: 3,
    username: 'vinyl_collector',
    filename: 'Berlin Underground - Techno Dreams.flac',
    size: 45678901,
    bitRate: null,
    sampleRate: 96000,
    bitDepth: 24,
    isVariableBitRate: false,
    fileExtension: 'flac',
    queueLength: 0,
    freeUploadSlots: true,
    uploadSpeed: 1048576,
  },
  {
    trackId: 3,
    username: 'low_quality_rips',
    filename: 'techno_dreams_128.mp3',
    size: 5012345,
    bitRate: 128,
    sampleRate: 44100,
    bitDepth: 16,
    isVariableBitRate: false,
    fileExtension: 'mp3',
    queueLength: 15,
    freeUploadSlots: false,
    uploadSpeed: 65536,
  },
  // Results for track 1010 (Dark Matter)
  {
    trackId: 10,
    username: 'deep_house_lover',
    filename: 'Void - Dark Matter (2024 Remaster).flac',
    size: 67890123,
    bitRate: null,
    sampleRate: 48000,
    bitDepth: 24,
    isVariableBitRate: false,
    fileExtension: 'flac',
    queueLength: 1,
    freeUploadSlots: true,
    uploadSpeed: 786432,
  },
  {
    trackId: 10,
    username: 'mp3_archive',
    filename: 'Void_-_Dark_Matter.mp3',
    size: 14567890,
    bitRate: 320,
    sampleRate: 44100,
    bitDepth: 16,
    isVariableBitRate: false,
    fileExtension: 'mp3',
    queueLength: 5,
    freeUploadSlots: true,
    uploadSpeed: 262144,
  },
];

async function main() {
  const dbPath = resolve(import.meta.dirname, '../../../../data/tracks.db');
  const dbDir = resolve(import.meta.dirname, '../../../../data');

  // Ensure data directory exists
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
    console.log('Created data directory:', dbDir);
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      soundcloud_id INTEGER UNIQUE NOT NULL,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      artwork_url TEXT,
      soundcloud_url TEXT NOT NULL,
      duration INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      download_path TEXT,
      download_source TEXT,
      liked_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS soulseek_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      filename TEXT NOT NULL,
      size INTEGER NOT NULL,
      bit_rate INTEGER,
      sample_rate INTEGER,
      bit_depth INTEGER,
      is_variable_bit_rate INTEGER DEFAULT 0,
      file_extension TEXT,
      queue_length INTEGER,
      free_upload_slots INTEGER,
      upload_speed INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS active_downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id INTEGER NOT NULL,
      source TEXT NOT NULL,
      slskd_username TEXT,
      slskd_filename TEXT,
      bytes_transferred INTEGER DEFAULT 0,
      total_bytes INTEGER DEFAULT 0,
      state TEXT NOT NULL DEFAULT 'queued',
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_status ON tracks(status);
    CREATE INDEX IF NOT EXISTS idx_tracks_soundcloud_id ON tracks(soundcloud_id);
    CREATE INDEX IF NOT EXISTS idx_soulseek_results_track_id ON soulseek_results(track_id);
  `);

  console.log('Database schema ready');

  // Clear existing data for clean seed
  db.exec('DELETE FROM soulseek_results');
  db.exec('DELETE FROM active_downloads');
  db.exec('DELETE FROM tracks');
  console.log('Cleared existing data');

  // Insert mock tracks
  const insertTrack = db.prepare(`
    INSERT INTO tracks (soundcloud_id, title, artist, artwork_url, soundcloud_url, duration, status, error_message, download_path, download_source, liked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' days'))
  `);

  const trackIdMap = new Map<number, number>();

  db.transaction(() => {
    mockTracks.forEach((track, index) => {
      const result = insertTrack.run(
        track.soundcloudId,
        track.title,
        track.artist,
        track.artworkUrl,
        track.soundcloudUrl,
        track.duration,
        track.status,
        (track as any).errorMessage || null,
        (track as any).downloadPath || null,
        (track as any).downloadSource || null,
        index // days ago for liked_at
      );
      trackIdMap.set(track.soundcloudId, Number(result.lastInsertRowid));
    });
  })();

  console.log(`Inserted ${mockTracks.length} mock tracks`);

  // Insert mock Soulseek results
  const insertResult = db.prepare(`
    INSERT INTO soulseek_results (track_id, username, filename, size, bit_rate, sample_rate, bit_depth, is_variable_bit_rate, file_extension, queue_length, free_upload_slots, upload_speed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Map soundcloud IDs to actual DB IDs for results
  const trackIdFor1003 = trackIdMap.get(1003)!;
  const trackIdFor1010 = trackIdMap.get(1010)!;

  db.transaction(() => {
    mockSoulseekResults.forEach((result) => {
      const actualTrackId = result.trackId === 3 ? trackIdFor1003 : trackIdFor1010;
      insertResult.run(
        actualTrackId,
        result.username,
        result.filename,
        result.size,
        result.bitRate,
        result.sampleRate,
        result.bitDepth,
        result.isVariableBitRate ? 1 : 0,
        result.fileExtension,
        result.queueLength,
        result.freeUploadSlots ? 1 : 0,
        result.uploadSpeed
      );
    });
  })();

  console.log(`Inserted ${mockSoulseekResults.length} mock Soulseek results`);

  // Insert an active download for the DOWNLOADING track
  const downloadingTrackId = trackIdMap.get(1006)!;
  db.prepare(`
    INSERT INTO active_downloads (track_id, source, slskd_username, slskd_filename, bytes_transferred, total_bytes, state)
    VALUES (?, 'soulseek', 'bass_head_99', 'Heavy Frequency - Bass Drop.mp3', 5242880, 10485760, 'downloading')
  `).run(downloadingTrackId);

  console.log('Inserted 1 active download');

  db.close();
  console.log('\nMock data seeded successfully!');
  console.log('Run `npm run dev` to start the server and client');
}

main().catch(console.error);
