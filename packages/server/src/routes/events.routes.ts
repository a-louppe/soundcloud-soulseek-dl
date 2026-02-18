import type { FastifyPluginAsync } from 'fastify';

export const eventsRoutes: FastifyPluginAsync = async (app) => {
  // SSE endpoint for real-time updates
  app.get('/stream', async (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    let eventId = 0;

    const sendEvent = (type: string, data: unknown) => {
      eventId++;
      reply.raw.write(`id: ${eventId}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Subscribe to download manager events
    const handler = (event: { type: string; data: unknown }) => {
      sendEvent(event.type, event.data);
    };
    app.downloadManager.on('event', handler);

    // Send heartbeat every 30s to keep connection alive
    const heartbeat = setInterval(() => {
      reply.raw.write(`: heartbeat\n\n`);
    }, 30000);

    // Send initial connected event
    sendEvent('connected', { timestamp: new Date().toISOString() });

    // Cleanup on disconnect
    request.raw.on('close', () => {
      clearInterval(heartbeat);
      app.downloadManager.off('event', handler);
    });

    // Don't end the response — SSE stays open
    await new Promise(() => {});
  });
};
