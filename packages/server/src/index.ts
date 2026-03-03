import { loadConfig } from './config.js';
import { buildApp } from './app.js';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

async function main() {
  const config = loadConfig();

  // Ensure directories exist
  mkdirSync(config.downloadDir, { recursive: true });
  mkdirSync(dirname(config.databasePath), { recursive: true });

  const app = await buildApp(config);

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} received, shutting down...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`Server listening on http://localhost:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
