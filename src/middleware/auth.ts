import type express from 'express';
import type { AdminUser } from '../types/quiz.ts';

export interface AuthRequest extends express.Request {
  admin?: AdminUser;
}

export const requireAdmin = async (
  req: AuthRequest,
  res: express.Response,
  next: express.NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentification administrateur requise.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Jeton d’authentification manquant.' });
    return;
  }

  try {
    const { isSupabaseConfigured, verifySupabaseAccessToken } = await import(
      '../../server/supabaseDb.ts'
    );

    if (!isSupabaseConfigured()) {
      res.status(503).json({
        error:
          'Authentification Supabase non configurée. Ajoutez SUPABASE_URL et SUPABASE_ANON_KEY dans vos variables d’environnement.',
      });
      return;
    }

    const dbUser = await verifySupabaseAccessToken(token);
    req.admin = {
      id: dbUser.uid,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'HOST',
    };

    next();
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    if (code === 'FORBIDDEN_ADMIN') {
      res.status(403).json({
        error: 'Accès refusé : ce compte n’est pas autorisé à accéder à la régie.',
      });
      return;
    }
    if (code === 'SUPABASE_NOT_CONFIGURED') {
      res.status(503).json({
        error:
          'Authentification Supabase non configurée. Ajoutez SUPABASE_URL et SUPABASE_ANON_KEY.',
      });
      return;
    }
    if (code !== 'INVALID_TOKEN') {
      console.error('Error verifying Supabase admin token:', error);
    }
    res.status(401).json({ error: 'Session administrateur Supabase invalide ou expirée.' });
  }
};
