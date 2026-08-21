/* ============================================================
   Lista central de módulos do sistema.
   Para adicionar um módulo novo, basta adicionar uma linha aqui.
   O Admin (permissões) e a Sidebar usam esta mesma lista.
   ============================================================ */

import { MODULOS_ATIVOS } from "./config.js";

const TODOS = [
  // PRINCIPAIS
  { id: "dashboard", nome: "Dashboard", grupo: "Principais" },
  { id: "relatorios", nome: "Relatórios", grupo: "Principais" },
  { id: "acompanhamento", nome: "Acompanhamento", grupo: "Principais" },
  { id: "follow", nome: "Tarefas", grupo: "Principais" },
  { id: "clientes", nome: "Clientes", grupo: "Principais" },

  // COMERCIAL
  { id: "whatsapp", nome: "Conversas", grupo: "Comercial" },
  { id: "crm", nome: "CRM", grupo: "Comercial" },
  { id: "metas", nome: "Painel de Metas", grupo: "Comercial" },
  { id: "crm-analises", nome: "Análises", grupo: "Comercial" },
  { id: "crm-auto", nome: "Automações", grupo: "Comercial" },
  { id: "crm-params", nome: "Parâmetros de CRM", grupo: "Comercial" },

  // FINANCEIRO
  { id: "fluxo", nome: "Fluxo de Caixa", grupo: "Financeiro" },
  { id: "gestao", nome: "Gestão de Clientes", grupo: "Financeiro" },
  { id: "obz", nome: "OBZ", grupo: "Financeiro" },

  // LOG
  { id: "registro-tarefas", nome: "Registro de Tarefas", grupo: "Log de Tarefas" },

  // ADMIN (só admin/master vê, independente de permissões)
  { id: "cadastros", nome: "Cadastros", grupo: "Admin" },
  { id: "admin", nome: "Administradores", grupo: "Admin" },
  { id: "logs", nome: "Logs", grupo: "Admin" },
];

const MODULOS = TODOS.filter((m) => MODULOS_ATIVOS.includes(m.id));

export default MODULOS;
