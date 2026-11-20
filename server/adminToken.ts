import crypto from 'node:crypto';

const TOKEN_PREFIX = 'regie_v1.';
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 heures

export interface AdminTokenPayload {
  uid: string;
  email: string;
  name: string;
  exp: number;
}

export function getConfiguredAdminAccessCode(): string {
  return (process.env.ADMIN_ACCESS_CODE || process.env.ADMIN_PASSWORD || '').trim();
}

function getSigningSecret(): string | null {
  const secret = (
    process.env.ADMIN_TOKEN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.ADMIN_ACCESS_CODE ||
    process.env.ADMIN_PASSWORD ||
    process.env.SQL_PASSWORD ||
    ''
  ).trim();
  return secret || null;
}

export function verifyConfiguredAccessCode(submitted: string): boolean {
  const expected = getConfiguredAdminAccessCode();
  const cleanSubmitted = submitted.trim();
  if (!expected || !cleanSubmitted) return false;

  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  const submittedHash = crypto.createHash('sha256').update(cleanSubmitted).digest();
  return crypto.timingSafeEqual(expectedHash, submittedHash);
}

export function signAdminSessionToken(payload: Omit<AdminTokenPayload, 'exp'>): string {
  const secret = getSigningSecret();
  if (!secret) {
    throw new Error('ADMIN_SECRET_MISSING');
  }
  const fullPayload: AdminTokenPayload = {
    ...payload,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sigB64 = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${TOKEN_PREFIX}${payloadB64}.${sigB64}`;
}

export function isAdminSessionToken(token: string): boolean {
  return token.startsWith(TOKEN_PREFIX);
}

export function verifyAdminSessionToken(token: string): AdminTokenPayload | null {
  if (!isAdminSessionToken(token)) return null;
  const secret = getSigningSecret();
  if (!secret) return null;

  const body = token.slice(TOKEN_PREFIX.length);
  const dotIdx = body.indexOf('.');
  if (dotIdx <= 0) return null;

  const payloadB64 = body.slice(0, dotIdx);
  const sigB64 = body.slice(dotIdx + 1);
  if (!payloadB64 || !sigB64) return null;

  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const sigBuf = Buffer.from(sigB64, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as Partial<AdminTokenPayload>;
    if (
      typeof parsed.uid !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }
    if (Date.now() > parsed.exp) {
      return null;
    }
    return {
      uid: parsed.uid,
      email: parsed.email,
      name: parsed.name,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}
