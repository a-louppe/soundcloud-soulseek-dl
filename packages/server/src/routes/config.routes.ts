import type { FastifyPluginAsync } from 'fastify';

export const configRoutes: FastifyPluginAsync = async (app) => {
  // Health status endpoint
  app.get('/status', async () => {
    const [slskdConnected, soundcloudConnected, ytdlpStatus] = await Promise.all([
      app.slskd.testConnection(),
      app.soundcloud.testConnection(),
      app.ytdlp.checkAvailable(),
    ]);

    const statusCounts = app.trackRepo.getStatusCounts();

    return {
      slskd: {
        connected: slskdConnected,
        url: app.config.slskdUrl,
      },
      soundcloud: {
        connected: soundcloudConnected,
        userId: app.config.soundcloudUserId,
      },
      ytdlp: {
        available: ytdlpStatus.available,
        version: ytdlpStatus.version,
      },
      downloadDir: app.config.downloadDir,
      trackStats: {
        total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        downloaded: statusCounts['downloaded'] || 0,
        pending: statusCounts['pending'] || 0,
        failed: statusCounts['failed'] || 0,
      },
    };
  });
};
