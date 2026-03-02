import type { FastifyPluginAsync } from 'fastify';
import { TrackStatus } from '@scsd/shared';

const VALID_STATUSES = new Set(Object.values(TrackStatus));

export const tracksRoutes: FastifyPluginAsync = async (app) => {
  // List all tracks
  app.get('/', async (request, reply) => {
    const query = request.query as {
      status?: string;
      sort?: string;
      order?: string;
      page?: string;
      limit?: string;
      search?: string;
    };

    const result = app.trackRepo.listTracks({
      status: query.status,
      sort: query.sort,
      order: query.order,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
    });

    return result;
  });

  // Get single track with results
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    const track = app.trackRepo.getTrack(id);

    if (!track) {
      return reply.code(404).send({ error: 'Track not found' });
    }

    const soulseekResults = app.searchResultRepo.getResults(id);
    return { ...track, soulseekResults };
  });

  // Sync SoundCloud likes
  app.post('/sync', async (request, reply) => {
    if (app.syncAbortController) {
      return reply.code(409).send({ error: 'Sync already in progress' });
    }

    const abortController = new AbortController();
    app.syncAbortController = abortController;

    reply.code(202).send({ message: 'Sync started' });

    // Run in background
    setImmediate(async () => {
      try {
        let newCount = 0;
        let updatedCount = 0;
        let pageNum = 0;

        for await (const batch of app.soundcloud.fetchAllLikes()) {
          // Check if sync was cancelled between pages
          if (abortController.signal.aborted) {
            app.log.info(`Sync cancelled after ${pageNum} pages`);
            break;
          }

          pageNum++;
          const result = app.trackRepo.bulkUpsert(batch);
          newCount += result.newCount;
          updatedCount += result.updatedCount;

          app.log.info(`Sync page ${pageNum}: ${batch.length} tracks (${result.newCount} new, ${result.updatedCount} updated)`);

          // Emit progress per batch so the client can display tracks as they arrive
          app.downloadManager.emit('event', {
            type: 'sync:progress',
            data: {
              tracks: result.upsertedTracks,
              newCount: result.newCount,
              totalSoFar: app.trackRepo.getTotalCount(),
            },
          });
        }

        const totalCount = app.trackRepo.getTotalCount();
        app.log.info(`Sync complete: ${newCount} new, ${updatedCount} updated, ${totalCount} total across ${pageNum} pages`);
        app.downloadManager.emit('event', {
          type: 'sync:complete',
          data: { newCount, totalCount },
        });
      } catch (err) {
        app.log.error(err, 'Failed to sync SoundCloud likes');
      } finally {
        app.syncAbortController = null;
      }
    });
  });

  // Cancel an in-progress sync
  app.post('/sync/cancel', async (request, reply) => {
    if (!app.syncAbortController) {
      return reply.code(404).send({ error: 'No sync in progress' });
    }

    app.syncAbortController.abort();
    return { success: true };
  });

  // Update track status (for manual marking as downloaded/pending/etc.)
  app.patch<{ Params: { id: string } }>('/:id/status', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    const body = request.body as { status: string };

    if (!body.status || !VALID_STATUSES.has(body.status as TrackStatus)) {
      return reply.code(400).send({ error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}` });
    }

    const track = app.trackRepo.getTrack(id);
    if (!track) {
      return reply.code(404).send({ error: 'Track not found' });
    }

    app.trackRepo.updateStatus(id, body.status as TrackStatus);

    // Emit SSE so all connected clients update in real-time
    app.downloadManager.emit('event', {
      type: 'track:status-changed',
      data: { trackId: id, status: body.status },
    });

    return { success: true };
  });

  // Bulk update track statuses — accepts an array of IDs and a single status.
  // better-sqlite3 is synchronous, so looping is effectively atomic within
  // a single request — no concurrent writes can interleave.
  app.patch('/bulk-status', async (request, reply) => {
    const body = request.body as { trackIds: number[]; status: string };

    if (!Array.isArray(body.trackIds) || body.trackIds.length === 0) {
      return reply.code(400).send({ error: 'trackIds array is required' });
    }

    if (!body.status || !VALID_STATUSES.has(body.status as TrackStatus)) {
      return reply.code(400).send({ error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}` });
    }

    for (const id of body.trackIds) {
      app.trackRepo.updateStatus(id, body.status as TrackStatus);
    }

    // Emit SSE for each track so all connected clients update in real-time
    for (const id of body.trackIds) {
      app.downloadManager.emit('event', {
        type: 'track:status-changed',
        data: { trackId: id, status: body.status },
      });
    }

    return { success: true, updatedCount: body.trackIds.length };
  });

  // Delete track
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    const track = app.trackRepo.getTrack(id);

    if (!track) {
      return reply.code(404).send({ error: 'Track not found' });
    }

    app.trackRepo.deleteTrack(id);
    return { success: true };
  });
};
