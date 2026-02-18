import type { FastifyPluginAsync } from 'fastify';

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
    reply.code(202).send({ message: 'Sync started' });

    // Run in background
    setImmediate(async () => {
      try {
        let newCount = 0;
        let updatedCount = 0;

        for await (const batch of app.soundcloud.fetchAllLikes()) {
          const result = app.trackRepo.bulkUpsert(batch);
          newCount += result.newCount;
          updatedCount += result.updatedCount;
        }

        const totalCount = app.trackRepo.getTotalCount();
        app.downloadManager.emit('event', {
          type: 'sync:complete',
          data: { newCount, totalCount },
        });
      } catch (err) {
        app.log.error(err, 'Failed to sync SoundCloud likes');
      }
    });
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
