import type express from 'express';

let cachedApp: express.Express | null = null;
let envLoaded = false;

export default async function handler(req: express.Request, res: express.Response) {
  try {
    if (!envLoaded && !process.env.VERCEL) {
      envLoaded = true;
      try {
        await import('dotenv/config');
      } catch {
        // dotenv optional in production
      }
    }

    if (!cachedApp) {
      const { createApiApp } = await import('../server/app.ts');
      cachedApp = createApiApp();
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      if (typeof res.once === 'function') {
        res.once('finish', done);
        res.once('close', done);
      } else {
        const origJson = res.json.bind(res);
        const origEnd = res.end.bind(res);
        res.json = ((body?: unknown) => {
          const out = origJson(body);
          done();
          return out;
        }) as typeof res.json;
        res.end = ((...args: Parameters<typeof res.end>) => {
          const out = origEnd(...args);
          done();
          return out;
        }) as typeof res.end;
      }

      try {
        cachedApp!(req, res);
      } catch (err) {
        if (!settled) {
          settled = true;
          reject(err);
        }
      }
    });
  } catch (err) {
    console.error('[api/index] handler error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Service momentanément indisponible. Veuillez réessayer.',
      });
    }
  }
}
