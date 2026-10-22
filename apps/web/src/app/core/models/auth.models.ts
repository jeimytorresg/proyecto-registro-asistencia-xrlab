export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

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
