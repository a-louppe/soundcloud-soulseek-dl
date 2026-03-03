import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export function initDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);

  // Enable WAL mode for better concurrent read/write performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run migrations
  runMigrations(db);

  return db;
}

function runMigrations(db: Database.Database) {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const migrationDir = resolve(import.meta.dirname, 'migrations');
  const migrations = [
    { name: '001-initial', file: '001-initial.sql' },
    { name: '002-add-label-and-original-artist', file: '002-add-label-and-original-artist.sql' },
    { name: '003-add-slskd-search-id', file: '003-add-slskd-search-id.sql' },
  ];

  const applied = new Set(
    db
      .prepare('SELECT name FROM _migrations')
      .all()
      .map((row: any) => row.name),
  );

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;

    const sql = readFileSync(resolve(migrationDir, migration.file), 'utf-8');
    db.exec(sql);
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name);
    console.log(`Applied migration: ${migration.name}`);
  }
}
