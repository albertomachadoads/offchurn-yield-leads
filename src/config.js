/* ============================================================
   CONFIGURAÇÃO DO SISTEMA — OffChurn
   Único arquivo a editar ao instalar em outra empresa.
   ============================================================ */

/* ---------- Identidade ---------- */
export const NOME_SISTEMA = "OffChurn";
export const NOME_COMPLETO = "OffChurn Yield Leads";

/* ---------- Administrador principal ----------
   Acesso irrestrito. Não pode ser bloqueado nem excluído. */
export const EMAIL_MASTER = "albertomachadoads@gmail.com";

/* ---------- Unidades de negócio ---------- */
export const AGENCIAS = ["Yield", "Mads"];

/* ---------- Módulos ativos ----------
   Remova da lista para sumir do menu e das permissões. */
export const MODULOS_ATIVOS = [
  "dashboard", "acompanhamento", "follow", "clientes",
  "whatsapp", "crm", "formularios", "crm-params", "crm-auto", "crm-analises", "metas",
  "fluxo", "gestao", "obz",
  "registro-tarefas",
  "cadastros", "admin", "logs",
];

/* ---------- WhatsApp (UAZAPI) ----------
   Só o endereço. Tokens ficam no banco e nos secrets. */
export const UAZAPI_SERVER_PADRAO = "https://madsoffchurn.uazapi.com";

/* ---------- Helpers ---------- */
export const moduloAtivo = (id) => MODULOS_ATIVOS.includes(id);
export const ehMaster = (email) =>
  !!email && email.toLowerCase() === EMAIL_MASTER.toLowerCase();
