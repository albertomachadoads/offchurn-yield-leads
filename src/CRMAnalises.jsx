import { useEffect, useMemo, useState } from "react";
import { fmtMoeda } from "./utils";
import { supabase } from "./supabaseClient.js";
import * as api from "./api.js";

/* ============================================================
   Análises do CRM — performance comercial cruzada com a
   origem de mídia (campanha, conjunto e anúncio do Meta).
   ============================================================ */

const FILTROS = [
  { id: "", l: "Todo o período" },
  { id: "7d", l: "Últimos 7 dias" },
  { id: "15d", l: "Últimos 15 dias" },
  { id: "30d", l: "Últimos 30 dias" },
  { id: "90d", l: "Últimos 90 dias" },
  { id: "custom", l: "Personalizado" },
];
const limDate = (f) => { if (!f) return null; const d = new Date(); d.setDate(d.getDate() - parseInt(f)); return d.toISOString(); };
const pct = (a, b) => (b > 0 ? (a / b) * 100 : 0);
const fmtP = (v) => `${v.toFixed(1)}%`;

/* ---------- Cartão de indicador ---------- */
function Kpi({ label, valor, sub, tom }) {
  return (
    <div className={`an-kpi ${tom ? "an-kpi-" + tom : ""}`}>
      <span className="an-kpi-l">{label}</span>
      <span className="an-kpi-v">{valor}</span>
      {sub && <span className="an-kpi-s">{sub}</span>}
    </div>
  );
}

/* ---------- Funil com degradê ---------- */
function Funil({ etapas, contagem, acumulado }) {
  const base = Math.max(acumulado[0] || 1, 1);
  return (
    <div className="an-funil">
      {etapas.map((e, i) => {
        const larg = Math.max(pct(acumulado[i], base), 6);
        const conv = i === 0 ? null : pct(acumulado[i], acumulado[i - 1]);
        const tipo = e.tipo === "ganho" ? "ganho" : e.tipo === "perdido" ? "perdido" : "aberto";
        return (
          <div key={e.id} className="an-funil-linha">
            <div className="an-funil-info">
              <span className="an-funil-nome">{e.nome}</span>
              {conv != null && <span className="an-funil-conv">{fmtP(conv)} avançaram</span>}
            </div>
            <div className="an-funil-trilha">
              <div className={`an-funil-barra an-${tipo}`} style={{ width: `${larg}%` }}>
                <span>{contagem[i]}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Rosca com degradê ---------- */
function Rosca({ fatias, total, legenda }) {
  const S = 168, R = 62, W = 22, CX = S / 2, CY = S / 2;
  const circ = 2 * Math.PI * R;
  const soma = fatias.reduce((a, f) => a + f.v, 0) || 1;
  let off = 0;
  return (
    <div className="an-rosca-wrap">
      <svg viewBox={`0 0 ${S} ${S}`} className="an-rosca">
        <defs>
          {fatias.map((f, i) => (
            <linearGradient key={i} id={`gr${f.id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={f.c1} />
              <stop offset="100%" stopColor={f.c2} />
            </linearGradient>
          ))}
        </defs>
        {fatias.map((f, i) => {
          const dash = (f.v / soma) * circ;
          const o = off; off += dash;
          return f.v > 0 && (
            <circle key={i} cx={CX} cy={CY} r={R} fill="none" stroke={`url(#gr${f.id})`} strokeWidth={W}
              strokeDasharray={`${dash - 2} ${circ - dash + 2}`} strokeDashoffset={-o}
              strokeLinecap="round" transform={`rotate(-90 ${CX} ${CY})`}
              style={{ transition: "stroke-dasharray .5s" }} />
          );
        })}
        <text x={CX} y={CY - 4} textAnchor="middle" className="an-rosca-n">{total}</text>
        <text x={CX} y={CY + 14} textAnchor="middle" className="an-rosca-l">{legenda}</text>
      </svg>
      <div className="an-rosca-leg">
        {fatias.map((f, i) => (
          <div key={i} className="an-leg-item">
            <span className="an-leg-dot" style={{ background: `linear-gradient(135deg, ${f.c1}, ${f.c2})` }} />
            <span className="an-leg-nome">{f.l}</span>
            <strong>{f.v}</strong>
            <span className="an-leg-pct">{fmtP(pct(f.v, soma))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Barra de ranking ---------- */
function BarraRank({ nome, valor, max, sub, cor }) {
  return (
    <div className="an-rank">
      <div className="an-rank-top">
        <span className="an-rank-nome" title={nome}>{nome}</span>
        <span className="an-rank-v">{valor}{sub && <em>{sub}</em>}</span>
      </div>
      <div className="an-rank-trilha">
        <div className="an-rank-barra" style={{ width: `${Math.max(pct(valor, max), 2)}%`, background: cor }} />
      </div>
    </div>
  );
}

/* ================= COMPONENTE ================= */
export default function CRMAnalises({ onToast, pessoas }) {
  const [crm, setCrm] = useState(null);
  const [convs, setConvs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [periodo, setPeriodo] = useState("30d");
  const [funilId, setFunilId] = useState(null);
  const [customDe, setCustomDe] = useState("");
  const [customAte, setCustomAte] = useState("");
  const [agrup, setAgrup] = useState("campanha");  // campanha | conjunto | anuncio
  const [ordenar, setOrdenar] = useState("leads");

  async function carregar() {
    try {
      const d = await api.fetchCRM();
      setCrm(d);
      if (!funilId && d.funis.length > 0) setFunilId(d.funis[0].id);
      const { data } = await supabase.from("wa_conversas")
        .select("numero, lead_id, utm_source, utm_medium, utm_campaign, utm_content, ad_id, ad_app, origem_tipo");
      setConvs(data || []);
    } catch (e) { onToast("Erro: " + e.message); }
    finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  const D = useMemo(() => {
    if (!crm || !crm.funis?.length) return null;

    const lim = periodo === "custom" ? (customDe ? new Date(customDe).toISOString() : null) : limDate(periodo);
    const limAte = periodo === "custom" && customAte ? new Date(customAte + "T23:59:59").toISOString() : null;
    const funil = crm.funis.find((f) => f.id === funilId) || crm.funis[0];
    const etapas = (crm.etapas || []).filter((e) => e.funilId === funil.id).sort((a, b) => a.ordem - b.ordem);
    const idsGanho = new Set(etapas.filter((e) => e.tipo === "ganho").map((e) => e.id));
    const idsPerdido = new Set(etapas.filter((e) => e.tipo === "perdido").map((e) => e.id));

    let leads = (crm.leads || []).filter((l) => l.funilId === funil.id);
    if (lim) leads = leads.filter((l) => l.criadoEm >= lim);
    if (limAte) leads = leads.filter((l) => l.criadoEm <= limAte);

    const ganhos = leads.filter((l) => idsGanho.has(l.etapaId));
    const perdidos = leads.filter((l) => idsPerdido.has(l.etapaId));
    const abertos = leads.filter((l) => !idsGanho.has(l.etapaId) && !idsPerdido.has(l.etapaId));
    const receitaGanha = ganhos.reduce((s, l) => s + (l.valor || 0), 0);
    const receitaPerdida = perdidos.reduce((s, l) => s + (l.valor || 0), 0);
    const valorAberto = abertos.reduce((s, l) => s + (l.valor || 0), 0);

    /* --- Etapas comerciais em ordem, sem "perdido" --- */
    const comerciais = etapas.filter((e) => e.tipo !== "perdido");
    const ordemPorEtapa = {};
    comerciais.forEach((e, i) => { ordemPorEtapa[e.id] = i; });

    const contagem = comerciais.map((e) => leads.filter((l) => l.etapaId === e.id).length);
    // Acumulado: quem está nesta etapa ou já passou dela
    const acumulado = comerciais.map((_, i) =>
      leads.filter((l) => {
        const pos = ordemPorEtapa[l.etapaId];
        return pos !== undefined && pos >= i;
      }).length
    );

    /* --- Marcos: qualificação e reunião --- */
    const acharEtapa = (regex, padraoIdx) => {
      const achou = comerciais.findIndex((e) => regex.test(e.nome || ""));
      return achou >= 0 ? achou : Math.min(padraoIdx, comerciais.length - 1);
    };
    const idxQualif = acharEtapa(/qualific/i, 2);
    const idxReuniao = acharEtapa(/reuni/i, 3);

    const chegouEm = (l, idx) => {
      if (idsGanho.has(l.etapaId)) return true;
      const pos = ordemPorEtapa[l.etapaId];
      return pos !== undefined && pos >= idx;
    };

    /* --- Origem de mídia por lead --- */
    const porLeadId = {}, porTel = {};
    convs.forEach((c) => {
      if (c.lead_id) porLeadId[c.lead_id] = c;
      if (c.numero) porTel[c.numero.slice(-8)] = c;
    });
    const origemDe = (l) => {
      if (l.utmCampaign) return { campanha: l.utmCampaign, conjunto: l.utmMedium, anuncio: l.utmContent, canal: l.utmSource };
      const c = porLeadId[l.id] || porTel[(l.whatsapp || "").replace(/\D/g, "").slice(-8)];
      if (c?.utm_campaign) return { campanha: c.utm_campaign, conjunto: c.utm_medium, anuncio: c.utm_content, canal: c.utm_source };
      if (c?.origem_tipo === "meta_ads") return { campanha: "(anúncio não identificado)", conjunto: null, anuncio: null, canal: c.ad_app };
      return null;
    };

    /* --- Agregação por campanha / conjunto / anúncio --- */
    const chaveDe = (o) => (agrup === "campanha" ? o.campanha : agrup === "conjunto" ? o.conjunto : o.anuncio) || "(não informado)";
    const grupos = {};
    let comOrigem = 0;

    leads.forEach((l) => {
      const o = origemDe(l);
      if (!o) return;
      comOrigem++;
      const k = chaveDe(o);
      if (!grupos[k]) grupos[k] = { nome: k, campanha: o.campanha, leads: 0, qualificados: 0, reunioes: 0, vendas: 0, perdidos: 0, receita: 0 };
      const g = grupos[k];
      g.leads++;
      if (chegouEm(l, idxQualif)) g.qualificados++;
      if (chegouEm(l, idxReuniao)) g.reunioes++;
      if (idsGanho.has(l.etapaId)) { g.vendas++; g.receita += l.valor || 0; }
      if (idsPerdido.has(l.etapaId)) g.perdidos++;
    });

    const lista = Object.values(grupos).map((g) => ({
      ...g,
      taxaQualif: pct(g.qualificados, g.leads),
      taxaReuniao: pct(g.reunioes, g.leads),
      taxaVenda: pct(g.vendas, g.leads),
      ticket: g.vendas > 0 ? g.receita / g.vendas : 0,
    })).sort((a, b) => (b[ordenar] ?? 0) - (a[ordenar] ?? 0));

    /* --- Motivos de perda --- */
    const motivos = {};
    perdidos.forEach((l) => {
      const nome = (crm.motivos || []).find((m) => m.id === l.motivoPerdaId)?.nome || "Não informado";
      motivos[nome] = (motivos[nome] || 0) + 1;
    });
    const motivosLista = Object.entries(motivos).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd);

    /* --- Vendedores --- */
    const porPessoa = {};
    leads.forEach((l) => {
      const id = l.responsavelId || "_sem";
      if (!porPessoa[id]) porPessoa[id] = { nome: (pessoas || []).find((p) => p.id === id)?.nome || "Sem responsável", leads: 0, ganhos: 0, perdidos: 0, receita: 0 };
      const v = porPessoa[id];
      v.leads++;
      if (idsGanho.has(l.etapaId)) { v.ganhos++; v.receita += l.valor || 0; }
      if (idsPerdido.has(l.etapaId)) v.perdidos++;
    });
    const vendedores = Object.values(porPessoa)
      .map((v) => ({ ...v, conv: pct(v.ganhos, v.leads) }))
      .sort((a, b) => b.receita - a.receita);

    return {
      funil, etapas, comerciais, contagem, acumulado,
      leads: leads.length, ganhos: ganhos.length, perdidos: perdidos.length, abertos: abertos.length,
      receitaGanha, receitaPerdida, valorAberto,
      ticket: ganhos.length ? receitaGanha / ganhos.length : 0,
      conversao: pct(ganhos.length, leads.length),
      lista, comOrigem, semOrigem: leads.length - comOrigem,
      nomeQualif: comerciais[idxQualif]?.nome || "Qualificado",
      nomeReuniao: comerciais[idxReuniao]?.nome || "Reunião",
      motivosLista, vendedores,
    };
  }, [crm, convs, periodo, funilId, customDe, customAte, agrup, ordenar, pessoas]);

  if (carregando) return <div style={{ padding: 40, textAlign: "center" }}>Carregando análises…</div>;
  if (!crm || crm.funis.length === 0) return <div className="empty"><p>Crie funis no CRM para ver as análises.</p></div>;
  if (!D) return null;

  const maxLista = Math.max(...D.lista.map((g) => g[ordenar] || 0), 1);
  const rotuloAgrup = agrup === "campanha" ? "Campanha" : agrup === "conjunto" ? "Conjunto" : "Anúncio";

  return (
    <div className="an">
      <div className="page-head">
        <div>
          <h1>Análises do CRM</h1>
          <p>Performance comercial e origem de mídia — {D.funil.nome}</p>
        </div>
        <div className="head-actions">
          <button className="toolbar-btn" onClick={() => { setCarregando(true); carregar(); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            Atualizar
          </button>
          <select className="select" style={{ width: "auto" }} value={funilId || ""} onChange={(e) => setFunilId(e.target.value)}>
            {crm.funis.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <select className="select" style={{ width: "auto" }} value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {FILTROS.map((f) => <option key={f.id} value={f.id}>{f.l}</option>)}
          </select>
          {periodo === "custom" && (<>
            <input type="date" className="select" style={{ width: "auto" }} value={customDe} onChange={(e) => setCustomDe(e.target.value)} />
            <input type="date" className="select" style={{ width: "auto" }} value={customAte} onChange={(e) => setCustomAte(e.target.value)} />
          </>)}
        </div>
      </div>

      {/* KPIs */}
      <div className="an-kpis">
        <Kpi label="Receita ganha" valor={fmtMoeda(D.receitaGanha)} sub={`${D.ganhos} ${D.ganhos === 1 ? "venda" : "vendas"}`} tom="ok" />
        <Kpi label="Receita perdida" valor={fmtMoeda(D.receitaPerdida)} sub={`${D.perdidos} perdidos`} tom="err" />
        <Kpi label="Em aberto" valor={D.abertos} sub={fmtMoeda(D.valorAberto)} tom="info" />
        <Kpi label="Ticket médio" valor={fmtMoeda(D.ticket)} />
        <Kpi label="Taxa de conversão" valor={fmtP(D.conversao)} sub={`${D.ganhos} de ${D.leads}`} tom={D.conversao >= 5 ? "ok" : "avi"} />
        <Kpi label="Novos contatos" valor={D.leads} sub={`${D.comOrigem} com origem`} />
      </div>

      {/* Funil + distribuição */}
      <div className="an-g2">
        <section className="an-card">
          <div className="an-card-head"><h3>Funil por estágio</h3><span className="an-hint">largura = leads que chegaram até a etapa</span></div>
          <Funil etapas={D.comerciais} contagem={D.contagem} acumulado={D.acumulado} />
        </section>

        <section className="an-card">
          <div className="an-card-head"><h3>Distribuição</h3></div>
          <Rosca total={D.leads} legenda="leads" fatias={[
            { id: "g", l: "Ganhos", v: D.ganhos, c1: "#18A35F", c2: "#3CCF7A" },
            { id: "a", l: "Em aberto", v: D.abertos, c1: "#2563EB", c2: "#60A5FA" },
            { id: "p", l: "Perdidos", v: D.perdidos, c1: "#D92D20", c2: "#F97066" },
          ]} />
        </section>
      </div>

      {/* ORIGEM DE MÍDIA */}
      <section className="an-card an-midia">
        <div className="an-card-head">
          <div>
            <h3>Desempenho por origem</h3>
            <span className="an-hint">
              {D.comOrigem} de {D.leads} leads com origem identificada
              {D.semOrigem > 0 && ` · ${D.semOrigem} sem rastreamento`}
            </span>
          </div>
          <div className="an-toggle">
            {[["campanha", "Campanha"], ["conjunto", "Conjunto"], ["anuncio", "Anúncio"]].map(([id, l]) => (
              <button key={id} className={agrup === id ? "on" : ""} onClick={() => setAgrup(id)}>{l}</button>
            ))}
          </div>
        </div>

        {D.lista.length === 0 ? (
          <p className="an-vazio">
            Nenhum lead com origem identificada neste período.
            Leads que chegam por anúncio Click-to-WhatsApp são marcados automaticamente.
          </p>
        ) : (<>
          <div className="an-tabela-wrap">
            <table className="an-tabela">
              <thead>
                <tr>
                  <th>{rotuloAgrup}</th>
                  {[["leads", "Leads"], ["qualificados", D.nomeQualif], ["reunioes", D.nomeReuniao], ["vendas", "Vendas"], ["receita", "Receita"]].map(([id, l]) => (
                    <th key={id} className={`an-th-num ${ordenar === id ? "on" : ""}`} onClick={() => setOrdenar(id)} title="Ordenar por esta coluna">{l}</th>
                  ))}
                  <th className="an-th-num">Conversão</th>
                </tr>
              </thead>
              <tbody>
                {D.lista.slice(0, 12).map((g, i) => (
                  <tr key={i}>
                    <td className="an-td-nome" title={g.nome}>
                      <span className="an-pos">{i + 1}</span>
                      {g.nome}
                    </td>
                    <td className="an-num">{g.leads}</td>
                    <td className="an-num">{g.qualificados}<em>{fmtP(g.taxaQualif)}</em></td>
                    <td className="an-num">{g.reunioes}<em>{fmtP(g.taxaReuniao)}</em></td>
                    <td className="an-num an-ok">{g.vendas}</td>
                    <td className="an-num an-ok">{fmtMoeda(g.receita)}</td>
                    <td className="an-num">{fmtP(g.taxaVenda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="an-g3">
            <div>
              <h4 className="an-sub">Mais leads qualificados</h4>
              {[...D.lista].sort((a, b) => b.qualificados - a.qualificados).slice(0, 4).map((g, i) => (
                <BarraRank key={i} nome={g.nome} valor={g.qualificados} sub={` · ${fmtP(g.taxaQualif)}`}
                  max={Math.max(...D.lista.map((x) => x.qualificados), 1)}
                  cor="linear-gradient(90deg, #2563EB, #60A5FA)" />
              ))}
            </div>
            <div>
              <h4 className="an-sub">Mais {D.nomeReuniao.toLowerCase()}</h4>
              {[...D.lista].sort((a, b) => b.reunioes - a.reunioes).slice(0, 4).map((g, i) => (
                <BarraRank key={i} nome={g.nome} valor={g.reunioes} sub={` · ${fmtP(g.taxaReuniao)}`}
                  max={Math.max(...D.lista.map((x) => x.reunioes), 1)}
                  cor="linear-gradient(90deg, #6941C6, #9E77ED)" />
              ))}
            </div>
            <div>
              <h4 className="an-sub">Maior receita</h4>
              {[...D.lista].sort((a, b) => b.receita - a.receita).slice(0, 4).map((g, i) => (
                <BarraRank key={i} nome={g.nome} valor={g.vendas} sub={` · ${fmtMoeda(g.receita)}`}
                  max={Math.max(...D.lista.map((x) => x.vendas), 1)}
                  cor="linear-gradient(90deg, #0C5530, #3CCF7A)" />
              ))}
            </div>
          </div>
        </>)}
      </section>

      {/* Vendedores + perdas */}
      <div className="an-g2">
        <section className="an-card">
          <div className="an-card-head"><h3>Produtividade por vendedor</h3></div>
          <div className="an-tabela-wrap">
            <table className="an-tabela">
              <thead><tr><th>Vendedor</th><th className="an-th-num">Leads</th><th className="an-th-num">Ganhos</th><th className="an-th-num">Perdidos</th><th className="an-th-num">Conversão</th><th className="an-th-num">Receita</th></tr></thead>
              <tbody>
                {D.vendedores.map((v, i) => (
                  <tr key={i}>
                    <td className="an-td-nome"><span className="an-pos">{i + 1}</span>{v.nome}</td>
                    <td className="an-num">{v.leads}</td>
                    <td className="an-num an-ok">{v.ganhos}</td>
                    <td className="an-num an-err">{v.perdidos}</td>
                    <td className="an-num">{fmtP(v.conv)}</td>
                    <td className="an-num an-ok">{fmtMoeda(v.receita)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="an-card">
          <div className="an-card-head"><h3>Motivos de perda</h3></div>
          {D.motivosLista.length === 0
            ? <p className="an-vazio">Nenhuma perda registrada no período.</p>
            : D.motivosLista.map((m, i) => (
                <BarraRank key={i} nome={m.nome} valor={m.qtd}
                  sub={` · ${fmtP(pct(m.qtd, D.perdidos))}`}
                  max={Math.max(...D.motivosLista.map((x) => x.qtd), 1)}
                  cor="linear-gradient(90deg, #D92D20, #F97066)" />
              ))}
        </section>
      </div>
    </div>
  );
}
