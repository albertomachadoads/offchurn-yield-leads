import { useEffect, useMemo, useState } from "react";
import { fmtMoeda } from "./utils.js";
import { supabase } from "./supabaseClient.js";
import * as api from "./api.js";

const PERIODOS = [
  { v: "7d", l: "7 dias" }, { v: "15d", l: "15 dias" }, { v: "30d", l: "30 dias" },
  { v: "90d", l: "90 dias" }, { v: "mes", l: "Este mês" }, { v: "ano", l: "Este ano" },
];

function dataInicio(p) {
  const d = new Date();
  if (p === "7d") d.setDate(d.getDate() - 7);
  else if (p === "15d") d.setDate(d.getDate() - 15);
  else if (p === "30d") d.setDate(d.getDate() - 30);
  else if (p === "90d") d.setDate(d.getDate() - 90);
  else if (p === "mes") { d.setDate(1); }
  else if (p === "ano") { d.setMonth(0); d.setDate(1); }
  return d.toISOString();
}

function Tile({ label, valor, sub, cor }) {
  return <div className="tile"><div className="label">{label}</div><div className="value" style={cor ? { color: cor } : {}}>{valor}</div>{sub && <div className="hint">{sub}</div>}</div>;
}

function Barra({ label, valor, max, cor }) {
  const pct = max > 0 ? Math.min((valor / max) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}><span style={{ fontWeight: 600 }}>{label}</span><span style={{ color: "var(--ink-faint)" }}>{valor}</span></div>
      <div style={{ height: 8, background: "var(--gray-soft)", borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: cor || "var(--green)", borderRadius: 4, transition: "width .4s" }} /></div>
    </div>
  );
}

function MetaGauge({ label, atual, meta, fmt }) {
  const pct = meta > 0 ? (atual / meta) * 100 : 0;
  const status = pct >= 100 ? "acima" : pct >= 70 ? "ok" : "abaixo";
  const cor = status === "acima" ? "#22c55e" : status === "ok" ? "#f59e0b" : "#ef4444";
  return (
    <div className="dash-meta-gauge">
      <div className="dash-meta-label">{label}</div>
      <div className="dash-meta-valores"><span style={{ fontWeight: 800, color: cor }}>{fmt(atual)}</span> <span style={{ color: "var(--ink-faint)", fontSize: 11 }}>/ {fmt(meta)}</span></div>
      <div className="dash-meta-bar"><div style={{ width: `${Math.min(pct, 100)}%`, background: cor }} /></div>
      <div className="dash-meta-status" style={{ color: cor }}>{pct >= 100 ? "✓ Acima da meta" : pct >= 70 ? "→ No caminho" : "⚠ Abaixo da meta"} ({pct.toFixed(0)}%)</div>
    </div>
  );
}

function VendedorCard({ pessoa, leads, etGanho, etPerdido, tarefas, meta }) {
  const ganhos = leads.filter((l) => etGanho.has(l.etapaId));
  const perdidos = leads.filter((l) => etPerdido.has(l.etapaId));
  const receita = ganhos.reduce((s, l) => s + (l.valor || 0), 0);
  const conversao = leads.length > 0 ? (ganhos.length / leads.length) * 100 : 0;
  const hoje = new Date().toISOString().slice(0, 10);
  const pendentes = tarefas.filter((t) => !t.status || t.status === "pendente");
  const atrasadas = pendentes.filter((t) => t.dataPrevista && t.dataPrevista < hoje);

  const m = meta || {};
  const fmtR = (v) => fmtMoeda(Number(v || 0));
  const fmtN = (v) => String(v || 0);

  return (
    <div className="card card-pad dash-vendedor">
      <div className="dash-vendedor-head">
        <div className="dash-vendedor-avatar">{(pessoa.nome || "?").charAt(0).toUpperCase()}</div>
        <div><div style={{ fontWeight: 800, fontSize: 14 }}>{pessoa.nome}</div>
          <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{leads.length} leads · {ganhos.length} vendas · {fmtR(receita)}</div>
        </div>
      </div>
      <div className="dash-vendedor-stats">
        <div className="dash-vstat"><span className="dash-vstat-n" style={{ color: "var(--green)" }}>{ganhos.length}</span><span className="dash-vstat-l">Vendas</span></div>
        <div className="dash-vstat"><span className="dash-vstat-n" style={{ color: "#ef4444" }}>{perdidos.length}</span><span className="dash-vstat-l">Perdidos</span></div>
        <div className="dash-vstat"><span className="dash-vstat-n">{pendentes.length}</span><span className="dash-vstat-l">Tarefas</span></div>
        <div className="dash-vstat"><span className="dash-vstat-n" style={{ color: atrasadas.length > 0 ? "#ef4444" : "var(--ink)" }}>{atrasadas.length}</span><span className="dash-vstat-l">Atrasadas</span></div>
      </div>
      {m.meta_fechamento > 0 && (
        <div style={{ marginTop: 10 }}>
          <MetaGauge label="Vendas" atual={ganhos.length} meta={Number(m.meta_fechamento)} fmt={fmtN} />
          {m.meta_faturamento > 0 && <MetaGauge label="Faturamento" atual={receita} meta={Number(m.meta_faturamento)} fmt={fmtR} />}
          {m.taxa_conversao_meta > 0 && <MetaGauge label="Conversão" atual={conversao} meta={Number(m.taxa_conversao_meta)} fmt={(v) => v.toFixed(1) + "%"} />}
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ clientes, tarefas, pessoas, onToast, isAdmin, onVerLead, onReload }) {
  const [periodo, setPeriodo] = useState("30d");
  const [crm, setCrm] = useState(null);
  const [vendedorFiltro, setVendedorFiltro] = useState(["todos"]);
  const [metas, setMetas] = useState([]);

  useEffect(() => { api.fetchCRM().then(setCrm).catch(() => {}); }, []);
  useEffect(() => {
    const comp = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    supabase.from("metas_comerciais").select("*").eq("competencia", comp).then(({ data }) => setMetas(data || []));
  }, []);

  const vendedores = useMemo(() => (pessoas || []).filter((p) => p.papel !== "admin" || isAdmin), [pessoas]);

  const toggleVendedor = (id) => {
    if (id === "todos") { setVendedorFiltro(["todos"]); return; }
    setVendedorFiltro((prev) => {
      const sem = prev.filter((v) => v !== "todos");
      return sem.includes(id) ? (sem.length === 1 ? ["todos"] : sem.filter((v) => v !== id)) : [...sem, id];
    });
  };
  const filtroAtivo = vendedorFiltro.includes("todos");

  const stats = useMemo(() => {
    const desde = dataInicio(periodo);
    const leads = (crm?.leads || []).filter((l) => l.criadoEm >= desde);
    const filteredLeads = filtroAtivo ? leads : leads.filter((l) => vendedorFiltro.includes(l.responsavelId));
    const etGanho = new Set((crm?.etapas || []).filter((e) => e.tipo === "ganho").map((e) => e.id));
    const etPerdido = new Set((crm?.etapas || []).filter((e) => e.tipo === "perdido").map((e) => e.id));
    const ganhos = filteredLeads.filter((l) => etGanho.has(l.etapaId));
    const perdidos = filteredLeads.filter((l) => etPerdido.has(l.etapaId));
    const emAberto = filteredLeads.filter((l) => !etGanho.has(l.etapaId) && !etPerdido.has(l.etapaId));
    const receitaGanha = ganhos.reduce((s, l) => s + (l.valor || 0), 0);
    const receitaPerdida = perdidos.reduce((s, l) => s + (l.valor || 0), 0);
    const conversao = filteredLeads.length > 0 ? (ganhos.length / filteredLeads.length) * 100 : 0;

    const hoje = new Date().toISOString().slice(0, 10);
    const tarefasFiltro = filtroAtivo ? (tarefas || []) : (tarefas || []).filter((t) => vendedorFiltro.includes(t.responsavelId));
    const pendentes = tarefasFiltro.filter((t) => !t.status || t.status === "pendente");
    const concluidas = tarefasFiltro.filter((t) => t.status === "concluida" || t.status === "concluído");
    const atrasadas = pendentes.filter((t) => t.dataPrevista && t.dataPrevista < hoje);

    // Reuniões agendadas
    const etReuniao = (crm?.etapas || []).filter((e) => e.nome?.toLowerCase().includes("reunião") || e.nome?.toLowerCase().includes("reuniao"));
    const reunioes = (crm?.leads || []).filter((l) => etReuniao.some((e) => e.id === l.etapaId) && !etGanho.has(l.etapaId) && !etPerdido.has(l.etapaId));

    const ativos = (clientes || []).filter((c) => c.ativo);
    const mrr = ativos.reduce((s, c) => s + (Number(c.ticket) || 0), 0);

    const etapas = (crm?.etapas || []).sort((a, b) => a.ordem - b.ordem);
    const leadsPorEtapa = etapas.map((e) => ({ nome: e.nome, total: filteredLeads.filter((l) => l.etapaId === e.id).length, cor: e.tipo === "ganho" ? "#22c55e" : e.tipo === "perdido" ? "#ef4444" : "var(--green)" }));

    return { totalLeads: filteredLeads.length, ganhos: ganhos.length, perdidos: perdidos.length, emAberto: emAberto.length, receitaGanha, receitaPerdida, conversao, pendentes: pendentes.length, concluidas: concluidas.length, atrasadas: atrasadas.length, clientesAtivos: ativos.length, mrr, leadsPorEtapa, reunioes, etGanho, etPerdido, leads, allLeads: crm?.leads || [] };
  }, [crm, tarefas, clientes, periodo, vendedorFiltro]);

  const maxEtapa = Math.max(...(stats.leadsPorEtapa?.map((e) => e.total) || [1]), 1);

  return (
    <>
      <div className="page-head">
        <div><h1>Dashboard</h1><p>Visão geral do período</p></div>
        <div className="head-actions" style={{ gap: 8 }}>
          {isAdmin && (
            <div className="dash-filtro-vendedores">
              <button className={`dash-vf-btn ${filtroAtivo ? "active" : ""}`} onClick={() => toggleVendedor("todos")}>Todos</button>
              {vendedores.map((p) => (
                <button key={p.id} className={`dash-vf-btn ${vendedorFiltro.includes(p.id) ? "active" : ""}`} onClick={() => toggleVendedor(p.id)}>{p.nome?.split(" ")[0]}</button>
              ))}
            </div>
          )}
          {onReload && <button className="toolbar-btn" onClick={() => { onReload(); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            Atualizar
          </button>}
          <select className="select" style={{ width: "auto" }} value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {PERIODOS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
          </select>
        </div>
      </div>

      <div className="tiles dash-tiles">
        <Tile label="Leads recebidos" valor={stats.totalLeads} sub={`${stats.emAberto} em aberto`} />
        <Tile label="Vendas" valor={stats.ganhos} cor="var(--green)" sub={`${stats.conversao.toFixed(1)}% conversão`} />
        <Tile label="Receita ganha" valor={fmtMoeda(stats.receitaGanha)} cor="var(--green)" />
        <Tile label="Receita perdida" valor={fmtMoeda(stats.receitaPerdida)} cor="var(--red)" />
        <Tile label="Clientes ativos" valor={stats.clientesAtivos} sub={`MRR ${fmtMoeda(stats.mrr)}`} />
        <Tile label="Conversão" valor={`${stats.conversao.toFixed(1)}%`} cor={stats.conversao >= 4 ? "var(--green)" : "var(--amber, #e6a817)"} />
      </div>

      <div className="dash-grid">
        <div className="card card-pad">
          <h3 className="dash-h3">Tarefas</h3>
          <div className="dash-tarefas-grid">
            <div className="dash-tarefa-item"><div className="dash-tarefa-num" style={{ color: "var(--amber, #e6a817)" }}>{stats.pendentes}</div><div className="dash-tarefa-label">Pendentes</div></div>
            <div className="dash-tarefa-item"><div className="dash-tarefa-num" style={{ color: "var(--red)" }}>{stats.atrasadas}</div><div className="dash-tarefa-label">Atrasadas</div></div>
            <div className="dash-tarefa-item"><div className="dash-tarefa-num" style={{ color: "var(--green)" }}>{stats.concluidas}</div><div className="dash-tarefa-label">Concluídas</div></div>
          </div>
        </div>

        {/* Lista detalhada de tarefas do CRM */}
        <div className="card card-pad" style={{ gridColumn: "1 / -1" }}>
          <h3 className="dash-h3">Tarefas do CRM</h3>
          {(() => {
            const hoje = new Date().toISOString().slice(0, 10);
            const ativCRM = (crm?.atividades || []).filter((a) => a.tipo === "tarefa" && a.status !== "cancelada");
            const leadsMap = {};
            (crm?.leads || []).forEach((l) => { leadsMap[l.id] = l; });
            const tarefasCRM = ativCRM.map((a) => ({
              ...a,
              leadNome: leadsMap[a.leadId]?.nome || "—",
              leadId: a.leadId,
              atrasada: a.dataPrevista && a.dataPrevista.slice(0, 10) < hoje && a.status !== "concluida",
              pendente: !a.status || a.status === "pendente",
              concluida: a.status === "concluida",
            })).sort((a, b) => (a.atrasada ? -1 : 1));
            
            if (tarefasCRM.length === 0) return <p style={{ fontSize: 12, color: "var(--ink-faint)" }}>Nenhuma tarefa no CRM</p>;
            
            return (
              <div className="dash-tarefas-lista">
                {tarefasCRM.slice(0, 20).map((t) => (
                  <div key={t.id} className={`dash-tarefa-row ${t.atrasada ? "dash-tarefa-atrasada" : ""}`}
                    onClick={() => onVerLead && onVerLead(t.leadId)} style={{ cursor: "pointer" }}>
                    <div className="dash-tarefa-status">
                      {t.concluida ? <span style={{ color: "var(--green)" }}>✓</span> : t.atrasada ? <span style={{ color: "var(--red)" }}>!</span> : <span style={{ color: "var(--amber, #e6a817)" }}>●</span>}
                    </div>
                    <div className="dash-tarefa-info">
                      <div className="dash-tarefa-desc">{t.descricao}</div>
                      <div className="dash-tarefa-meta">
                        <span className="dash-tarefa-lead">📋 {t.leadNome}</span>
                        {t.dataPrevista && <span> · Prevista: {t.dataPrevista.slice(0, 10).split("-").reverse().join("/")}</span>}
                        {t.responsavelNome && <span> · {t.responsavelNome}</span>}
                      </div>
                    </div>
                    <div>
                      {t.atrasada && <span className="pill" style={{ background: "#fee2e2", color: "#dc2626", fontSize: 9 }}>ATRASADA</span>}
                      {t.pendente && !t.atrasada && <span className="pill" style={{ background: "#fef3c7", color: "#d97706", fontSize: 9 }}>PENDENTE</span>}
                      {t.concluida && <span className="pill done" style={{ fontSize: 9 }}>CONCLUÍDA</span>}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

      </div>

      <div className="dash-grid">
        <div className="card card-pad">
          <h3 className="dash-h3">Reuniões agendadas</h3>
          {stats.reunioes?.length > 0 ? (
            <div className="dash-reunioes">{stats.reunioes.map((l) => (
              <div key={l.id} className="dash-reuniao-item">
                <span className="dash-reuniao-dot" />
                <div><strong>{l.nome}</strong>{l.whatsapp && <span style={{ fontSize: 11, color: "var(--ink-faint)", marginLeft: 6 }}>{l.whatsapp}</span>}</div>
              </div>
            ))}</div>
          ) : <p style={{ fontSize: 12, color: "var(--ink-faint)" }}>Nenhuma reunião agendada</p>}
        </div>
      </div>

      <div className="dash-grid" style={{ marginTop: 16 }}>
        <div className="card card-pad">
          <h3 className="dash-h3">Leads por etapa</h3>
          {stats.leadsPorEtapa?.length > 0 ? stats.leadsPorEtapa.map((e, i) => <Barra key={i} label={e.nome} valor={e.total} max={maxEtapa} cor={e.cor} />) : <p style={{ fontSize: 12, color: "var(--ink-faint)" }}>Sem dados</p>}
        </div>
        <div className="card card-pad">
          <h3 className="dash-h3">Distribuição</h3>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, textAlign: "center", padding: "14px 0", background: "var(--green-softer)", borderRadius: 8 }}><div style={{ fontSize: 24, fontWeight: 800, color: "var(--green)" }}>{stats.ganhos}</div><div style={{ fontSize: 11, color: "var(--ink-faint)" }}>Ganhos</div></div>
            <div style={{ flex: 1, textAlign: "center", padding: "14px 0", background: "#fef3c7", borderRadius: 8 }}><div style={{ fontSize: 24, fontWeight: 800, color: "#d97706" }}>{stats.emAberto}</div><div style={{ fontSize: 11, color: "var(--ink-faint)" }}>Aberto</div></div>
            <div style={{ flex: 1, textAlign: "center", padding: "14px 0", background: "#fee2e2", borderRadius: 8 }}><div style={{ fontSize: 24, fontWeight: 800, color: "#dc2626" }}>{stats.perdidos}</div><div style={{ fontSize: 11, color: "var(--ink-faint)" }}>Perdidos</div></div>
          </div>
        </div>
      </div>

      {/* Cards por vendedor */}
      {isAdmin && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Desempenho por vendedor</h2>
          <div className="dash-vendedores-grid">
            {vendedores.map((p) => {
              const desde = dataInicio(periodo);
              const leadsV = (stats.allLeads || []).filter((l) => l.responsavelId === p.id && l.criadoEm >= desde);
              const tarefasV = (tarefas || []).filter((t) => t.responsavelId === p.id);
              const metaV = metas.find((m) => m.vendedor_id === p.id) || metas.find((m) => !m.vendedor_id) || {};
              return <VendedorCard key={p.id} pessoa={p} leads={leadsV} etGanho={stats.etGanho} etPerdido={stats.etPerdido} tarefas={tarefasV} meta={metaV} />;
            })}
          </div>
        </div>
      )}
    </>
  );
}
