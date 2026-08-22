/* ============================================================
   Motivos de cancelamento.

   Agrupados por natureza, porque a leitura gerencial muda:
   perdas por resultado exigem ação na operação; perdas por
   situação do cliente muitas vezes não eram evitáveis.
   ============================================================ */

export const MOTIVOS_CANCELAMENTO = [
  {
    grupo: "Resultado e entrega",
    tom: "err",
    itens: [
      { id: "sem_resultado", nome: "Não atingiu os resultados esperados" },
      { id: "cpl_alto", nome: "Custo por lead acima do viável" },
      { id: "leads_baixa_qualidade", nome: "Leads sem qualidade" },
      { id: "sem_roi", nome: "Não enxergou retorno sobre o investimento" },
      { id: "demora_resultado", nome: "Demora para gerar resultado" },
    ],
  },
  {
    grupo: "Relacionamento e atendimento",
    tom: "avi",
    itens: [
      { id: "comunicacao", nome: "Falha de comunicação ou alinhamento" },
      { id: "atendimento", nome: "Insatisfação com o atendimento" },
      { id: "falta_proatividade", nome: "Falta de proatividade da agência" },
      { id: "troca_responsavel", nome: "Troca de responsável na agência" },
      { id: "sem_relatorio", nome: "Falta de clareza nos relatórios" },
    ],
  },
  {
    grupo: "Financeiro",
    tom: "laranja",
    itens: [
      { id: "orcamento", nome: "Corte de orçamento do cliente" },
      { id: "preco", nome: "Preço acima do que o cliente pode pagar" },
      { id: "inadimplencia", nome: "Encerrado por inadimplência" },
      { id: "concorrente_barato", nome: "Migrou para concorrente mais barato" },
    ],
  },
  {
    grupo: "Situação do cliente",
    tom: "info",
    itens: [
      { id: "internalizou", nome: "Internalizou o marketing" },
      { id: "fechou", nome: "Encerrou as atividades" },
      { id: "mudou_estrategia", nome: "Mudou de estratégia ou canal" },
      { id: "troca_socio", nome: "Mudança de gestão ou sociedade" },
      { id: "sazonalidade", nome: "Pausa por sazonalidade" },
      { id: "projeto_encerrado", nome: "Projeto tinha prazo definido" },
    ],
  },
  {
    grupo: "Outros",
    tom: "neutro",
    itens: [
      { id: "concorrente", nome: "Migrou para outra agência" },
      { id: "sem_contato", nome: "Cliente sumiu / sem retorno" },
      { id: "outro", nome: "Outro motivo" },
    ],
  },
];

/* Busca rápida pelo id */
export const MOTIVO_POR_ID = Object.fromEntries(
  MOTIVOS_CANCELAMENTO.flatMap((g) =>
    g.itens.map((i) => [i.id, { ...i, grupo: g.grupo, tom: g.tom }])
  )
);

/* Motivos que indicam falha da agência — úteis para o que dá para corrigir */
export const MOTIVOS_EVITAVEIS = [
  "sem_resultado", "cpl_alto", "leads_baixa_qualidade", "sem_roi", "demora_resultado",
  "comunicacao", "atendimento", "falta_proatividade", "troca_responsavel", "sem_relatorio",
];

export const ehEvitavel = (id) => MOTIVOS_EVITAVEIS.includes(id);
