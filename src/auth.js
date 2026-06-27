import { supabase } from "./supabaseClient";

// ===== Login / Logout =====
export async function signIn(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

// ===== Sessão atual + perfil =====
export async function getSessionUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data: perfil } = await supabase
    .from("perfis").select("*").eq("id", session.user.id).single();
  return {
    id: session.user.id,
    email: session.user.email,
    nome: perfil?.nome || session.user.email,
    papel: perfil?.papel || "gestor",
  };
}

// Observa mudanças de sessão (login/logout em outra aba, expiração de token).
export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session);
  });
  return () => data.subscription.unsubscribe();
}

// ===== Admin cria usuário =====
// Usa signUp para criar o login; nome e papel vão nos metadados, e o trigger
// no banco cria o perfil automaticamente.
// Observação: o Supabase, por padrão, troca a sessão para o novo usuário ao usar signUp.
// Para o admin não ser deslogado, criamos um cliente isolado só para esta operação.
import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function adminCriarUsuario({ email, senha, nome, papel }) {
  // cliente temporário, sem persistir sessão, para não derrubar o admin logado
  const temp = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await temp.auth.signUp({
    email,
    password: senha,
    options: { data: { nome, papel } },
  });
  if (error) throw error;
  return data;
}

// ===== Atualizar perfil (nome/papel) — admin =====
export async function atualizarPerfil(id, campos) {
  const { error } = await supabase.from("perfis").update(campos).eq("id", id);
  if (error) throw error;
}
