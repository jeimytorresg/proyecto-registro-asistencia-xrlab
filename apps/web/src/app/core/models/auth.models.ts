export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

/** FIRST_ACCESS: debe crear su contraseña. PASSWORD: inicia sesión con su contraseña. */
export type AccessStatus = 'FIRST_ACCESS' | 'PASSWORD';

export interface UserProfile {
  id: string;
  firebaseUid: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  active: boolean;
  lastLoginAt: string | null;
}

export interface AuthSession {
  uid: string;
  email: string;
  role: UserRole;
  profile: UserProfile;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  message: string;
  requestId: string;
}

export interface ApiErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorResponse;
