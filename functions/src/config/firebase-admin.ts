import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const app = getApps().length > 0 ? getApps()[0] : initializeApp();

export const adminAuth = getAuth(app);
