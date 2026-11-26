import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// En Firebase Functions el proyecto se detecta solo. En Vercel hay que indicarlo:
// verifyIdToken solo necesita el projectId (valida con los certificados públicos de Google).
const projectId =
  process.env.FIREBASE_PROJECT_ID ??
  process.env.GOOGLE_CLOUD_PROJECT ??
  process.env.GCLOUD_PROJECT;

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp(projectId ? { projectId } : undefined);

export const adminAuth = getAuth(app);
