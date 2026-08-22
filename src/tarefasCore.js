/* ============================================================
   Fonte única de verdade para tarefas.

   A home e o módulo de Tarefas precisam contar exatamente a
   mesma coisa. Toda classificação passa por aqui — se a regra
   mudar, muda nos dois lugares ao mesmo tempo.

   A etapa gravada no banco manda. "Atrasada" é uma etapa real,
   não um cálculo de data: era essa a divergência entre a home
   e o módulo antes deste arquivo existir.
   ============================================================ */

export const ETAPAS = ["A executar", "Em andamento", "Concluída", "Atrasada", "Cancelada"];

/* Estados terminais: saem da contagem de trabalho pendente */
export const ehFechada = (t) => t.etapa === "Concluída" || t.etapa === "Cancelada";
export const ehAberta = (t) => !ehFechada(t);

/* Atraso: a etapa do banco tem prioridade. O prazo vencido só
   entra como reforço para tarefas que ninguém reclassificou. */
export const ehAtrasada = (t, hoje = hojeISO()) =>
  t.etapa === "Atrasada" || (ehAberta(t) && !!t.prazo && t.prazo < hoje);

export const ehDeHoje = (t, hoje = hojeISO()) =>
  ehAberta(t) && (t.prazo === hoje || (!t.prazo && t.data === hoje));

export const hojeISO = () => new Date().toISOString().slice(0, 10);

/* Início da semana corrente (domingo) */
export function inicioSemana(ref = new Date()) {
  const d = new Date(ref);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

/* ---------- Contagens consolidadas ---------- */
export function resumirTarefas(tarefas, { hoje = hojeISO() } = {}) {
  const lista = tarefas || [];
  const abertas = lista.filter(ehAberta);
  const atrasadas = lista.filter((t) => ehAtrasada(t, hoje));
  const deHoje = lista.filter((t) => ehDeHoje(t, hoje)).filter((t) => !ehAtrasada(t, hoje));
  const andamento = lista.filter((t) => t.etapa === "Em andamento");
  const pendentes = lista.filter((t) => t.etapa === "A executar" && !ehAtrasada(t, hoje));
  const concluidas = lista.filter((t) => t.etapa === "Concluída");
  const concluidasHoje = concluidas.filter(
    (t) => (t.dataConclusao || t.dataEntrega || "").slice(0, 10) === hoje
  );

  const ini = inicioSemana();
  const daSemana = lista.filter((t) => (t.prazo || t.data || "") >= ini);
  const concluidasSemana = daSemana.filter((t) => t.etapa === "Concluída");

  return {
    total: lista.length,
    abertas: abertas.length,
    atrasadas: atrasadas.length,
    deHoje: deHoje.length,
    andamento: andamento.length,
    pendentes: pendentes.length,
    concluidas: concluidas.length,
    concluidasHoje: concluidasHoje.length,
    concluidasSemana: concluidasSemana.length,
    daSemana: daSemana.length,
    taxaSemana: daSemana.length > 0 ? (concluidasSemana.length / daSemana.length) * 100 : null,
    // listas para quem precisa dos itens
    listaAtrasadas: atrasadas,
    listaDeHoje: deHoje,
  };
}

/* ---------- Prioridades do dia ----------
   Atrasadas primeiro, depois as de hoje; dentro de cada grupo,
   o cliente mais crítico vem antes. */
export function prioridadesDoDia(tarefas, { scorePorCliente = {}, limite = 8, hoje = hojeISO() } = {}) {
  const R = resumirTarefas(tarefas, { hoje });
  return [...R.listaAtrasadas, ...R.listaDeHoje]
    .map((t) => {
      const atrasada = ehAtrasada(t, hoje);
      const score = scorePorCliente[t.clienteId] || 0;
      return {
        ...t,
        atrasada,
        prioridade: atrasada ? "critica" : score > 50 ? "alta" : "media",
        situacao: atrasada ? "Atrasada" : t.etapa === "Em andamento" ? "Em andamento" : "Pendente hoje",
        scoreCliente: score,
      };
    })
    .sort((a, b) =>
      (b.atrasada ? 1 : 0) - (a.atrasada ? 1 : 0) ||
      b.scoreCliente - a.scoreCliente ||
      String(a.prazo || "").localeCompare(String(b.prazo || ""))
    )
    .slice(0, limite);
}

/* ---------- Churn ----------
   Reexportado do churnEngine para haver UMA fórmula no sistema.
   Antes existiam duas: esta somava os clientes que entraram no
   próprio período à base, o que diluía a taxa e divergia do
   painel financeiro (14,3% contra 22,2% no mesmo dado).

   A regra correta é a do churnEngine: a base é quem já era
   cliente no início do período. Quem entrou depois não podia
   ter saído, então não pertence ao denominador. */
/* ---------- Prioridade derivada ----------
   Não há campo de prioridade no banco. Ela vem do atraso e da
   criticidade do cliente — dado real, não inventado. */
export function prioridadeDe(t, scorePorCliente = {}, hoje = hojeISO()) {
  if (ehAtrasada(t, hoje)) return "critica";
  const score = scorePorCliente[t.clienteId] || 0;
  if (score > 70) return "critica";
  if (score > 40) return "alta";
  if (ehDeHoje(t, hoje)) return "alta";
  return "media";
}

const ORDEM_PRIO = { critica: 0, alta: 1, media: 2, baixa: 3 };

/* ---------- Recortes da Central de Tarefas ---------- */
export function recortesTarefas(tarefas, { scorePorCliente = {}, hoje = hojeISO() } = {}) {
  const lista = (tarefas || []).filter(ehAberta);

  const decorar = (t) => ({
    ...t,
    atrasada: ehAtrasada(t, hoje),
    prioridade: prioridadeDe(t, scorePorCliente, hoje),
    situacao: ehAtrasada(t, hoje) ? "Atrasada"
      : t.etapa === "Em andamento" ? "Em andamento" : "Pendente",
    quando: t.prazo || t.data || null,
  });

  const ordenar = (a, b) =>
    ORDEM_PRIO[a.prioridade] - ORDEM_PRIO[b.prioridade] ||
    String(a.quando || "9999").localeCompare(String(b.quando || "9999"));

  const atrasadas = lista.filter((t) => ehAtrasada(t, hoje)).map(decorar)
    .sort((a, b) => ORDEM_PRIO[a.prioridade] - ORDEM_PRIO[b.prioridade]
      || String(a.quando || "").localeCompare(String(b.quando || "")));

  const deHoje = lista.filter((t) => ehDeHoje(t, hoje) && !ehAtrasada(t, hoje)).map(decorar).sort(ordenar);

  const d1 = new Date(hoje); d1.setDate(d1.getDate() + 1);
  const d7 = new Date(hoje); d7.setDate(d7.getDate() + 7);
  const ini = d1.toISOString().slice(0, 10), fim = d7.toISOString().slice(0, 10);
  const futuras = lista
    .filter((t) => { const q = t.prazo || t.data; return q && q >= ini && q <= fim; })
    .map(decorar).sort(ordenar);

  const porDia = {};
  futuras.forEach((t) => { (porDia[t.quando] = porDia[t.quando] || []).push(t); });
  const dias = Object.keys(porDia).sort().map((d) => ({ data: d, tarefas: porDia[d] }));

  return { atrasadas, deHoje, futuras, dias };
}

/* ---------- Churn ----------
   Reexportado do churnEngine para haver UMA fórmula no sistema.
   Antes existia aqui um calcularChurn que somava à base os
   clientes entrados no próprio período, diluindo a taxa e
   divergindo do painel financeiro (14,3% contra 22,2%).

   A regra correta é a do churnEngine: a base é quem já era
   cliente no início do período — quem entrou depois não podia
   ter saído, logo não pertence ao denominador. */
export { churnHistorico, churnReceita } from "./churnEngine.js";
