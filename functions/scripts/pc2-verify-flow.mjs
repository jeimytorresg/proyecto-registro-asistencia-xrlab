import { readFile } from 'node:fs/promises';

const firebaserc = JSON.parse(
  await readFile(new URL('../../.firebaserc', import.meta.url), 'utf8'),
);

const projectId =
  process.env.FIREBASE_PROJECT_ID ??
  process.env.GCLOUD_PROJECT ??
  firebaserc.projects?.default;

if (!projectId) {
  throw new Error('No se encontró projectId en .firebaserc');
}

const authEmulatorHost =
  process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';

const authSignInUrl =
  `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=dev`;

const apiBaseUrl =
  process.env.XRLAB_API_BASE_URL ??
  `http://127.0.0.1:5001/${projectId}/us-central1/xrlabApi/api`;

const password = 'Xrlab.Dev.2026!';

const results = [];
let failures = 0;

function record(name, passed, details = '') {
  results.push({
    prueba: name,
    estado: passed ? 'OK' : 'FAIL',
    detalle: details,
  });

  if (!passed) {
    failures += 1;
  }
}

async function signIn(email) {
  const response = await fetch(authSignInUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  });

  const body = await response.json();

  if (!response.ok || !body.idToken) {
    throw new Error(`No se pudo iniciar sesión con ${email}: ${JSON.stringify(body)}`);
  }

  return body.idToken;
}

async function apiPost(path, token, body) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const responseBody = await response.json();

  return {
    status: response.status,
    body: responseBody,
  };
}

async function apiGet(path) {
  const response = await fetch(`${apiBaseUrl}${path}`);
  const body = await response.json();

  return {
    status: response.status,
    body,
  };
}

console.log('Verificando PC2 con emuladores locales');
console.log(`Project ID: ${projectId}`);
console.log(`Auth Emulator: ${authEmulatorHost}`);
console.log(`API: ${apiBaseUrl}`);

const health = await apiGet('/health');
record('health público 200', health.status === 200, `status=${health.status}`);
record('health ok=true', health.body?.ok === true, JSON.stringify(health.body));

const teacherToken = await signIn('docente@xrlab.test');
const studentToken = await signIn('estudiante@xrlab.test');

const openSession = await apiPost('/kiosk/sessions/open', teacherToken, {
  kioskCode: 'XR-KIOSK-01',
});

record('docente abre sesión kiosko', openSession.status === 200, `status=${openSession.status}`);

const kioskSessionId = openSession.body?.data?.session?.id;

record(
  'kioskSessionId recibido',
  typeof kioskSessionId === 'string' && kioskSessionId.length > 0,
  kioskSessionId,
);

const batch = await apiPost('/kiosk/qr/batch', teacherToken, {
  kioskSessionId,
  batchSeconds: 60,
});

record('docente obtiene batch QR', batch.status === 200, `status=${batch.status}`);

const tokens = batch.body?.data?.tokens ?? [];
const currentToken = tokens[0]?.token;

record(
  'batch contiene tokens',
  Array.isArray(tokens) && tokens.length > 0 && typeof currentToken === 'string',
  `tokens=${tokens.length}`,
);

const studentOpenKioskAttempt = await apiPost('/kiosk/sessions/open', studentToken, {
  kioskCode: 'XR-KIOSK-01',
});

record(
  'estudiante no abre kiosko',
  studentOpenKioskAttempt.status === 403,
  `status=${studentOpenKioskAttempt.status}`,
);

const firstScan = await apiPost('/attendance/scan', studentToken, {
  qrToken: currentToken,
  clientInfo: {
    userAgent: 'pc2-verify-script',
    timezone: 'America/Guayaquil',
  },
});

record('estudiante registra entrada', firstScan.status === 200, `status=${firstScan.status}`);
record(
  'acción ENTRY_REGISTERED',
  firstScan.body?.data?.action === 'ENTRY_REGISTERED',
  firstScan.body?.data?.action,
);

const secondScan = await apiPost('/attendance/scan', studentToken, {
  qrToken: currentToken,
  clientInfo: {
    userAgent: 'pc2-verify-script',
    timezone: 'America/Guayaquil',
  },
});

record('doble escaneo no falla', secondScan.status === 200, `status=${secondScan.status}`);
record(
  'doble escaneo pide salida con actividades',
  secondScan.body?.data?.action === 'EXIT_REQUIRES_ACTIVITIES',
  secondScan.body?.data?.action,
);

const alteredToken = `${currentToken.slice(0, -2)}xx`;

const alteredScan = await apiPost('/attendance/scan', studentToken, {
  qrToken: alteredToken,
  clientInfo: {
    userAgent: 'pc2-verify-script',
    timezone: 'America/Guayaquil',
  },
});

record('QR alterado rechazado', alteredScan.status === 400, `status=${alteredScan.status}`);
record(
  'QR alterado responde QR_INVALID',
  alteredScan.body?.error?.code === 'QR_INVALID',
  alteredScan.body?.error?.code,
);

const closeSession = await apiPost('/kiosk/sessions/close', teacherToken, {
  kioskSessionId,
});

record('docente cierra sesión kiosko', closeSession.status === 200, `status=${closeSession.status}`);

console.table(results);

if (failures > 0) {
  console.error(`PC2 tiene ${failures} prueba(s) fallida(s).`);
  process.exit(1);
}

console.log('OK: PC2 verificado correctamente.');
