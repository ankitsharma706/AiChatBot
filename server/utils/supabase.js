import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '[Supabase] SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env\n' +
    'Get them from: https://app.supabase.com → Project Settings → API'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

/**
 * Quick connectivity check — resolves true/false.
 * Used by /health endpoint.
 */
export const checkSupabaseConnection = async () => {
  try {
    const { error } = await supabase
      .from('documents')
      .select('id')
      .limit(1);
    return !error;
  } catch {
    return false;
  }
};
