import { readFile } from 'node:fs/promises';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

process.env.FIREBASE_AUTH_EMULATOR_HOST =
  process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';

const firebasercUrl = new URL('../../.firebaserc', import.meta.url);
const firebaserc = JSON.parse(await readFile(firebasercUrl, 'utf8'));

const projectId =
  process.env.FIREBASE_PROJECT_ID ??
  process.env.GCLOUD_PROJECT ??
  firebaserc.projects?.default;

if (!projectId) {
  console.error('No se pudo detectar el projectId desde .firebaserc');
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ projectId });
}

const auth = getAuth();

const password = 'Xrlab.Dev.2026!';

const users = [
  {
    uid: 'dev-admin-001',
    email: 'admin@xrlab.test',
    displayName: 'Admin XRLAB',
    role: 'ADMIN',
  },
  {
    uid: 'dev-teacher-001',
    email: 'docente@xrlab.test',
    displayName: 'Docente XRLAB',
    role: 'TEACHER',
  },
  {
    uid: 'dev-student-001',
    email: 'estudiante@xrlab.test',
    displayName: 'Estudiante XRLAB',
    role: 'STUDENT',
  },
];

async function upsertUser(user) {
  try {
    await auth.getUser(user.uid);

    await auth.updateUser(user.uid, {
      email: user.email,
      password,
      displayName: user.displayName,
      emailVerified: true,
      disabled: false,
    });
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') {
      throw error;
    }

    await auth.createUser({
      uid: user.uid,
      email: user.email,
      password,
      displayName: user.displayName,
      emailVerified: true,
      disabled: false,
    });
  }

  await auth.setCustomUserClaims(user.uid, {
    role: user.role,
  });

  console.log(`OK: ${user.email} -> ${user.role}`);
}

console.log(`Sembrando usuarios en Firebase Auth Emulator`);
console.log(`Project ID: ${projectId}`);
console.log(`Auth Emulator: ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);

for (const user of users) {
  await upsertUser(user);
}

console.log('\nUsuarios de prueba:');
console.table(
  users.map((user) => ({
    uid: user.uid,
    email: user.email,
    role: user.role,
    password,
  })),
);
