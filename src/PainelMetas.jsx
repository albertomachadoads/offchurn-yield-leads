import { useEffect, useMemo, useState } from "react";
import { fmtMoeda } from "./utils";
import { supabase } from "./supabaseClient.js";
import * as api from "./api.js";

/* ============================================================
   Painel de Metas — acompanhamento comercial e de mídia.
   ============================================================ */

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_L = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const comp = (ano, mes) => `${ano}-${String(mes + 1).padStart(2, "0")}`;
const num = (v) => Number(v || 0);
const fmtN = (v) => num(v).toLocaleString("pt-BR");
const fmtR = (v) => fmtMoeda(num(v));
const fmtP = (v) => `${num(v).toFixed(1)}%`;

/* Excedente de métrica inversa, sem percentuais absurdos */
function excedente(atual, limite) {
  const dif = atual - limite;
  if (dif <= 0) return { txt: `${fmtR(Math.abs(dif))} abaixo do limite`, nivel: "ok" };
  const pct = (dif / limite) * 100;
  if (pct > 200) return { txt: `${fmtR(dif)} acima — ${(atual / limite).toFixed(1)}x o limite`, nivel: "err" };
  return { txt: `${fmtR(dif)} acima do limite (${pct.toFixed(0)}%)`, nivel: pct > 20 ? "err" : "avi" };
}

/* ---------- Velocímetro ---------- */
function Gauge({ pct, ritmo }) {
  const p = Math.max(Math.min(pct, 100), 0);
  const R = 106, CX = 130, CY = 124, SW = 15;
  const arco = Math.PI * R;
  const ang = (v) => Math.PI * (1 - v / 100);
  const pt = (v, r) => [CX + r * Math.cos(ang(v)), CY - r * Math.sin(ang(v))];
  const [mx1, my1] = pt(ritmo, R - SW / 2 - 5);
  const [mx2, my2] = pt(ritmo, R + SW / 2 + 5);
  const desvio = pct - ritmo;
  const cor = desvio >= -2 ? "var(--pm-ok)" : desvio >= -12 ? "var(--pm-avi)" : "var(--pm-err)";
  return (
    <svg viewBox="0 0 260 152" className="pm-gauge">
      <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="var(--pm-bd)" strokeWidth={SW} strokeLinecap="round" />
      <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke={cor} strokeWidth={SW} strokeLinecap="round"
        strokeDasharray={arco} strokeDashoffset={arco * (1 - p / 100)} style={{ transition: "stroke-dashoffset .5s ease" }} />
      {ritmo > 0 && ritmo <= 100 && <line x1={mx1} y1={my1} x2={mx2} y2={my2} stroke="var(--pm-tx2)" strokeWidth="2.5" strokeLinecap="round" />}
      <text x={CX} y={CY - 28} textAnchor="middle" className="pm-gauge-n" fill="var(--pm-tx)">{pct.toFixed(1)}%</text>
      <text x={CX} y={CY - 6} textAnchor="middle" className="pm-gauge-l" fill="var(--pm-tx2)">da meta</text>
      <text x={CX - R} y={CY + 20} textAnchor="middle" className="pm-gauge-e" fill="var(--pm-muted)">0%</text>
      <text x={CX + R} y={CY + 20} textAnchor="middle" className="pm-gauge-e" fill="var(--pm-muted)">100%</text>
    </svg>
  );
}

/* ---------- Card compacto de métrica ---------- */
function MetricCard({ label, valor, meta, metaLabel, status, nivel, pct, inversa }) {
  const larg = Math.max(Math.min(pct ?? 0, 100), 0);
  const cor = nivel === "ok" ? "var(--pm-ok)" : nivel === "avi" ? "var(--pm-avi)" : nivel === "err" ? "var(--pm-err)" : "var(--pm-tx2)";
  return (
    <div className="pm-mc">
      <div className="pm-mc-head">
        <span className="pm-mc-label">{label}</span>
        {inversa && <span className="pm-inv" title="Quanto menor, melhor">menor é melhor</span>}
      </div>
      <div className="pm-mc-valor">{valor}</div>
      {meta && <div className="pm-mc-meta">{metaLabel || "Meta"} <strong>{meta}</strong></div>}
      {pct != null && (
        <div className="pm-mc-track">
          <div className="pm-mc-fill" style={{ width: `${larg}%`, background: cor }} />
          <span className="pm-mc-marca" />
        </div>
      )}
      {status && <div className="pm-mc-status" style={{ color: nivel ? cor : "var(--pm-tx2)" }}>{status}</div>}
    </div>
  );
}

/* ---------- Evolução da receita ---------- */
function LinhaReceita({ serie, meta, diasMes, diaAtual }) {
  const W = 660, H = 240, P = { t: 16, r: 16, b: 28, l: 64 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const maxV = Math.max(meta, ...serie, 1) * 1.08;
  const x = (d) => P.l + (d / Math.max(diasMes - 1, 1)) * iw;
  const y = (v) => P.t + ih - (v / maxV) * ih;
  const ptsReal = serie.slice(0, diaAtual).map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const areaReal = diaAtual > 0 ? `M ${x(0)},${y(0)} L ${ptsReal.replace(/ /g, " L ")} L ${x(diaAtual - 1)},${y(0)} Z` : "";
  const ptsMeta = Array.from({ length: diasMes }, (_, i) => `${x(i)},${y((meta / diasMes) * (i + 1))}`).join(" ");
  const realHoje = serie[diaAtual - 1] || 0;
  const projFinal = diaAtual > 0 ? (realHoje / diaAtual) * diasMes : 0;
  const ptsProj = diaAtual > 0 ? `${x(diaAtual - 1)},${y(realHoje)} ${x(diasMes - 1)},${y(projFinal)}` : "";
  const ticks = [0, 0.5, 1].map((f) => maxV * f);
  const labelsX = [0, Math.floor(diasMes / 3), Math.floor((2 * diasMes) / 3), diasMes - 1];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="pm-svg">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={P.l} y1={y(t)} x2={W - P.r} y2={y(t)} stroke="var(--pm-grid)" strokeWidth="1" />
            <text x={P.l - 9} y={y(t) + 4} textAnchor="end" className="pm-ax">{fmtMoeda(t).replace(/,\d\d$/, "")}</text>
          </g>
        ))}
        {labelsX.map((d, i) => <text key={i} x={x(d)} y={H - 9} textAnchor="middle" className="pm-ax">{d + 1}</text>)}
        {meta > 0 && <polyline points={ptsMeta} fill="none" stroke="var(--pm-target)" strokeWidth="1.6" strokeDasharray="5 4" />}
        {areaReal && <path d={areaReal} fill="var(--pm-soft)" />}
        {ptsReal && <polyline points={ptsReal} fill="none" stroke="var(--pm-accent)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />}
        {ptsProj && <polyline points={ptsProj} fill="none" stroke="var(--pm-info)" strokeWidth="1.8" strokeDasharray="2 4" strokeLinecap="round" />}
        {diaAtual > 0 && <circle cx={x(diaAtual - 1)} cy={y(realHoje)} r="4" fill="var(--pm-accent)" />}
      </svg>
      <div className="pm-legenda">
        <span><i style={{ background: "var(--pm-accent)" }} />Realizado</span>
        <span><i className="tracejado" />Meta acumulada</span>
        <span><i className="pontilhado" />Projeção</span>
      </div>
    </div>
  );
}

/* ---------- Funil ---------- */
function FunilCom({ etapas, modo }) {
  if (!etapas.length) return <p className="pm-vazio-centro">Sem dados do CRM neste período.</p>;
  const base = Math.max(...etapas.map((e) => (modo === "valor" ? e.valor : e.qtd)), 1);
  return (
    <div className="pm-funil">
      {etapas.map((e, i) => {
        const v = modo === "valor" ? e.valor : e.qtd;
        const prox = etapas[i + 1];
        const conv = prox && e.qtd > 0 ? (prox.qtd / e.qtd) * 100 : null;
        const naoAvanc = prox ? Math.max(e.qtd - prox.qtd, 0) : 0;
        return (
          <div key={e.id}>
            <div className="pm-funil-barra" style={{ width: `${Math.max((v / base) * 100, 12)}%`, background: `var(--pm-f${Math.min(i, 4)})` }}>
              <span className="pm-funil-nome">{e.nome}</span>
              <span className="pm-funil-v">{modo === "valor" ? fmtR(e.valor) : e.qtd}</span>
            </div>
            {conv != null && (
              <div className="pm-funil-conv">
                <span>{conv.toFixed(0)}% avançaram</span>
                {naoAvanc > 0 && <span className="perda">{naoAvanc} não avançaram</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Colunas anuais ---------- */
function Colunas({ dados, chave, metaChave, mesAtivo, formato, extra }) {
  const temDado = dados.some((d) => d[chave] > 0 || d[metaChave] > 0);
  if (!temDado) return <p className="pm-vazio-centro">Ainda não existem dados suficientes para exibir a evolução anual.</p>;
  const max = Math.max(...dados.map((d) => Math.max(d[chave], d[metaChave])), 1);
  return (
    <div className="pm-cols">
      {dados.map((d, i) => {
        const bateu = d[metaChave] > 0 && d[chave] >= d[metaChave];
        return (
          <div key={i} className={`pm-col ${i === mesAtivo ? "on" : ""}`}>
            <div className="pm-col-area">
              <div className="pm-col-tip">
                <strong>{MESES_L[i]}</strong>
                <span>Realizado: {formato(d[chave])}</span>
                <span>Meta: {d[metaChave] > 0 ? formato(d[metaChave]) : "—"}</span>
                {d[metaChave] > 0 && <span>Diferença: {d[chave] >= d[metaChave] ? "+" : ""}{formato(d[chave] - d[metaChave])}</span>}
                {extra && extra(d)}
              </div>
              {d[chave] > 0 && <span className="pm-col-n">{formato(d[chave])}</span>}
              <div className="pm-col-barra" style={{ height: `${(d[chave] / max) * 100}%`, background: bateu ? "var(--pm-ok)" : "var(--pm-accent)" }} />
              {d[metaChave] > 0 && <div className="pm-col-meta" style={{ bottom: `${(d[metaChave] / max) * 100}%` }} />}
            </div>
            <span className="pm-col-l">{d.mes}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Insight ---------- */
function Insight({ prio, titulo, texto, acao, onAcao }) {
  return (
    <div className={`pm-ins pm-ins-${prio}`}>
      <span className={`pm-ins-tag t-${prio}`}>{prio === "alta" ? "Alta prioridade" : prio === "media" ? "Atenção" : "Informação"}</span>
      <div className="pm-ins-titulo">{titulo}</div>
      <p className="pm-ins-texto">{texto}</p>
      {acao && onAcao && <button className="pm-link" onClick={onAcao}>{acao}</button>}
    </div>
  );
}

/* ---------- Modal de tráfego ---------- */
function ModalTrafego({ base, mesLabel, userName, onSalvar, onFechar }) {
  const [f, setF] = useState({
    inv_meta_ads: base.inv_meta_ads ?? "", leads_meta_ads: base.leads_meta_ads ?? "",
    inv_google_ads: base.inv_google_ads ?? "", leads_google_ads: base.leads_google_ads ?? "",
    leads_qualificados: base.leads_qualificados ?? "", cpl_manual: base.cpl_manual ?? "",
  });
  const s = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const invTot = num(f.inv_meta_ads) + num(f.inv_google_ads);
  const leadsTot = num(f.leads_meta_ads) + num(f.leads_google_ads);
  const cplCalc = leadsTot > 0 ? invTot / leadsTot : 0;
  const cplMeta = num(f.leads_meta_ads) > 0 ? num(f.inv_meta_ads) / num(f.leads_meta_ads) : 0;
  const cplGoogle = num(f.leads_google_ads) > 0 ? num(f.inv_google_ads) / num(f.leads_google_ads) : 0;
  const manual = f.cpl_manual !== "" && f.cpl_manual != null;

  return (
    <div className="pm-modal-bd" onClick={onFechar}>
      <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pm-modal-head">
          <div><h3>Dados de tráfego</h3><p>{mesLabel}</p></div>
          <button className="pm-modal-x" onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        <div className="pm-modal-aviso">
          Dados comerciais são atualizados automaticamente pelo CRM. Dados de mídia podem ser informados manualmente ou por integração.
        </div>

        <div className="pm-modal-body">
          <div className="pm-canal">
            <div className="pm-canal-t">Meta Ads</div>
            <div className="pm-canal-g">
              <div className="pm-f-row"><label>Valor investido (R$)</label><input className="pm-input" type="number" step="0.01" value={f.inv_meta_ads} onChange={(e) => s("inv_meta_ads", e.target.value)} /></div>
              <div className="pm-f-row"><label>Leads gerados</label><input className="pm-input" type="number" value={f.leads_meta_ads} onChange={(e) => s("leads_meta_ads", e.target.value)} /></div>
              <div className="pm-f-row"><label>CPL do canal</label><div className="pm-calc">{cplMeta > 0 ? fmtR(cplMeta) : "—"}</div></div>
            </div>
          </div>

          <div className="pm-canal">
            <div className="pm-canal-t">Google Ads</div>
            <div className="pm-canal-g">
              <div className="pm-f-row"><label>Valor investido (R$)</label><input className="pm-input" type="number" step="0.01" value={f.inv_google_ads} onChange={(e) => s("inv_google_ads", e.target.value)} /></div>
              <div className="pm-f-row"><label>Leads gerados</label><input className="pm-input" type="number" value={f.leads_google_ads} onChange={(e) => s("leads_google_ads", e.target.value)} /></div>
              <div className="pm-f-row"><label>CPL do canal</label><div className="pm-calc">{cplGoogle > 0 ? fmtR(cplGoogle) : "—"}</div></div>
            </div>
          </div>

          <div className="pm-canal">
            <div className="pm-canal-t">Consolidado</div>
            <div className="pm-canal-g">
              <div className="pm-f-row"><label>Investimento total</label><div className="pm-calc">{fmtR(invTot)}</div></div>
              <div className="pm-f-row"><label>Leads totais</label><div className="pm-calc">{fmtN(leadsTot)}</div></div>
              <div className="pm-f-row"><label>CPL consolidado</label><div className={`pm-calc ${manual ? "alterado" : ""}`}>{manual ? fmtR(f.cpl_manual) : cplCalc > 0 ? fmtR(cplCalc) : "—"}</div></div>
              <div className="pm-f-row"><label>Leads qualificados</label><input className="pm-input" type="number" value={f.leads_qualificados} onChange={(e) => s("leads_qualificados", e.target.value)} /></div>
              <div className="pm-f-row pm-f-wide">
                <label>CPL informado manualmente <span className="pm-op">opcional — sobrescreve o cálculo</span></label>
                <input className="pm-input" type="number" step="0.01" placeholder={cplCalc > 0 ? fmtR(cplCalc) : "Automático"} value={f.cpl_manual} onChange={(e) => s("cpl_manual", e.target.value)} />
              </div>
            </div>
            {manual && <div className="pm-alerta-manual">O CPL está sendo informado manualmente e não reflete o cálculo automático.</div>}
          </div>
        </div>

        {base.trafego_atualizado_em && (
          <div className="pm-modal-rodape">
            Atualizado por {base.trafego_atualizado_por || "—"} em {new Date(base.trafego_atualizado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}.
          </div>
        )}

        <div className="pm-modal-acoes">
          <button className="pm-btn" onClick={onFechar}>Cancelar</button>
          <button className="pm-btn-primary" onClick={() => onSalvar({
            inv_meta_ads: num(f.inv_meta_ads), leads_meta_ads: num(f.leads_meta_ads),
            inv_google_ads: num(f.inv_google_ads), leads_google_ads: num(f.leads_google_ads),
            leads_qualificados: num(f.leads_qualificados),
            cpl_manual: f.cpl_manual === "" ? null : num(f.cpl_manual),
            trafego_atualizado_em: new Date().toISOString(), trafego_atualizado_por: userName || "Sistema",
          })}>Salvar dados</button>
        </div>
      </div>
    </div>
  );
}

/* ================= PAINEL ================= */
export default function PainelMetas({ clientes, onToast, userName, onIrParaCRM }) {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mesSel, setMesSel] = useState(new Date().getMonth());
  const [metas, setMetas] = useState({});
  const [editando, setEditando] = useState(false);
  const [modalTraf, setModalTraf] = useState(false);
  const [crm, setCrm] = useState(null);
  const [form, setForm] = useState({});
  const [modoFunil, setModoFunil] = useState("qtd");
  const [modoDist, setModoDist] = useState("qtd");
  const [verTodos, setVerTodos] = useState(false);

  const competencia = comp(ano, mesSel);

  useEffect(() => {
    supabase.from("metas_comerciais").select("*")
      .gte("competencia", `${ano}-01`).lte("competencia", `${ano}-12`)
      .then(({ data }) => {
        const map = {};
        (data || []).forEach((mm) => { map[mm.competencia] = mm; });
        setMetas(map);
        if (map[competencia]) setForm(map[competencia]);
        else setForm({ competencia, investimento: 0, meta_leads: 0, cpl_meta: 0, taxa_conversao_meta: 4, meta_fechamento: 0, ticket_medio_meta: 0, meta_faturamento: 0, meta_churn: 5, meta_mrr: 0, meta_novos_clientes: 0, meta_produtos: 0 });
      });
  }, [ano, competencia]);

  useEffect(() => { api.fetchCRM().then(setCrm).catch(() => {}); }, []);

  const m = metas[competencia] || {};

  async function salvarMeta() {
    try {
      const row = { ...(metas[competencia] || {}), ...form, competencia, atualizado_em: new Date().toISOString() };
      await supabase.from("metas_comerciais").upsert(row, { onConflict: "competencia" });
      setMetas((p) => ({ ...p, [competencia]: row }));
      setEditando(false);
      onToast("Metas salvas");
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function salvarTrafego(dados) {
    try {
      const row = { ...(metas[competencia] || {}), competencia, ...dados };
      await supabase.from("metas_comerciais").upsert(row, { onConflict: "competencia" });
      setMetas((p) => ({ ...p, [competencia]: row }));
      setModalTraf(false);
      onToast("Dados de tráfego salvos");
    } catch (e) { onToast("Erro: " + e.message); }
  }

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  /* ---- Dados ---- */
  const D = useMemo(() => {
    const ativos = (clientes || []).filter((c) => c.ativo);
    const mrr = ativos.reduce((s, c) => s + num(c.ticket), 0);
    const etapas = (crm?.etapas || []).slice().sort((a, b) => a.ordem - b.ordem);
    const comerciais = etapas.filter((e) => e.tipo !== "perdido");
    const setG = new Set(etapas.filter((e) => e.tipo === "ganho").map((e) => e.id));
    const setP = new Set(etapas.filter((e) => e.tipo === "perdido").map((e) => e.id));

    const leadsMes = (crm?.leads || []).filter((l) => (l.criadoEm || "").startsWith(competencia));
    const ganhosL = leadsMes.filter((l) => setG.has(l.etapaId));
    const perdidosL = leadsMes.filter((l) => setP.has(l.etapaId));
    const abertosMes = leadsMes.filter((l) => !setG.has(l.etapaId) && !setP.has(l.etapaId));
    const receita = ganhosL.reduce((s, l) => s + num(l.valor), 0);
    const vlPerdido = perdidosL.reduce((s, l) => s + num(l.valor), 0);
    const vlAberto = abertosMes.reduce((s, l) => s + num(l.valor), 0);
    const ticket = ganhosL.length ? receita / ganhosL.length : 0;
    const conversao = leadsMes.length ? (ganhosL.length / leadsMes.length) * 100 : 0;
    const produtosVendidos = ganhosL.filter((l) => l.produtoId).length;

    const idxQ = Math.min(2, Math.max(comerciais.length - 1, 0));
    const idsQ = new Set(comerciais.slice(idxQ).map((e) => e.id));
    const qualifCRM = leadsMes.filter((l) => idsQ.has(l.etapaId) || setG.has(l.etapaId)).length;
    const qualificados = num(m.leads_qualificados) || qualifCRM;

    const abertosAll = (crm?.leads || []).filter((l) => !setG.has(l.etapaId) && !setP.has(l.etapaId));
    const pipelineTotal = abertosAll.reduce((s, l) => s + num(l.valor), 0);

    const mAnt = mesSel === 0 ? comp(ano - 1, 11) : comp(ano, mesSel - 1);
    const leadsAnt = (crm?.leads || []).filter((l) => (l.criadoEm || "").startsWith(mAnt));
    const ganhosAnt = leadsAnt.filter((l) => setG.has(l.etapaId));
    const receitaAnt = ganhosAnt.reduce((s, l) => s + num(l.valor), 0);

    const diasMes = new Date(ano, mesSel + 1, 0).getDate();
    const agora = new Date();
    const mesCorrente = agora.getFullYear() === ano && agora.getMonth() === mesSel;
    const futuro = new Date(ano, mesSel, 1) > agora;
    const diaAtual = futuro ? 0 : mesCorrente ? agora.getDate() : diasMes;
    const porDia = Array(diasMes).fill(0);
    ganhosL.forEach((l) => { const d = new Date(l.criadoEm).getDate(); if (d >= 1 && d <= diasMes) porDia[d - 1] += num(l.valor); });
    const serie = []; let acc = 0;
    porDia.forEach((v) => { acc += v; serie.push(acc); });

    const funil = comerciais.map((e) => {
      const ls = leadsMes.filter((l) => l.etapaId === e.id);
      return { id: e.id, nome: e.nome, qtd: ls.length, valor: ls.reduce((s, l) => s + num(l.valor), 0) };
    });

    const anual = MESES.map((mes, i) => {
      const c = comp(ano, i);
      const mt = metas[c] || {};
      const ls = (crm?.leads || []).filter((l) => (l.criadoEm || "").startsWith(c));
      const gn = ls.filter((l) => setG.has(l.etapaId));
      return { mes, leads: ls.length, metaLeads: num(mt.meta_leads), vendas: gn.length, metaVendas: num(mt.meta_fechamento),
        receita: gn.reduce((s, l) => s + num(l.valor), 0), conv: ls.length ? (gn.length / ls.length) * 100 : 0 };
    });

    const invReal = num(m.inv_meta_ads) + num(m.inv_google_ads);
    const leadsMidia = num(m.leads_meta_ads) + num(m.leads_google_ads);
    const cplAuto = leadsMidia > 0 ? invReal / leadsMidia : 0;
    const cpl = m.cpl_manual != null && m.cpl_manual !== "" ? num(m.cpl_manual) : cplAuto;
    const cpo = qualificados > 0 && invReal > 0 ? invReal / qualificados : 0;
    const cpv = ganhosL.length > 0 && invReal > 0 ? invReal / ganhosL.length : 0;
    const temTrafego = invReal > 0 || leadsMidia > 0;
    const diasDesdeTraf = m.trafego_atualizado_em ? Math.floor((Date.now() - new Date(m.trafego_atualizado_em)) / 86400000) : null;

    return {
      clientes: ativos.length, mrr, leads: leadsMes.length, vendas: ganhosL.length, perdidos: perdidosL.length,
      abertos: abertosMes.length, receita, vlPerdido, vlAberto, ticket, conversao, qualificados, produtosVendidos,
      pipelineTotal, receitaAnt, vendasAnt: ganhosAnt.length, serie, diasMes, diaAtual, futuro, funil, anual,
      invReal, leadsMidia, cpl, cplManual: m.cpl_manual != null && m.cpl_manual !== "", cpo, cpv, temTrafego, diasDesdeTraf,
    };
  }, [clientes, crm, competencia, metas, m, ano, mesSel]);

  /* ---- Meta ---- */
  const metaFat = num(m.meta_faturamento);
  const aderencia = metaFat > 0 ? (D.receita / metaFat) * 100 : 0;
  const ritmoIdeal = D.diasMes > 0 ? (D.diaAtual / D.diasMes) * 100 : 0;
  const restante = Math.max(metaFat - D.receita, 0);
  const diasRest = Math.max(D.diasMes - D.diaAtual, 0);
  const projecao = D.diaAtual > 0 ? (D.receita / D.diaAtual) * D.diasMes : 0;
  const pctProj = metaFat > 0 ? (projecao / metaFat) * 100 : 0;
  const desvio = aderencia - ritmoIdeal;
  const tkMeta = num(m.ticket_medio_meta);
  const tkRef = D.ticket > 0 ? D.ticket : tkMeta;
  const vendasNec = tkRef > 0 ? Math.ceil(restante / tkRef) : null;
  const cobertura = restante > 0 && D.pipelineTotal > 0 ? D.pipelineTotal / restante : null;
  const cplMeta = num(m.cpl_meta);
  const orcamento = num(m.investimento);

  /* ---- Insights ---- */
  const insights = [];
  if (metaFat > 0 && D.diaAtual >= 3) {
    insights.push({
      prio: pctProj < 85 ? "alta" : pctProj < 100 ? "media" : "baixa",
      titulo: pctProj >= 100 ? "Meta dentro do ritmo" : "Meta abaixo do ritmo esperado",
      texto: `A operação atingiu ${aderencia.toFixed(1)}% da meta, enquanto o ritmo esperado até hoje era de ${ritmoIdeal.toFixed(0)}%. ` +
        `No ritmo atual, a projeção é encerrar o mês com ${fmtR(projecao)}, equivalente a ${pctProj.toFixed(1)}% da meta.` +
        (vendasNec ? ` São necessárias cerca de ${vendasNec} vendas${D.ticket === 0 ? ", considerando o ticket médio definido como meta" : ""}.` : ""),
      acao: "Ver oportunidades abertas", onAcao: onIrParaCRM,
    });
  }
  if (D.temTrafego && cplMeta > 0 && D.cpl > 0) {
    const ex = excedente(D.cpl, cplMeta);
    if (ex.nivel !== "ok") insights.push({
      prio: ex.nivel === "err" ? "alta" : "media", titulo: "CPL acima do limite definido",
      texto: `O custo por lead está em ${fmtR(D.cpl)}, enquanto o limite definido é de ${fmtR(cplMeta)}. Diferença de ${fmtR(D.cpl - cplMeta)} por lead.`,
      acao: "Revisar dados de tráfego", onAcao: () => setModalTraf(true),
    });
  }
  if (num(m.meta_leads) > 0 && D.diaAtual >= 3) {
    const proj = Math.round((D.leads / D.diaAtual) * D.diasMes);
    if (proj < num(m.meta_leads) * 0.9) insights.push({
      prio: proj < num(m.meta_leads) * 0.6 ? "alta" : "media", titulo: "Volume de leads abaixo da meta",
      texto: `Foram gerados ${D.leads} leads de uma meta mensal de ${fmtN(m.meta_leads)}. Mantendo o ritmo atual, a projeção é de ${proj} leads.`,
      acao: "Atualizar dados de tráfego", onAcao: () => setModalTraf(true),
    });
  }
  const gargalo = D.funil.map((e, i) => {
    const prox = D.funil[i + 1];
    return prox && e.qtd > 0 ? { de: e.nome, para: prox.nome, conv: (prox.qtd / e.qtd) * 100, base: e.qtd } : null;
  }).filter(Boolean).sort((a, b) => a.conv - b.conv)[0];
  if (gargalo) {
    const baixa = gargalo.base < 5;
    insights.push({
      prio: baixa ? "baixa" : gargalo.conv < 40 ? "alta" : "media", titulo: "Gargalo no funil",
      texto: `${baixa ? "Com base no volume atual, a" : "A"} menor taxa de avanço está entre "${gargalo.de}" e "${gargalo.para}", com conversão de ${gargalo.conv.toFixed(0)}%.` +
        (baixa ? ` A amostra ainda é pequena (${gargalo.base} ${gargalo.base === 1 ? "oportunidade" : "oportunidades"}), o que reduz a confiabilidade do dado.` : ""),
      acao: "Ver oportunidades da etapa", onAcao: onIrParaCRM,
    });
  }
  if (D.invReal > 0 && D.vendas === 0) insights.push({
    prio: "media", titulo: "Sem vendas para calcular aquisição",
    texto: "Ainda não existem vendas suficientes para calcular o custo por aquisição neste período.",
  });
  if (D.abertos > 0) insights.push({
    prio: "baixa", titulo: "Oportunidades de recuperação",
    texto: `Existem ${D.abertos} ${D.abertos === 1 ? "oportunidade aberta" : "oportunidades abertas"} no período, somando ${fmtR(D.vlAberto)} em pipeline.`,
    acao: "Abrir CRM", onAcao: onIrParaCRM,
  });

  const anoAtual = new Date().getFullYear();
  const insVisiveis = verTodos ? insights : insights.slice(0, 3);

  const ritmoOrc = orcamento > 0 ? (D.invReal / orcamento) * 100 : null;
  const exCpl = cplMeta > 0 && D.cpl > 0 ? excedente(D.cpl, cplMeta) : null;
  const metaCpo = cplMeta > 0 ? cplMeta * 3 : 0;
  const exCpo = metaCpo > 0 && D.cpo > 0 ? excedente(D.cpo, metaCpo) : null;
  const metaCpv = tkMeta > 0 ? tkMeta * 0.3 : 0;
  const exCpv = metaCpv > 0 && D.cpv > 0 ? excedente(D.cpv, metaCpv) : null;
  const projLeads = D.diaAtual > 0 ? Math.round((D.leads / D.diaAtual) * D.diasMes) : 0;
  const nivelDireto = (r) => (r >= 1 ? "ok" : r >= 0.7 ? "avi" : "err");

  return (
    <div className="pm">
      {/* Cabeçalho */}
      <div className="pm-head">
        <div>
          <h1 className="pm-h1">Painel de Metas</h1>
          <p className="pm-sub">{MESES_L[mesSel]} de {ano}</p>
        </div>
        <div className="pm-head-r">
          <select className="pm-sel" value={mesSel} onChange={(e) => setMesSel(Number(e.target.value))}>
            {MESES_L.map((mm, i) => <option key={i} value={i}>{mm}</option>)}
          </select>
          <select className="pm-sel" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {[anoAtual - 2, anoAtual - 1, anoAtual, anoAtual + 1].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="pm-btn" onClick={() => setModalTraf(true)}>Atualizar dados de tráfego</button>
          <button className={editando ? "pm-btn-primary" : "pm-btn"} onClick={() => { if (editando) salvarMeta(); else setEditando(true); }}>
            {editando ? "Salvar metas" : "Editar metas"}
          </button>
        </div>
      </div>

      <div className="pm-meses">
        {MESES.map((mes, i) => (
          <button key={i} className={`pm-mes ${i === mesSel ? "on" : ""}`} onClick={() => setMesSel(i)}>{mes}</button>
        ))}
      </div>

      {/* Avisos de tráfego */}
      {!D.temTrafego && (
        <div className="pm-aviso">
          <span>Os dados de tráfego deste mês ainda não foram atualizados.</span>
          <button className="pm-link" onClick={() => setModalTraf(true)}>Atualizar dados</button>
        </div>
      )}
      {D.temTrafego && D.diasDesdeTraf != null && D.diasDesdeTraf > 7 && (
        <div className="pm-aviso avi">
          <span>Dados de tráfego desatualizados — última atualização há {D.diasDesdeTraf} dias.</span>
          <button className="pm-link" onClick={() => setModalTraf(true)}>Atualizar dados</button>
        </div>
      )}

      {/* ADERÊNCIA — largura total */}
      <section className="pm-card pm-ader">
        <div className="pm-c-head"><h3>Aderência à meta</h3><span className="pm-c-hint">{MESES_L[mesSel]} de {ano}</span></div>
        {metaFat === 0 ? (
          <div className="pm-vazio-bloco">
            <p>Ainda não há uma meta de faturamento definida para {MESES_L[mesSel]}.</p>
            <button className="pm-link" onClick={() => setEditando(true)}>Configurar meta</button>
          </div>
        ) : (<>
          <div className="pm-ader-corpo">
            <div className="pm-ader-gauge"><Gauge pct={aderencia} ritmo={ritmoIdeal} /></div>

            <div className="pm-ader-bloco">
              <div className="pm-ader-t">Resultado atual</div>
              <div className="pm-ader-par"><span>Receita conquistada</span><strong>{fmtR(D.receita)}</strong></div>
              <div className="pm-ader-par"><span>Meta mensal</span><strong>{fmtR(metaFat)}</strong></div>
              <div className="pm-ader-par"><span>Ritmo ideal hoje</span><strong>{ritmoIdeal.toFixed(0)}%</strong></div>
              <div className="pm-ader-par"><span>Diferença de ritmo</span>
                <strong style={{ color: desvio >= 0 ? "var(--pm-ok)" : "var(--pm-err)" }}>{desvio >= 0 ? "+" : ""}{desvio.toFixed(1)} p.p.</strong>
              </div>
              <div className="pm-ader-par"><span>Dias decorridos</span><strong>{D.diaAtual} de {D.diasMes}</strong></div>
            </div>

            <div className="pm-ader-bloco">
              <div className="pm-ader-t">Projeção</div>
              <div className="pm-ader-par"><span>Faltam</span><strong>{fmtR(restante)}</strong></div>
              <div className="pm-ader-par"><span>Vendas necessárias</span>
                <strong>{vendasNec != null ? vendasNec : <em className="pm-insuf">Dados insuficientes</em>}</strong>
              </div>
              <div className="pm-ader-par"><span>Projeção no ritmo atual</span><strong>{D.diaAtual > 0 ? fmtR(projecao) : "—"}</strong></div>
              <div className="pm-ader-par"><span>Projeção da meta</span>
                <strong style={{ color: pctProj >= 100 ? "var(--pm-ok)" : pctProj >= 85 ? "var(--pm-avi)" : "var(--pm-err)" }}>
                  {D.diaAtual > 0 ? `${pctProj.toFixed(1)}%` : "—"}
                </strong>
              </div>
              <div className="pm-ader-par"><span>Melhor cenário</span><strong>{fmtR(D.receita + D.pipelineTotal)}</strong></div>
              <div className="pm-ader-par"><span>Dias restantes</span><strong>{diasRest}</strong></div>
            </div>
          </div>

          <div className={`pm-ader-rodape ${D.diaAtual < 3 ? "" : desvio >= -2 ? "ok" : desvio >= -12 ? "avi" : "err"}`}>
            {D.futuro ? "Período futuro — ainda não há dados para projeção."
              : D.diaAtual < 3 ? `Apenas ${D.diaAtual} ${D.diaAtual === 1 ? "dia decorrido" : "dias decorridos"} no mês. A projeção ganha confiabilidade a partir do terceiro dia.`
              : `No ritmo atual, a operação deve encerrar o mês com ${fmtR(projecao)}, equivalente a ${pctProj.toFixed(1)}% da meta.` +
                (cobertura != null ? ` O pipeline aberto cobre ${cobertura.toFixed(1)}x o valor restante.` : "")}
          </div>
        </>)}
      </section>

      {/* Evolução + Insights */}
      <div className="pm-g-83">
        <section className="pm-card">
          <div className="pm-c-head"><h3>Evolução da receita</h3><span className="pm-c-hint">{MESES_L[mesSel]}</span></div>
          {D.receita === 0 && metaFat === 0
            ? <p className="pm-vazio-centro">Nenhuma venda registrada neste período.</p>
            : <>
                <LinhaReceita serie={D.serie} meta={metaFat} diasMes={D.diasMes} diaAtual={D.diaAtual} />
                {metaFat > 0 && D.diaAtual > 0 && (
                  <div className="pm-nota-linha">
                    A receita está {Math.abs(desvio).toFixed(1)} pontos percentuais {desvio >= 0 ? "acima" : "abaixo"} do ritmo esperado para o período.
                  </div>
                )}
              </>}
        </section>

        <section className="pm-card">
          <div className="pm-c-head"><h3>Insights da operação</h3></div>
          {insights.length === 0
            ? <p className="pm-vazio">Configure metas e registre os dados de tráfego para receber recomendações automáticas.</p>
            : <>
                <div className="pm-ins-lista">{insVisiveis.map((x, i) => <Insight key={i} {...x} />)}</div>
                {insights.length > 3 && (
                  <button className="pm-link pm-ver-todos" onClick={() => setVerTodos((v) => !v)}>
                    {verTodos ? "Ver menos" : `Ver todos (${insights.length})`}
                  </button>
                )}
              </>}
        </section>
      </div>

      {/* Funil + Oportunidades */}
      <div className="pm-g-83">
        <section className="pm-card">
          <div className="pm-c-head">
            <h3>Funil comercial</h3>
            <div className="pm-toggle">
              <button className={modoFunil === "qtd" ? "on" : ""} onClick={() => setModoFunil("qtd")}>Quantidade</button>
              <button className={modoFunil === "valor" ? "on" : ""} onClick={() => setModoFunil("valor")}>Valor</button>
            </div>
          </div>
          <FunilCom etapas={D.funil} modo={modoFunil} />
        </section>

        <section className="pm-card">
          <div className="pm-c-head">
            <h3>Visão das oportunidades</h3>
            <div className="pm-toggle">
              <button className={modoDist === "qtd" ? "on" : ""} onClick={() => setModoDist("qtd")}>Quantidade</button>
              <button className={modoDist === "valor" ? "on" : ""} onClick={() => setModoDist("valor")}>Valor</button>
            </div>
          </div>
          {D.leads === 0 ? <p className="pm-vazio-centro">Nenhum lead recebido no período selecionado.</p> : (() => {
            const qtds = [D.abertos, D.vendas, D.perdidos];
            const vals = [D.vlAberto, D.receita, D.vlPerdido];
            const cores = ["var(--pm-info)", "var(--pm-ok)", "var(--pm-err)"];
            const labels = ["Em aberto", "Ganhas", "Perdidas"];
            const serie = modoDist === "qtd" ? qtds : vals;
            const tot = serie.reduce((a, x) => a + x, 0) || 1;
            return (<>
              <div className="pm-opp-barra">
                {serie.map((v, i) => v > 0 && (
                  <div key={i} style={{ width: `${(v / tot) * 100}%`, background: cores[i] }}>
                    <span>{((v / tot) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
              <div className="pm-opp-cards">
                {labels.map((l, i) => (
                  <div key={i} className="pm-opp-card">
                    <div className="pm-opp-top"><span className="pm-dot" style={{ background: cores[i] }} />{l}</div>
                    <div className="pm-opp-q">{qtds[i]} {qtds[i] === 1 ? "oportunidade" : "oportunidades"}</div>
                    <div className="pm-opp-v">{fmtR(vals[i])}</div>
                  </div>
                ))}
              </div>
              <div className="pm-nota-linha">
                {((serie[0] / tot) * 100).toFixed(0)}% {modoDist === "qtd" ? "das oportunidades" : "do valor"} do período permanece em aberto, somando {fmtR(D.vlAberto)}.
              </div>
            </>);
          })()}
        </section>
      </div>

      {/* Desempenho de tráfego */}
      <section className="pm-secao">
        <div className="pm-secao-head">
          <h2>Desempenho de tráfego</h2>
          <button className="pm-link" onClick={() => setModalTraf(true)}>Atualizar dados</button>
        </div>
        <div className="pm-mc-grid">
          <MetricCard label="Investimento" valor={fmtR(D.invReal)}
            meta={orcamento > 0 ? fmtR(orcamento) : null} metaLabel="Orçamento planejado" pct={ritmoOrc}
            nivel={ritmoOrc == null ? null : ritmoOrc <= ritmoIdeal + 10 ? "ok" : ritmoOrc <= 100 ? "avi" : "err"}
            status={orcamento > 0
              ? `${ritmoOrc.toFixed(1)}% utilizado · ${fmtR(Math.max(orcamento - D.invReal, 0))} disponíveis${D.diaAtual > 0 ? ` · ${ritmoIdeal.toFixed(0)}% do mês transcorrido` : ""}`
              : "Sem orçamento planejado"} />

          <MetricCard label="Leads" valor={fmtN(D.leads)}
            meta={num(m.meta_leads) > 0 ? fmtN(m.meta_leads) : null}
            pct={num(m.meta_leads) > 0 ? (D.leads / num(m.meta_leads)) * 100 : null}
            nivel={num(m.meta_leads) > 0 ? nivelDireto(D.leads / num(m.meta_leads)) : null}
            status={num(m.meta_leads) > 0
              ? `${((D.leads / num(m.meta_leads)) * 100).toFixed(0)}% atingido${D.diaAtual > 0 ? ` · projeção de ${projLeads} leads` : ""}`
              : "Sem meta definida"} />

          <MetricCard label="CPL" inversa valor={D.cpl > 0 ? fmtR(D.cpl) : "—"}
            meta={cplMeta > 0 ? fmtR(cplMeta) : null} metaLabel="Meta máxima"
            pct={cplMeta > 0 && D.cpl > 0 ? Math.min((D.cpl / cplMeta) * 100, 100) : null} nivel={exCpl?.nivel}
            status={!D.temTrafego ? "Registre os dados de tráfego" : cplMeta === 0 ? "Sem meta definida" : exCpl?.txt} />

          <MetricCard label="Leads qualificados" valor={fmtN(D.qualificados)}
            meta={D.leads > 0 ? `${((D.qualificados / D.leads) * 100).toFixed(0)}%` : null} metaLabel="Taxa de qualificação"
            pct={D.leads > 0 ? (D.qualificados / D.leads) * 100 : null}
            nivel={D.leads > 0 ? (D.qualificados / D.leads >= 0.3 ? "ok" : "avi") : null}
            status={num(m.leads_qualificados) > 0 ? "Informado manualmente" : "Calculado pelo CRM"} />

          <MetricCard label="Custo por oportunidade" inversa valor={D.cpo > 0 ? fmtR(D.cpo) : "—"}
            meta={metaCpo > 0 ? fmtR(metaCpo) : null} metaLabel="Limite estimado"
            pct={metaCpo > 0 && D.cpo > 0 ? Math.min((D.cpo / metaCpo) * 100, 100) : null} nivel={exCpo?.nivel}
            status={D.qualificados === 0 ? "Sem oportunidades qualificadas" : !D.temTrafego ? "Registre os dados de tráfego" : metaCpo === 0 ? "Defina o CPL máximo" : exCpo?.txt} />

          <MetricCard label="Custo por venda" inversa valor={D.cpv > 0 ? fmtR(D.cpv) : "—"}
            meta={metaCpv > 0 ? fmtR(metaCpv) : null} metaLabel="Limite estimado"
            pct={metaCpv > 0 && D.cpv > 0 ? Math.min((D.cpv / metaCpv) * 100, 100) : null} nivel={exCpv?.nivel}
            status={D.vendas === 0 ? "Ainda não existem vendas no período" : !D.temTrafego ? "Registre os dados de tráfego" : metaCpv === 0 ? "Defina o ticket médio meta" : exCpv?.txt} />
        </div>
      </section>

      {/* Desempenho comercial */}
      <section className="pm-secao">
        <div className="pm-secao-head"><h2>Desempenho comercial</h2></div>
        <div className="pm-mc-grid">
          <MetricCard label="Vendas" valor={fmtN(D.vendas)}
            meta={num(m.meta_fechamento) > 0 ? fmtN(m.meta_fechamento) : null}
            pct={num(m.meta_fechamento) > 0 ? (D.vendas / num(m.meta_fechamento)) * 100 : null}
            nivel={num(m.meta_fechamento) > 0 ? nivelDireto(D.vendas / num(m.meta_fechamento)) : null}
            status={num(m.meta_fechamento) > 0
              ? `${((D.vendas / num(m.meta_fechamento)) * 100).toFixed(0)}% atingido · faltam ${Math.max(num(m.meta_fechamento) - D.vendas, 0)} vendas`
              : "Sem meta definida"} />

          <MetricCard label="Faturamento" valor={fmtR(D.receita)}
            meta={metaFat > 0 ? fmtR(metaFat) : null} pct={metaFat > 0 ? aderencia : null}
            nivel={metaFat > 0 ? nivelDireto(D.receita / metaFat) : null}
            status={metaFat > 0 ? `${aderencia.toFixed(1)}% atingido · faltam ${fmtR(restante)}` : "Sem meta definida"} />

          <MetricCard label="Ticket médio" valor={fmtR(D.ticket)}
            meta={tkMeta > 0 ? fmtR(tkMeta) : null}
            pct={tkMeta > 0 && D.ticket > 0 ? (D.ticket / tkMeta) * 100 : null}
            nivel={tkMeta > 0 && D.ticket > 0 ? nivelDireto(D.ticket / tkMeta) : null}
            status={D.vendas === 0 ? "Sem vendas no período" : tkMeta > 0
              ? `${fmtR(Math.abs(D.ticket - tkMeta))} ${D.ticket >= tkMeta ? "acima" : "abaixo"} da meta`
              : "Sem meta definida"} />

          <MetricCard label="Conversão" valor={fmtP(D.conversao)}
            meta={num(m.taxa_conversao_meta) > 0 ? fmtP(m.taxa_conversao_meta) : null}
            pct={num(m.taxa_conversao_meta) > 0 ? (D.conversao / num(m.taxa_conversao_meta)) * 100 : null}
            nivel={num(m.taxa_conversao_meta) > 0 ? nivelDireto(D.conversao / num(m.taxa_conversao_meta)) : null}
            status={D.leads === 0 ? "Sem leads no período" : num(m.taxa_conversao_meta) > 0
              ? `${Math.abs(D.conversao - num(m.taxa_conversao_meta)).toFixed(1)} pontos ${D.conversao >= num(m.taxa_conversao_meta) ? "acima" : "abaixo"} da meta`
              : `${D.vendas} vendas em ${D.leads} leads`} />

          <MetricCard label="Produtos vendidos" valor={fmtN(D.produtosVendidos)}
            meta={num(m.meta_produtos) > 0 ? fmtN(m.meta_produtos) : null}
            pct={num(m.meta_produtos) > 0 ? (D.produtosVendidos / num(m.meta_produtos)) * 100 : null}
            nivel={num(m.meta_produtos) > 0 ? nivelDireto(D.produtosVendidos / num(m.meta_produtos)) : null}
            status={num(m.meta_produtos) > 0 ? `${((D.produtosVendidos / num(m.meta_produtos)) * 100).toFixed(0)}% atingido` : "Sem meta definida"} />

          <MetricCard label="Novos clientes" valor={fmtN(D.vendas)}
            meta={num(m.meta_novos_clientes) > 0 ? fmtN(m.meta_novos_clientes) : null}
            pct={num(m.meta_novos_clientes) > 0 ? (D.vendas / num(m.meta_novos_clientes)) * 100 : null}
            nivel={num(m.meta_novos_clientes) > 0 ? nivelDireto(D.vendas / num(m.meta_novos_clientes)) : null}
            status={num(m.meta_novos_clientes) > 0 ? `Faltam ${Math.max(num(m.meta_novos_clientes) - D.vendas, 0)} para a meta` : "Sem meta definida"} />
        </div>
      </section>

      {/* Anual */}
      <div className="pm-g-2">
        <section className="pm-card">
          <div className="pm-c-head"><h3>Leads por mês</h3><span className="pm-c-hint">{ano}</span></div>
          <Colunas dados={D.anual} chave="leads" metaChave="metaLeads" mesAtivo={mesSel} formato={fmtN}
            extra={(d) => <span>Conversão: {d.conv.toFixed(1)}%</span>} />
        </section>
        <section className="pm-card">
          <div className="pm-c-head"><h3>Vendas por mês</h3><span className="pm-c-hint">{ano}</span></div>
          <Colunas dados={D.anual} chave="vendas" metaChave="metaVendas" mesAtivo={mesSel} formato={fmtN}
            extra={(d) => <span>Receita: {fmtR(d.receita)}</span>} />
        </section>
      </div>

      {/* Base recorrente */}
      <section className="pm-card pm-recorrente">
        <div className="pm-c-head"><h3>Base recorrente</h3></div>
        <div className="pm-rec-grid">
          <div><span className="pm-rec-l">Clientes ativos</span><span className="pm-rec-v">{D.clientes}</span></div>
          <div><span className="pm-rec-l">MRR</span><span className="pm-rec-v">{fmtR(D.mrr)}</span>{num(m.meta_mrr) > 0 && <span className="pm-rec-m">Meta: {fmtR(m.meta_mrr)}</span>}</div>
          <div><span className="pm-rec-l">Ticket médio da base</span><span className="pm-rec-v">{fmtR(D.clientes ? D.mrr / D.clientes : 0)}</span></div>
        </div>
      </section>

      {/* Editor de metas */}
      {editando && (
        <section className="pm-card" style={{ marginTop: 16 }}>
          <div className="pm-c-head"><h3>Editar metas — {MESES_L[mesSel]} de {ano}</h3></div>
          <div className="pm-form">
            {[
              ["investimento", "Orçamento planejado (R$)", "1"], ["meta_leads", "Meta de leads", "1"],
              ["cpl_meta", "CPL máximo (R$)", "0.01"], ["taxa_conversao_meta", "Taxa conversão (%)", "0.1"],
              ["meta_fechamento", "Meta de vendas", "1"], ["ticket_medio_meta", "Ticket médio (R$)", "0.01"],
              ["meta_faturamento", "Meta faturamento (R$)", "1"], ["meta_churn", "Meta churn (%)", "0.1"],
              ["meta_mrr", "Meta MRR (R$)", "1"], ["meta_novos_clientes", "Meta novos clientes", "1"],
              ["meta_produtos", "Meta produtos vendidos", "1"],
            ].map(([k, l, step]) => (
              <div key={k} className="pm-f-row">
                <label>{l}</label>
                <input className="pm-input" type="number" step={step} value={form[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
              </div>
            ))}
          </div>
          <div className="pm-form-acoes">
            <button className="pm-btn" onClick={() => setEditando(false)}>Cancelar</button>
            <button className="pm-btn-primary" onClick={salvarMeta}>Salvar metas</button>
          </div>
        </section>
      )}

      {modalTraf && (
        <ModalTrafego base={m} mesLabel={`${MESES_L[mesSel]} de ${ano}`} userName={userName}
          onSalvar={salvarTrafego} onFechar={() => setModalTraf(false)} />
      )}
    </div>
  );
}
