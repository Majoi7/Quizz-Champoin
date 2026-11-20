import type express from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { AdminUser } from '../types/quiz.ts';

export interface AuthRequest extends express.Request {
  user?: DecodedIdToken;
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
    const [{ getAdminAuth }, { upsertAdminUser }] = await Promise.all([
      import('../lib/firebase-admin.ts'),
      import('../../server/db.ts'),
    ]);

    const decodedToken = await getAdminAuth().verifyIdToken(token);
    req.user = decodedToken;

    const email = decodedToken.email ?? `${decodedToken.uid}@firebase.local`;
    const dbUser = await upsertAdminUser(
      decodedToken.uid,
      email,
      typeof decodedToken.name === 'string' ? decodedToken.name : undefined
    );

    req.admin = {
      id: dbUser.uid,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'HOST',
    };

    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    res.status(401).json({ error: 'Session administrateur invalide ou expirée.' });
  }
};
