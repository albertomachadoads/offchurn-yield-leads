// ============================================================
// OffChurn — Proteção contra DevTools
// Detecta tentativa de abrir ferramentas de desenvolvedor.
// Se o usuário NÃO for o admin isento:
//   1. Bloqueia o perfil (bloqueado = true)
//   2. Bane o IP
//   3. Registra log de segurança
//   4. Desloga imediatamente
// ============================================================

import { supabase } from "./supabaseClient";

const ADMIN_ISENTO = "albertomachadoads@gmail.com";

let _user = null;
let _jaDisparou = false; // evita disparar múltiplas vezes

export function setProtecaoUser(user) {
  _user = user;
  _jaDisparou = false;
}

/** Busca o IP público do usuário. */
async function getIP() {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip || null;
  } catch {
    return null;
  }
}

/** Coleta informações do dispositivo. */
function infoDispositivo() {
  const ua = navigator.userAgent || "";
  const plataforma = navigator.platform || navigator.userAgentData?.platform || "";
  const idioma = navigator.language || "";
  const tela = `${screen.width}x${screen.height}`;
  const memoria = navigator.deviceMemory ? `${navigator.deviceMemory}GB RAM` : "";
  const cores = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} cores` : "";

  return {
    navegador: ua,
    plataforma,
    idioma,
    tela,
    hardware: [memoria, cores].filter(Boolean).join(", "),
  };
}

/** Ação principal: bloqueia, bane IP, loga e desloga. */
async function dispararProtecao(gatilho) {
  if (_jaDisparou) return;
  _jaDisparou = true;

  const ip = await getIP();
  const info = infoDispositivo();

  const detalhes = [
    `Gatilho: ${gatilho}`,
    `IP: ${ip || "não obtido"}`,
    `Navegador: ${info.navegador}`,
    `Plataforma: ${info.plataforma}`,
    `Idioma: ${info.idioma}`,
    `Tela: ${info.tela}`,
    `Hardware: ${info.hardware}`,
    `URL: ${window.location.href}`,
    `Horário local: ${new Date().toLocaleString("pt-BR")}`,
  ].join("\n");

  try {
    // 1. Bloquear o perfil
    if (_user?.id) {
      await supabase.from("perfis").update({ bloqueado: true }).eq("id", _user.id);
    }

    // 2. Banir o IP
    if (ip) {
      await supabase.from("ips_banidos").upsert({
        ip,
        motivo: `DevTools detectado (${gatilho})`,
        usuario_nome: _user?.nome || "desconhecido",
        usuario_email: _user?.email || "desconhecido",
      }, { onConflict: "ip" });
    }

    // 3. Registrar log de segurança
    await supabase.from("logs").insert({
      tipo: "erro",
      origem: "seguranca",
      mensagem: `⚠️ BLOQUEIO DE SEGURANÇA: ${_user?.nome || "usuário"} tentou abrir DevTools`,
      detalhes,
      usuario_id: _user?.id,
      usuario_nome: _user?.nome,
      url: window.location.pathname,
    });
  } catch {
    // silencioso — não pode falhar e impedir o logout
  }

  // 4. Deslogar
  try {
    await supabase.auth.signOut();
  } catch {
    // forçar saída mesmo se signOut falhar
  }

  // redirecionar para login
  window.location.reload();
}

/** Instala os detectores de DevTools. Chamar após o login. */
export function instalarProtecaoDevTools() {
  if (typeof window === "undefined") return;
  if (!_user) return;

  // admin isento
  if (_user.email === ADMIN_ISENTO) return;

  // ---- 1. Teclas de atalho ----
  window.addEventListener("keydown", (e) => {
    // F12
    if (e.key === "F12" || e.keyCode === 123) {
      e.preventDefault();
      dispararProtecao("Tecla F12");
      return;
    }
    // Ctrl+Shift+I (Inspecionar)
    if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.keyCode === 73)) {
      e.preventDefault();
      dispararProtecao("Ctrl+Shift+I");
      return;
    }
    // Ctrl+Shift+J (Console)
    if (e.ctrlKey && e.shiftKey && (e.key === "J" || e.key === "j" || e.keyCode === 74)) {
      e.preventDefault();
      dispararProtecao("Ctrl+Shift+J");
      return;
    }
    // Ctrl+Shift+C (Seletor de elemento)
    if (e.ctrlKey && e.shiftKey && (e.key === "C" || e.key === "c" || e.keyCode === 67)) {
      e.preventDefault();
      dispararProtecao("Ctrl+Shift+C");
      return;
    }
    // Ctrl+U (ver código-fonte)
    if (e.ctrlKey && (e.key === "U" || e.key === "u" || e.keyCode === 85)) {
      e.preventDefault();
      dispararProtecao("Ctrl+U");
      return;
    }
  }, true); // capture phase para pegar antes de tudo

  // ---- 2. Clique direito (menu de contexto) ----
  window.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    // não bloqueia por clique direito (seria agressivo demais)
    // mas impede o menu de contexto
  });

  // ---- 3. Detecção por tamanho da janela (DevTools aberto muda as dimensões) ----
  let verificacoes = 0;
  const intervalo = setInterval(() => {
    const limiar = 160;
    const larguraDevTools = window.outerWidth - window.innerWidth > limiar;
    const alturaDevTools = window.outerHeight - window.innerHeight > limiar;

    if (larguraDevTools || alturaDevTools) {
      verificacoes++;
      // precisa de 3 verificações seguidas para não dar falso positivo
      if (verificacoes >= 3) {
        clearInterval(intervalo);
        dispararProtecao("DevTools detectado (dimensão da janela)");
      }
    } else {
      verificacoes = 0;
    }
  }, 1000);

  // limpar intervalo se sair da página
  window.addEventListener("beforeunload", () => clearInterval(intervalo));
}

/** Verifica se o IP está banido (chamar ANTES do login). */
export async function verificarIPBanido() {
  try {
    const ip = await getIP();
    if (!ip) return { banido: false };

    const { data } = await supabase
      .from("ips_banidos")
      .select("ip, motivo, usuario_nome, criado_em")
      .eq("ip", ip)
      .maybeSingle();

    if (data) {
      return { banido: true, ip, motivo: data.motivo, desde: data.criado_em };
    }
    return { banido: false, ip };
  } catch {
    return { banido: false };
  }
}
