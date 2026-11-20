import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

const DEFAULT_FIREBASE_PROJECT_ID = 'strong-canopy-qpjks';

function resolveFirebaseProjectId(): string {
  const envProjectId = (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    ''
  ).trim();
  if (envProjectId) {
    return envProjectId;
  }

  const candidatePaths = [path.resolve(process.cwd(), 'firebase-applet-config.json')];
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    candidatePaths.push(path.resolve(currentDir, '../../firebase-applet-config.json'));
  } catch {
    // ignore if import.meta.url unavailable in bundled context
  }

  for (const configPath of candidatePaths) {
    try {
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
  }

  return DEFAULT_FIREBASE_PROJECT_ID;
}

let cachedAuth: Auth | null = null;

export function getAdminAuth(): Auth {
  if (!getApps().length) {
    const projectId = resolveFirebaseProjectId();
    initializeApp({ projectId });
  }
  if (!cachedAuth) {
    cachedAuth = getAuth();
  }
  return cachedAuth;
}
