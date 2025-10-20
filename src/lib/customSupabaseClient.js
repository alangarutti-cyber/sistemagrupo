import { createClient } from '@supabase/supabase-js';

// Read from environment variables (Vite).
// Configure these in a .env.local and in your Vercel project settings.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in .env.local or Vercel env vars.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
