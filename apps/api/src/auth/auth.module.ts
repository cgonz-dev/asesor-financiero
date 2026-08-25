import { Module, type DynamicModule } from '@nestjs/common';

import { IdentityModule } from '../identity/identity.module';
import type { AuthConfiguration } from './config/auth-configuration';
import { AuthenticationGuard } from './http/authentication.guard';
import { MeController } from './http/me.controller';
import {
  DEFAULT_JOSE_ACCESS_TOKEN_VERIFIER_OPTIONS,
  JOSE_ACCESS_TOKEN_VERIFIER_PROVIDER,
  JoseAccessTokenVerifier,
} from './infrastructure/jose-access-token-verifier';
import { AUTH_CONFIGURATION, JOSE_VERIFIER_OPTIONS } from './tokens';

export interface AuthModuleOptions {
  configuration?: AuthConfiguration;
}

@Module({})
export class AuthModule {
  static register(options: AuthModuleOptions = {}): DynamicModule {
    return {
      module: AuthModule,
      imports: [IdentityModule],
      controllers: [MeController],
      providers: [
        {
          provide: AUTH_CONFIGURATION,
          useValue: options.configuration ?? null,
        },
        {
          provide: JOSE_VERIFIER_OPTIONS,
          useValue: DEFAULT_JOSE_ACCESS_TOKEN_VERIFIER_OPTIONS,
        },
        JoseAccessTokenVerifier,
        JOSE_ACCESS_TOKEN_VERIFIER_PROVIDER,
        AuthenticationGuard,
      ],
    };
  }
}
