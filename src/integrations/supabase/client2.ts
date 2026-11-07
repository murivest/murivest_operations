import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env["NEXT_PUBLIC_SUPABASE_URL2"] as string;
const supabaseKey = (import.meta.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY2"] ??
  import.meta.env["NEXT_PUBLIC_SUPABASE_ANON_KEY2"]) as string | undefined;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL2 or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY2 — check your .env",
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
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
