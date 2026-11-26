import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// En Vercel no hay credenciales implícitas: se leen de FIREBASE_SERVICE_ACCOUNT_KEY (JSON).
// En Firebase Functions la variable no existe y se usa la detección automática.
const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp(
        rawServiceAccount
          ? { credential: cert(JSON.parse(rawServiceAccount)) }
          : undefined,
      );

export const adminAuth = getAuth(app);
