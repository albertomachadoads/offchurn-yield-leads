import { useEffect, useMemo, useState } from "react";
import { fmtMoeda } from "./utils";
import * as api from "./api.js";

/* ============================================================
   Análises do CRM — dashboards de performance comercial.
   Receita ganha/perdida, ticket médio, conversão, funil,
   análise entre funis, movimentações, novos contatos.
   ============================================================ */

const FILTROS = [
  { id: "", l: "Todo o período" },
  { id: "7d", l: "Últimos 7 dias" },
  { id: "15d", l: "Últimos 15 dias" },
  { id: "30d", l: "Últimos 30 dias" },
  { id: "90d", l: "Últimos 90 dias" },
];
const limDate = (f) => { if (!f) return null; const d = new Date(); d.setDate(d.getDate() - parseInt(f)); return d.toISOString(); };
const pct = (a, b) => b > 0 ? ((a / b) * 100).toFixed(1) : "0.0";

/* ---- Barra horizontal ---- */
function Bar({ label, valor, max, cor, sub }) {
  const w = max > 0 ? Math.min((valor / max) * 100, 100) : 0;
  return (
    <div className="ana-bar">
      <div className="ana-bar-head">
        <span className="ana-bar-label">{label}</span>
        <span className="ana-bar-valor" style={{ color: cor }}>{sub || valor}</span>
      </div>
      <div className="ana-bar-track"><div className="ana-bar-fill" style={{ width: `${w}%`, background: cor || "var(--green)" }} /></div>
    </div>
  );
}

/* ---- Gráfico de funil (pirâmide) ---- */
function GraficoFunil({ etapas, leadsPorEtapa }) {
  const maxLeads = Math.max(...etapas.map((e) => (leadsPorEtapa[e.id] || []).length), 1);
  return (
    <div className="funil-chart">
      {etapas.map((e, i) => {
        const qtd = (leadsPorEtapa[e.id] || []).length;
        const w = maxLeads > 0 ? Math.max((qtd / maxLeads) * 100, 8) : 8;
        return (
          <div key={e.id} className="funil-row">
            <div className="funil-bar-wrap" style={{ width: `${w}%` }}>
              <div className="funil-bar" style={{ background: e.cor || "var(--green)" }}>{qtd}</div>
            </div>
            <span className="funil-label">{e.nome}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---- Pizza simples CSS ---- */
function Pizza({ fatias }) {
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  if (total === 0) return <p style={{ fontSize: 12, color: "var(--ink-faint)" }}>Sem dados</p>;
  let acc = 0;
  const gradParts = fatias.map((f) => {
    const start = (acc / total) * 360;
    acc += f.valor;
    const end = (acc / total) * 360;
    return `${f.cor} ${start}deg ${end}deg`;
  });
  return (
    <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
      <div className="pizza-circle" style={{ background: `conic-gradient(${gradParts.join(", ")})` }} />
      <div className="pizza-legend">
        {fatias.map((f, i) => (
          <div key={i} className="pizza-item">
            <span className="pizza-dot" style={{ background: f.cor }} />
            <span>{f.label}: <strong>{f.valor}</strong> ({pct(f.valor, total)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Principal ---- */
export default function CRMAnalises({ onToast }) {
  const [crm, setCrm] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [periodo, setPeriodo] = useState("30d");
  const [funilId, setFunilId] = useState(null);

  async function carregar() {
    try { const d = await api.fetchCRM(); setCrm(d); if (!funilId && d.funis.length > 0) setFunilId(d.funis[0].id); }
    catch (e) { onToast("Erro: " + e.message); } finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  if (carregando) return <div style={{ padding: 40, textAlign: "center" }}>Carregando análises…</div>;
  if (!crm || crm.funis.length === 0) return <div className="empty"><p>Crie funis no CRM para ver as análises.</p></div>;

  const lim = limDate(periodo);
  const funil = crm.funis.find((f) => f.id === funilId) || crm.funis[0];
  const etapas = (crm.etapas || []).filter((e) => e.funilId === funil.id).sort((a, b) => a.ordem - b.ordem);
  const etGanho = etapas.filter((e) => e.tipo === "ganho");
  const etPerdido = etapas.filter((e) => e.tipo === "perdido");
  const idsGanho = new Set(etGanho.map((e) => e.id));
  const idsPerdido = new Set(etPerdido.map((e) => e.id));

  let leads = (crm.leads || []).filter((l) => l.funilId === funil.id);
  if (lim) leads = leads.filter((l) => l.criadoEm >= lim);

  const ganhos = leads.filter((l) => idsGanho.has(l.etapaId));
  const perdidos = leads.filter((l) => idsPerdido.has(l.etapaId));
  const abertos = leads.filter((l) => !idsGanho.has(l.etapaId) && !idsPerdido.has(l.etapaId));

  const receitaGanha = ganhos.reduce((s, l) => s + (l.valor || 0), 0);
  const receitaPerdida = perdidos.reduce((s, l) => s + (l.valor || 0), 0);
  const ticketMedio = ganhos.length > 0 ? receitaGanha / ganhos.length : 0;
  const taxaConversao = leads.length > 0 ? (ganhos.length / leads.length) * 100 : 0;

  // atividades do período
  let atividades = (crm.atividades || []);
  if (lim) atividades = atividades.filter((a) => a.criadoEm >= lim);
  const atvsFunil = atividades.filter((a) => leads.some((l) => l.id === a.leadId));
  const reunioes = atvsFunil.filter((a) => a.tipo === "reuniao").length;
  const ligacoes = atvsFunil.filter((a) => a.tipo === "ligacao").length;
  const tarefas = atvsFunil.filter((a) => a.tipo === "tarefa").length;
  const movimentacoes = atvsFunil.filter((a) => a.tipo === "sistema" && a.descricao?.includes("Movido")).length;
  const novosContatos = leads.length;

  // leads por etapa
  const leadsPorEtapa = {};
  etapas.forEach((e) => { leadsPorEtapa[e.id] = []; });
  leads.forEach((l) => { if (leadsPorEtapa[l.etapaId]) leadsPorEtapa[l.etapaId].push(l); });

  // taxas de progressão entre etapas
  const taxasProgressao = etapas.slice(0, -1).map((e, i) => {
    const qtdAtual = (leadsPorEtapa[e.id] || []).length;
    const qtdProx = (leadsPorEtapa[etapas[i + 1]?.id] || []).length;
    return { de: e.nome, para: etapas[i + 1]?.nome, taxa: qtdAtual > 0 ? (qtdProx / qtdAtual * 100).toFixed(1) : "0.0" };
  });

  // análise entre funis
  const todosFunis = crm.funis.map((f) => {
    const fLeads = (crm.leads || []).filter((l) => l.funilId === f.id);
    const fEtapas = (crm.etapas || []).filter((e) => e.funilId === f.id);
    const fGanho = fLeads.filter((l) => fEtapas.find((e) => e.id === l.etapaId)?.tipo === "ganho");
    return { nome: f.nome, total: fLeads.length, ganhos: fGanho.length, receita: fGanho.reduce((s, l) => s + (l.valor || 0), 0), taxa: fLeads.length > 0 ? (fGanho.length / fLeads.length * 100).toFixed(1) : "0.0" };
  });

  // produtos mais vendidos
  const prodMap = Object.fromEntries((crm.produtos || []).map((p) => [p.id, p]));
  const prodContagem = {};
  ganhos.forEach((l) => { if (l.produtoId) prodContagem[l.produtoId] = (prodContagem[l.produtoId] || 0) + 1; });
  const topProdutos = Object.entries(prodContagem).map(([id, qtd]) => ({ nome: prodMap[id]?.nome || "?", qtd, valor: (prodMap[id]?.valor || 0) * qtd })).sort((a, b) => b.qtd - a.qtd).slice(0, 5);

  return (
    <>
      <div className="page-head">
        <div><h1>Análises do CRM</h1><p>Performance comercial — {funil.nome}</p></div>
        <div className="head-actions">
          <select className="select" style={{ width: "auto" }} value={funilId || ""} onChange={(e) => setFunilId(e.target.value)}>
            {crm.funis.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <select className="select" style={{ width: "auto" }} value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {FILTROS.map((f) => <option key={f.id} value={f.id}>{f.l}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="tiles ana-tiles">
        <div className="tile"><div className="label">Receita ganha</div><div className="value" style={{ color: "var(--green)" }}>{fmtMoeda(receitaGanha)}</div><div className="hint">{ganhos.length} vendas</div></div>
        <div className="tile"><div className="label">Receita perdida</div><div className="value" style={{ color: "var(--red)" }}>{fmtMoeda(receitaPerdida)}</div><div className="hint">{perdidos.length} perdidos</div></div>
        <div className="tile"><div className="label">Em aberto</div><div className="value">{abertos.length}</div><div className="hint">{fmtMoeda(abertos.reduce((s, l) => s + (l.valor || 0), 0))}</div></div>
        <div className="tile"><div className="label">Ticket médio</div><div className="value">{fmtMoeda(ticketMedio)}</div></div>
        <div className="tile"><div className="label">Taxa de conversão</div><div className="value" style={{ color: taxaConversao >= 20 ? "var(--green)" : taxaConversao >= 10 ? "var(--amber, #e6a817)" : "var(--red)" }}>{taxaConversao.toFixed(1)}%</div><div className="hint">{ganhos.length}/{leads.length}</div></div>
        <div className="tile"><div className="label">Novos contatos</div><div className="value">{novosContatos}</div></div>
      </div>

      <div className="ana-grid">
        {/* Gráfico de funil */}
        <div className="card card-pad">
          <h3 className="dash-title" style={{ margin: "0 0 14px" }}>Funil por estágio</h3>
          <GraficoFunil etapas={etapas} leadsPorEtapa={leadsPorEtapa} />
        </div>

        {/* Distribuição ganhos/perdidos/abertos */}
        <div className="card card-pad">
          <h3 className="dash-title" style={{ margin: "0 0 14px" }}>Distribuição de leads</h3>
          <Pizza fatias={[
            { label: "Ganhos", valor: ganhos.length, cor: "#22c55e" },
            { label: "Perdidos", valor: perdidos.length, cor: "#ef4444" },
            { label: "Em aberto", valor: abertos.length, cor: "#3b82f6" },
          ]} />
        </div>
      </div>

      <div className="ana-grid">
        {/* Atividades */}
        <div className="card card-pad">
          <h3 className="dash-title" style={{ margin: "0 0 14px" }}>Atividades</h3>
          <Bar label="Reuniões agendadas" valor={reunioes} max={Math.max(reunioes, ligacoes, tarefas, movimentacoes, 1)} cor="#8b5cf6" sub={reunioes} />
          <Bar label="Ligações" valor={ligacoes} max={Math.max(reunioes, ligacoes, tarefas, movimentacoes, 1)} cor="#3b82f6" sub={ligacoes} />
          <Bar label="Tarefas" valor={tarefas} max={Math.max(reunioes, ligacoes, tarefas, movimentacoes, 1)} cor="#22c55e" sub={tarefas} />
          <Bar label="Movimentações" valor={movimentacoes} max={Math.max(reunioes, ligacoes, tarefas, movimentacoes, 1)} cor="#f59e0b" sub={movimentacoes} />
        </div>

        {/* Taxas de progressão */}
        <div className="card card-pad">
          <h3 className="dash-title" style={{ margin: "0 0 14px" }}>Taxas de progressão</h3>
          {taxasProgressao.length === 0 ? <p style={{ fontSize: 12, color: "var(--ink-faint)" }}>Menos de 2 etapas.</p> : (
            taxasProgressao.map((t, i) => (
              <Bar key={i} label={`${t.de} → ${t.para}`} valor={parseFloat(t.taxa)} max={100} cor="var(--green)" sub={`${t.taxa}%`} />
            ))
          )}
        </div>
      </div>

      {/* Análise entre funis */}
      {crm.funis.length > 1 && (
        <div className="card card-pad" style={{ marginTop: 16 }}>
          <h3 className="dash-title" style={{ margin: "0 0 14px" }}>Análise entre funis</h3>
          <div className="table-wrap">
            <table className="grid">
              <thead><tr><th>Funil</th><th>Total leads</th><th>Ganhos</th><th>Taxa</th><th>Receita</th></tr></thead>
              <tbody>
                {todosFunis.map((f, i) => (
                  <tr key={i}><td className="cell-cliente">{f.nome}</td><td className="cell-num">{f.total}</td><td className="cell-num">{f.ganhos}</td><td className="cell-num">{f.taxa}%</td><td className="cell-num">{fmtMoeda(f.receita)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Produtos mais vendidos */}
      {topProdutos.length > 0 && (
        <div className="card card-pad" style={{ marginTop: 16 }}>
          <h3 className="dash-title" style={{ margin: "0 0 14px" }}>Produtos mais vendidos</h3>
          {topProdutos.map((p, i) => (
            <Bar key={i} label={p.nome} valor={p.qtd} max={topProdutos[0]?.qtd || 1} cor="#22c55e" sub={`${p.qtd}x — ${fmtMoeda(p.valor)}`} />
          ))}
        </div>
      )}
    </>
  );
}
