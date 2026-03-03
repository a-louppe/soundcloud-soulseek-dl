import type { FastifyPluginAsync } from 'fastify';

export const eventsRoutes: FastifyPluginAsync = async (app) => {
  // SSE endpoint for real-time updates
  app.get('/stream', async (request, reply) => {
    // hijack() tells Fastify we're taking over the response — without this,
    // Fastify may buffer or interfere with the raw SSE stream.
    reply.hijack();

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    let eventId = 0;

    const sendEvent = (type: string, data: unknown) => {
      eventId++;
      reply.raw.write(`id: ${eventId}\ndata: ${JSON.stringify({ type, data })}\n\n`);
    };

    // Subscribe to download manager events
    const handler = (event: { type: string; data: unknown }) => {
      sendEvent(event.type, event.data);
    };
    app.downloadManager.on('event', handler);

    // Send heartbeat every 15s to keep connection alive through proxies
    const heartbeat = setInterval(() => {
      reply.raw.write(`: heartbeat\n\n`);
    }, 15000);

    // Send initial connected event
    sendEvent('connected', { timestamp: new Date().toISOString() });

    // Cleanup on disconnect
    request.raw.on('close', () => {
      clearInterval(heartbeat);
      app.downloadManager.off('event', handler);
    });
  });
};
