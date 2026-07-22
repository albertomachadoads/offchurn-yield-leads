// Cálculo das taxas do Painel a partir dos números brutos.
// Regras: Qualificação = qualificados/captados
//         Fechamento   = fechados/qualificados
//         Conversão    = fechados/captados

export function calcTaxas({ captados = 0, qualificados = 0, fechados = 0 } = {}) {
  const c = Number(captados) || 0;
  const q = Number(qualificados) || 0;
  const f = Number(fechados) || 0;
  const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : null);
  return {
    qualificacao: pct(q, c), // % de qualificação
    fechamento: pct(f, q),   // % de fechamento
    conversao: pct(f, c),    // % de conversão total
  };
}

// Cor de uma taxa (0-100) numa escala vermelho -> amarelo -> verde.
// Usada na barra do Acompanhamento e nos indicadores do Painel.
export function corTaxa(pct) {
  if (pct == null) return "var(--ink-faint)";
  if (pct >= 70) return "var(--green)";
  if (pct >= 40) return "var(--amber)";
  return "var(--red)";
}

// Classe CSS correspondente (para estilos que preferem classe a variável)
export function classeTaxa(pct) {
  if (pct == null) return "taxa-sem";
  if (pct >= 70) return "taxa-boa";
  if (pct >= 40) return "taxa-media";
  return "taxa-baixa";
}
