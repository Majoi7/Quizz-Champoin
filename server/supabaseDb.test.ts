import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSupabaseParticipant,
  getSupabaseConfig,
  isSupabaseConfigured,
  isSupabaseMissingColumnError,
  isSupabaseMissingTableError,
  isSupabaseRlsError,
  isSupabaseUniqueViolation,
} from './supabaseDb.ts';

test('getSupabaseConfig detects SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY', () => {
  const prevUrl = process.env.SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const prevViteUrl = process.env.VITE_SUPABASE_URL;
  const prevViteKey = process.env.VITE_SUPABASE_ANON_KEY;
  const prevAnon = process.env.SUPABASE_ANON_KEY;

  try {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_ANON_KEY;
    assert.equal(isSupabaseConfigured(), false);
    assert.equal(getSupabaseConfig(), null);

    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
    assert.equal(isSupabaseConfigured(), true);
    assert.deepEqual(getSupabaseConfig(), {
      url: 'https://example.supabase.co',
      key: 'service-role-test-key',
    });
  } finally {
    if (prevUrl !== undefined) process.env.SUPABASE_URL = prevUrl;
    else delete process.env.SUPABASE_URL;
    if (prevKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (prevViteUrl !== undefined) process.env.VITE_SUPABASE_URL = prevViteUrl;
    else delete process.env.VITE_SUPABASE_URL;
    if (prevViteKey !== undefined) process.env.VITE_SUPABASE_ANON_KEY = prevViteKey;
    else delete process.env.VITE_SUPABASE_ANON_KEY;
    if (prevAnon !== undefined) process.env.SUPABASE_ANON_KEY = prevAnon;
    else delete process.env.SUPABASE_ANON_KEY;
  }
});

test('isSupabaseMissingTableError detects PGRST205 schema cache and 42P01 missing relation errors', () => {
  assert.equal(
    isSupabaseMissingTableError({
      code: 'PGRST205',
      message: "Could not find the table 'public.competitions' in the schema cache",
    }),
    true
  );
  assert.equal(
    isSupabaseMissingTableError({
      code: '42P01',
      message: 'relation "public.participants" does not exist',
    }),
    true
  );
  assert.equal(isSupabaseMissingTableError({ code: '23505', message: 'duplicate key' }), false);
});

test('isSupabaseMissingColumnError and isSupabaseRlsError detect PostgREST error codes', () => {
  assert.equal(
    isSupabaseMissingColumnError(
      {
        code: 'PGRST204',
        message: "Could not find the 'normalized_key' column of 'participants' in the schema cache",
      },
      'normalized_key'
    ),
    true
  );
  assert.equal(
    isSupabaseRlsError({
      code: '42501',
      message: 'new row violates row-level security policy for table "participants"',
    }),
    true
  );
});

test('isSupabaseUniqueViolation identifies PostgreSQL 23505 and duplicate key messages', () => {
  assert.equal(isSupabaseUniqueViolation({ code: '23505' }), true);
  assert.equal(
    isSupabaseUniqueViolation({ message: 'duplicate key value violates unique constraint' }),
    true
  );
  assert.equal(isSupabaseUniqueViolation({ code: '42P01', message: 'relation missing' }), false);
  assert.equal(isSupabaseUniqueViolation(null), false);
});

test('createSupabaseParticipant rejects invalid name and unsafe avatar before hitting network', async () => {
  await assert.rejects(
    () =>
      createSupabaseParticipant({
        first_name: 'A',
        last_name: 'B',
      }),
    /INVALID_NAME/
  );

  await assert.rejects(
    () =>
      createSupabaseParticipant({
        first_name: 'Camille',
        last_name: 'Diallo',
        avatar_url: 'javascript:alert(1)',
      }),
    /INVALID_AVATAR/
  );
});
