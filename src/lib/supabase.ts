import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const bakedUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const bakedAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

function buildBrowserClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

let runtimeClient: SupabaseClient | null =
  bakedUrl && bakedAnonKey && /^https?:\/\//i.test(bakedUrl)
    ? buildBrowserClient(bakedUrl, bakedAnonKey)
    : null;

export const supabaseClient: SupabaseClient | null = runtimeClient;

export function getSupabaseClient(): SupabaseClient | null {
  return runtimeClient;
}

export function getOrCreateSupabaseClient(
  url?: string | null,
  anonKey?: string | null
): SupabaseClient | null {
  if (runtimeClient) return runtimeClient;
  const cleanUrl = url?.trim();
  const cleanKey = anonKey?.trim();
  if (!cleanUrl || !cleanKey || !/^https?:\/\//i.test(cleanUrl)) return null;

  runtimeClient = buildBrowserClient(cleanUrl, cleanKey);
  return runtimeClient;
}
