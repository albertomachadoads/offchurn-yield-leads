import { supabase } from "./supabaseClient";

// ===== Mapeamento banco (snake_case) <-> app (camelCase) =====
const mapCliente = (r) => ({ id: r.id, nome: r.nome, responsavelId: r.responsavel_id, ativo: r.ativo });
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
});
const mapPerfil = (r) => ({ id: r.id, nome: r.nome, papel: r.papel });

// ===== Carga inicial de tudo =====
export async function fetchAll() {
  const [clientes, gestores, pessoas, acomp, tarefas, perfis] = await Promise.all([
    supabase.from("clientes").select("*").order("nome"),
    supabase.from("gestores").select("*").order("nome"),
    supabase.from("pessoas").select("*").order("nome"),
    supabase.from("acompanhamentos").select("*").order("data", { ascending: false }),
    supabase.from("tarefas").select("*").order("data", { ascending: false }),
    supabase.from("perfis").select("*").order("nome"),
  ]);
  const err = clientes.error || gestores.error || pessoas.error || acomp.error || tarefas.error || perfis.error;
  if (err) throw err;
  return {
    clientes: (clientes.data || []).map(mapCliente),
    gestores: (gestores.data || []).map(mapGestor),
    pessoas: (pessoas.data || []).map(mapPessoa),
    acompanhamentos: (acomp.data || []).map(mapAcomp),
    tarefas: (tarefas.data || []).map(mapTarefa),
    perfis: (perfis.data || []).map(mapPerfil),
  };
}

// ===== CLIENTES =====
export async function upsertCliente(c) {
  const row = { nome: c.nome, responsavel_id: c.responsavelId || null, ativo: c.ativo };
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
    .subscribe();
  return () => supabase.removeChannel(ch);
}

export { mapCliente, mapGestor, mapPessoa, mapAcomp, mapTarefa, mapPerfil };
