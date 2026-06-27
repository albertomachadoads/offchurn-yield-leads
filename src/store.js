// OffChurn Yield Leads — camada de dados (persistência local)
const KEY = "offchurn_yield_leads_v1";

const CRITICIDADES = ["Normal", "Baixo", "Alto", "Crítico"];
const TIPOS_META = ["Faturamento", "Leads"];
const ADERENCIAS = ["Ok", "Atenção", "Abaixo", "Sem dados"];

// Etapas (status) de cada tarefa no Follow de Ações. A ordem define a ordem nos gráficos.
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

function seed() {
  const gestores = [
    { id: uid(), nome: "João" },
    { id: uid(), nome: "Alberto" },
  ];
  const gJoao = gestores[0].id;
  const gAlberto = gestores[1].id;

  const clientes = [
    { id: uid(), nome: "MDF na Web", responsavelId: gJoao, ativo: true },
    { id: uid(), nome: "Vaapty Amparo | Itapira", responsavelId: gAlberto, ativo: true },
    { id: uid(), nome: "Pink Ninas", responsavelId: gAlberto, ativo: true },
    { id: uid(), nome: "Brakiarias", responsavelId: gJoao, ativo: true },
    { id: uid(), nome: "Sasa", responsavelId: gAlberto, ativo: true },
    { id: uid(), nome: "RG Multimarcas", responsavelId: gJoao, ativo: true },
    { id: uid(), nome: "Bremenkamp", responsavelId: gAlberto, ativo: true },
    { id: uid(), nome: "L. Quintella Advogados Associados", responsavelId: gJoao, ativo: true },
    { id: uid(), nome: "Guilherme Garcia & Co", responsavelId: gAlberto, ativo: true },
  ];

  const cli = (n) => clientes.find((c) => c.nome === n).id;

  const registros = [
    {
      id: uid(), data: "2026-06-15", clienteId: cli("MDF na Web"),
      criticidade: "Normal", tipoMeta: "Faturamento", meta: 130000,
      realizado: 57893, aderencia: "Ok",
      acompanhamento: "Custo aumentou e resultado caiu | Temos muita gente entrando no site, mas perdemos volume na finalização e nas compras | Abrir todas as etapas do funil | Novos Vídeos e Imagens bifrados",
      criadoEm: Date.now(),
    },
    {
      id: uid(), data: "2026-06-15", clienteId: cli("Vaapty Amparo | Itapira"),
      criticidade: "Alto", tipoMeta: "Leads", meta: 30,
      realizado: null, aderencia: "Atenção",
      acompanhamento: "Melhora no CPL geral | R$ 14 em média | Sugeri novos criativos ali no grupo aproveitando a sazonalidade | Fabio me sinalizou que percebeu melhora no tráfego, mas está difícil de vender | Volume de venda ainda tá muito baixo",
      criadoEm: Date.now(),
    },
    {
      id: uid(), data: "2026-06-15", clienteId: cli("Pink Ninas"),
      criticidade: "Normal", tipoMeta: "Faturamento", meta: 110000,
      realizado: 59447, aderencia: "Ok",
      acompanhamento: "Dentro da média | Mas com ROAS geral abaixo de 5 | Após a parada da meta as campanhas voltaram bem ruins | Planejamento moda praia e inverno agora",
      criadoEm: Date.now(),
    },
    {
      id: uid(), data: "2026-06-15", clienteId: cli("Brakiarias"),
      criticidade: "Normal", tipoMeta: "Leads", meta: null,
      realizado: null, aderencia: "Sem dados",
      acompanhamento: "Anúncios dos Namorados já estão rodando, prazo de até o final do mês | Acompanhar quantidade de mensagens e CPA",
      criadoEm: Date.now(),
    },
    {
      id: uid(), data: "2026-06-15", clienteId: cli("Sasa"),
      criticidade: "Normal", tipoMeta: "Leads", meta: 85,
      realizado: null, aderencia: "Sem dados",
      acompanhamento: "Tudo normalizado | CPL dentro do projetado | Campanha de dosadores rodando | Vou tentar coletar feedback no grupo",
      criadoEm: Date.now(),
    },
    {
      id: uid(), data: "2026-06-15", clienteId: cli("RG Multimarcas"),
      criticidade: "Baixo", tipoMeta: "Leads", meta: null,
      realizado: null, aderencia: "Sem dados",
      acompanhamento: "Mantendo evidência de trabalho e troca dos anúncios dos carros | Seguir pausando veículos vendidos e subindo novos anúncios | Cosignado continua com cpa alto, mas já temos novos vídeos pra subir assim que pronto e otimizando os conjuntos",
      criadoEm: Date.now(),
    },
    {
      id: uid(), data: "2026-06-15", clienteId: cli("Bremenkamp"),
      criticidade: "Normal", tipoMeta: "Leads", meta: 1288,
      realizado: null, aderencia: "Sem dados",
      acompanhamento: "Puxar o planejamento de acordo com o que foi conversado com o Habiel",
      criadoEm: Date.now(),
    },
    {
      id: uid(), data: "2026-06-15", clienteId: cli("L. Quintella Advogados Associados"),
      criticidade: "Alto", tipoMeta: "Leads", meta: null,
      realizado: null, aderencia: "Atenção",
      acompanhamento: "L.Quintella ainda tá sem usar o tintim, as frases gatilhos saíram todas e não tá trazendo o traqueamento, estou ajustando e em contato com suporte pra orientar",
      criadoEm: Date.now(),
    },
    {
      id: uid(), data: "2026-06-15", clienteId: cli("Guilherme Garcia & Co"),
      criticidade: "Normal", tipoMeta: "Faturamento", meta: 1000000,
      realizado: 302642, aderencia: "Ok",
      acompanhamento: "Faturamento estagnou na casa dos 300k | Puxei uma reunião amanhã | Bater funil de VSL | Criativos direcionados a consultoria paga | Sugeri disparo",
      criadoEm: Date.now(),
    },
  ];

  const cliId = (n) => clientes.find((c) => c.nome === n).id;

  // Equipe: pessoas que criam e executam tarefas. Inclui os gestores + outros nomes.
  const pessoas = [
    { id: gJoao, nome: "João" },
    { id: gAlberto, nome: "Alberto" },
    { id: uid(), nome: "Habiel" },
    { id: uid(), nome: "Tiago" },
    { id: uid(), nome: "Marcelo" },
    { id: uid(), nome: "Bruna" },
    { id: uid(), nome: "Gabriele" },
  ];
  const pId = (n) => pessoas.find((p) => p.nome === n).id;

  const tarefas = [
    {
      id: uid(), data: "2026-06-15", criadaPorId: pId("Habiel"), responsavelId: pId("João"),
      clienteId: cliId("MDF na Web"), acao: "Abrir todas as etapas do funil para análise de queda",
      etapa: "Em andamento", criadoEm: Date.now(),
    },
    {
      id: uid(), data: "2026-06-15", criadaPorId: pId("Habiel"), responsavelId: pId("Gabriele"),
      clienteId: cliId("MDF na Web"), acao: "Produzir novos vídeos e imagens bifrados",
      etapa: "A executar", criadoEm: Date.now(),
    },
    {
      id: uid(), data: "2026-06-15", criadaPorId: pId("Tiago"), responsavelId: pId("Alberto"),
      clienteId: cliId("Pink Ninas"), acao: "Planejamento de campanha moda praia e inverno",
      etapa: "Em andamento", criadoEm: Date.now(),
    },
    {
      id: uid(), data: "2026-06-15", criadaPorId: pId("Alberto"), responsavelId: pId("Bruna"),
      clienteId: cliId("Guilherme Garcia & Co"), acao: "Montar funil de VSL e bater estrutura",
      etapa: "Atrasada", criadoEm: Date.now(),
    },
    {
      id: uid(), data: "2026-06-15", criadaPorId: pId("Alberto"), responsavelId: pId("Marcelo"),
      clienteId: cliId("Guilherme Garcia & Co"), acao: "Criativos direcionados à consultoria paga",
      etapa: "A executar", criadoEm: Date.now(),
    },
    {
      id: uid(), data: "2026-06-12", criadaPorId: pId("João"), responsavelId: pId("Tiago"),
      clienteId: cliId("RG Multimarcas"), acao: "Pausar veículos vendidos e subir novos anúncios",
      etapa: "Concluída", criadoEm: Date.now() - 1,
    },
  ];

  return { gestores, clientes, registros, pessoas, tarefas, version: 3 };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const data = seed();
      localStorage.setItem(KEY, JSON.stringify(data));
      return data;
    }
    const data = JSON.parse(raw);
    // Migração: garante campos novos para quem salvou versões anteriores.
    if (!Array.isArray(data.reunioes)) data.reunioes = [];
    if (!Array.isArray(data.tarefas)) data.tarefas = [];
    // v3: cria a "equipe" (pessoas) a partir dos gestores existentes, se ainda não houver.
    if (!Array.isArray(data.pessoas) || data.pessoas.length === 0) {
      data.pessoas = (data.gestores || []).map((g) => ({ id: g.id, nome: g.nome }));
    }
    if (!data.version || data.version < 3) data.version = 3;
    return data;
  } catch (e) {
    const data = seed();
    return data;
  }
}

export function save(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function resetAll() {
  const data = seed();
  save(data);
  return data;
}

export { CRITICIDADES, TIPOS_META, ADERENCIAS, ETAPAS, ETAPA_KEYS, uid };
