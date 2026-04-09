import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseConfigSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
});

export function createSupabaseServiceClient(): SupabaseClient {
  const parsed = supabaseConfigSchema.parse(process.env);
  return createClient(parsed.SUPABASE_URL, parsed.SUPABASE_SERVICE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
