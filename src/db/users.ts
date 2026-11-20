import { count } from 'drizzle-orm';
import { db } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateUser(uid: string, email: string, name?: string) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const displayName = (name && name.trim()) || cleanEmail.split('@')[0] || 'Régie';
    const configuredOwner = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

    const [{ total }] = await db.select({ total: count() }).from(users);
    const assignedRole =
      total === 0 || (configuredOwner && cleanEmail === configuredOwner) ? 'SUPER_ADMIN' : 'HOST';

    const result = await db
      .insert(users)
      .values({
        uid,
        email: cleanEmail,
        name: displayName,
        role: assignedRole,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: cleanEmail,
          name: displayName,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Impossible de synchroniser le compte administrateur.', { cause: error });
  }
}
