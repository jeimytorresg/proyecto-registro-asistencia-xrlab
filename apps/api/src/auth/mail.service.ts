import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const MAIL_TIMEOUT_MS = 10_000;

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Envío de correo por la API HTTP de Resend (no SMTP: Render puede bloquear esos puertos en el plan gratis). */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async send(message: MailMessage): Promise<void> {
    const apiKey = this.config.get('RESEND_API_KEY', { infer: true });

    if (!apiKey) {
      // Solo ocurre fuera de producción (el entorno lo exige allí). El texto incluye el enlace con el token.
      this.logger.warn(`RESEND_API_KEY no configurada. Correo para ${message.to}:\n${message.text}`);
      return;
    }

    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: this.config.get('MAIL_FROM', { infer: true }),
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
      signal: AbortSignal.timeout(MAIL_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Resend respondió ${response.status} al enviar el correo.`);
    }
  }
}
