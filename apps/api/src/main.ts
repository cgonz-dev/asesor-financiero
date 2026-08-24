import 'reflect-metadata';

import { createApplication } from './create-application';

async function bootstrap(): Promise<void> {
  const app = await createApplication({ logger: ['error', 'warn', 'log'] });
  app.enableShutdownHooks();
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  const host = process.env.API_HOST?.trim();

  if (host === undefined || host.length === 0) {
    await app.listen(port);
    return;
  }

  await app.listen(port, host);
}

void bootstrap();
