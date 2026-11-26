import { setGlobalOptions } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';
import { app } from './app.js';

setGlobalOptions({
  region: 'us-central1',
  maxInstances: 2,
});

export const xrlabApi = onRequest(
  {
    region: 'us-central1',
    minInstances: 0,
    maxInstances: 2,
    memory: '256MiB',
    timeoutSeconds: 60,
    cors: true,
  },
  app,
);
