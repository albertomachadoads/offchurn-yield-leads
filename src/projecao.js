// ============================================================
// Projeção de verba e CPA — lógica do módulo Clientes
// ============================================================

/** Quantos dias tem o mês da data informada. */
export const diasNoMes = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

/** Competência "YYYY-MM" de uma data. */
export const competencia = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/**
 * Projeção de verba.
 * Compara o gasto real com o esperado até hoje (proporcional ao dia do mês).
 *
 * Ex.: verba 1000, dia 15 de um mês de 30 dias -> esperado 500.
 *
 * Retorna:
 *  - esperado: quanto deveria ter sido gasto até hoje
 *  - gasto: quanto foi gasto
 *  - desvioPct: % de desvio (positivo = gastando acima do ritmo)
 *  - status: "acima" (vermelho) | "abaixo" (atenção) | "no_ritmo" (verde)
 *  - pctVerba: quanto do total da verba já foi gasto (para a barra)
 */
export function projecaoVerba(verbaMensal, gasto, ref = new Date(), tolerancia = 10) {
  const verba = Number(verbaMensal) || 0;
  const g = Number(gasto) || 0;
  if (!verba) return null;

  const dias = diasNoMes(ref);
  const hoje = ref.getDate();
  const esperado = (verba / dias) * hoje;

  const desvioPct = esperado > 0 ? Math.round(((g - esperado) / esperado) * 100) : 0;

  let status = "no_ritmo";
  if (desvioPct > tolerancia) status = "acima";
  else if (desvioPct < -tolerancia) status = "abaixo";

  return {
    esperado,
    gasto: g,
    verba,
    desvioPct,
    status,
    pctVerba: verba > 0 ? Math.min(Math.round((g / verba) * 100), 999) : 0,
    pctEsperado: verba > 0 ? Math.round((esperado / verba) * 100) : 0,
    dia: hoje,
    dias,
  };
}

/**
 * Projeção de CPA.
 * Compara o CPA real (gasto / leads) com o CPA alvo definido no cadastro.
 *
 * Retorna:
 *  - cpaReal: gasto dividido por leads (null se não houver leads)
 *  - desvioPct: % acima/abaixo do alvo (positivo = mais caro que o alvo)
 *  - status: "acima" (vermelho, CPA caro) | "abaixo" (verde, CPA barato) | "no_ritmo"
 */
export function projecaoCPA(cpaMeta, gasto, leads, tolerancia = 10, cpaRealMeta = null) {
  const alvo = Number(cpaMeta) || 0;
  const g = Number(gasto) || 0;
  const l = Number(leads) || 0;
  if (!alvo) return null;

  // se a Meta já forneceu o custo por resultado médio, ele tem prioridade
  const cpaReal = (cpaRealMeta != null && Number(cpaRealMeta) > 0)
    ? Number(cpaRealMeta)
    : (l > 0 ? g / l : null);
  if (cpaReal == null) {
    return { cpaReal: null, alvo, desvioPct: null, status: "sem_dados", pct: 0 };
  }

  const desvioPct = Math.round(((cpaReal - alvo) / alvo) * 100);
  let status = "no_ritmo";
  if (desvioPct > tolerancia) status = "acima";      // CPA mais caro que o alvo -> ruim
  else if (desvioPct < -tolerancia) status = "abaixo"; // CPA mais barato -> bom

  return {
    cpaReal,
    alvo,
    desvioPct,
    status,
    // barra: proporção do CPA real em relação ao alvo (100% = no alvo)
    pct: Math.min(Math.round((cpaReal / alvo) * 100), 999),
  };
}

/** Cor conforme o status da VERBA (gastar demais é o pior caso). */
export function corVerba(status) {
  if (status === "acima") return "var(--red)";       // estourando
  if (status === "abaixo") return "var(--amber)";    // subutilizando (atenção)
  return "var(--green)";                              // no ritmo
}

/** Cor conforme o status do CPA (CPA caro é ruim, barato é bom). */
export function corCPA(status) {
  if (status === "acima") return "var(--red)";       // caro demais
  if (status === "abaixo") return "var(--green)";    // barato (ótimo)
  if (status === "sem_dados") return "var(--ink-faint)";
  return "var(--green)";
}

/** Tempo de casa em texto legível a partir da data de entrada. */
export function tempoDeCasa(dataEntrada, ref = new Date()) {
  if (!dataEntrada) return null;
  const s = String(dataEntrada).split("T")[0];
  const [y, m, d] = s.split("-").map(Number);
  if (!y) return null;
  const inicio = new Date(y, m - 1, d);
  if (inicio > ref) return "ainda não iniciou";

  let meses = (ref.getFullYear() - inicio.getFullYear()) * 12 + (ref.getMonth() - inicio.getMonth());
  if (ref.getDate() < inicio.getDate()) meses--;
  if (meses < 1) {
    const dias = Math.floor((ref - inicio) / 86400000);
    return `${dias} dia${dias === 1 ? "" : "s"}`;
  }
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  if (anos === 0) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  if (resto === 0) return `${anos} ano${anos === 1 ? "" : "s"}`;
  return `${anos} ano${anos === 1 ? "" : "s"} e ${resto} ${resto === 1 ? "mês" : "meses"}`;
}

/** Faixa do NPS (0 a 100). */
export function faixaNPS(nota) {
  const n = Number(nota);
  if (nota == null || Number.isNaN(n)) return { label: "—", cor: "var(--ink-faint)" };
  if (n >= 75) return { label: "Excelente", cor: "var(--green)" };
  if (n >= 50) return { label: "Bom", cor: "var(--green-deep)" };
  if (n >= 25) return { label: "Regular", cor: "var(--amber)" };
  return { label: "Crítico", cor: "var(--red)" };
}

/** Iniciais para o avatar do cliente. */
export function iniciais(nome = "") {
  const partes = String(nome).trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

/** Cor determinística do avatar a partir do nome (paleta verde). */
export function corAvatar(nome = "") {
  const paleta = ["#1f9d5a", "#137a44", "#0c5530", "#2fb36b", "#0f6b3c", "#258f52"];
  let h = 0;
  for (let i = 0; i < String(nome).length; i++) h = (h * 31 + nome.charCodeAt(i)) % 9973;
  return paleta[h % paleta.length];
}
