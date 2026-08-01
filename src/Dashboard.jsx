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
  else if (p === "mes") d.setDate(1);
  else if (p === "ano") { d.setMonth(0); d.setDate(1); }
  return d.toISOString();
}

/* ---- KPI Card ---- */
function KpiCard({ icon, label, valor, sub, cor, trend }) {
  return (
    <div className="dkpi">
      <div className="dkpi-icon" style={{ background: cor ? `${cor}18` : "var(--green-softer)" }}>
        <span style={{ color: cor || "var(--green)" }}>{icon}</span>
      </div>
      <div className="dkpi-body">
        <div className="dkpi-label">{label}</div>
        <div className="dkpi-valor" style={cor ? { color: cor } : {}}>{valor}</div>
        {(sub || trend) && <div className="dkpi-sub">{trend && <span className={`dkpi-trend ${trend > 0 ? "up" : "down"}`}>{trend > 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}%</span>}{sub}</div>}
      </div>
    </div>
  );
}

/* ---- Donut Chart ---- */
function Donut({ data, size }) {
  const s = size || 120;
  const total = data.reduce((a, d) => a + d.valor, 0) || 1;
  const r = s / 2 - 10;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width={s} height={s} style={{ flexShrink: 0 }}>
        {data.map((d, i) => {
          const pct = d.valor / total;
          const dash = pct * circ;
          const o = offset;
          offset += dash;
          return <circle key={i} cx={s/2} cy={s/2} r={r} fill="none" stroke={d.cor} strokeWidth="14"
            strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-o}
            strokeLinecap="round" style={{ transition: "stroke-dasharray .5s, stroke-dashoffset .5s" }} />;
        })}
        <text x={s/2} y={s/2-6} textAnchor="middle" style={{ fontSize: 18, fontWeight: 800, fill: "var(--ink)" }}>{total}</text>
        <text x={s/2} y={s/2+12} textAnchor="middle" style={{ fontSize: 10, fill: "var(--ink-faint)" }}>Total</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.cor, flexShrink: 0 }} />
            <span style={{ color: "var(--ink-faint)" }}>{d.label}</span>
            <strong>{d.valor}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Funnel Horizontal ---- */
function Funnel({ etapas }) {
  const max = Math.max(...etapas.map((e) => e.total), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {etapas.map((e, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 100, fontSize: 11, color: "var(--ink-faint)", textAlign: "right", flexShrink: 0 }}>{e.nome}</span>
          <div style={{ flex: 1, height: 22, background: "var(--gray-soft)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
            <div style={{ width: `${Math.max((e.total / max) * 100, 2)}%`, height: "100%", background: e.cor || "var(--green)", borderRadius: 4, transition: "width .5s" }} />
            <span style={{ position: "absolute", right: 8, top: 3, fontSize: 11, fontWeight: 700, color: e.total > max * 0.3 ? "#fff" : "var(--ink)" }}>{e.total}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- Meta Gauge ---- */
function MetaGauge({ label, atual, meta, fmt }) {
  const pct = meta > 0 ? (atual / meta) * 100 : 0;
  const cor = pct >= 100 ? "#22c55e" : pct >= 70 ? "#f59e0b" : "#ef4444";
  return (
    <div className="dmeta">
      <div className="dmeta-head"><span>{label}</span><span style={{ fontWeight: 700, color: cor }}>{fmt(atual)} <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>/ {fmt(meta)}</span></span></div>
      <div className="dmeta-bar"><div style={{ width: `${Math.min(pct, 100)}%`, background: cor }} /></div>
    </div>
  );
}

/* ---- Vendedor Card ---- */
function VendedorCard({ pessoa, leads, etGanho, etPerdido, tarefas, meta }) {
  const ganhos = leads.filter((l) => etGanho.has(l.etapaId));
  const receita = ganhos.reduce((s, l) => s + (l.valor || 0), 0);
  const conversao = leads.length > 0 ? (ganhos.length / leads.length) * 100 : 0;
  const hoje = new Date().toISOString().slice(0, 10);
  const pendentes = tarefas.filter((t) => !t.status || t.status === "pendente");
  const atrasadas = pendentes.filter((t) => t.dataPrevista && t.dataPrevista < hoje);
  const m = meta || {};
  const fmtR = (v) => fmtMoeda(Number(v || 0));
  const fmtN = (v) => String(v || 0);
  const pctVendas = m.meta_fechamento > 0 ? (ganhos.length / m.meta_fechamento) * 100 : 0;
  const status = pctVendas >= 100 ? "acima" : pctVendas >= 70 ? "ok" : pctVendas > 0 ? "abaixo" : "";

  return (
    <div className="dvendedor">
      <div className="dvendedor-head">
        <div className="dvendedor-avatar">{(pessoa.nome || "?").charAt(0)}</div>
        <div>
          <div className="dvendedor-nome">{pessoa.nome}</div>
          <div className="dvendedor-sub">{leads.length} leads · {ganhos.length} vendas</div>
        </div>
        {status && <span className={`dvendedor-badge dvendedor-${status}`}>{status === "acima" ? "✓ Acima" : status === "ok" ? "→ No caminho" : "⚠ Abaixo"}</span>}
      </div>
      <div className="dvendedor-stats">
        <div><span className="dvendedor-n" style={{ color: "#22c55e" }}>{ganhos.length}</span><span className="dvendedor-l">Vendas</span></div>
        <div><span className="dvendedor-n">{fmtR(receita)}</span><span className="dvendedor-l">Receita</span></div>
        <div><span className="dvendedor-n">{pendentes.length}</span><span className="dvendedor-l">Tarefas</span></div>
        <div><span className="dvendedor-n" style={{ color: atrasadas.length > 0 ? "#ef4444" : "" }}>{atrasadas.length}</span><span className="dvendedor-l">Atrasadas</span></div>
      </div>
      {m.meta_fechamento > 0 && <div style={{ marginTop: 10 }}>
        <MetaGauge label="Vendas" atual={ganhos.length} meta={Number(m.meta_fechamento)} fmt={fmtN} />
        {m.meta_faturamento > 0 && <MetaGauge label="Faturamento" atual={receita} meta={Number(m.meta_faturamento)} fmt={fmtR} />}
      </div>}
    </div>
  );
}

/* ================ DASHBOARD ================ */
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
    setVendedorFiltro((prev) => { const sem = prev.filter((v) => v !== "todos"); return sem.includes(id) ? (sem.length === 1 ? ["todos"] : sem.filter((v) => v !== id)) : [...sem, id]; });
  };
  const filtroAtivo = vendedorFiltro.includes("todos");

  const stats = useMemo(() => {
    const desde = dataInicio(periodo);
    const leads = (crm?.leads || []).filter((l) => l.criadoEm >= desde);
    const fl = filtroAtivo ? leads : leads.filter((l) => vendedorFiltro.includes(l.responsavelId));
    const etGanho = new Set((crm?.etapas || []).filter((e) => e.tipo === "ganho").map((e) => e.id));
    const etPerdido = new Set((crm?.etapas || []).filter((e) => e.tipo === "perdido").map((e) => e.id));
    const ganhos = fl.filter((l) => etGanho.has(l.etapaId));
    const perdidos = fl.filter((l) => etPerdido.has(l.etapaId));
    const emAberto = fl.filter((l) => !etGanho.has(l.etapaId) && !etPerdido.has(l.etapaId));
    const receitaGanha = ganhos.reduce((s, l) => s + (l.valor || 0), 0);
    const receitaPerdida = perdidos.reduce((s, l) => s + (l.valor || 0), 0);
    const conversao = fl.length > 0 ? (ganhos.length / fl.length) * 100 : 0;
    const hoje = new Date().toISOString().slice(0, 10);
    const tf = filtroAtivo ? (tarefas || []) : (tarefas || []).filter((t) => vendedorFiltro.includes(t.responsavelId));
    const pendentes = tf.filter((t) => !t.status || t.status === "pendente");
    const concluidas = tf.filter((t) => t.status === "concluida" || t.status === "concluído");
    const atrasadas = pendentes.filter((t) => t.dataPrevista && t.dataPrevista < hoje);
    const etReuniao = (crm?.etapas || []).filter((e) => e.nome?.toLowerCase().includes("reunião") || e.nome?.toLowerCase().includes("reuniao"));
    const reunioes = (crm?.leads || []).filter((l) => etReuniao.some((e) => e.id === l.etapaId) && !etGanho.has(l.etapaId) && !etPerdido.has(l.etapaId));
    const ativos = (clientes || []).filter((c) => c.ativo);
    const mrr = ativos.reduce((s, c) => s + (Number(c.ticket) || 0), 0);
    const etapas = (crm?.etapas || []).sort((a, b) => a.ordem - b.ordem);
    const leadsPorEtapa = etapas.map((e) => ({ nome: e.nome, total: fl.filter((l) => l.etapaId === e.id).length, cor: e.tipo === "ganho" ? "#22c55e" : e.tipo === "perdido" ? "#ef4444" : "#16a34a" }));
    return { totalLeads: fl.length, ganhos: ganhos.length, perdidos: perdidos.length, emAberto: emAberto.length, receitaGanha, receitaPerdida, conversao, pendentes: pendentes.length, concluidas: concluidas.length, atrasadas: atrasadas.length, clientesAtivos: ativos.length, mrr, leadsPorEtapa, reunioes, etGanho, etPerdido, leads, allLeads: crm?.leads || [] };
  }, [crm, tarefas, clientes, periodo, vendedorFiltro]);

  // Tarefas CRM
  const tarefasCRM = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const leadsMap = {}; (crm?.leads || []).forEach((l) => { leadsMap[l.id] = l; });
    return (crm?.atividades || []).filter((a) => a.tipo === "tarefa" && a.status !== "cancelada").map((a) => ({
      ...a, leadNome: leadsMap[a.leadId]?.nome || "—", atrasada: a.dataPrevista && a.dataPrevista.slice(0, 10) < hoje && a.status !== "concluida",
      pendente: !a.status || a.status === "pendente", concluida: a.status === "concluida",
    })).sort((a, b) => a.atrasada === b.atrasada ? 0 : a.atrasada ? -1 : 1);
  }, [crm]);

  return (
    <>
      <div className="page-head">
        <div><h1>Dashboard</h1><p>Visão geral do período</p></div>
        <div className="head-actions">
          {isAdmin && <div className="dash-vf">{[{ id: "todos", l: "Todos" }, ...vendedores.map((p) => ({ id: p.id, l: p.nome?.split(" ")[0] }))].map((v) => (
            <button key={v.id} className={`dash-vf-btn ${vendedorFiltro.includes(v.id) ? "active" : ""}`} onClick={() => toggleVendedor(v.id)}>{v.l}</button>
          ))}</div>}
          {onReload && <button className="toolbar-btn" onClick={onReload}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> Atualizar</button>}
          <select className="select" style={{ width: "auto" }} value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {PERIODOS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="dkpi-grid">
        <KpiCard icon="📊" label="Leads recebidos" valor={stats.totalLeads} sub={`${stats.emAberto} em aberto`} />
        <KpiCard icon="🏆" label="Vendas" valor={stats.ganhos} cor="#22c55e" sub={`${stats.conversao.toFixed(1)}% conversão`} />
        <KpiCard icon="💰" label="Receita ganha" valor={fmtMoeda(stats.receitaGanha)} cor="#22c55e" />
        <KpiCard icon="📉" label="Receita perdida" valor={fmtMoeda(stats.receitaPerdida)} cor="#ef4444" />
        <KpiCard icon="👥" label="Clientes ativos" valor={stats.clientesAtivos} sub={`MRR ${fmtMoeda(stats.mrr)}`} />
        <KpiCard icon="📈" label="Conversão" valor={`${stats.conversao.toFixed(1)}%`} cor={stats.conversao >= 4 ? "#22c55e" : "#f59e0b"} />
      </div>

      <div className="dgrid-2">
        {/* Tarefas resumo + Distribuição */}
        <div className="dcard">
          <div className="dcard-head"><h3>Tarefas</h3></div>
          <div className="dtarefas-resumo">
            <div className="dtarefa-pill"><span className="dtarefa-n" style={{ color: "#f59e0b" }}>{stats.pendentes}</span>Pendentes</div>
            <div className="dtarefa-pill"><span className="dtarefa-n" style={{ color: "#ef4444" }}>{stats.atrasadas}</span>Atrasadas</div>
            <div className="dtarefa-pill"><span className="dtarefa-n" style={{ color: "#22c55e" }}>{stats.concluidas}</span>Concluídas</div>
          </div>
        </div>
        <div className="dcard">
          <div className="dcard-head"><h3>Distribuição de leads</h3></div>
          <Donut data={[
            { label: "Ganhos", valor: stats.ganhos, cor: "#22c55e" },
            { label: "Em aberto", valor: stats.emAberto, cor: "#3b82f6" },
            { label: "Perdidos", valor: stats.perdidos, cor: "#ef4444" },
          ]} />
        </div>
      </div>

      {/* Tarefas CRM detalhadas */}
      {tarefasCRM.length > 0 && (
      <div className="dcard" style={{ marginTop: 16 }}>
        <div className="dcard-head"><h3>Tarefas do CRM</h3><span className="dcard-count">{tarefasCRM.length}</span></div>
        <div className="dtarefas-lista">
          {tarefasCRM.slice(0, 15).map((t) => (
            <div key={t.id} className={`dtarefa-row ${t.atrasada ? "dtarefa-atrasada" : ""}`}
              onClick={() => onVerLead && onVerLead(t.leadId)}>
              <div className="dtarefa-dot" style={{ background: t.concluida ? "#22c55e" : t.atrasada ? "#ef4444" : "#f59e0b" }} />
              <div className="dtarefa-info">
                <div className="dtarefa-desc">{t.descricao}</div>
                <div className="dtarefa-meta">📋 {t.leadNome}{t.dataPrevista && <span> · {t.dataPrevista.slice(0, 10).split("-").reverse().join("/")}</span>}{t.responsavelNome && <span> · {t.responsavelNome}</span>}</div>
              </div>
              <span className={`dtarefa-badge ${t.atrasada ? "badge-red" : t.pendente ? "badge-yellow" : "badge-green"}`}>
                {t.atrasada ? "ATRASADA" : t.concluida ? "CONCLUÍDA" : "PENDENTE"}
              </span>
            </div>
          ))}
        </div>
      </div>
      )}

      <div className="dgrid-2" style={{ marginTop: 16 }}>
        {/* Funil */}
        <div className="dcard">
          <div className="dcard-head"><h3>Funil de conversão</h3></div>
          {stats.leadsPorEtapa?.length > 0 ? <Funnel etapas={stats.leadsPorEtapa} /> : <p className="dcard-empty">Sem dados no período</p>}
        </div>
        {/* Reuniões */}
        <div className="dcard">
          <div className="dcard-head"><h3>Reuniões agendadas</h3><span className="dcard-count">{stats.reunioes?.length || 0}</span></div>
          {stats.reunioes?.length > 0 ? <div className="dreuniao-lista">{stats.reunioes.map((l) => (
            <div key={l.id} className="dreuniao-item" onClick={() => onVerLead && onVerLead(l.id)}>
              <div className="dreuniao-dot" /><strong>{l.nome}</strong>{l.whatsapp && <span className="dreuniao-num">{l.whatsapp}</span>}
            </div>
          ))}</div> : <p className="dcard-empty">Nenhuma reunião agendada</p>}
        </div>
      </div>

      {/* Vendedores */}
      {isAdmin && vendedores.length > 0 && (
      <div style={{ marginTop: 24 }}>
        <h2 className="dsection-title">Desempenho por vendedor</h2>
        <div className="dvendedor-grid">
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
