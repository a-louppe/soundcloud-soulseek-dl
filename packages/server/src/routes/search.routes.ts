import type { FastifyPluginAsync } from 'fastify';
import { TrackStatus } from '@scsd/shared';

export const searchRoutes: FastifyPluginAsync = async (app) => {
  // Search Soulseek for a specific track
  app.post<{ Params: { trackId: string } }>('/:trackId', async (request, reply) => {
    const trackId = parseInt(request.params.trackId, 10);
    const track = app.trackRepo.getTrack(trackId);

    if (!track) {
      return reply.code(404).send({ error: 'Track not found' });
    }

    // Fire-and-forget, results come via SSE
    app.downloadManager.searchTrackAsync(trackId);
    return reply.code(202).send({ message: 'Search started', trackId });
  });

  // Bulk search
  app.post('/bulk', async (request, reply) => {
    const body = request.body as { trackIds?: number[] } | undefined;

    let tracks;
    if (body?.trackIds && body.trackIds.length > 0) {
      tracks = body.trackIds
        .map((id) => app.trackRepo.getTrack(id))
        .filter(Boolean);
    } else {
      // Search all pending and not_found tracks
      const pending = app.trackRepo.listTracks({
        status: TrackStatus.PENDING,
        limit: 1000,
      });
      const notFound = app.trackRepo.listTracks({
        status: TrackStatus.NOT_FOUND,
        limit: 1000,
      });
      tracks = [...pending.data, ...notFound.data];
    }

    for (const track of tracks) {
      if (track) {
        app.downloadManager.searchTrackAsync(track.id);
      }
    }

    return reply
      .code(202)
      .send({ message: 'Bulk search started', count: tracks.length });
  });

  // Get cached Soulseek results for a track
  app.get<{ Params: { trackId: string } }>('/:trackId/results', async (request, reply) => {
    const trackId = parseInt(request.params.trackId, 10);
    const results = app.searchResultRepo.getResults(trackId);
    return { results };
  });
};
