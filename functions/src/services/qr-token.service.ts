import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { ApiError } from '../http/api-error.js';
import type { QrBatch, QrTokenPayload, SignedQrToken } from '../domain/qr-token.js';

const TOKEN_VERSION = 1 as const;
const CLOCK_SKEW_MS = 3000;

export interface VerifyQrTokenOptions {
  allowExpired?: boolean;
  allowNotYetValid?: boolean;
}

function getSigningKey(): string {
  const key = process.env.QR_SIGNING_KEY;

  if (!key || key.length < 32) {
    throw new Error('QR_SIGNING_KEY no está configurado o es demasiado corto.');
  }

  return key;
}

function getTtlSeconds(): number {
  return Number(process.env.QR_TOKEN_TTL_SECONDS ?? '15');
}

function getRotateSeconds(): number {
  return Number(process.env.QR_ROTATE_SECONDS ?? '10');
}

function getMaxBatchSeconds(): number {
  return Number(process.env.QR_BATCH_SECONDS ?? '60');
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function parseBase64UrlJson<T>(value: string): T {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
  } catch {
    throw new ApiError(400, 'QR_INVALID', 'El código QR no tiene un formato válido.');
  }
}

function sign(unsignedToken: string): string {
  return createHmac('sha256', getSigningKey())
    .update(unsignedToken)
    .digest('base64url');
}

function safeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function createSignedToken(payload: QrTokenPayload): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const unsignedToken = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = sign(unsignedToken);

  return `${unsignedToken}.${signature}`;
}

function validatePayloadShape(payload: QrTokenPayload): void {
  const valid =
    payload &&
    payload.v === TOKEN_VERSION &&
    typeof payload.kioskId === 'string' &&
    payload.kioskId.length > 0 &&
    typeof payload.kioskSessionId === 'string' &&
    payload.kioskSessionId.length > 0 &&
    typeof payload.jti === 'string' &&
    payload.jti.length > 0 &&
    typeof payload.iat === 'string' &&
    typeof payload.exp === 'string' &&
    Number.isInteger(payload.seq);

  if (!valid) {
    throw new ApiError(400, 'QR_INVALID', 'El token QR no contiene los datos requeridos.');
  }
}

export function isQrPayloadExpired(payload: QrTokenPayload): boolean {
  return new Date(payload.exp).getTime() + CLOCK_SKEW_MS < Date.now();
}

export function generateQrToken(params: {
  kioskCode: string;
  kioskSessionId: string;
  validFrom: Date;
  seq: number;
}): SignedQrToken {
  const ttlSeconds = getTtlSeconds();

  const expiresAt = new Date(params.validFrom.getTime() + ttlSeconds * 1000);

  const payload: QrTokenPayload = {
    v: TOKEN_VERSION,
    kioskId: params.kioskCode,
    kioskSessionId: params.kioskSessionId,
    jti: randomUUID(),
    iat: params.validFrom.toISOString(),
    exp: expiresAt.toISOString(),
    seq: params.seq,
  };

  return {
    seq: payload.seq,
    jti: payload.jti,
    token: createSignedToken(payload),
    validFrom: payload.iat,
    expiresAt: payload.exp,
  };
}

export function generateQrBatch(params: {
  kioskCode: string;
  kioskSessionId: string;
  requestedBatchSeconds?: number;
}): QrBatch {
  const now = new Date();
  const rotateEverySeconds = getRotateSeconds();
  const ttlSeconds = getTtlSeconds();
  const maxBatchSeconds = getMaxBatchSeconds();

  const requestedBatchSeconds =
    params.requestedBatchSeconds && params.requestedBatchSeconds > 0
      ? params.requestedBatchSeconds
      : maxBatchSeconds;

  const batchSeconds = Math.min(
    Math.max(requestedBatchSeconds, rotateEverySeconds),
    maxBatchSeconds,
  );

  const tokenCount = Math.ceil(batchSeconds / rotateEverySeconds) + 1;

  const tokens = Array.from({ length: tokenCount }, (_unused, index) => {
    const validFrom = new Date(now.getTime() + index * rotateEverySeconds * 1000);
    const seq = Math.floor(validFrom.getTime() / (rotateEverySeconds * 1000));

    return generateQrToken({
      kioskCode: params.kioskCode,
      kioskSessionId: params.kioskSessionId,
      validFrom,
      seq,
    });
  });

  return {
    kioskSessionId: params.kioskSessionId,
    kioskCode: params.kioskCode,
    serverNow: now.toISOString(),
    rotateEverySeconds,
    ttlSeconds,
    tokens,
  };
}

export function verifyQrToken(
  token: string,
  options: VerifyQrTokenOptions = {},
): QrTokenPayload {
  const parts = token.split('.');

  if (parts.length !== 3) {
    throw new ApiError(400, 'QR_INVALID', 'El código QR no tiene una firma válida.');
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const header = parseBase64UrlJson<{ alg?: string; typ?: string }>(encodedHeader);

  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new ApiError(400, 'QR_INVALID', 'El encabezado del código QR no es válido.');
  }

  const expectedSignature = sign(unsignedToken);

  if (!safeEqualString(signature, expectedSignature)) {
    throw new ApiError(400, 'QR_INVALID', 'El código QR fue alterado o no pertenece a XRLAB.');
  }

  const payload = parseBase64UrlJson<QrTokenPayload>(encodedPayload);
  validatePayloadShape(payload);

  const issuedAtMs = new Date(payload.iat).getTime();
  const expiresAtMs = new Date(payload.exp).getTime();

  if (!Number.isFinite(issuedAtMs) || !Number.isFinite(expiresAtMs)) {
    throw new ApiError(400, 'QR_INVALID', 'Las fechas del código QR no son válidas.');
  }

  if (expiresAtMs <= issuedAtMs) {
    throw new ApiError(400, 'QR_INVALID', 'La expiración del código QR no es coherente.');
  }

  const nowMs = Date.now();

  if (issuedAtMs - CLOCK_SKEW_MS > nowMs && !options.allowNotYetValid) {
    throw new ApiError(400, 'QR_NOT_YET_VALID', 'El código QR todavía no está vigente.');
  }

  if (expiresAtMs + CLOCK_SKEW_MS < nowMs && !options.allowExpired) {
    throw new ApiError(400, 'QR_EXPIRED', 'El código QR expiró. Escanee el código actual.');
  }

  return payload;
}
