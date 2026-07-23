// ============================================================
// Logger do OffChurn — captura erros e registra ações no banco.
// Funciona em segundo plano, sem interferir na experiência.
// ============================================================

import { supabase, supabaseConfigured } from "./supabaseClient";

let _userId = null;
let _userName = null;

/** Configura o usuário atual (chamado no login). */
export function setLogUser(id, nome) {
  _userId = id;
  _userName = nome;
}

/** Envia um log para o Supabase. Nunca lança erro (silencioso). */
async function enviar(tipo, origem, mensagem, detalhes) {
  if (!supabaseConfigured) return;
  try {
    await supabase.from("logs").insert({
      tipo,
      origem,
      mensagem: String(mensagem).slice(0, 1000),
      detalhes: detalhes ? String(detalhes).slice(0, 4000) : null,
      usuario_id: _userId,
      usuario_nome: _userName,
      url: typeof window !== "undefined" ? window.location.pathname : null,
    });
  } catch {
    // silencioso — o logger nunca pode derrubar o app
  }
}

// ---- API pública ----

export function logErro(origem, mensagem, detalhes) {
  enviar("erro", origem, mensagem, detalhes);
}

export function logAviso(origem, mensagem, detalhes) {
  enviar("aviso", origem, mensagem, detalhes);
}

export function logInfo(origem, mensagem, detalhes) {
  enviar("info", origem, mensagem, detalhes);
}

export function logAcao(origem, mensagem, detalhes) {
  enviar("acao", origem, mensagem, detalhes);
}

// ---- Captura global de erros não tratados ----

export function instalarCaptura() {
  if (typeof window === "undefined") return;

  // erros JS não capturados
  window.addEventListener("error", (e) => {
    logErro("window", e.message || "Erro não capturado", [
      e.filename && `Arquivo: ${e.filename}:${e.lineno}:${e.colno}`,
      e.error?.stack,
    ].filter(Boolean).join("\n"));
  });

  // promises rejeitadas sem catch
  window.addEventListener("unhandledrejection", (e) => {
    const msg = e.reason?.message || String(e.reason || "Promise rejeitada");
    logErro("promise", msg, e.reason?.stack);
  });

  // erros de rede (fetch que falha)
  const fetchOriginal = window.fetch;
  window.fetch = async function (...args) {
    try {
      const res = await fetchOriginal.apply(this, args);
      if (!res.ok && res.status >= 500) {
        logAviso("fetch", `HTTP ${res.status} em ${typeof args[0] === "string" ? args[0].slice(0, 200) : "request"}`);
      }
      return res;
    } catch (err) {
      logErro("fetch", `Falha de rede: ${err.message}`, typeof args[0] === "string" ? args[0].slice(0, 200) : undefined);
      throw err;
    }
  };

  // captura erros do console.error (muitas libs logam ali)
  const consoleErrorOriginal = console.error;
  console.error = function (...args) {
    consoleErrorOriginal.apply(console, args);
    const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a).slice(0, 500) : String(a))).join(" ");
    if (!msg.includes("logs") && !msg.includes("logger")) { // evita loop
      logErro("console", msg.slice(0, 1000));
    }
  };
}
