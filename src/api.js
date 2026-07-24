import { supabase } from "./supabaseClient";

// ===== Mapeamento banco (snake_case) <-> app (camelCase) =====
const mapCliente = (r) => ({
  id: r.id, nome: r.nome, responsavelId: r.responsavel_id, ativo: r.ativo,
  cpa: r.cpa, verbaMensal: r.verba_mensal,
  nicho: r.nicho, dataEntrada: r.data_entrada, dataSaidaPrevista: r.data_saida_prevista,
  ticket: r.ticket, recorrencia: r.recorrencia || "Mensal", diaPagamento: r.dia_pagamento,
  linkDrive: r.link_drive,
  nps: r.nps, platGoogle: r.plat_google || false, platMeta: r.plat_meta || false,
  cpaMeta: r.cpa_meta,
  metaAdAccountId: r.meta_ad_account_id,
  googleAdCustomerId: r.google_ad_customer_id,
  googleMccId: r.google_mcc_id,
  objetivo: r.objetivo || "Lead",
  criticidade: r.criticidade || "Normal",
});
const mapFunil = (r) => ({
  id: r.id, clienteId: r.cliente_id, competencia: r.competencia, plataforma: r.plataforma,
  captados: Number(r.leads_captados) || 0, qualificados: Number(r.leads_qualificados) || 0,
  vendidos: Number(r.leads_vendidos) || 0,
  vendas: Number(r.vendas) || 0, vgv: Number(r.vgv) || 0, custo: Number(r.custo) || 0,
});
const mapDesempenho = (r) => ({
  id: r.id, clienteId: r.cliente_id, competencia: r.competencia,
  gasto: r.gasto, leads: r.leads, cpaReal: r.cpa_real,
});
const mapRecebivel = (r) => ({
  id: r.id, clienteId: r.cliente_id, competencia: r.competencia,
  valor: r.valor, pago: r.pago, dataPagamento: r.data_pagamento, observacao: r.observacao,
});
const mapPainel = (r) => ({
  id: r.id, clienteId: r.cliente_id,
  captados: r.leads_captados, qualificados: r.leads_qualificados, fechados: r.leads_fechados,
  atualizadoEm: r.atualizado_em,
});
const mapGestor = (r) => ({ id: r.id, nome: r.nome });
const mapPessoa = (r) => ({ id: r.id, nome: r.nome });
const mapAcomp = (r) => ({
  id: r.id, data: r.data, clienteId: r.cliente_id, criticidade: r.criticidade,
  tipoMeta: r.tipo_meta, meta: r.meta, realizado: r.realizado, aderencia: r.aderencia,
  acompanhamento: r.acompanhamento, autorId: r.autor_id, criadoEm: r.criado_em,
});
const mapTarefa = (r) => ({
  id: r.id, data: r.data, criadaPorId: r.criada_por_id, responsavelId: r.responsavel_id,
  clienteId: r.cliente_id, acao: r.acao, etapa: r.etapa, autorId: r.autor_id, criadoEm: r.criado_em,
  dataCriacao: r.data_criacao, prazo: r.prazo, dataConclusao: r.data_conclusao,
  titulo: r.titulo, validadorId: r.validador_id, dataExecucao: r.data_execucao, dataEntrega: r.data_entrega,
});
const mapDespesa = (r) => ({
  id: r.id, nome: r.nome, centroCusto: r.centro_custo, fornecedor: r.fornecedor,
  tipo: r.tipo, valor: Number(r.valor) || 0, recorrencia: r.recorrencia,
  criticidade: r.criticidade, impactoReceita: r.impacto_receita, riscoCorte: r.risco_corte,
  dataPagamento: r.data_pagamento, responsavel: r.responsavel, observacao: r.observacao,
  ativo: r.ativo, criadoEm: r.criado_em,
});
const mapPerfil = (r) => ({ id: r.id, nome: r.nome, papel: r.papel, bloqueado: r.bloqueado || false });

// ===== Carga inicial de tudo =====
export async function fetchAll() {
  const [clientes, gestores, pessoas, acomp, tarefas, perfis, painel, recebiveis, desempenho, funil, despesas] = await Promise.all([
    supabase.from("clientes").select("*").order("nome"),
    supabase.from("gestores").select("*").order("nome"),
    supabase.from("pessoas").select("*").order("nome"),
    supabase.from("acompanhamentos").select("*").order("data", { ascending: false }),
    supabase.from("tarefas").select("*").order("data", { ascending: false }),
    supabase.from("perfis").select("*").order("nome"),
    supabase.from("painel").select("*"),
    supabase.from("recebiveis").select("*"),
    supabase.from("desempenho").select("*"),
    supabase.from("funil_mensal").select("*"),
    supabase.from("despesas").select("*"),
  ]);
  const err = clientes.error || gestores.error || pessoas.error || acomp.error || tarefas.error || perfis.error || painel.error || recebiveis.error || desempenho.error || funil.error || despesas.error;
  if (err) throw err;
  return {
    clientes: (clientes.data || []).map(mapCliente),
    gestores: (gestores.data || []).map(mapGestor),
    pessoas: (pessoas.data || []).map(mapPessoa),
    acompanhamentos: (acomp.data || []).map(mapAcomp),
    tarefas: (tarefas.data || []).map(mapTarefa),
    perfis: (perfis.data || []).map(mapPerfil),
    painel: (painel.data || []).map(mapPainel),
    recebiveis: (recebiveis.data || []).map(mapRecebivel),
    desempenho: (desempenho.data || []).map(mapDesempenho),
    funil: (funil.data || []).map(mapFunil),
    despesas: (despesas.data || []).map(mapDespesa),
  };
}

// ===== CLIENTES =====
export async function upsertCliente(c) {
  const num = (v) => (v === "" || v == null ? null : Number(v));
  const txt = (v) => (v === "" || v == null ? null : v);
  const row = {
    nome: c.nome, responsavel_id: c.responsavelId || null, ativo: c.ativo,
    cpa: num(c.cpa), verba_mensal: num(c.verbaMensal),
    nicho: txt(c.nicho),
    data_entrada: txt(c.dataEntrada),
    data_saida_prevista: txt(c.dataSaidaPrevista),
    ticket: num(c.ticket),
    recorrencia: c.recorrencia || "Mensal",
    dia_pagamento: num(c.diaPagamento),
    link_drive: txt(c.linkDrive),
    nps: num(c.nps),
    plat_google: !!c.platGoogle,
    plat_meta: !!c.platMeta,
    objetivo: c.objetivo || "Lead",
    criticidade: c.criticidade || "Normal",
    google_mcc_id: (c.googleMccId === "" || c.googleMccId == null) ? null : String(c.googleMccId),
    google_ad_customer_id: (c.googleAdCustomerId === "" || c.googleAdCustomerId == null) ? null : String(c.googleAdCustomerId),
    meta_ad_account_id: (c.metaAdAccountId === "" || c.metaAdAccountId == null) ? null : String(c.metaAdAccountId),
    cpa_meta: num(c.cpaMeta),
  };
  if (c.id) row.id = c.id;
  const { data, error } = await supabase.from("clientes").upsert(row).select().single();
  if (error) throw error;
  return mapCliente(data);
}
export async function deleteCliente(id) {
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) throw error;
}

// ===== GESTORES =====
export async function upsertGestor(g) {
  const row = { nome: g.nome };
  if (g.id) row.id = g.id;
  const { data, error } = await supabase.from("gestores").upsert(row).select().single();
  if (error) throw error;
  return mapGestor(data);
}
export async function deleteGestor(id) {
  const { error } = await supabase.from("gestores").delete().eq("id", id);
  if (error) throw error;
}

// ===== PESSOAS (equipe) =====
export async function upsertPessoa(p) {
  const row = { nome: p.nome };
  if (p.id) row.id = p.id;
  const { data, error } = await supabase.from("pessoas").upsert(row).select().single();
  if (error) throw error;
  return mapPessoa(data);
}
export async function deletePessoa(id) {
  const { error } = await supabase.from("pessoas").delete().eq("id", id);
  if (error) throw error;
}

// ===== ACOMPANHAMENTOS =====
export async function upsertAcomp(a, autorId) {
  const row = {
    data: a.data, cliente_id: a.clienteId || null, criticidade: a.criticidade,
    tipo_meta: a.tipoMeta, meta: a.meta, realizado: a.realizado, aderencia: a.aderencia,
    acompanhamento: a.acompanhamento, autor_id: autorId || null,
  };
  if (a.id) row.id = a.id;
  const { data, error } = await supabase.from("acompanhamentos").upsert(row).select().single();
  if (error) throw error;
  return mapAcomp(data);
}
export async function deleteAcomp(id) {
  const { error } = await supabase.from("acompanhamentos").delete().eq("id", id);
  if (error) throw error;
}

// ===== TAREFAS =====
export async function upsertTarefa(t, autorId) {
  const row = {
    data: t.data, criada_por_id: t.criadaPorId || null, responsavel_id: t.responsavelId || null,
    cliente_id: t.clienteId || null, acao: t.acao, etapa: t.etapa, autor_id: autorId || null,
    data_criacao: t.dataCriacao || null, prazo: t.prazo || null, data_conclusao: t.dataConclusao || null,
    titulo: t.titulo || null, validador_id: t.validadorId || null,
    data_execucao: t.dataExecucao || null, data_entrega: t.dataEntrega || null,
  };
  if (t.id) row.id = t.id;
  const { data, error } = await supabase.from("tarefas").upsert(row).select().single();
  if (error) throw error;
  return mapTarefa(data);
}
export async function deleteTarefa(id) {
  const { error } = await supabase.from("tarefas").delete().eq("id", id);
  if (error) throw error;
}

// ===== PAINEL (métricas por cliente) =====
// Salva os números de um cliente. cliente_id é único, então usamos onConflict.
export async function upsertPainel(p, autorId) {
  const row = {
    cliente_id: p.clienteId,
    leads_captados: Number(p.captados) || 0,
    leads_qualificados: Number(p.qualificados) || 0,
    leads_fechados: Number(p.fechados) || 0,
    atualizado_em: new Date().toISOString(),
    atualizado_por: autorId || null,
  };
  const { data, error } = await supabase
    .from("painel")
    .upsert(row, { onConflict: "cliente_id" })
    .select().single();
  if (error) throw error;
  return mapPainel(data);
}

// ===== RECEBÍVEIS (fluxo de caixa) =====
export async function upsertRecebivel(r, autorId) {
  const row = {
    cliente_id: r.clienteId,
    competencia: r.competencia,
    valor: (r.valor === "" || r.valor == null) ? null : Number(r.valor),
    pago: !!r.pago,
    data_pagamento: r.dataPagamento || null,
    observacao: r.observacao || null,
    atualizado_em: new Date().toISOString(),
    atualizado_por: autorId || null,
  };
  const { data, error } = await supabase
    .from("recebiveis")
    .upsert(row, { onConflict: "cliente_id,competencia" })
    .select().single();
  if (error) throw error;
  return mapRecebivel(data);
}

// ===== DESEMPENHO (gasto e leads do mês, por cliente) =====
export async function upsertDesempenho(d, autorId) {
  const row = {
    cliente_id: d.clienteId,
    competencia: d.competencia,
    gasto: Number(d.gasto) || 0,
    leads: Number(d.leads) || 0,
    atualizado_em: new Date().toISOString(),
    atualizado_por: autorId || null,
  };
  const { data, error } = await supabase
    .from("desempenho")
    .upsert(row, { onConflict: "cliente_id,competencia" })
    .select().single();
  if (error) throw error;
  return mapDesempenho(data);
}


// ===== INTEGRAÇÃO META (via Edge Function meta-sync) =====
export async function metaListarContas() {
  const { data, error } = await supabase.functions.invoke("meta-sync", {
    body: { action: "contas" },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.erro || "Falha ao listar contas");
  return data.contas || [];
}

export async function metaSincronizar(clienteId) {
  const { data, error } = await supabase.functions.invoke("meta-sync", {
    body: clienteId ? { action: "sync", clienteId } : { action: "sync" },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.erro || "Falha ao sincronizar");
  return data; // { competencia, resultados: [...] }
}

export async function upsertDespesa(d, autorId) {
  const row = {
    nome: d.nome, centro_custo: d.centroCusto, fornecedor: d.fornecedor, tipo: d.tipo,
    valor: Number(d.valor) || 0, recorrencia: d.recorrencia,
    criticidade: Number(d.criticidade) || 3, impacto_receita: Number(d.impactoReceita) || 3,
    risco_corte: Number(d.riscoCorte) || 3, data_pagamento: d.dataPagamento || null,
    responsavel: d.responsavel || null, observacao: d.observacao || null,
    ativo: d.ativo ?? true, criado_por: autorId || null,
  };
  if (d.id) row.id = d.id;
  const { data, error } = await supabase.from("despesas").upsert(row).select().single();
  if (error) throw error;
  return mapDespesa(data);
}

export async function deleteDespesa(id) {
  const { error } = await supabase.from("despesas").delete().eq("id", id);
  if (error) throw error;
}

export async function upsertFunil(f, autorId) {
  const row = {
    cliente_id: f.clienteId, competencia: f.competencia, plataforma: f.plataforma,
    leads_captados: Number(f.captados) || 0,
    leads_qualificados: Number(f.qualificados) || 0,
    leads_vendidos: Number(f.vendidos) || 0,
    vendas: Number(f.vendas) || 0,
    vgv: Number(f.vgv) || 0,
    custo: Number(f.custo) || 0,
    atualizado_em: new Date().toISOString(),
    atualizado_por: autorId || null,
  };
  const { data, error } = await supabase
    .from("funil_mensal")
    .upsert(row, { onConflict: "cliente_id,competencia,plataforma" })
    .select().single();
  if (error) throw error;
  return mapFunil(data);
}

export async function metaInsights(clienteId, since, until) {
  const { data, error } = await supabase.functions.invoke("meta-sync", {
    body: { action: "insights", clienteId, since, until },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.erro || "Falha ao buscar métricas");
  return data; // { periodo, periodoAnterior, atual, anterior, campanhas }
}

// ===== INTEGRAÇÃO GOOGLE ADS (via Edge Function google-sync) =====
export async function googleListarContas() {
  const { data, error } = await supabase.functions.invoke("google-sync", {
    body: { action: "contas" },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.erro || "Falha ao listar contas Google");
  return data.mccs || []; // hierarquia: [{ mccId, mccNome, contas: [...] }]
}

export async function googleSincronizar(clienteId) {
  const { data, error } = await supabase.functions.invoke("google-sync", {
    body: clienteId ? { action: "sync", clienteId } : { action: "sync" },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.erro || "Falha ao sincronizar Google");
  return data;
}

export async function googleInsights(clienteId, since, until) {
  const { data, error } = await supabase.functions.invoke("google-sync", {
    body: { action: "insights", clienteId, since, until },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.erro || "Falha ao buscar métricas Google");
  return data;
}

// ===== Realtime: assina mudanças em todas as tabelas =====
export function subscribeAll(onChange) {
  const ch = supabase
    .channel("offchurn-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "acompanhamentos" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "tarefas" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "gestores" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "pessoas" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "perfis" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "painel" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "recebiveis" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "desempenho" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "funil_mensal" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "despesas" }, onChange)
    .subscribe();
  return () => supabase.removeChannel(ch);
}

export { mapCliente, mapGestor, mapPessoa, mapAcomp, mapTarefa, mapPerfil, mapPainel, mapRecebivel, mapDesempenho };
