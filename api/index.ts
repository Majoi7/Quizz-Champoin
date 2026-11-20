import type express from 'express';
import { createApiApp } from '../server/app';

let cachedApp: express.Express | null = null;

export default function handler(req: express.Request, res: express.Response) {
  try {
    if (!cachedApp) {
      cachedApp = createApiApp();
    }
    return cachedApp(req, res);
  } catch (err) {
    console.error('[api/index] handler error:', err);
    return res.status(500).json({
      error: "Service momentanément indisponible. Veuillez réessayer.",
    });
  }
}
