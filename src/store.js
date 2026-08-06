/* ============================================================
   Constantes compartilhadas da aplicação.
   Não contém dados: tudo vem do Supabase.
   ============================================================ */

const CRITICIDADES = ["Normal", "Baixo", "Alto", "Crítico"];
const TIPOS_META = ["Faturamento", "Leads"];
const ADERENCIAS = ["Ok", "Atenção", "Abaixo", "Sem dados"];

/* Etapas (status) de cada tarefa no Follow de Ações.
   A ordem define como aparecem nos gráficos. */
const ETAPAS = [
  { key: "A executar", cor: "var(--ink-faint)" },
  { key: "Em andamento", cor: "var(--green)" },
  { key: "Concluída", cor: "var(--green-dark)" },
  { key: "Atrasada", cor: "var(--red)" },
  { key: "Cancelada", cor: "var(--amber)" },
];
const ETAPA_KEYS = ETAPAS.map((e) => e.key);

const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export { CRITICIDADES, TIPOS_META, ADERENCIAS, ETAPAS, ETAPA_KEYS, uid };
