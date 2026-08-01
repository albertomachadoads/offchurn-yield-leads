import { useEffect, useMemo, useState } from "react";
import { fmtMoeda } from "./utils.js";
import * as api from "./api.js";

/* ============================================================
   Dashboard — Página inicial com métricas principais.
   ============================================================ */

const PERIODOS = [
  { v: "7d", l: "7 dias" },
  { v: "15d", l: "15 dias" },
  { v: "30d", l: "30 dias" },
  { v: "90d", l: "90 dias" },
  { v: "mes", l: "Este mês" },
  { v: "ano", l: "Este ano" },
];

function dataInicio(periodo) {
  const d = new Date();
  if (periodo === "7d") d.setDate(d.getDate() - 7);
  else if (periodo === "15d") d.setDate(d.getDate() - 15);
  else if (periodo === "30d") d.setDate(d.getDate() - 30);
  else if (periodo === "90d") d.setDate(d.getDate() - 90);
  else if (periodo === "mes") { d.setDate(1); }
  else if (periodo === "ano") { d.setMonth(0); d.setDate(1); }
  return d.toISOString();
}

function Tile({ label, valor, sub, cor }) {
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className="value" style={cor ? { color: cor } : {}}>{valor}</div>
      {sub && <div className="hint">{sub}</div>}
    </div>
  );
}

function BarraSimples({ label, valor, max, cor }) {
  const pct = max > 0 ? Math.min((valor / max) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: "var(--ink-faint)" }}>{valor}</span>
      </div>
      <div style={{ height: 8, background: "var(--gray-soft)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: cor || "var(--green)", borderRadius: 4, transition: "width .4s" }} />
      </div>
    </div>
  );
}

export default function Dashboard({ clientes, tarefas, onToast }) {
  const [periodo, setPeriodo] = useState("30d");
  const [crm, setCrm] = useState(null);

  useEffect(() => { api.fetchCRM().then(setCrm).catch(() => {}); }, []);

  const stats = useMemo(() => {
    const desde = dataInicio(periodo);

    // CRM
    const leads = (crm?.leads || []).filter((l) => l.criadoEm >= desde);
    const etGanho = new Set((crm?.etapas || []).filter((e) => e.tipo === "ganho").map((e) => e.id));
    const etPerdido = new Set((crm?.etapas || []).filter((e) => e.tipo === "perdido").map((e) => e.id));
    const ganhos = leads.filter((l) => etGanho.has(l.etapaId));
    const perdidos = leads.filter((l) => etPerdido.has(l.etapaId));
    const emAberto = leads.filter((l) => !etGanho.has(l.etapaId) && !etPerdido.has(l.etapaId));
    const receitaGanha = ganhos.reduce((s, l) => s + (l.valor || 0), 0);
    const receitaPerdida = perdidos.reduce((s, l) => s + (l.valor || 0), 0);
    const conversao = leads.length > 0 ? (ganhos.length / leads.length) * 100 : 0;

    // Tarefas
    const hoje = new Date().toISOString().slice(0, 10);
    const tarefasPeriodo = (tarefas || []).filter((t) => t.criadoEm >= desde);
    const pendentes = tarefasPeriodo.filter((t) => t.status === "pendente" || !t.status);
    const concluidas = tarefasPeriodo.filter((t) => t.status === "concluida" || t.status === "concluído");
    const atrasadas = pendentes.filter((t) => t.dataPrevista && t.dataPrevista < hoje);

    // Clientes
    const ativos = (clientes || []).filter((c) => c.ativo);
    const mrr = ativos.reduce((s, c) => s + (Number(c.ticket) || 0), 0);

    // Leads por etapa (para gráfico)
    const etapas = (crm?.etapas || []).sort((a, b) => a.ordem - b.ordem);
    const leadsPorEtapa = etapas.map((e) => ({
      nome: e.nome,
      total: leads.filter((l) => l.etapaId === e.id).length,
      cor: e.tipo === "ganho" ? "#22c55e" : e.tipo === "perdido" ? "#ef4444" : "var(--green)",
    }));

    return {
      totalLeads: leads.length, ganhos: ganhos.length, perdidos: perdidos.length, emAberto: emAberto.length,
      receitaGanha, receitaPerdida, conversao,
      pendentes: pendentes.length, concluidas: concluidas.length, atrasadas: atrasadas.length,
      totalTarefas: tarefasPeriodo.length,
      clientesAtivos: ativos.length, mrr, leadsPorEtapa,
    };
  }, [crm, tarefas, clientes, periodo]);

  const maxEtapa = Math.max(...(stats.leadsPorEtapa?.map((e) => e.total) || [1]), 1);

  return (
    <>
      <div className="page-head">
        <div><h1>Dashboard</h1><p>Visão geral do período</p></div>
        <div className="head-actions">
          <select className="select" style={{ width: "auto" }} value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {PERIODOS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="tiles dash-tiles">
        <Tile label="Leads recebidos" valor={stats.totalLeads} sub={`${stats.emAberto} em aberto`} />
        <Tile label="Vendas" valor={stats.ganhos} cor="var(--green)" sub={`${stats.conversao.toFixed(1)}% conversão`} />
        <Tile label="Receita ganha" valor={fmtMoeda(stats.receitaGanha)} cor="var(--green)" />
        <Tile label="Receita perdida" valor={fmtMoeda(stats.receitaPerdida)} cor="var(--red)" />
        <Tile label="Clientes ativos" valor={stats.clientesAtivos} sub={`MRR ${fmtMoeda(stats.mrr)}`} />
        <Tile label="Taxa conversão" valor={`${stats.conversao.toFixed(1)}%`} cor={stats.conversao >= 4 ? "var(--green)" : "var(--amber, #e6a817)"} />
      </div>

      <div className="dash-grid">
        {/* Tarefas */}
        <div className="card card-pad">
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800 }}>Tarefas</h3>
          <div className="dash-tarefas-grid">
            <div className="dash-tarefa-item">
              <div className="dash-tarefa-num" style={{ color: "var(--amber, #e6a817)" }}>{stats.pendentes}</div>
              <div className="dash-tarefa-label">Pendentes</div>
            </div>
            <div className="dash-tarefa-item">
              <div className="dash-tarefa-num" style={{ color: "var(--red)" }}>{stats.atrasadas}</div>
              <div className="dash-tarefa-label">Atrasadas</div>
            </div>
            <div className="dash-tarefa-item">
              <div className="dash-tarefa-num" style={{ color: "var(--green)" }}>{stats.concluidas}</div>
              <div className="dash-tarefa-label">Concluídas</div>
            </div>
          </div>
          {stats.totalTarefas > 0 && (
            <div style={{ marginTop: 14 }}>
              <BarraSimples label="Concluídas" valor={stats.concluidas} max={stats.totalTarefas} cor="#22c55e" />
              <BarraSimples label="Pendentes" valor={stats.pendentes} max={stats.totalTarefas} cor="#f59e0b" />
              <BarraSimples label="Atrasadas" valor={stats.atrasadas} max={stats.totalTarefas} cor="#ef4444" />
            </div>
          )}
        </div>

        {/* Funil */}
        <div className="card card-pad">
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800 }}>Leads por etapa</h3>
          {stats.leadsPorEtapa?.length > 0 ? stats.leadsPorEtapa.map((e, i) => (
            <BarraSimples key={i} label={e.nome} valor={e.total} max={maxEtapa} cor={e.cor} />
          )) : <p style={{ fontSize: 12, color: "var(--ink-faint)" }}>Sem dados no período</p>}
        </div>
      </div>

      {/* Resumo rápido */}
      <div className="dash-grid" style={{ marginTop: 16 }}>
        <div className="card card-pad">
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800 }}>Distribuição de leads</h3>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, textAlign: "center", padding: "12px 0", background: "var(--green-softer)", borderRadius: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--green)" }}>{stats.ganhos}</div>
              <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>Ganhos</div>
            </div>
            <div style={{ flex: 1, textAlign: "center", padding: "12px 0", background: "#fef3c7", borderRadius: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#d97706" }}>{stats.emAberto}</div>
              <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>Em aberto</div>
            </div>
            <div style={{ flex: 1, textAlign: "center", padding: "12px 0", background: "#fee2e2", borderRadius: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#dc2626" }}>{stats.perdidos}</div>
              <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>Perdidos</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
