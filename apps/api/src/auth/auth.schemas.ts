import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

const emailSchema = z.string().trim().toLowerCase().email().max(254);

const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`)
  .max(PASSWORD_MAX_LENGTH);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200) });

export const setPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: newPasswordSchema,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export type LoginDto = z.output<typeof loginSchema>;
export type RefreshDto = z.output<typeof refreshSchema>;
export type SetPasswordDto = z.output<typeof setPasswordSchema>;
export type ForgotPasswordDto = z.output<typeof forgotPasswordSchema>;
