import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

let client: ReturnType<typeof createSupabaseClient> | null = null;

export const createClient = () => {
  if (!client) client = createSupabaseClient(supabaseUrl, supabaseKey);
  return client;
};
