import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import type { AppConfig } from '../config.js';
import { sanitizeFilename } from '../utils/sanitize-filename.js';

export interface YtdlpProgress {
  percent: number;
  speed: string;
  eta: string;
}

export class YtdlpService {
  private ytdlpPath: string;
  private downloadDir: string;

  constructor(config: AppConfig) {
    this.ytdlpPath = config.ytdlpPath;
    this.downloadDir = config.downloadDir;
  }

  async checkAvailable(): Promise<{ available: boolean; version: string | null }> {
    return new Promise((resolve) => {
      const proc = spawn(this.ytdlpPath, ['--version']);
      let version = '';

      proc.stdout.on('data', (data: Buffer) => {
        version += data.toString().trim();
      });

      proc.on('close', (code) => {
        resolve({
          available: code === 0,
          version: code === 0 ? version : null,
        });
      });

      proc.on('error', () => {
        resolve({ available: false, version: null });
      });
    });
  }

  download(
    url: string,
    artist: string,
    title: string,
  ): { process: ChildProcess; events: EventEmitter; outputPath: string } {
    const filename = sanitizeFilename(artist, title, 'mp3');
    const outputPath = `${this.downloadDir}/${filename}`;

    const events = new EventEmitter();

    const proc = spawn(this.ytdlpPath, [
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--newline',
      '--no-playlist',
      '-o', outputPath,
      url,
    ]);

    proc.stdout.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      const match = line.match(
        /\[download\]\s+([\d.]+)%\s+of\s+~?\s*([\d.]+\w+)\s+at\s+([\d.]+\w+\/s)\s+ETA\s+(\S+)/,
      );
      if (match) {
        events.emit('progress', {
          percent: parseFloat(match[1]),
          speed: match[3],
          eta: match[4],
        });
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      if (line) {
        events.emit('log', line);
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        events.emit('complete', outputPath);
      } else {
        events.emit('error', new Error(`yt-dlp exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      events.emit('error', err);
    });

    return { process: proc, events, outputPath };
  }

  downloadFromSearch(
    artist: string,
    title: string,
  ): ReturnType<typeof this.download> {
    const searchQuery = `ytsearch1:${artist} ${title}`;
    return this.download(searchQuery, artist, title);
  }
}
