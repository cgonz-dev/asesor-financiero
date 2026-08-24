import type { PrismaService } from '../src/persistence/prisma/prisma.service';
import { ReadinessService } from '../src/readiness/readiness.service';
import { describe, expect, it, vi } from 'vitest';

describe('ReadinessService', () => {
  it('reports ready after a successful lightweight database query', async () => {
    const databaseQuery = vi.fn().mockResolvedValue([{ value: 1 }]);
    const service = new ReadinessService({
      $queryRaw: databaseQuery,
    } as unknown as PrismaService);

    await expect(service.check()).resolves.toEqual({
      status: 'ready',
      service: 'copiloto-financiero-api',
    });
    expect(databaseQuery).toHaveBeenCalledOnce();
  });

  it('reports a safe not-ready response without exposing the database error', async () => {
    const databaseQuery = vi
      .fn()
      .mockRejectedValue(new Error('postgresql://user:password@internal-host/database'));
    const service = new ReadinessService({
      $queryRaw: databaseQuery,
    } as unknown as PrismaService);

    const result = await service.check();

    expect(result).toEqual({
      status: 'notReady',
      service: 'copiloto-financiero-api',
    });
    expect(JSON.stringify(result)).not.toContain('password');
    expect(JSON.stringify(result)).not.toContain('internal-host');
  });
});
