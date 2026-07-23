// ============================================================
// Fluxo de Caixa — geração do calendário de recebíveis e projeções
// ============================================================
// O calendário NÃO é armazenado: ele é derivado dos clientes.
// A tabela "recebiveis" guarda apenas o que foi marcado como pago.

// "YYYY-MM" de uma data
export const compDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// converte "YYYY-MM-DD" (ou com hora) em Date local, sem fuso bagunçar
export function paraData(iso) {
  if (!iso) return null;
  const s = String(iso).split("T")[0];
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// último dia do mês (para clientes que pagam dia 31 em meses curtos)
const ultimoDia = (ano, mes) => new Date(ano, mes + 1, 0).getDate();

/**
 * Gera as ocorrências de recebimento de UM cliente dentro de um intervalo.
 * - Mensal: uma ocorrência por mês, no dia escolhido (limitado ao fim do mês).
 * - Pagamento único: uma única ocorrência, na data de entrada.
 * Respeita data de entrada e data prevista de saída, quando informadas.
 */
export function ocorrenciasCliente(cliente, inicio, fim) {
  const out = [];
  const ticket = Number(cliente.ticket) || 0;
  if (!ticket) return out;

  const entrada = paraData(cliente.dataEntrada);
  const saida = paraData(cliente.dataSaidaPrevista);

  if ((cliente.recorrencia || "Mensal") === "Único") {
    const dia = entrada || inicio;
    if (dia >= inicio && dia <= fim) {
      out.push({ clienteId: cliente.id, data: dia, competencia: compDe(dia), valor: ticket });
    }
    return out;
  }

  // Mensal
  const diaEscolhido = Number(cliente.diaPagamento) || (entrada ? entrada.getDate() : 1);
  let ano = inicio.getFullYear();
  let mes = inicio.getMonth();
  const limite = new Date(fim.getFullYear(), fim.getMonth(), 1);

  while (new Date(ano, mes, 1) <= limite) {
    const dia = Math.min(diaEscolhido, ultimoDia(ano, mes));
    const data = new Date(ano, mes, dia);
    const dentroInicio = !entrada || data >= new Date(entrada.getFullYear(), entrada.getMonth(), 1);
    const dentroFim = !saida || data <= saida;
    if (data >= inicio && data <= fim && dentroInicio && dentroFim) {
      out.push({ clienteId: cliente.id, data, competencia: compDe(data), valor: ticket });
    }
    mes++;
    if (mes > 11) { mes = 0; ano++; }
  }
  return out;
}

/** Gera todas as ocorrências de todos os clientes no intervalo. */
export function gerarRecebiveis(clientes, inicio, fim) {
  const todas = [];
  (clientes || []).forEach((c) => {
    if (c.ativo === false) return; // inativos não geram recebível
    todas.push(...ocorrenciasCliente(c, inicio, fim));
  });
  return todas.sort((a, b) => a.data - b.data);
}

/** Soma dos valores de uma lista de ocorrências. */
export const somar = (lista) => lista.reduce((acc, o) => acc + (Number(o.valor) || 0), 0);

/**
 * Projeções para períodos a partir de uma data de referência.
 * Retorna { semana, mes, semestre, ano } com o total previsto em cada janela.
 */
export function projecoes(clientes, ref = new Date()) {
  const inicioSemana = new Date(ref); inicioSemana.setDate(ref.getDate() - ref.getDay());
  const fimSemana = new Date(inicioSemana); fimSemana.setDate(inicioSemana.getDate() + 6);

  const inicioMes = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const fimMes = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);

  const semestreInicioMes = ref.getMonth() < 6 ? 0 : 6;
  const inicioSem = new Date(ref.getFullYear(), semestreInicioMes, 1);
  const fimSem = new Date(ref.getFullYear(), semestreInicioMes + 6, 0);

  const inicioAno = new Date(ref.getFullYear(), 0, 1);
  const fimAno = new Date(ref.getFullYear(), 11, 31);

  return {
    semana: somar(gerarRecebiveis(clientes, inicioSemana, fimSemana)),
    mes: somar(gerarRecebiveis(clientes, inicioMes, fimMes)),
    semestre: somar(gerarRecebiveis(clientes, inicioSem, fimSem)),
    ano: somar(gerarRecebiveis(clientes, inicioAno, fimAno)),
  };
}

/** Agrupa ocorrências por competência (YYYY-MM), somando valores. */
export function porCompetencia(ocorrencias) {
  const m = {};
  ocorrencias.forEach((o) => {
    m[o.competencia] = (m[o.competencia] || 0) + (Number(o.valor) || 0);
  });
  return m;
}

export const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Rótulo amigável de uma competência "YYYY-MM" */
export function rotuloComp(comp) {
  const [y, m] = comp.split("-").map(Number);
  return `${NOMES_MES[m - 1]} / ${y}`;
}
