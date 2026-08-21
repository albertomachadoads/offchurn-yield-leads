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
   Um cliente conta como perdido quando é inativado no cadastro.
   Sem data de inativação registrada, o cliente entra no período
   corrente — assumir o contrário esconderia perdas reais. */
export function calcularChurn(clientes, { de, ate, metaAceitavel = 5 } = {}) {
  const lista = clientes || [];
  const ativos = lista.filter((c) => c.ativo);
  const inativos = lista.filter((c) => !c.ativo);

  const noPeriodo = inativos.filter((c) => {
    const ref = (c.inativadoEm || c.atualizadoEm || "").slice(0, 10);
    if (!ref) return true;
    if (de && ref < de) return false;
    if (ate && ref > ate) return false;
    return true;
  });

  const baseInicial = ativos.length + noPeriodo.length;
  const taxa = baseInicial > 0 ? (noPeriodo.length / baseInicial) * 100 : 0;

  return {
    perdidos: noPeriodo.length,
    ativos: ativos.length,
    taxa,
    metaAceitavel,
    acimaDaMeta: taxa > metaAceitavel,
    clientes: noPeriodo,
  };
}
