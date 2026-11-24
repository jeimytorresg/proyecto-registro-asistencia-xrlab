import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../config/env.schema';
import { AuthTokensRepository } from './auth-tokens.repository';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MailService } from './mail.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { UsersRepository } from './users.repository';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokensRepository,
    JwtAuthGuard,
    MailService,
    PasswordService,
    TokenService,
    UsersRepository,
  ],
  // El guard y sus dependencias quedan exportados para que otros módulos usen @Auth().
  exports: [AuthService, JwtAuthGuard, TokenService, UsersRepository],
})
export class AuthModule {}
