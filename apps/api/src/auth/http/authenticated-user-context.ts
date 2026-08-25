import type { VerifiedExternalIdentity } from '@copiloto/domain';
import type { Request } from 'express';

import type { InternalUser } from '../../identity/application/identity-repository';

const AUTHENTICATED_USER_CONTEXT = Symbol('AUTHENTICATED_USER_CONTEXT');

export interface AuthenticatedUserContext {
  externalIdentity: VerifiedExternalIdentity;
  user: InternalUser;
}

type AuthenticatedRequest = Request & {
  [AUTHENTICATED_USER_CONTEXT]?: AuthenticatedUserContext;
};

export function setAuthenticatedUserContext(
  request: Request,
  context: AuthenticatedUserContext,
): void {
  (request as AuthenticatedRequest)[AUTHENTICATED_USER_CONTEXT] = context;
}

export function authenticatedUserContext(request: Request): AuthenticatedUserContext {
  const context = (request as AuthenticatedRequest)[AUTHENTICATED_USER_CONTEXT];

  if (context === undefined) {
    throw new Error('Authenticated User context is unavailable.');
  }

  return context;
}
