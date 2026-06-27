import { createClient } from "@supabase/supabase-js";

// As chaves vêm das variáveis de ambiente (definidas no .env e no Vercel).
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

// Cria o cliente apenas se as chaves existirem (evita crash quando não configurado).
export const supabase = supabaseConfigured
  ? createClient(url, anonKey)
  : null;
