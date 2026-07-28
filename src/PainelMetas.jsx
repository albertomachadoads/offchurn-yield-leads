import { useEffect, useMemo, useState } from "react";
import { fmtMoeda } from "./utils";
import { supabase } from "./supabaseClient.js";
import * as api from "./api.js";

/* ============================================================
   Painel de Metas — gestão à vista com metas vs realizado.
   Integrado com CRM e dados de clientes.
   ============================================================ */

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const comp = (ano, mes) => `${ano}-${String(mes + 1).padStart(2, "0")}`;
const pct = (a, b) => b > 0 ? Math.min((a / b) * 100, 999).toFixed(1) : "0.0";

/* Barra de progresso */
function BarraProg({ label, atual, meta, fmt, cor }) {
  const p = meta > 0 ? Math.min((atual / meta) * 100, 100) : 0;
  const atingiu = atual >= meta && meta > 0;
  return (
    <div className="mp-barra">
      <div className="mp-barra-head">
        <span className="mp-barra-label">{label}</span>
        <span className="mp-barra-nums">{fmt(atual)} / {fmt(meta)}</span>
      </div>
      <div className="mp-barra-track">
        <div className="mp-barra-fill" style={{ width: `${p}%`, background: atingiu ? "var(--green)" : cor || "var(--green)" }} />
      </div>
      <div className="mp-barra-pct" style={{ color: atingiu ? "var(--green)" : p < 50 ? "var(--red)" : "var(--amber, #e6a817)" }}>{p.toFixed(0)}%</div>
    </div>
  );
}

/* Pizza CSS */
function Pizza({ fatias }) {
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  if (total === 0) return <p style={{ fontSize: 12, color: "var(--ink-faint)" }}>Sem dados</p>;
  let acc = 0;
  const grad = fatias.map((f) => { const start = (acc / total) * 360; acc += f.valor; return `${f.cor} ${start}deg ${(acc / total) * 360}deg`; });
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ width: 110, height: 110, borderRadius: "50%", background: `conic-gradient(${grad.join(", ")})`, flexShrink: 0 }} />
      <div>{fatias.map((f, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 3 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: f.cor, flexShrink: 0 }} />{f.label}: <strong>{f.valor}</strong>
      </div>)}</div>
    </div>
  );
}

/* Barra vertical (gráfico de colunas) */
function GraficoColunas({ dados, labelKey, valorKey, metaKey, titulo }) {
  const max = Math.max(...dados.map((d) => Math.max(d[valorKey] || 0, d[metaKey] || 0)), 1);
  return (
    <div>
      <h4 className="mp-chart-title">{titulo}</h4>
      <div className="mp-colunas">
        {dados.map((d, i) => (
          <div key={i} className="mp-col-grupo">
            <div className="mp-col-barras">
              <div className="mp-col-bar mp-col-meta" style={{ height: `${((d[metaKey] || 0) / max) * 140}px` }} title={`Meta: ${d[metaKey]}`} />
              <div className="mp-col-bar mp-col-real" style={{ height: `${((d[valorKey] || 0) / max) * 140}px`, background: (d[valorKey] || 0) >= (d[metaKey] || 0) ? "var(--green)" : "var(--amber, #e6a817)" }} title={`Real: ${d[valorKey]}`} />
            </div>
            <span className="mp-col-label">{d[labelKey]}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 14, fontSize: 10, color: "var(--ink-faint)", marginTop: 6 }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "var(--gray-soft)", borderRadius: 2, marginRight: 4 }} />Meta</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "var(--green)", borderRadius: 2, marginRight: 4 }} />Realizado</span>
      </div>
    </div>
  );
}

/* Funil visual */
function GraficoFunil({ etapas }) {
  const maxV = Math.max(...etapas.map((e) => e.valor), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {etapas.map((e, i) => {
        const w = Math.max((e.valor / maxV) * 100, 10);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: `${w}%`, transition: "width .4s", padding: "6px 12px", background: e.cor || "var(--green)", borderRadius: 4, color: "#fff", fontWeight: 700, fontSize: 12, textAlign: "center", minWidth: 40 }}>{e.valor}</div>
            <span style={{ fontSize: 12, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>{e.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---- Componente principal ---- */
export default function PainelMetas({ clientes, onToast }) {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mesSel, setMesSel] = useState(new Date().getMonth());
  const [metas, setMetas] = useState({});
  const [editando, setEditando] = useState(false);
  const [crm, setCrm] = useState(null);
  const [form, setForm] = useState({});

  const competencia = comp(ano, mesSel);

  // Carregar metas do ano
  useEffect(() => {
    supabase.from("metas_comerciais").select("*")
      .gte("competencia", `${ano}-01`).lte("competencia", `${ano}-12`)
      .then(({ data }) => {
        const map = {};
        (data || []).forEach((m) => { map[m.competencia] = m; });
        setMetas(map);
        if (map[competencia]) setForm(map[competencia]);
        else setForm({ competencia, investimento: 0, meta_leads: 0, cpl_meta: 0, taxa_conversao_meta: 4, meta_fechamento: 0, ticket_medio_meta: 0, meta_faturamento: 0, meta_churn: 5, meta_mrr: 0, meta_novos_clientes: 0, meta_produtos: 0 });
      });
  }, [ano, competencia]);

  // Carregar CRM
  useEffect(() => { api.fetchCRM().then(setCrm).catch(() => {}); }, []);

  // Dados reais do mês
  const real = useMemo(() => {
    const ativos = (clientes || []).filter((c) => c.ativo);
    const mrr = ativos.reduce((s, c) => s + (Number(c.ticket) || 0), 0);
    const ticketMedio = ativos.length > 0 ? mrr / ativos.length : 0;

    // CRM do mês
    let leadsTotal = 0, ganhos = 0, perdidos = 0, receitaGanha = 0, produtosVendidos = 0;
    if (crm) {
      const leadsDoMes = (crm.leads || []).filter((l) => (l.criadoEm || "").startsWith(competencia));
      leadsTotal = leadsDoMes.length;
      const etGanho = new Set((crm.etapas || []).filter((e) => e.tipo === "ganho").map((e) => e.id));
      const etPerdido = new Set((crm.etapas || []).filter((e) => e.tipo === "perdido").map((e) => e.id));
      ganhos = leadsDoMes.filter((l) => etGanho.has(l.etapaId)).length;
      perdidos = leadsDoMes.filter((l) => etPerdido.has(l.etapaId)).length;
      receitaGanha = leadsDoMes.filter((l) => etGanho.has(l.etapaId)).reduce((s, l) => s + (l.valor || 0), 0);
      produtosVendidos = leadsDoMes.filter((l) => etGanho.has(l.etapaId) && l.produtoId).length;
    }

    const conversao = leadsTotal > 0 ? (ganhos / leadsTotal) * 100 : 0;
    const churnReal = ativos.length > 0 ? ((clientes || []).filter((c) => !c.ativo).length / (clientes || []).length) * 100 : 0;

    return { clientes: ativos.length, mrr, ticketMedio, leadsTotal, ganhos, perdidos, receitaGanha, conversao, churnReal, produtosVendidos };
  }, [clientes, crm, competencia]);

  const m = metas[competencia] || {};

  async function salvarMeta() {
    try {
      const row = { ...form, competencia, atualizado_em: new Date().toISOString() };
      await supabase.from("metas_comerciais").upsert(row, { onConflict: "competencia" });
      setMetas((p) => ({ ...p, [competencia]: row }));
      setEditando(false);
      onToast("Metas salvas");
    } catch (e) { onToast("Erro: " + e.message); }
  }

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const fmtN = (v) => Number(v || 0).toLocaleString("pt-BR");
  const fmtR = (v) => fmtMoeda(Number(v || 0));
  const fmtP = (v) => `${Number(v || 0).toFixed(1)}%`;

  // Dados para gráfico de colunas mensal
  const colunasAnual = MESES.map((mes, i) => {
    const c = comp(ano, i);
    const meta = metas[c] || {};
    const leadsDoMes = crm ? (crm.leads || []).filter((l) => (l.criadoEm || "").startsWith(c)).length : 0;
    const etGanho = crm ? new Set((crm.etapas || []).filter((e) => e.tipo === "ganho").map((e) => e.id)) : new Set();
    const ganhosDoMes = crm ? (crm.leads || []).filter((l) => (l.criadoEm || "").startsWith(c) && etGanho.has(l.etapaId)).length : 0;
    return { mes, leads: leadsDoMes, metaLeads: Number(meta.meta_leads) || 0, vendas: ganhosDoMes, metaVendas: Number(meta.meta_fechamento) || 0 };
  });

  // Etapas do funil para gráfico
  const etapasFunil = useMemo(() => {
    if (!crm) return [];
    const etapas = (crm.etapas || []).sort((a, b) => a.ordem - b.ordem);
    const leads = (crm.leads || []).filter((l) => (l.criadoEm || "").startsWith(competencia));
    return etapas.map((e) => ({ label: e.nome, valor: leads.filter((l) => l.etapaId === e.id).length, cor: e.cor }));
  }, [crm, competencia]);

  return (
    <>
      <div className="page-head">
        <div><h1>Painel de Metas</h1><p>Gestão à vista — {MESES[mesSel]} {ano}</p></div>
        <div className="head-actions">
          <button className="btn btn-sm" onClick={() => setAno(ano - 1)}>◀</button>
          <span style={{ fontWeight: 700 }}>{ano}</span>
          <button className="btn btn-sm" onClick={() => setAno(ano + 1)}>▶</button>
          <button className={`btn btn-sm ${editando ? "btn-primary" : ""}`} onClick={() => { if (editando) salvarMeta(); else setEditando(true); }}>
            {editando ? "Salvar metas" : "Editar metas"}
          </button>
        </div>
      </div>

      {/* Seletor de mês */}
      <div className="mp-meses">
        {MESES.map((mes, i) => (
          <button key={i} className={`mp-mes ${i === mesSel ? "mp-mes-ativo" : ""}`} onClick={() => setMesSel(i)}>{mes}</button>
        ))}
      </div>

      {/* KPIs principais */}
      <div className="tiles mp-tiles">
        <div className="tile"><div className="label">Clientes ativos</div><div className="value">{real.clientes}</div><div className="hint">MRR: {fmtR(real.mrr)}</div></div>
        <div className="tile"><div className="label">Leads no mês</div><div className="value">{real.leadsTotal}</div><div className="hint">Meta: {fmtN(m.meta_leads)}</div></div>
        <div className="tile"><div className="label">Vendas</div><div className="value" style={{ color: "var(--green)" }}>{real.ganhos}</div><div className="hint">Meta: {fmtN(m.meta_fechamento)}</div></div>
        <div className="tile"><div className="label">Receita ganha</div><div className="value" style={{ color: "var(--green)" }}>{fmtR(real.receitaGanha)}</div><div className="hint">Meta: {fmtR(m.meta_faturamento)}</div></div>
        <div className="tile"><div className="label">Ticket médio</div><div className="value">{fmtR(real.ticketMedio)}</div><div className="hint">Meta: {fmtR(m.ticket_medio_meta)}</div></div>
        <div className="tile"><div className="label">Conversão</div><div className="value" style={{ color: real.conversao >= (m.taxa_conversao_meta || 0) ? "var(--green)" : "var(--red)" }}>{fmtP(real.conversao)}</div><div className="hint">Meta: {fmtP(m.taxa_conversao_meta)}</div></div>
      </div>

      {/* Barras de progresso */}
      <div className="mp-grid">
        <div className="card card-pad">
          <h3 className="mp-chart-title">Metas de tráfego</h3>
          <BarraProg label="Investimento" atual={0} meta={Number(m.investimento) || 0} fmt={fmtR} cor="#3b82f6" />
          <BarraProg label="Leads" atual={real.leadsTotal} meta={Number(m.meta_leads) || 0} fmt={fmtN} cor="#8b5cf6" />
          <BarraProg label="CPL" atual={real.leadsTotal > 0 ? (Number(m.investimento) || 0) / real.leadsTotal : 0} meta={Number(m.cpl_meta) || 0} fmt={fmtR} cor="#f59e0b" />
        </div>
        <div className="card card-pad">
          <h3 className="mp-chart-title">Metas comerciais</h3>
          <BarraProg label="Fechamentos" atual={real.ganhos} meta={Number(m.meta_fechamento) || 0} fmt={fmtN} cor="#22c55e" />
          <BarraProg label="Faturamento" atual={real.receitaGanha} meta={Number(m.meta_faturamento) || 0} fmt={fmtR} cor="#22c55e" />
          <BarraProg label="Produtos vendidos" atual={real.produtosVendidos} meta={Number(m.meta_produtos) || 0} fmt={fmtN} cor="#14b8a6" />
          <BarraProg label="Novos clientes" atual={real.ganhos} meta={Number(m.meta_novos_clientes) || 0} fmt={fmtN} cor="#3b82f6" />
        </div>
      </div>

      {/* Gráficos */}
      <div className="mp-grid">
        <div className="card card-pad">
          <h3 className="mp-chart-title">Funil do mês</h3>
          {etapasFunil.length > 0 ? <GraficoFunil etapas={etapasFunil} /> : <p style={{ fontSize: 12, color: "var(--ink-faint)" }}>Sem dados do CRM</p>}
        </div>
        <div className="card card-pad">
          <h3 className="mp-chart-title">Distribuição de leads</h3>
          <Pizza fatias={[
            { label: "Ganhos", valor: real.ganhos, cor: "#22c55e" },
            { label: "Perdidos", valor: real.perdidos, cor: "#ef4444" },
            { label: "Em aberto", valor: Math.max(0, real.leadsTotal - real.ganhos - real.perdidos), cor: "#3b82f6" },
          ]} />
        </div>
      </div>

      <div className="mp-grid">
        <div className="card card-pad">
          <GraficoColunas dados={colunasAnual} labelKey="mes" valorKey="leads" metaKey="metaLeads" titulo={`Leads — ${ano}`} />
        </div>
        <div className="card card-pad">
          <GraficoColunas dados={colunasAnual} labelKey="mes" valorKey="vendas" metaKey="metaVendas" titulo={`Vendas — ${ano}`} />
        </div>
      </div>

      {/* Editor de metas */}
      {editando && (
        <div className="card card-pad" style={{ marginTop: 16 }}>
          <h3 className="mp-chart-title">Editar metas — {MESES[mesSel]} {ano}</h3>
          <div className="mp-form">
            <div className="form-row"><label>Investimento (R$)</label><input className="input" type="number" value={form.investimento || ""} onChange={(e) => set("investimento", e.target.value)} /></div>
            <div className="form-row"><label>Meta de leads</label><input className="input" type="number" value={form.meta_leads || ""} onChange={(e) => set("meta_leads", e.target.value)} /></div>
            <div className="form-row"><label>CPL meta (R$)</label><input className="input" type="number" step="0.01" value={form.cpl_meta || ""} onChange={(e) => set("cpl_meta", e.target.value)} /></div>
            <div className="form-row"><label>Taxa conversão (%)</label><input className="input" type="number" step="0.1" value={form.taxa_conversao_meta || ""} onChange={(e) => set("taxa_conversao_meta", e.target.value)} /></div>
            <div className="form-row"><label>Meta fechamentos</label><input className="input" type="number" value={form.meta_fechamento || ""} onChange={(e) => set("meta_fechamento", e.target.value)} /></div>
            <div className="form-row"><label>Ticket médio (R$)</label><input className="input" type="number" step="0.01" value={form.ticket_medio_meta || ""} onChange={(e) => set("ticket_medio_meta", e.target.value)} /></div>
            <div className="form-row"><label>Meta faturamento (R$)</label><input className="input" type="number" value={form.meta_faturamento || ""} onChange={(e) => set("meta_faturamento", e.target.value)} /></div>
            <div className="form-row"><label>Meta churn (%)</label><input className="input" type="number" step="0.1" value={form.meta_churn || ""} onChange={(e) => set("meta_churn", e.target.value)} /></div>
            <div className="form-row"><label>Meta MRR (R$)</label><input className="input" type="number" value={form.meta_mrr || ""} onChange={(e) => set("meta_mrr", e.target.value)} /></div>
            <div className="form-row"><label>Meta novos clientes</label><input className="input" type="number" value={form.meta_novos_clientes || ""} onChange={(e) => set("meta_novos_clientes", e.target.value)} /></div>
            <div className="form-row"><label>Meta produtos vendidos</label><input className="input" type="number" value={form.meta_produtos || ""} onChange={(e) => set("meta_produtos", e.target.value)} /></div>
          </div>
        </div>
      )}
    </>
  );
}
