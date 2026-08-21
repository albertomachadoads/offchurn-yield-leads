/* ============================================================
   Motor de diagnóstico do Painel de Tráfego.

   Separado do componente por dois motivos: pode ser testado
   isoladamente e reaproveitado por uma rotina agendada que
   gere os insights do dia sem depender da tela aberta.

   Princípio: nenhum insight é inventado para preencher espaço.
   Sem evidência suficiente, devolvemos "conta saudável" ou
   "ponto de monitoramento" com a confiança rebaixada.
   ============================================================ */

/* ---------- Pacing: quanto do período já passou ---------- */
export function pacingPeriodo(ref = new Date()) {
  const ano = ref.getFullYear(), mes = ref.getMonth();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const diaAtual = ref.getDate();
  return {
    diasNoMes,
    diaAtual,
    diasRestantes: diasNoMes - diaAtual,
    pctTranscorrido: (diaAtual / diasNoMes) * 100,
  };
}

/* ---------- Classificação do desvio de verba ---------- */
export function classificarPacing(pctConsumido, pctEsperado) {
  if (pctEsperado <= 0) return { id: "sem_dados", rot: "Sem referência", tom: "neutro", desvio: null };
  const desvio = pctConsumido - pctEsperado;
  const rel = (desvio / pctEsperado) * 100;
  if (Math.abs(rel) <= 10) return { id: "ok", rot: "Dentro do ritmo", tom: "ok", desvio: rel };
  if (Math.abs(rel) <= 20) return { id: "atencao", rot: "Atenção", tom: "avi", desvio: rel };
  return { id: "critico", rot: "Crítico", tom: "err", desvio: rel };
}

/* ---------- Score de criticidade (0 a 100) ----------
   40% desvio de CPL · 25% desvio de verba
   20% queda de volume · 15% problemas técnicos          */
export function scoreCriticidade(c) {
  const parcelas = [];

  // 1. CPL contra a meta do próprio cliente
  let sCpl = 0;
  if (c.cpaMeta > 0 && c.cpaReal > 0) {
    const excesso = ((c.cpaReal - c.cpaMeta) / c.cpaMeta) * 100;
    // 50% de excesso já satura: acima disso a conta está claramente fora da meta
    sCpl = Math.max(0, Math.min((excesso / 50) * 100, 100));
    if (excesso > 0) parcelas.push(`CPL ${excesso.toFixed(0)}% acima da meta`);
  }

  // 2. Desvio de verba
  let sVerba = 0;
  if (c.pacing?.desvio != null) {
    // 30% de desvio satura
    sVerba = Math.min((Math.abs(c.pacing.desvio) / 30) * 100, 100);
    if (Math.abs(c.pacing.desvio) > 15) {
      parcelas.push(`verba ${c.pacing.desvio > 0 ? "adiantada" : "atrasada"} ${Math.abs(c.pacing.desvio).toFixed(0)}%`);
    }
  }

  // 3. Queda de volume contra o período anterior
  let sVolume = 0;
  if (c.leadsAnterior > 0 && c.leads != null) {
    const queda = ((c.leadsAnterior - c.leads) / c.leadsAnterior) * 100;
    if (queda > 0) {
      // queda de 50% satura
      sVolume = Math.min((queda / 50) * 100, 100);
      if (queda > 20) parcelas.push(`volume caiu ${queda.toFixed(0)}%`);
    }
  }

  // 4. Problemas técnicos
  const sTecnico = Math.min((c.problemas?.length || 0) * 50, 100);
  if (c.problemas?.length) parcelas.push(`${c.problemas.length} alerta técnico`);

  let score = Math.round(sCpl * 0.40 + sVerba * 0.25 + sVolume * 0.20 + sTecnico * 0.15);

  /* Conta com verba contratada e zero investimento é o pior cenário:
     não há o que otimizar, a entrega simplesmente parou. */
  if (c.temConta && c.verba > 0 && c.gasto === 0) {
    score = Math.max(score, 85);
    if (!parcelas.some((x) => x.includes("sem investimento"))) parcelas.unshift("sem investimento no mês");
  }

  const faixa =
    score <= 30 ? { id: "saudavel", rot: "Saudável", tom: "ok" } :
    score <= 50 ? { id: "atencao", rot: "Atenção", tom: "avi" } :
    score <= 70 ? { id: "risco", rot: "Risco", tom: "laranja" } :
                  { id: "critico", rot: "Crítico", tom: "err" };

  return { score, faixa, motivos: parcelas };
}

/* ---------- Confiança estatística ----------
   Poucos dados não sustentam conclusão forte. */
export function confianca(leads, dias = 30) {
  if (leads >= 30 && dias >= 7) return { id: "alta", rot: "Alta confiança" };
  if (leads >= 10) return { id: "media", rot: "Média confiança" };
  return { id: "baixa", rot: "Baixa confiança" };
}

/* ---------- Geração de insights ----------
   Cada insight responde: o que houve, onde, qual evidência,
   o que fazer e qual o impacto esperado.                  */
export function gerarInsights(c) {
  const out = [];
  const conf = confianca(c.leads);
  const base = { clienteId: c.id, cliente: c.nome, plataforma: c.plataformaPrincipal || "Meta Ads", confianca: conf };

  // ── CPL acima da meta ──
  if (c.cpaMeta > 0 && c.cpaReal > 0 && c.cpaReal > c.cpaMeta * 1.15) {
    const excesso = ((c.cpaReal - c.cpaMeta) / c.cpaMeta) * 100;
    const leadsPerdidos = c.gasto > 0 ? Math.floor(c.gasto / c.cpaMeta) - c.leads : 0;
    out.push({
      ...base,
      prioridade: excesso > 50 ? "critico" : excesso > 25 ? "alto" : "medio",
      titulo: `CPL ${excesso.toFixed(0)}% acima da meta`,
      evidencia: `O custo por lead está em ${moeda(c.cpaReal)} contra a meta de ${moeda(c.cpaMeta)}. ` +
        `Com ${c.leads} leads e ${moeda(c.gasto)} investidos no período` +
        (leadsPerdidos > 0 ? `, o mesmo valor no CPL-meta teria gerado cerca de ${leadsPerdidos} leads a mais.` : "."),
      recomendacao: "Revisar a distribuição de verba entre conjuntos e pausar os de maior CPL. " +
        "Verificar se os criativos com melhor desempenho estão recebendo orçamento proporcional.",
      impacto: `Aproximar o CPL da meta de ${moeda(c.cpaMeta)}.`,
      tipo: "cpl_alto",
    });
  }

  // ── Verba fora do ritmo ──
  if (c.pacing && c.pacing.id !== "ok" && c.pacing.id !== "sem_dados") {
    const adiantado = c.pacing.desvio > 0;
    out.push({
      ...base,
      prioridade: c.pacing.id === "critico" ? "alto" : "medio",
      titulo: adiantado
        ? `Verba adiantada ${Math.abs(c.pacing.desvio).toFixed(0)}% em relação ao ritmo`
        : `Verba atrasada ${Math.abs(c.pacing.desvio).toFixed(0)}% em relação ao ritmo`,
      evidencia: `Foram investidos ${moeda(c.gasto)} de ${moeda(c.verba)} (${pct(c.pctConsumido)}), ` +
        `enquanto ${pct(c.pctEsperado)} do mês já transcorreu. ` +
        `No ritmo atual, a projeção para o fechamento é de ${moeda(c.projecao)}.`,
      recomendacao: adiantado
        ? "Reduzir os orçamentos diários para não esgotar a verba antes do fim do mês."
        : `Aumentar os orçamentos diários. Restam ${c.diasRestantes} dias e ${moeda(Math.max(c.verba - c.gasto, 0))} a investir.`,
      impacto: adiantado
        ? "Manter entrega até o fim do mês."
        : "Utilizar a verba contratada por completo.",
      tipo: "pacing",
    });
  }

  // ── Queda de volume ──
  if (c.leadsAnterior >= 10 && c.leads < c.leadsAnterior * 0.75) {
    const queda = ((c.leadsAnterior - c.leads) / c.leadsAnterior) * 100;
    out.push({
      ...base,
      prioridade: queda > 40 ? "alto" : "medio",
      titulo: `Volume de leads caiu ${queda.toFixed(0)}%`,
      evidencia: `Foram ${c.leads} leads no período contra ${c.leadsAnterior} no período anterior, ` +
        `com investimento de ${moeda(c.gasto)}.`,
      recomendacao: "Verificar se houve pausa de campanha, esgotamento de público ou queda na aprovação de anúncios. " +
        "Comparar a frequência atual com a do período anterior.",
      impacto: "Recuperar o volume de captação.",
      tipo: "queda_volume",
    });
  }

  // ── Conta sem entrega ──
  if (c.temConta && c.gasto === 0 && c.verba > 0) {
    out.push({
      ...base,
      prioridade: "critico",
      titulo: "Conta sem investimento no período",
      evidencia: `Nenhum valor investido, apesar de haver ${moeda(c.verba)} de verba contratada para o mês.`,
      recomendacao: "Verificar se as campanhas estão ativas, se há saldo no meio de pagamento " +
        "e se a conta não está com restrição.",
      impacto: "Retomar a entrega e evitar a perda da verba do mês.",
      tipo: "sem_entrega",
      confianca: { id: "alta", rot: "Alta confiança" },
    });
  }

  // ── Nada crítico: monitoramento honesto ──
  if (out.length === 0) {
    const pontos = [];
    if (c.cpaMeta > 0 && c.cpaReal > 0 && c.cpaReal > c.cpaMeta)
      pontos.push(`o CPL está ${pct(((c.cpaReal - c.cpaMeta) / c.cpaMeta) * 100)} acima da meta, ainda dentro da tolerância`);
    if (c.pacing?.desvio != null && Math.abs(c.pacing.desvio) > 5)
      pontos.push(`a verba está ${Math.abs(c.pacing.desvio).toFixed(0)}% ${c.pacing.desvio > 0 ? "adiantada" : "atrasada"}`);
    if (c.leads > 0 && c.leadsAnterior > 0 && c.leads < c.leadsAnterior)
      pontos.push("o volume ficou levemente abaixo do período anterior");

    out.push({
      ...base,
      prioridade: "baixo",
      tipo: pontos.length ? "monitoramento" : "saudavel",
      titulo: pontos.length ? "Ponto de monitoramento" : "Conta saudável",
      evidencia: pontos.length
        ? `Nenhum desvio crítico identificado. Observação: ${pontos.join("; ")}.`
        : `Nenhum desvio identificado. ${c.leads} leads a ${moeda(c.cpaReal)} com ${moeda(c.gasto)} investidos.`,
      recomendacao: pontos.length
        ? "Acompanhar nos próximos dias antes de intervir."
        : "Manter a configuração atual.",
      impacto: null,
    });
  }

  return out;
}

/* ---------- Problemas técnicos ---------- */
export function detectarProblemas(c, agora = new Date()) {
  const p = [];

  if (!c.temConta) {
    p.push({ nivel: "aviso", titulo: "Sem conta de anúncios vinculada",
      detalhe: "Este cliente não traz dados de plataforma. Vincule a conta na ficha do cliente." });
  }

  if (c.atualizadoEm) {
    const horas = (agora - new Date(c.atualizadoEm)) / 3600000;
    if (horas > 24) {
      p.push({ nivel: horas > 48 ? "critico" : "aviso",
        titulo: `Dados desatualizados há ${Math.floor(horas)}h`,
        detalhe: "A última sincronização com a plataforma está antiga. Rode a sincronização." });
    }
  } else if (c.temConta) {
    p.push({ nivel: "aviso", titulo: "Nunca sincronizado",
      detalhe: "A conta está vinculada mas ainda não trouxe dados." });
  }

  if (c.temConta && c.gasto === 0 && c.verba > 0) {
    p.push({ nivel: "critico", titulo: "Nenhum investimento no mês",
      detalhe: `Há ${moeda(c.verba)} de verba contratada e nenhum valor gasto.` });
  }

  // Divergência entre a plataforma e o CRM
  if (c.leads > 0 && c.leadsCrm != null && c.leadsCrm < c.leads * 0.6) {
    const dif = ((c.leads - c.leadsCrm) / c.leads) * 100;
    p.push({ nivel: "critico", titulo: "Divergência entre plataforma e CRM",
      detalhe: `A plataforma registra ${c.leads} conversões, mas o CRM tem ${c.leadsCrm} leads. Diferença de ${dif.toFixed(0)}%.` });
  }

  return p;
}

/* ---------- Formatação ---------- */
const moeda = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const pct = (v) => (v == null ? "—" : `${Number(v).toFixed(1)}%`);
export { moeda as fmtMoedaT, pct as fmtPctT };
