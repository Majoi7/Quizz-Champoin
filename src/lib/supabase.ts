import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const bakedUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const bakedAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

let runtimeClient: SupabaseClient | null =
  bakedUrl && bakedAnonKey
    ? createClient(bakedUrl, bakedAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      })
    : null;

export const supabaseClient: SupabaseClient | null = runtimeClient;

export function getOrCreateSupabaseClient(url?: string | null, anonKey?: string | null): SupabaseClient | null {
  if (runtimeClient) return runtimeClient;
  const cleanUrl = url?.trim();
  const cleanKey = anonKey?.trim();
  if (!cleanUrl || !cleanKey) return null;

  runtimeClient = createClient(cleanUrl, cleanKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
  return runtimeClient;
}
