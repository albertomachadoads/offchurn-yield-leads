/* ============================================================
   Churn e risco de cliente para o Fluxo de Caixa.

   A projeção padrão assume que todo cliente ativo paga para
   sempre. Aqui o histórico real corrige essa suposição: quem
   atrasa, quem tem NPS baixo e quem entrou há pouco tempo
   pesam contra a receita projetada.
   ============================================================ */

const diasEntre = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const compDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/* ---------- Histórico de pagamento de um cliente ---------- */
export function historicoPagamento(clienteId, recebiveis, { meses = 6 } = {}) {
  const hoje = new Date();
  const limite = new Date(hoje.getFullYear(), hoje.getMonth() - meses, 1);

  const doCliente = (recebiveis || [])
    .filter((r) => r.clienteId === clienteId)
    .filter((r) => {
      const [a, m] = (r.competencia || "").split("-").map(Number);
      return a && new Date(a, m - 1, 1) >= limite;
    });

  const vencidos = doCliente.filter((r) => {
    const [a, m] = (r.competencia || "").split("-").map(Number);
    return a && new Date(a, m - 1, 1) < new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  });

  const pagos = vencidos.filter((r) => r.pago);
  const emAberto = vencidos.filter((r) => !r.pago);

  // Atraso médio de quem pagou, em dias após o vencimento
  let somaAtraso = 0, comData = 0;
  pagos.forEach((r) => {
    if (!r.dataPagamento) return;
    const [a, m] = r.competencia.split("-").map(Number);
    const venc = new Date(a, m - 1, 10);   // vencimento padrão: dia 10
    const d = diasEntre(venc, r.dataPagamento);
    if (d > -60 && d < 180) { somaAtraso += Math.max(d, 0); comData++; }
  });

  return {
    faturas: vencidos.length,
    pagas: pagos.length,
    emAberto: emAberto.length,
    valorEmAberto: emAberto.reduce((s, r) => s + (Number(r.valor) || 0), 0),
    taxaPagamento: vencidos.length > 0 ? (pagos.length / vencidos.length) * 100 : null,
    atrasoMedio: comData > 0 ? somaAtraso / comData : null,
  };
}

/* ---------- Score de risco (0 a 100) ----------
   35% inadimplência · 25% atraso médio
   20% NPS · 20% tempo de casa                        */
export function scoreRisco(cliente, recebiveis, { desempenho } = {}) {
  const h = historicoPagamento(cliente.id, recebiveis);
  const motivos = [];

  // 1. Faturas em aberto
  let sInad = 0;
  if (h.faturas > 0) {
    const pct = (h.emAberto / h.faturas) * 100;
    sInad = Math.min((pct / 30) * 100, 100);   // 30% de inadimplência satura
    if (h.emAberto > 0) motivos.push(`${h.emAberto} fatura${h.emAberto > 1 ? "s" : ""} em aberto`);
  }

  // 2. Atraso médio
  let sAtraso = 0;
  if (h.atrasoMedio != null) {
    sAtraso = Math.min((h.atrasoMedio / 20) * 100, 100);   // 20 dias satura
    if (h.atrasoMedio > 5) motivos.push(`paga com ${Math.round(h.atrasoMedio)} dias de atraso, em média`);
  }

  // 3. NPS
  let sNps = 0;
  if (cliente.nps != null && cliente.nps !== "") {
    const nps = Number(cliente.nps);
    if (nps <= 6) { sNps = 100; motivos.push(`NPS ${nps} (detrator)`); }
    else if (nps <= 8) { sNps = 45; motivos.push(`NPS ${nps} (neutro)`); }
    else sNps = 0;
  } else {
    sNps = 30;                              // sem NPS é incerteza, não segurança
    motivos.push("sem NPS registrado");
  }

  // 4. Tempo de casa: os primeiros meses concentram a saída
  let sTempo = 0;
  if (cliente.dataEntrada) {
    const meses = diasEntre(cliente.dataEntrada, new Date()) / 30;
    if (meses < 3) { sTempo = 100; motivos.push(`${Math.max(Math.round(meses), 1)} ${Math.round(meses) === 1 ? "mês" : "meses"} de casa`); }
    else if (meses < 6) sTempo = 55;
    else if (meses < 12) sTempo = 25;
    else sTempo = 0;
  }

  // 5. Reforço: conta sem entrega recente é sinal de relação esfriando
  if (desempenho && desempenho.gasto === 0 && cliente.verbaMensal > 0) {
    motivos.push("sem investimento no mês");
  }

  let score = Math.round(sInad * 0.35 + sAtraso * 0.25 + sNps * 0.20 + sTempo * 0.20);

  // Saída já prevista é risco máximo, não cálculo
  if (cliente.dataSaidaPrevista) {
    const dias = diasEntre(new Date(), cliente.dataSaidaPrevista);
    if (dias >= 0 && dias <= 120) {
      score = Math.max(score, 90);
      motivos.unshift(`saída prevista em ${dias} dias`);
    }
  }

  const faixa =
    score <= 25 ? { id: "seguro", rot: "Seguro", tom: "ok", probSaida: 0.02 } :
    score <= 45 ? { id: "estavel", rot: "Estável", tom: "info", probSaida: 0.05 } :
    score <= 65 ? { id: "atencao", rot: "Atenção", tom: "avi", probSaida: 0.15 } :
    score <= 80 ? { id: "risco", rot: "Em risco", tom: "laranja", probSaida: 0.30 } :
                  { id: "critico", rot: "Crítico", tom: "err", probSaida: 0.55 };

  return { score, faixa, motivos, historico: h };
}

/* ---------- Churn histórico da carteira ---------- */
export function churnHistorico(clientes, { meses = 6 } = {}) {
  const hoje = new Date();
  const serie = [];

  for (let i = meses - 1; i >= 0; i--) {
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const comp = compDe(ref);
    const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);

    // ativos no início do mês: entraram antes e não saíram antes
    const ativosInicio = (clientes || []).filter((c) => {
      if (c.dataEntrada && new Date(c.dataEntrada) > ref) return false;
      const saida = c.inativadoEm || c.dataSaida;
      if (saida && new Date(saida) < ref) return false;
      return true;
    }).length;

    const perdidos = (clientes || []).filter((c) => {
      const saida = c.inativadoEm || c.dataSaida;
      if (!saida) return false;
      const d = new Date(saida);
      return d >= ref && d <= fim;
    }).length;

    serie.push({
      competencia: comp,
      ativosInicio,
      perdidos,
      taxa: ativosInicio > 0 ? (perdidos / ativosInicio) * 100 : 0,
    });
  }

  const comBase = serie.filter((s) => s.ativosInicio > 0);
  const taxaMedia = comBase.length > 0
    ? comBase.reduce((a, s) => a + s.taxa, 0) / comBase.length
    : 0;

  return {
    serie,
    taxaMedia,
    perdidosTotal: serie.reduce((a, s) => a + s.perdidos, 0),
    // Sem histórico suficiente, não inventamos taxa: usamos um piso conservador
    confiavel: comBase.length >= 3 && serie.some((s) => s.perdidos > 0),
  };
}

/* ---------- Projeção ajustada pelo churn ----------
   Cada mês à frente aplica a probabilidade de saída acumulada.
   Um cliente crítico não desaparece de vez: ele reduz o valor
   esperado mês a mês, que é como o risco se comporta.        */
export function projetarComChurn(clientes, recebiveis, { meses = 6, taxaChurn = null, desempPorCliente = {} } = {}) {
  const hoje = new Date();
  const linhas = [];

  const ativos = (clientes || []).filter((c) => c.ativo);
  const riscos = {};
  ativos.forEach((c) => { riscos[c.id] = scoreRisco(c, recebiveis, { desempenho: desempPorCliente[c.id] }); });

  for (let i = 0; i < meses; i++) {
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const comp = compDe(ref);

    let bruto = 0, ajustado = 0;
    const emRisco = [];

    ativos.forEach((c) => {
      const ticket = Number(c.ticket) || 0;
      if (ticket <= 0) return;
      bruto += ticket;

      // Probabilidade de permanecer até o mês i
      const p = riscos[c.id].faixa.probSaida;
      const sobrevive = Math.pow(1 - p, i);
      const esperado = ticket * sobrevive;
      ajustado += esperado;

      if (i === 0 && riscos[c.id].score > 45) {
        emRisco.push({ cliente: c, ticket, risco: riscos[c.id] });
      }
    });

    linhas.push({
      competencia: comp,
      mes: ref.getMonth(),
      ano: ref.getFullYear(),
      bruto,
      ajustado,
      perda: bruto - ajustado,
      pctPerda: bruto > 0 ? ((bruto - ajustado) / bruto) * 100 : 0,
      emRisco: i === 0 ? emRisco.sort((a, b) => b.risco.score - a.risco.score) : [],
    });
  }

  return {
    linhas,
    riscos,
    totalBruto: linhas.reduce((a, l) => a + l.bruto, 0),
    totalAjustado: linhas.reduce((a, l) => a + l.ajustado, 0),
  };
}

/* ============================================================
   Métricas financeiras da carteira
   ============================================================ */

/* Receita recorrente ativa, ticket médio e concentração */
export function metricasCarteira(clientes) {
  const ativos = (clientes || []).filter((c) => c.ativo);
  const comTicket = ativos.filter((c) => Number(c.ticket) > 0);
  const receita = comTicket.reduce((a, c) => a + Number(c.ticket), 0);
  const ticketMedio = comTicket.length > 0 ? receita / comTicket.length : 0;

  const ranking = comTicket
    .map((c) => ({
      cliente: c,
      ticket: Number(c.ticket),
      participacao: receita > 0 ? (Number(c.ticket) / receita) * 100 : 0,
    }))
    .sort((a, b) => b.ticket - a.ticket);

  const top5 = ranking.slice(0, 5).reduce((a, x) => a + x.participacao, 0);

  return {
    ativos: ativos.length,
    comTicket: comTicket.length,
    semTicket: ativos.length - comTicket.length,
    receita,
    ticketMedio,
    ranking,
    concentracaoTop5: top5,
    maiorCliente: ranking[0] || null,
    /* Acima de 50% em cinco clientes, a saída de um deles já
       compromete o mês — vale sinalizar. */
    concentracaoAlta: top5 > 50,
  };
}

/* Churn de receita: quanto de faturamento saiu, não quantos clientes */
export function churnReceita(clientes, { meses = 6 } = {}) {
  const hoje = new Date();
  const serie = [];

  for (let i = meses - 1; i >= 0; i--) {
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);

    const baseInicio = (clientes || [])
      .filter((c) => {
        if (c.dataEntrada && new Date(c.dataEntrada) > ref) return false;
        const s = c.inativadoEm || c.dataSaida;
        if (s && new Date(s) < ref) return false;
        return true;
      })
      .reduce((a, c) => a + (Number(c.ticket) || 0), 0);

    const perdida = (clientes || [])
      .filter((c) => {
        const s = c.inativadoEm || c.dataSaida;
        if (!s) return false;
        const d = new Date(s);
        return d >= ref && d <= fim;
      })
      .reduce((a, c) => a + (Number(c.ticket) || 0), 0);

    serie.push({
      competencia: `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`,
      mes: ref.getMonth(),
      baseInicio,
      perdida,
      taxa: baseInicio > 0 ? (perdida / baseInicio) * 100 : 0,
    });
  }

  const comBase = serie.filter((s) => s.baseInicio > 0);
  return {
    serie,
    taxaMedia: comBase.length > 0 ? comBase.reduce((a, s) => a + s.taxa, 0) / comBase.length : 0,
    perdidaTotal: serie.reduce((a, s) => a + s.perdida, 0),
    confiavel: comBase.length >= 3,
  };
}

/* LTV: ticket médio dividido pelo churn mensal.
   Sem churn medido, o cálculo é indefinido — e dizer isso é mais
   honesto que devolver um número inventado. */
export function calcularLTV(ticketMedio, taxaChurnMensal, { confiavel = true } = {}) {
  if (!confiavel) {
    return { valor: null, meses: null, motivo: "Histórico insuficiente para cálculo confiável do LTV" };
  }
  if (!taxaChurnMensal || taxaChurnMensal <= 0) {
    return { valor: null, meses: null, motivo: "Nenhuma saída registrada no período — sem base para estimar o LTV" };
  }
  const meses = 100 / taxaChurnMensal;          // vida média em meses
  return {
    valor: ticketMedio * meses,
    meses,
    motivo: null,
  };
}

/* Projeção anual: 12 meses, bruta e ajustada, com dois modos */
export function projecaoAnual(clientes, recebiveis, {
  modo = "avancado", taxaChurn = null, desempPorCliente = {},
} = {}) {
  const hoje = new Date();
  const M = metricasCarteira(clientes);
  const ativos = (clientes || []).filter((c) => c.ativo && Number(c.ticket) > 0);

  const riscos = {};
  ativos.forEach((c) => { riscos[c.id] = scoreRisco(c, recebiveis, { desempenho: desempPorCliente[c.id] }); });

  const linhas = [];
  for (let i = 0; i < 12; i++) {
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    let bruto = 0, ajustado = 0;

    if (modo === "simples") {
      // Churn médio aplicado sobre a carteira inteira
      const t = (taxaChurn || 0) / 100;
      bruto = M.receita;
      ajustado = M.receita * Math.pow(1 - t, i);
    } else {
      // Probabilidade individual de saída
      ativos.forEach((c) => {
        const ticket = Number(c.ticket);
        bruto += ticket;
        ajustado += ticket * Math.pow(1 - riscos[c.id].faixa.probSaida, i);
      });
    }

    linhas.push({
      competencia: `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`,
      mes: ref.getMonth(),
      ano: ref.getFullYear(),
      bruto, ajustado,
      perda: bruto - ajustado,
      pctPerda: bruto > 0 ? ((bruto - ajustado) / bruto) * 100 : 0,
    });
  }

  const totalBruto = linhas.reduce((a, l) => a + l.bruto, 0);
  const totalAjustado = linhas.reduce((a, l) => a + l.ajustado, 0);

  return {
    linhas, riscos, modo,
    totalBruto, totalAjustado,
    perdaTotal: totalBruto - totalAjustado,
    pctPerdaTotal: totalBruto > 0 ? ((totalBruto - totalAjustado) / totalBruto) * 100 : 0,
  };
}
