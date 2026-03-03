import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { resolve, join } from 'path';
import { existsSync } from 'fs';
import type { AppConfig } from './config.js';
import { initDatabase } from './db/database.js';
import { TrackRepository } from './db/repositories/track.repository.js';
import { SearchResultRepository } from './db/repositories/search-result.repository.js';
import { DownloadRepository } from './db/repositories/download.repository.js';
import { SoundCloudService } from './services/soundcloud.service.js';
import { SlskdService } from './services/slskd.service.js';
import { YtdlpService } from './services/ytdlp.service.js';
import { DownloadManager } from './services/download-manager.service.js';
import { tracksRoutes } from './routes/tracks.routes.js';
import { searchRoutes } from './routes/search.routes.js';
import { downloadsRoutes } from './routes/downloads.routes.js';
import { eventsRoutes } from './routes/events.routes.js';
import { configRoutes } from './routes/config.routes.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    trackRepo: TrackRepository;
    searchResultRepo: SearchResultRepository;
    downloadRepo: DownloadRepository;
    soundcloud: SoundCloudService;
    slskd: SlskdService;
    ytdlp: YtdlpService;
    downloadManager: DownloadManager;
    syncAbortController: AbortController | null;
  }
}

export async function buildApp(config: AppConfig) {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  // Decorate with config
  app.decorate('config', config);

  // Initialize database
  const db = initDatabase(config.databasePath);
  const trackRepo = new TrackRepository(db);
  const searchResultRepo = new SearchResultRepository(db);
  const downloadRepo = new DownloadRepository(db);
  app.decorate('trackRepo', trackRepo);
  app.decorate('searchResultRepo', searchResultRepo);
  app.decorate('downloadRepo', downloadRepo);

  // Initialize services
  const soundcloud = new SoundCloudService(config);
  const slskd = new SlskdService(config);
  const ytdlp = new YtdlpService(config);
  app.decorate('soundcloud', soundcloud);
  app.decorate('slskd', slskd);
  app.decorate('ytdlp', ytdlp);
  app.decorate(
    'downloadManager',
    new DownloadManager(slskd, ytdlp, trackRepo, searchResultRepo, downloadRepo, config),
  );

  app.decorate('syncAbortController', null);

  // Register routes
  await app.register(tracksRoutes, { prefix: '/api/tracks' });
  await app.register(searchRoutes, { prefix: '/api/search' });
  await app.register(downloadsRoutes, { prefix: '/api/downloads' });
  await app.register(eventsRoutes, { prefix: '/api/events' });
  await app.register(configRoutes, { prefix: '/api/config' });

  // Serve Angular build in production
  const clientDistPath = resolve(
    import.meta.dirname,
    '../../client/dist/client/browser',
  );
  if (existsSync(clientDistPath)) {
    await app.register(fastifyStatic, {
      root: clientDistPath,
      prefix: '/',
      wildcard: false,
    });

    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api')) {
        return reply.code(404).send({ error: 'Not Found' });
      }
      return reply.sendFile('index.html');
    });
  }

  // Graceful shutdown
  app.addHook('onClose', () => {
    app.syncAbortController?.abort();
    app.downloadManager.shutdown();
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
  });

  return app;
}
