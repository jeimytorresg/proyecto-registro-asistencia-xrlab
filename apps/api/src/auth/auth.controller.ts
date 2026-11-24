import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ResponseMessage } from '../common/response-message.decorator';
import { ZodBodyPipe } from '../common/zod-body.pipe';
import { Auth, CurrentUser } from './auth.decorators';
import {
  type ForgotPasswordDto,
  forgotPasswordSchema,
  type LoginDto,
  loginSchema,
  type RefreshDto,
  refreshSchema,
  type SetPasswordDto,
  setPasswordSchema,
} from './auth.schemas';
import { AuthService, type SessionTokens } from './auth.service';
import type { AuthenticatedUser } from './jwt-auth.guard';

/** Límite estricto para los endpoints que prueban credenciales o disparan correos. */
const SENSITIVE_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle(SENSITIVE_THROTTLE)
  @ResponseMessage('Sesión iniciada.')
  login(@Body(new ZodBodyPipe(loginSchema)) body: LoginDto): Promise<SessionTokens> {
    return this.auth.login(body.email, body.password);
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ResponseMessage('Sesión renovada.')
  refresh(@Body(new ZodBodyPipe(refreshSchema)) body: RefreshDto): Promise<SessionTokens> {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  @ResponseMessage('Sesión cerrada.')
  async logout(@Body(new ZodBodyPipe(refreshSchema)) body: RefreshDto): Promise<null> {
    await this.auth.logout(body.refreshToken);

    return null;
  }

  @Post('set-password')
  @HttpCode(200)
  @Throttle(SENSITIVE_THROTTLE)
  @ResponseMessage('Contraseña actualizada. Ya puede iniciar sesión.')
  async setPassword(@Body(new ZodBodyPipe(setPasswordSchema)) body: SetPasswordDto): Promise<null> {
    await this.auth.setPassword(body.token, body.password);

    return null;
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle(SENSITIVE_THROTTLE)
  @ResponseMessage('Si el correo está registrado, recibirá un enlace para restablecer su contraseña.')
  async forgotPassword(@Body(new ZodBodyPipe(forgotPasswordSchema)) body: ForgotPasswordDto): Promise<null> {
    await this.auth.forgotPassword(body.email);

    return null;
  }

  @Get('session-check')
  @Auth()
  @ResponseMessage('Sesión válida.')
  sessionCheck(@CurrentUser() user: AuthenticatedUser): {
    uid: string;
    email: string;
    role: string;
    profile: AuthenticatedUser['profile'];
  } {
    return { uid: user.id, email: user.email, role: user.role, profile: user.profile };
  }

  @Get('student-check')
  @Auth('STUDENT')
  @ResponseMessage('Acceso de estudiante confirmado.')
  studentCheck(@CurrentUser() user: AuthenticatedUser): { role: string; area: string } {
    return { role: user.role, area: 'student' };
  }

  @Get('admin-check')
  @Auth('ADMIN', 'TEACHER')
  @ResponseMessage('Acceso administrativo confirmado.')
  adminCheck(@CurrentUser() user: AuthenticatedUser): { role: string; area: string } {
    return { role: user.role, area: 'admin' };
  }
}
