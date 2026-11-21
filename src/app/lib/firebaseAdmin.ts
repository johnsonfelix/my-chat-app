import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import path from 'path';
import fs from 'fs';

let app: App | null = null;

export function getFirebaseApp(): App | null {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  try {
    const envKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (envKey) {
      const credentials = typeof envKey === 'string' ? JSON.parse(envKey) : envKey;
      app = initializeApp({
        credential: cert(credentials),
      });
      return app;
    }

    const keyPath = path.join(process.cwd(), 'firebase-service-account.json');
    if (fs.existsSync(keyPath)) {
      const raw = fs.readFileSync(keyPath, 'utf8');
      const credentials = JSON.parse(raw);
      app = initializeApp({
        credential: cert(credentials),
      });
      return app;
    }
  } catch (e) {
    console.error('Failed to initialize Firebase Admin:', e);
  }

  return null;
}
