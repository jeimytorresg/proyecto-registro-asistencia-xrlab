export interface KioskInfo {
  id: string;
  code: string;
  name: string;
  location: string;
  active: boolean;
}

export interface KioskSessionInfo {
  id: string;
  status: 'ACTIVE' | 'CLOSED' | 'EXPIRED';
  openedAt: string;
  closedAt: string | null;
  kiosk: KioskInfo;
}

export interface KioskOpenResponse {
  session: KioskSessionInfo;
  reused: boolean;
}

export interface KioskCloseResponse {
  session: KioskSessionInfo;
}

export interface QrBatchToken {
  seq: number;
  jti: string;
  token: string;
  validFrom: string;
  expiresAt: string;
}

export interface QrBatchResponse {
  kioskSessionId: string;
  kioskCode: string;
  serverNow: string;
  rotateEverySeconds: number;
  ttlSeconds: number;
  tokens: QrBatchToken[];
}
