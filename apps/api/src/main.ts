import 'reflect-metadata';

import { createApplication } from './create-application';

async function bootstrap(): Promise<void> {
  const app = await createApplication({ logger: ['error', 'warn', 'log'] });
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);

  await app.listen(port);
}

void bootstrap();
