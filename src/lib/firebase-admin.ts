import fs from 'node:fs';
import path from 'node:path';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

function resolveFirebaseProjectId(): string | undefined {
  const envProjectId = (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    ''
  ).trim();
  if (envProjectId) {
    return envProjectId;
  }

  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(raw) as { projectId?: unknown };
      if (typeof parsed.projectId === 'string' && parsed.projectId.trim()) {
        return parsed.projectId.trim();
      }
    }
  } catch (err) {
    console.warn('[firebase-admin] Unable to read firebase-applet-config.json:', err);
  }

  return undefined;
}

let cachedAuth: Auth | null = null;

export function getAdminAuth(): Auth {
  if (!getApps().length) {
    const projectId = resolveFirebaseProjectId();
    initializeApp(projectId ? { projectId } : {});
  }
  if (!cachedAuth) {
    cachedAuth = getAuth();
  }
  return cachedAuth;
}
