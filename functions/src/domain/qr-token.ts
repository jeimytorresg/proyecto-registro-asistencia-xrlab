export interface QrTokenPayload {
  v: 1;
  kioskId: string;
  kioskSessionId: string;
  jti: string;
  iat: string;
  exp: string;
  seq: number;
}

export interface SignedQrToken {
  seq: number;
  jti: string;
  token: string;
  validFrom: string;
  expiresAt: string;
}

export interface QrBatch {
  kioskSessionId: string;
  kioskCode: string;
  serverNow: string;
  rotateEverySeconds: number;
  ttlSeconds: number;
  tokens: SignedQrToken[];
}
