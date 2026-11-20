import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const tempDbPath = path.join(
  os.tmpdir(),
  `qcl-reg-test-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
);
process.env.SQLITE_PATH = tempDbPath;

const { createApiApp } = await import('./app');
const { db } = await import('./db');

let server: http.Server;
let baseUrl = '';
let shouldThrowBroadcast = false;

test.before(async () => {
  const app = createApiApp({
    onBroadcast: () => {
      if (shouldThrowBroadcast) {
        throw new Error('Simulated WebSocket send failure');
      }
    },
  });

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise<void>((resolve) => {
    if (!server) return resolve();
    server.close(() => resolve());
  });
  try {
    db.close();
  } catch {
    // ignore
  }
  for (const suffix of ['', '-wal', '-shm']) {
    const filePath = `${tempDbPath}${suffix}`;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

test('POST /api/register creates participant with score 0 and status ACTIVE', async () => {
  const res = await fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: 'Camille',
      last_name: 'Diallo',
      nickname: 'La Foudre',
      phone: '+33 6 11 22 33 44',
    }),
  });

  assert.equal(res.status, 201);
  const data = (await res.json()) as {
    participant: {
      id: string;
      first_name: string;
      last_name: string;
      score: number;
      status: string;
    };
  };
  assert.ok(data.participant.id.startsWith('p_'));
  assert.equal(data.participant.first_name, 'Camille');
  assert.equal(data.participant.last_name, 'Diallo');
  assert.equal(data.participant.score, 0);
  assert.equal(data.participant.status, 'ACTIVE');
});

test('POST /api/register handles concurrent duplicate registrations with 409 (never 500)', async () => {
  const payload = JSON.stringify({
    first_name: 'Nadia',
    last_name: 'Benali',
  });

  const [r1, r2, r3] = await Promise.all([
    fetch(`${baseUrl}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    }),
    fetch(`${baseUrl}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    }),
    fetch(`${baseUrl}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    }),
  ]);

  const statuses = [r1.status, r2.status, r3.status].sort();
  assert.deepEqual(statuses, [201, 409, 409]);
});

test('POST /api/register rejects duplicate phone with 409', async () => {
  const res = await fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: 'Thomas',
      last_name: 'Leroy',
      phone: '+33611223344',
    }),
  });

  assert.equal(res.status, 409);
  const data = (await res.json()) as { error: string };
  assert.match(data.error, /téléphone/i);
});

test('POST /api/register rejects short/invalid names with 400', async () => {
  const res = await fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: 'A',
      last_name: 'B',
    }),
  });

  assert.equal(res.status, 400);
});

test('POST /api/register rejects invalid or oversized avatar_url with 400', async () => {
  const badProtocol = await fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: 'Luc',
      last_name: 'Morel',
      avatar_url: 'javascript:alert(1)',
    }),
  });
  assert.equal(badProtocol.status, 400);

  const oversized = await fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: 'Luc',
      last_name: 'Morel',
      avatar_url: `data:image/png;base64,${'a'.repeat(460_000)}`,
    }),
  });
  assert.equal(oversized.status, 400);
});

test('POST /api/register succeeds with 201 even when WebSocket broadcast throws', async () => {
  shouldThrowBroadcast = true;
  try {
    const res = await fetch(`${baseUrl}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: 'Ines',
        last_name: 'Kone',
        avatar_url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      }),
    });
    assert.equal(res.status, 201);
  } finally {
    shouldThrowBroadcast = false;
  }
});

test('POST /api/register returns clean JSON 400/413 for malformed or oversized JSON payloads', async () => {
  const malformed = await fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"first_name": "Broken',
  });
  assert.equal(malformed.status, 400);
  const malformedBody = (await malformed.json()) as { error: string };
  assert.ok(malformedBody.error.length > 0);

  const tooBig = await fetch(`${baseUrl}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: 'Big',
      last_name: 'Payload',
      nickname: 'x'.repeat(4_500_000),
    }),
  });
  assert.equal(tooBig.status, 413);
  const tooBigBody = (await tooBig.json()) as { error: string };
  assert.ok(tooBigBody.error.length > 0);
});

test('api/index serverless handler handles pre-parsed body without 500', async () => {
  const { default: handler } = await import('../api/index');
  let statusCode = 200;
  let jsonBody: unknown = null;

  const mockReq = {
    method: 'POST',
    url: '/api/register',
    headers: { 'content-type': 'application/json' },
    body: {
      first_name: 'Samba',
      last_name: 'Traore',
    },
  } as unknown as Parameters<typeof handler>[0];

  const mockRes = {
    statusCode: 200,
    setHeader: () => mockRes,
    getHeader: () => undefined,
    status(code: number) {
      statusCode = code;
      return mockRes;
    },
    json(payload: unknown) {
      jsonBody = payload;
      return mockRes;
    },
    end() {
      return mockRes;
    },
  } as unknown as Parameters<typeof handler>[1];

  await new Promise<void>((resolve) => {
    const origJson = mockRes.json.bind(mockRes);
    (mockRes as unknown as { json: (p: unknown) => unknown }).json = (payload: unknown) => {
      const result = origJson(payload);
      resolve();
      return result;
    };
    handler(mockReq, mockRes);
  });

  assert.equal(statusCode, 201);
  assert.ok((jsonBody as { participant?: { id?: string } })?.participant?.id);
});
