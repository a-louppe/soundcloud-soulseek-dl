import type { FastifyPluginAsync } from 'fastify';

export const downloadsRoutes: FastifyPluginAsync = async (app) => {
  // Download via Soulseek
  app.post('/soulseek', async (request, reply) => {
    const body = request.body as { trackId: number; resultId: number };

    if (!body.trackId || !body.resultId) {
      return reply.code(400).send({ error: 'trackId and resultId are required' });
    }

    const track = app.trackRepo.getTrack(body.trackId);
    if (!track) {
      return reply.code(404).send({ error: 'Track not found' });
    }

    const result = app.searchResultRepo.getResult(body.resultId);
    if (!result) {
      return reply.code(404).send({ error: 'Search result not found' });
    }

    app.downloadManager.downloadFromSoulseek(body.trackId, body.resultId);
    return reply.code(202).send({ message: 'Download started', trackId: body.trackId });
  });

  // Download via yt-dlp
  app.post('/ytdlp', async (request, reply) => {
    const body = request.body as { trackId: number; sourceUrl?: string };

    if (!body.trackId) {
      return reply.code(400).send({ error: 'trackId is required' });
    }

    const track = app.trackRepo.getTrack(body.trackId);
    if (!track) {
      return reply.code(404).send({ error: 'Track not found' });
    }

    app.downloadManager.downloadWithYtdlp(body.trackId, body.sourceUrl);
    return reply.code(202).send({ message: 'Download started', trackId: body.trackId });
  });

  // List active downloads
  app.get('/active', async () => {
    const downloads = app.downloadRepo.getActiveDownloads();
    return { downloads };
  });

  // Cancel download
  app.post<{ Params: { id: string } }>('/:id/cancel', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    const download = app.downloadRepo.getDownload(id);

    if (!download) {
      return reply.code(404).send({ error: 'Download not found' });
    }

    app.downloadRepo.updateState(id, 'cancelled');
    return { success: true };
  });

  // Retry download
  app.post<{ Params: { id: string } }>('/:id/retry', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    const download = app.downloadRepo.getDownload(id);

    if (!download) {
      return reply.code(404).send({ error: 'Download not found' });
    }

    if (download.source === 'soulseek') {
      // Re-search and let user pick again
      app.downloadManager.searchTrackAsync(download.trackId);
    } else {
      app.downloadManager.downloadWithYtdlp(download.trackId);
    }

    return reply.code(202).send({ message: 'Retry started' });
  });
};
