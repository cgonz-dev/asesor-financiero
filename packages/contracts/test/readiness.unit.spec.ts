import {
  READINESS_NOT_READY_RESPONSE_EXAMPLE,
  READINESS_READY_RESPONSE_EXAMPLE,
  ReadinessResponseClientSchema,
  ReadinessResponseServerSchema,
} from '@copiloto/contracts';
import { describe, expect, it } from 'vitest';

describe('readiness response contract', () => {
  it.each([READINESS_READY_RESPONSE_EXAMPLE, READINESS_NOT_READY_RESPONSE_EXAMPLE])(
    'accepts the $status response',
    (example) => {
      expect(ReadinessResponseServerSchema.parse(example)).toEqual(example);
    },
  );

  it('rejects an unknown status', () => {
    expect(() =>
      ReadinessResponseServerSchema.parse({
        ...READINESS_READY_RESPONSE_EXAMPLE,
        status: 'degraded',
      }),
    ).toThrow();
  });

  it('does not let the server expose infrastructure details', () => {
    expect(() =>
      ReadinessResponseServerSchema.parse({
        ...READINESS_NOT_READY_RESPONSE_EXAMPLE,
        databaseUrl: 'postgresql://user:password@host/database',
      }),
    ).toThrow();
  });

  it('accepts additional safe fields on the compatible client variant', () => {
    expect(
      ReadinessResponseClientSchema.parse({
        ...READINESS_READY_RESPONSE_EXAMPLE,
        safeFutureField: 'future-compatible',
      }),
    ).toEqual({
      ...READINESS_READY_RESPONSE_EXAMPLE,
      safeFutureField: 'future-compatible',
    });
  });
});
