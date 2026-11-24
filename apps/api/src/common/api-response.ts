export interface ApiSuccess<T> {
  ok: true;
  data: T;
  message: string;
  requestId: string;
}

export interface ApiErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export const DEFAULT_SUCCESS_MESSAGE = 'Operación realizada correctamente.';
export const UNKNOWN_REQUEST_ID = 'unknown';
