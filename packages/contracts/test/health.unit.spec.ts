import {
  HEALTH_RESPONSE_EXAMPLE,
  HealthResponseClientSchema,
  HealthResponseServerSchema,
} from '@copiloto/contracts';
import { describe, expect, it } from 'vitest';

describe('health response contract', () => {
  it('accepts a valid health response', () => {
    expect(HealthResponseServerSchema.parse(HEALTH_RESPONSE_EXAMPLE)).toEqual(
      HEALTH_RESPONSE_EXAMPLE,
    );
  });

  it('rejects an invalid health response', () => {
    expect(() =>
      HealthResponseServerSchema.parse({
        ...HEALTH_RESPONSE_EXAMPLE,
        status: 'degraded',
      }),
    ).toThrow();
  });

  it('rejects extra properties on the server variant', () => {
    expect(() =>
      HealthResponseServerSchema.parse({
        ...HEALTH_RESPONSE_EXAMPLE,
        safeFutureField: 'future-compatible',
      }),
    ).toThrow();
  });

  it('accepts extra properties on the compatible client variant', () => {
    expect(
      HealthResponseClientSchema.parse({
        ...HEALTH_RESPONSE_EXAMPLE,
        safeFutureField: 'future-compatible',
      }),
    ).toEqual({
      ...HEALTH_RESPONSE_EXAMPLE,
      safeFutureField: 'future-compatible',
    });
  });
});
