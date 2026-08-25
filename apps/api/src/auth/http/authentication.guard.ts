import {
  AUTHENTICATION_INVALID_ERROR_EXAMPLE,
  AUTHENTICATION_REQUIRED_ERROR_EXAMPLE,
} from '@copiloto/contracts';
import { UserStatus } from '@copiloto/domain';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { ResolveOrCreateUserFromExternalIdentity } from '../../identity/application/resolve-or-create-user-from-external-identity';
import {
  ACCESS_TOKEN_VERIFIER,
  AccessTokenVerificationError,
  type AccessTokenVerifier,
} from '../application/access-token-verifier';
import { setAuthenticatedUserContext } from './authenticated-user-context';

const MAX_ACCESS_TOKEN_LENGTH = 8_192;
const COMPACT_JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function bearerToken(request: Request): string {
  const authorization = request.headers.authorization;

  if (authorization === undefined) {
    throw new UnauthorizedException(AUTHENTICATION_REQUIRED_ERROR_EXAMPLE);
  }

  if (
    authorization.length > `Bearer `.length + MAX_ACCESS_TOKEN_LENGTH ||
    !authorization.startsWith('Bearer ')
  ) {
    throw new UnauthorizedException(AUTHENTICATION_INVALID_ERROR_EXAMPLE);
  }

  const token = authorization.slice('Bearer '.length);

  if (
    token.length === 0 ||
    token.length > MAX_ACCESS_TOKEN_LENGTH ||
    !COMPACT_JWT_PATTERN.test(token)
  ) {
    throw new UnauthorizedException(AUTHENTICATION_INVALID_ERROR_EXAMPLE);
  }

  return token;
}

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    @Inject(ACCESS_TOKEN_VERIFIER)
    private readonly verifier: AccessTokenVerifier,
    @Inject(ResolveOrCreateUserFromExternalIdentity)
    private readonly resolveUser: ResolveOrCreateUserFromExternalIdentity,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = bearerToken(request);
    let verified;

    try {
      verified = await this.verifier.verify(token);
    } catch (error: unknown) {
      if (error instanceof AccessTokenVerificationError) {
        throw new UnauthorizedException(AUTHENTICATION_INVALID_ERROR_EXAMPLE);
      }

      throw error;
    }

    const user = await this.resolveUser.execute(verified.identity);

    if (user.status !== UserStatus.Active) {
      throw new UnauthorizedException(AUTHENTICATION_INVALID_ERROR_EXAMPLE);
    }

    setAuthenticatedUserContext(request, {
      externalIdentity: verified.identity,
      user,
    });

    return true;
  }
}
