/* ============================================================
   CONFIGURAÇÃO DO SISTEMA
   Este é o único arquivo que precisa ser editado ao instalar
   o sistema em uma nova empresa.
   ============================================================ */

/* ---------- Identidade ---------- */
export const NOME_SISTEMA = "OffChurn";
export const NOME_COMPLETO = "OffChurn — Gestão Comercial";

/* ---------- Administrador principal ----------
   Este e-mail tem acesso irrestrito a todos os módulos e não
   pode ser bloqueado nem excluído pela interface.
   Troque pelo e-mail do responsável na sua empresa.          */
export const EMAIL_MASTER = "admin@suaempresa.com.br";

/* ---------- Unidades de negócio ----------
   O sistema permite separar clientes e dados por unidade
   (filial, marca, equipe...). Deixe apenas uma se não usar.  */
export const AGENCIAS = ["Principal"];

/* ---------- Módulos ativos ----------
   Remova da lista os módulos que a empresa não vai utilizar.
   Eles somem do menu e das telas de permissão.

   Disponíveis:
     dashboard, acompanhamento, follow, clientes,
     whatsapp, crm, crm-params, crm-auto, crm-analises, metas,
     fluxo, gestao, obz,
     registro-tarefas,
     cadastros, admin, logs                                    */
export const MODULOS_ATIVOS = [
  "dashboard", "acompanhamento", "follow", "clientes",
  "whatsapp", "crm", "crm-params", "crm-auto", "crm-analises", "metas",
  "registro-tarefas",
  "cadastros", "admin", "logs",
  // Financeiro desativado nesta instalação:
  // "fluxo", "gestao", "obz",
];

/* ---------- WhatsApp (UAZAPI) ----------
   Endereço do servidor contratado. As credenciais NÃO ficam
   aqui: o token de cada instância é salvo no banco e o token
   de administrador vai nos secrets das Edge Functions.       */
export const UAZAPI_SERVER_PADRAO = "https://seu-servidor.uazapi.com";

/* ---------- Helpers ---------- */
export const moduloAtivo = (id) => MODULOS_ATIVOS.includes(id);
export const ehMaster = (email) =>
  !!email && email.toLowerCase() === EMAIL_MASTER.toLowerCase();
