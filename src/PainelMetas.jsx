import { useEffect, useMemo, useState } from "react";
import { fmtMoeda } from "./utils";
import { supabase } from "./supabaseClient.js";
import * as api from "./api.js";

/* ============================================================
   Painel de Metas — central de análise comercial e de aquisição.
   ============================================================ */

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_L = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const comp = (ano, mes) => `${ano}-${String(mes + 1).padStart(2, "0")}`;
const fmtN = (v) => Number(v || 0).toLocaleString("pt-BR");
const fmtR = (v) => fmtMoeda(Number(v || 0));
const fmtP = (v) => `${Number(v || 0).toFixed(1)}%`;

/* ---------- Velocímetro semicircular ---------- */
function Gauge({ pct, ritmo }) {
  const p = Math.max(Math.min(pct, 100), 0);
  const R = 88, CX = 110, CY = 104, W = 13;
  const arco = Math.PI * R;
  const ang = (v) => Math.PI * (1 - v / 100);
  const ponto = (v, r) => [CX + r * Math.cos(ang(v)), CY - r * Math.sin(ang(v))];
  const [mx1, my1] = ponto(ritmo, R - W / 2 - 4);
  const [mx2, my2] = ponto(ritmo, R + W / 2 + 4);
  const desvio = pct - ritmo;
  const cor = desvio >= -2 ? "var(--pm-ok)" : desvio >= -12 ? "var(--pm-avi)" : "var(--pm-err)";
  return (
    <svg viewBox="0 0 220 128" className="pm-gauge">
      <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="var(--pm-bd)" strokeWidth={W} strokeLinecap="round" />
      <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke={cor} strokeWidth={W} strokeLinecap="round"
        strokeDasharray={arco} strokeDashoffset={arco * (1 - p / 100)} style={{ transition: "stroke-dashoffset .5s ease" }} />
      {ritmo > 0 && ritmo <= 100 && <line x1={mx1} y1={my1} x2={mx2} y2={my2} stroke="var(--pm-tx2)" strokeWidth="2" strokeLinecap="round" />}
      <text x={CX} y={CY - 22} textAnchor="middle" className="pm-gauge-n" fill="var(--pm-tx)">{pct.toFixed(1)}%</text>
      <text x={CX} y={CY - 4} textAnchor="middle" className="pm-gauge-l" fill="var(--pm-tx2)">da meta</text>
    </svg>
  );
}

/* ---------- Bullet chart (com suporte a métrica inversa) ---------- */
function Bullet({ label, atual, meta, fmt, inversa, sufixo }) {
  const temMeta = meta > 0;
  const razao = temMeta ? atual / meta : 0;
  let pctBarra, cor, situacao;
  if (!temMeta) {
    pctBarra = 0; cor = "var(--pm-bd)"; situacao = "Sem meta definida";
  } else if (inversa) {
    pctBarra = Math.min(razao * 100, 100);
    const exc = ((atual - meta) / meta) * 100;
    cor = razao <= 1 ? "var(--pm-ok)" : razao <= 1.2 ? "var(--pm-avi)" : "var(--pm-err)";
    situacao = atual === 0 ? "Sem dados" : razao <= 1 ? `${Math.abs(exc).toFixed(0)}% abaixo do limite` : `${exc.toFixed(0)}% acima do limite`;
  } else {
    pctBarra = Math.min(razao * 100, 100);
    cor = razao >= 1 ? "var(--pm-ok)" : razao >= 0.7 ? "var(--pm-avi)" : "var(--pm-err)";
    situacao = `${(razao * 100).toFixed(0)}% atingido`;
  }
  return (
    <div className="pm-bullet">
      <div className="pm-bullet-top">
        <span className="pm-bullet-l">{label}{inversa && <span className="pm-inv" title="Quanto menor, melhor">menor é melhor</span>}</span>
        <span className="pm-bullet-v">
          {fmt(atual)}{sufixo}
          {temMeta && <span className="pm-bullet-meta"> / {fmt(meta)}{sufixo}</span>}
        </span>
      </div>
      <div className="pm-bullet-track">
        <div className="pm-bullet-fill" style={{ width: `${pctBarra}%`, background: cor }} />
        {temMeta && <span className="pm-bullet-marca" style={{ left: inversa ? "100%" : "100%" }} />}
      </div>
      <div className="pm-bullet-sit" style={{ color: cor === "var(--pm-bd)" ? "var(--pm-tx2)" : cor }}>{situacao}</div>
    </div>
  );
}

/* ---------- Gráfico de linha: receita acumulada x meta x projeção ---------- */
function LinhaReceita({ serie, meta, diasMes, diaAtual }) {
  const W = 640, H = 210, P = { t: 14, r: 14, b: 26, l: 58 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const maxV = Math.max(meta, ...serie, 1) * 1.08;
  const x = (d) => P.l + (d / Math.max(diasMes - 1, 1)) * iw;
  const y = (v) => P.t + ih - (v / maxV) * ih;

  const ptsReal = serie.slice(0, diaAtual).map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const areaReal = serie.length && diaAtual > 0
    ? `M ${x(0)},${y(0)} L ${ptsReal.replace(/ /g, " L ")} L ${x(diaAtual - 1)},${y(0)} Z` : "";
  const ptsMeta = Array.from({ length: diasMes }, (_, i) => `${x(i)},${y((meta / diasMes) * (i + 1))}`).join(" ");
  const realHoje = serie[diaAtual - 1] || 0;
  const projFinal = diaAtual > 0 ? (realHoje / diaAtual) * diasMes : 0;
  const ptsProj = diaAtual > 0 ? `${x(diaAtual - 1)},${y(realHoje)} ${x(diasMes - 1)},${y(projFinal)}` : "";

  const ticks = [0, 0.5, 1].map((f) => maxV * f);
  const labelsX = [0, Math.floor(diasMes / 3), Math.floor((2 * diasMes) / 3), diasMes - 1];

  return (
    <div className="pm-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="pm-svg">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={P.l} y1={y(t)} x2={W - P.r} y2={y(t)} stroke="var(--pm-grid)" strokeWidth="1" />
            <text x={P.l - 8} y={y(t) + 4} textAnchor="end" className="pm-ax">{fmtMoeda(t).replace(/,\d\d$/, "")}</text>
          </g>
        ))}
        {labelsX.map((d, i) => <text key={i} x={x(d)} y={H - 8} textAnchor="middle" className="pm-ax">{d + 1}</text>)}
        {meta > 0 && <polyline points={ptsMeta} fill="none" stroke="var(--pm-target)" strokeWidth="1.6" strokeDasharray="5 4" />}
        {areaReal && <path d={areaReal} fill="var(--pm-soft)" />}
        {ptsReal && <polyline points={ptsReal} fill="none" stroke="var(--pm-accent)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />}
        {ptsProj && <polyline points={ptsProj} fill="none" stroke="var(--pm-info)" strokeWidth="1.8" strokeDasharray="2 4" strokeLinecap="round" />}
        {diaAtual > 0 && <circle cx={x(diaAtual - 1)} cy={y(realHoje)} r="3.5" fill="var(--pm-accent)" />}
      </svg>
      <div className="pm-legenda">
        <span><i style={{ background: "var(--pm-accent)" }} />Realizado</span>
        <span><i className="tracejado" style={{ background: "var(--pm-target)" }} />Meta acumulada</span>
        <span><i className="pontilhado" style={{ background: "var(--pm-info)" }} />Projeção</span>
      </div>
    </div>
  );
}

/* ---------- Funil comercial ---------- */
function FunilCom({ etapas, modo }) {
  if (!etapas.length) return <p className="pm-vazio">Sem dados do CRM neste período.</p>;
  const base = Math.max(...etapas.map((e) => (modo === "valor" ? e.valor : e.qtd)), 1);
  return (
    <div className="pm-funil">
      {etapas.map((e, i) => {
        const v = modo === "valor" ? e.valor : e.qtd;
        const larg = Math.max((v / base) * 100, 8);
        const prox = etapas[i + 1];
        const conv = prox && e.qtd > 0 ? (prox.qtd / e.qtd) * 100 : null;
        const naoAvanc = prox ? Math.max(e.qtd - prox.qtd, 0) : 0;
        return (
          <div key={e.id}>
            <div className="pm-funil-barra" style={{ width: `${larg}%`, background: `var(--pm-f${Math.min(i, 4)})` }}>
              <span className="pm-funil-nome">{e.nome}</span>
              <span className="pm-funil-v">{modo === "valor" ? fmtR(e.valor) : e.qtd}</span>
            </div>
            {conv != null && (
              <div className="pm-funil-conv">
                <span className="pm-conv-pct">{conv.toFixed(0)}% avançaram</span>
                {naoAvanc > 0 && <span className="pm-conv-perda">{naoAvanc} não avançaram</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Colunas anuais ---------- */
function Colunas({ dados, chave, metaChave, formato }) {
  const max = Math.max(...dados.map((d) => Math.max(d[chave], d[metaChave])), 1);
  return (
    <div className="pm-cols">
      {dados.map((d, i) => {
        const h = (d[chave] / max) * 100;
        const hm = (d[metaChave] / max) * 100;
        const bateu = d[metaChave] > 0 && d[chave] >= d[metaChave];
        return (
          <div key={i} className="pm-col" title={`${d.mes}: ${formato(d[chave])}${d[metaChave] ? ` · Meta ${formato(d[metaChave])}` : ""}`}>
            <div className="pm-col-area">
              <div className="pm-col-barra" style={{ height: `${h}%`, background: bateu ? "var(--pm-ok)" : "var(--pm-accent)" }} />
              {d[metaChave] > 0 && <div className="pm-col-meta" style={{ bottom: `${hm}%` }} />}
            </div>
            <span className="pm-col-l">{d.mes}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Barra empilhada ---------- */
function Empilhada({ segs, formato }) {
  const total = segs.reduce((a, s) => a + s.v, 0) || 1;
  return (
    <div>
      <div className="pm-emp">
        {segs.map((s, i) => s.v > 0 && <div key={i} style={{ width: `${(s.v / total) * 100}%`, background: s.c }} />)}
      </div>
      <div className="pm-emp-leg">
        {segs.map((s, i) => (
          <div key={i}>
            <span className="pm-dot" style={{ background: s.c }} />
            <span className="pm-emp-l">{s.l}</span>
            <span className="pm-emp-v">{formato(s.v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Insight ---------- */
function Insight({ prio, titulo, texto }) {
  return (
    <div className={`pm-insight pm-i-${prio}`}>
      <div className="pm-i-head">
        <span className={`pm-i-tag pm-t-${prio}`}>{prio === "alta" ? "Alta prioridade" : prio === "media" ? "Atenção" : "Informação"}</span>
        <span className="pm-i-titulo">{titulo}</span>
      </div>
      <p className="pm-i-texto">{texto}</p>
    </div>
  );
}

/* ================= PAINEL ================= */
export default function PainelMetas({ clientes, onToast }) {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mesSel, setMesSel] = useState(new Date().getMonth());
  const [metas, setMetas] = useState({});
  const [editando, setEditando] = useState(false);
  const [crm, setCrm] = useState(null);
  const [form, setForm] = useState({});
  const [modoFunil, setModoFunil] = useState("qtd");
  const [modoDist, setModoDist] = useState("qtd");

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
      const row = { ...form, competencia, atualizado_em: new Date().toISOString() };
      await supabase.from("metas_comerciais").upsert(row, { onConflict: "competencia" });
      setMetas((p) => ({ ...p, [competencia]: row }));
      setEditando(false);
      onToast("Metas salvas");
    } catch (e) { onToast("Erro: " + e.message); }
  }
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  /* ---- Dados reais ---- */
  const D = useMemo(() => {
    const ativos = (clientes || []).filter((c) => c.ativo);
    const mrr = ativos.reduce((s, c) => s + (Number(c.ticket) || 0), 0);

    const etapas = (crm?.etapas || []).slice().sort((a, b) => a.ordem - b.ordem);
    const comerciais = etapas.filter((e) => e.tipo !== "perdido");
    const setG = new Set(etapas.filter((e) => e.tipo === "ganho").map((e) => e.id));
    const setP = new Set(etapas.filter((e) => e.tipo === "perdido").map((e) => e.id));

    const leadsMes = (crm?.leads || []).filter((l) => (l.criadoEm || "").startsWith(competencia));
    const ganhosL = leadsMes.filter((l) => setG.has(l.etapaId));
    const perdidosL = leadsMes.filter((l) => setP.has(l.etapaId));
    const abertosMes = leadsMes.filter((l) => !setG.has(l.etapaId) && !setP.has(l.etapaId));
    const receita = ganhosL.reduce((s, l) => s + (l.valor || 0), 0);
    const vlPerdido = perdidosL.reduce((s, l) => s + (l.valor || 0), 0);
    const vlAberto = abertosMes.reduce((s, l) => s + (l.valor || 0), 0);
    const ticket = ganhosL.length ? receita / ganhosL.length : 0;
    const conversao = leadsMes.length ? (ganhosL.length / leadsMes.length) * 100 : 0;
    const produtosVendidos = ganhosL.filter((l) => l.produtoId).length;

    // qualificados: da 3ª etapa comercial em diante
    const idxQ = Math.min(2, Math.max(comerciais.length - 1, 0));
    const idsQ = new Set(comerciais.slice(idxQ).map((e) => e.id));
    const qualificados = leadsMes.filter((l) => idsQ.has(l.etapaId) || setG.has(l.etapaId)).length;

    // pipeline aberto global (todas as competências)
    const abertosAll = (crm?.leads || []).filter((l) => !setG.has(l.etapaId) && !setP.has(l.etapaId));
    const pipelineTotal = abertosAll.reduce((s, l) => s + (l.valor || 0), 0);
    const escala = [0.1, 0.2, 0.4, 0.55, 0.75, 0.9];
    const ponderado = abertosAll.reduce((s, l) => {
      const e = etapas.find((x) => x.id === l.etapaId);
      const idx = Math.min(Math.round(((e?.ordem ?? 0) / Math.max(comerciais.length - 1, 1)) * (escala.length - 1)), escala.length - 1);
      return s + (l.valor || 0) * (escala[idx] || 0.3);
    }, 0);

    // mês anterior
    const mAnt = mesSel === 0 ? comp(ano - 1, 11) : comp(ano, mesSel - 1);
    const leadsAnt = (crm?.leads || []).filter((l) => (l.criadoEm || "").startsWith(mAnt));
    const ganhosAnt = leadsAnt.filter((l) => setG.has(l.etapaId));
    const receitaAnt = ganhosAnt.reduce((s, l) => s + (l.valor || 0), 0);
    const varia = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);

    // série diária acumulada
    const diasMes = new Date(ano, mesSel + 1, 0).getDate();
    const agora = new Date();
    const mesCorrente = agora.getFullYear() === ano && agora.getMonth() === mesSel;
    const diaAtual = mesCorrente ? agora.getDate() : diasMes;
    const porDia = Array(diasMes).fill(0);
    ganhosL.forEach((l) => {
      const d = new Date(l.criadoEm).getDate();
      if (d >= 1 && d <= diasMes) porDia[d - 1] += l.valor || 0;
    });
    const serie = []; let acc = 0;
    porDia.forEach((v) => { acc += v; serie.push(acc); });

    // funil
    const funil = comerciais.map((e) => {
      const ls = leadsMes.filter((l) => l.etapaId === e.id);
      return { id: e.id, nome: e.nome, qtd: ls.length, valor: ls.reduce((s, l) => s + (l.valor || 0), 0) };
    });

    // colunas anuais
    const anual = MESES.map((mes, i) => {
      const c = comp(ano, i);
      const mt = metas[c] || {};
      const ls = (crm?.leads || []).filter((l) => (l.criadoEm || "").startsWith(c));
      return { mes, leads: ls.length, metaLeads: Number(mt.meta_leads) || 0,
        vendas: ls.filter((l) => setG.has(l.etapaId)).length, metaVendas: Number(mt.meta_fechamento) || 0 };
    });

    const investimento = Number(m.investimento) || 0;
    const cpl = leadsMes.length ? investimento / leadsMes.length : 0;
    const cpo = qualificados ? investimento / qualificados : 0;
    const cpv = ganhosL.length ? investimento / ganhosL.length : 0;

    return {
      clientes: ativos.length, mrr, leads: leadsMes.length, vendas: ganhosL.length, perdidos: perdidosL.length,
      abertos: abertosMes.length, receita, vlPerdido, vlAberto, ticket, conversao, qualificados, produtosVendidos,
      pipelineTotal, ponderado, varReceita: varia(receita, receitaAnt), varVendas: varia(ganhosL.length, ganhosAnt.length),
      varLeads: varia(leadsMes.length, leadsAnt.length), serie, diasMes, diaAtual, mesCorrente, funil, anual,
      investimento, cpl, cpo, cpv,
    };
  }, [clientes, crm, competencia, metas, m, ano, mesSel]);

  /* ---- Cálculos de meta ---- */
  const metaFat = Number(m.meta_faturamento) || 0;
  const aderencia = metaFat > 0 ? (D.receita / metaFat) * 100 : 0;
  const ritmoIdeal = (D.diaAtual / D.diasMes) * 100;
  const restante = Math.max(metaFat - D.receita, 0);
  const diasRest = Math.max(D.diasMes - D.diaAtual, 0);
  const projecao = D.diaAtual > 0 ? (D.receita / D.diaAtual) * D.diasMes : 0;
  const vendasNec = D.ticket > 0 ? Math.ceil(restante / D.ticket) : 0;
  const cobertura = restante > 0 ? D.pipelineTotal / restante : null;
  const desvio = aderencia - ritmoIdeal;

  /* ---- Insights ---- */
  const insights = [];
  if (metaFat > 0 && D.diaAtual > 0) {
    const pj = (projecao / metaFat) * 100;
    insights.push({ prio: pj >= 100 ? "baixa" : pj >= 85 ? "media" : "alta",
      titulo: pj >= 100 ? "Meta no ritmo" : "Meta em risco",
      texto: `No ritmo atual, o faturamento deve encerrar o mês em ${fmtR(projecao)}, equivalente a ${pj.toFixed(1)}% da meta.` +
        (pj < 100 && vendasNec > 0 ? ` São necessárias cerca de ${vendasNec} novas vendas com o ticket médio atual.` : "") });
  }
  const gargalo = D.funil.map((e, i) => {
    const prox = D.funil[i + 1];
    return prox && e.qtd > 0 ? { de: e.nome, para: prox.nome, conv: (prox.qtd / e.qtd) * 100 } : null;
  }).filter(Boolean).sort((a, b) => a.conv - b.conv)[0];
  if (gargalo) insights.push({ prio: gargalo.conv < 40 ? "alta" : "media", titulo: "Gargalo do funil",
    texto: `A maior redução acontece entre "${gargalo.de}" e "${gargalo.para}". Apenas ${gargalo.conv.toFixed(0)}% das oportunidades avançam.` });
  const cplMeta = Number(m.cpl_meta) || 0;
  if (cplMeta > 0 && D.cpl > 0) {
    const exc = ((D.cpl - cplMeta) / cplMeta) * 100;
    if (exc > 5) insights.push({ prio: exc > 25 ? "alta" : "media", titulo: "CPL acima da meta",
      texto: `O custo por lead está em ${fmtR(D.cpl)}, ${exc.toFixed(0)}% acima do limite de ${fmtR(cplMeta)}. Verifique investimento, rastreamento e volume de conversões.` });
  }
  const tkMeta = Number(m.ticket_medio_meta) || 0;
  if (tkMeta > 0 && D.ticket > 0 && D.ticket < tkMeta) insights.push({ prio: "media", titulo: "Ticket médio abaixo do objetivo",
    texto: `O ticket médio está em ${fmtR(D.ticket)} contra a meta de ${fmtR(tkMeta)}. Mantendo esse valor, será necessário aumentar o volume de vendas.` });
  if (D.abertos > 0) insights.push({ prio: "baixa", titulo: "Oportunidades de recuperação",
    texto: `Existem ${D.abertos} oportunidades abertas neste mês, somando ${fmtR(D.vlAberto)}.` });

  const anoAtual = new Date().getFullYear();

  return (
    <div className="pm">
      {/* Cabeçalho */}
      <div className="pm-head">
        <div>
          <h1 className="pm-h1">Painel de Metas</h1>
          <p className="pm-sub">Visão comercial e de aquisição — {MESES_L[mesSel]} de {ano}</p>
        </div>
        <div className="pm-head-r">
          <select className="pm-sel" value={mesSel} onChange={(e) => setMesSel(Number(e.target.value))}>
            {MESES_L.map((mm, i) => <option key={i} value={i}>{mm}</option>)}
          </select>
          <select className="pm-sel" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {[anoAtual - 2, anoAtual - 1, anoAtual, anoAtual + 1].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className={editando ? "pm-btn-primary" : "pm-btn"} onClick={() => { if (editando) salvarMeta(); else setEditando(true); }}>
            {editando ? "Salvar metas" : "Editar metas"}
          </button>
        </div>
      </div>

      {/* Faixa de meses */}
      <div className="pm-meses">
        {MESES.map((mes, i) => (
          <button key={i} className={`pm-mes ${i === mesSel ? "on" : ""}`} onClick={() => setMesSel(i)}>{mes}</button>
        ))}
      </div>

      {/* Aderência + Forecast */}
      <div className="pm-g-topo">
        <section className="pm-card pm-aderencia">
          <div className="pm-c-head"><h3>Aderência à meta</h3></div>
          {metaFat === 0 ? (
            <div className="pm-vazio-bloco">
              <p>Ainda não há uma meta de faturamento definida para {MESES_L[mesSel]}.</p>
              <button className="pm-link" onClick={() => setEditando(true)}>Configurar meta</button>
            </div>
          ) : (<>
            <div className="pm-ader-corpo">
              <Gauge pct={aderencia} ritmo={ritmoIdeal} />
              <div className="pm-ader-dados">
                <div className="pm-ader-valor">{fmtR(D.receita)} <span>de {fmtR(metaFat)}</span></div>
                <div className="pm-ader-grid">
                  <div><span className="pm-g-l">Ritmo ideal hoje</span><span className="pm-g-v">{ritmoIdeal.toFixed(0)}%</span></div>
                  <div><span className="pm-g-l">Faltam</span><span className="pm-g-v">{fmtR(restante)}</span></div>
                  <div><span className="pm-g-l">Dias restantes</span><span className="pm-g-v">{diasRest}</span></div>
                  <div><span className="pm-g-l">Vendas necessárias</span><span className="pm-g-v">{vendasNec || "—"}</span></div>
                </div>
              </div>
            </div>
            <div className={`pm-nota ${desvio >= -2 ? "ok" : desvio >= -12 ? "avi" : "err"}`}>
              {D.diaAtual === 0 ? "Sem dados suficientes para projeção."
                : `Projeção no ritmo atual: ${fmtR(projecao)}` + (metaFat > 0 ? ` — ${((projecao / metaFat) * 100).toFixed(1)}% da meta.` : ".")}
            </div>
          </>)}
        </section>

        <section className="pm-card">
          <div className="pm-c-head"><h3>Previsão do mês</h3></div>
          <div className="pm-fc-linhas">
            <div><span className="pm-dot" style={{ background: "var(--pm-ok)" }} /><span className="pm-fc-l">Receita conquistada</span><span className="pm-fc-v">{fmtR(D.receita)}</span></div>
            <div><span className="pm-dot" style={{ background: "var(--pm-info)" }} /><span className="pm-fc-l">Pipeline ponderado</span><span className="pm-fc-v">{fmtR(D.ponderado)}</span></div>
            <div><span className="pm-dot" style={{ background: "var(--pm-tx2)" }} /><span className="pm-fc-l">Melhor cenário</span><span className="pm-fc-v">{fmtR(D.receita + D.pipelineTotal)}</span></div>
            <div><span className="pm-dot" style={{ background: "var(--pm-bd)" }} /><span className="pm-fc-l">Pipeline total</span><span className="pm-fc-v">{fmtR(D.pipelineTotal)}</span></div>
          </div>
          {metaFat > 0 && (
            <div className="pm-fc-barra-wrap">
              <div className="pm-fc-barra">
                <div style={{ width: `${Math.min((D.receita / metaFat) * 100, 100)}%`, background: "var(--pm-ok)" }} />
                <div style={{ width: `${Math.min((D.ponderado / metaFat) * 100, Math.max(100 - (D.receita / metaFat) * 100, 0))}%`, background: "var(--pm-info)" }} />
                <span className="pm-fc-meta-marca" />
              </div>
              <div className="pm-fc-insight">
                Projeção comprometida cobre <strong>{(((D.receita + D.ponderado) / metaFat) * 100).toFixed(0)}%</strong> da meta.
                {cobertura != null && <> Cobertura do pipeline: <strong>{cobertura.toFixed(1)}x</strong> o valor restante.</>}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Indicadores */}
      <div className="pm-g-kpi">
        {[
          { l: "Receita ganha", v: fmtR(D.receita), sub: metaFat > 0 ? `Meta: ${fmtR(metaFat)}` : "Sem meta", var: D.varReceita },
          { l: "Vendas", v: fmtN(D.vendas), sub: m.meta_fechamento > 0 ? `Meta: ${fmtN(m.meta_fechamento)}` : "Sem meta", var: D.varVendas },
          { l: "Ticket médio", v: fmtR(D.ticket), sub: tkMeta > 0 ? `Meta: ${fmtR(tkMeta)}` : "Sem meta" },
          { l: "Taxa de conversão", v: fmtP(D.conversao), sub: `${D.vendas} em ${D.leads} · Meta ${fmtP(m.taxa_conversao_meta)}`,
            cor: D.conversao >= (Number(m.taxa_conversao_meta) || 0) ? "var(--pm-ok)" : "var(--pm-err)" },
          { l: "Leads qualificados", v: fmtN(D.qualificados), sub: D.leads ? `${((D.qualificados / D.leads) * 100).toFixed(0)}% dos leads` : "Sem leads" },
          { l: "Pipeline aberto", v: fmtR(D.pipelineTotal), sub: `${D.abertos} no mês · ${fmtR(D.vlAberto)}` },
        ].map((k, i) => (
          <div key={i} className="pm-kpi">
            <div className="pm-kpi-l">{k.l}</div>
            <div className="pm-kpi-v" style={k.cor ? { color: k.cor } : {}}>{k.v}</div>
            <div className="pm-kpi-f">
              <span>{k.sub}</span>
              {k.var != null && Math.abs(k.var) >= 0.1 && (
                <span className={`pm-var ${k.var >= 0 ? "up" : "down"}`}>{k.var >= 0 ? "▲" : "▼"} {Math.abs(k.var).toFixed(1)}%</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Evolução + Insights */}
      <div className="pm-g-63">
        <section className="pm-card">
          <div className="pm-c-head">
            <h3>Evolução da receita</h3>
            <span className="pm-c-hint">{MESES_L[mesSel]} de {ano}</span>
          </div>
          {D.receita === 0 && metaFat === 0
            ? <p className="pm-vazio">Nenhuma venda registrada neste período.</p>
            : <>
                <LinhaReceita serie={D.serie} meta={metaFat} diasMes={D.diasMes} diaAtual={D.diaAtual} />
                {metaFat > 0 && D.diaAtual > 0 && (
                  <div className="pm-nota-linha">
                    {desvio >= 0
                      ? `A receita está ${desvio.toFixed(1)} pontos acima do ritmo esperado para o período.`
                      : `A receita está ${Math.abs(desvio).toFixed(1)} pontos abaixo do ritmo esperado para o período.`}
                  </div>
                )}
              </>}
        </section>

        <section className="pm-card">
          <div className="pm-c-head"><h3>Insights da operação</h3></div>
          {insights.length === 0
            ? <p className="pm-vazio">Configure metas para receber recomendações automáticas.</p>
            : <div className="pm-insights">{insights.slice(0, 5).map((x, i) => <Insight key={i} {...x} />)}</div>}
        </section>
      </div>

      {/* Funil + Distribuição */}
      <div className="pm-g-2">
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
            <h3>Distribuição das oportunidades</h3>
            <div className="pm-toggle">
              <button className={modoDist === "qtd" ? "on" : ""} onClick={() => setModoDist("qtd")}>Quantidade</button>
              <button className={modoDist === "valor" ? "on" : ""} onClick={() => setModoDist("valor")}>Valor</button>
            </div>
          </div>
          {D.leads === 0
            ? <p className="pm-vazio">Nenhum lead recebido no período selecionado.</p>
            : modoDist === "qtd"
              ? <Empilhada formato={(v) => String(v)} segs={[
                  { l: "Em aberto", v: D.abertos, c: "var(--pm-info)" },
                  { l: "Ganhas", v: D.vendas, c: "var(--pm-ok)" },
                  { l: "Perdidas", v: D.perdidos, c: "var(--pm-err)" }]} />
              : <Empilhada formato={fmtR} segs={[
                  { l: "Em aberto", v: D.vlAberto, c: "var(--pm-info)" },
                  { l: "Ganhas", v: D.receita, c: "var(--pm-ok)" },
                  { l: "Perdidas", v: D.vlPerdido, c: "var(--pm-err)" }]} />}
        </section>
      </div>

      {/* Metas de tráfego + comerciais */}
      <div className="pm-g-2">
        <section className="pm-card">
          <div className="pm-c-head"><h3>Metas de tráfego</h3></div>
          <Bullet label="Investimento" atual={D.investimento} meta={Number(m.investimento) || 0} fmt={fmtR} />
          <Bullet label="Leads" atual={D.leads} meta={Number(m.meta_leads) || 0} fmt={fmtN} />
          <Bullet label="CPL" atual={D.cpl} meta={cplMeta} fmt={fmtR} inversa />
          <Bullet label="Custo por oportunidade" atual={D.cpo} meta={cplMeta > 0 ? cplMeta * 3 : 0} fmt={fmtR} inversa />
          <Bullet label="Custo por venda" atual={D.cpv} meta={tkMeta > 0 ? tkMeta * 0.3 : 0} fmt={fmtR} inversa />
        </section>

        <section className="pm-card">
          <div className="pm-c-head"><h3>Metas comerciais</h3></div>
          <Bullet label="Vendas" atual={D.vendas} meta={Number(m.meta_fechamento) || 0} fmt={fmtN} />
          <Bullet label="Faturamento" atual={D.receita} meta={metaFat} fmt={fmtR} />
          <Bullet label="Ticket médio" atual={D.ticket} meta={tkMeta} fmt={fmtR} />
          <Bullet label="Conversão" atual={D.conversao} meta={Number(m.taxa_conversao_meta) || 0} fmt={(v) => Number(v).toFixed(1)} sufixo="%" />
          <Bullet label="Produtos vendidos" atual={D.produtosVendidos} meta={Number(m.meta_produtos) || 0} fmt={fmtN} />
          <Bullet label="Novos clientes" atual={D.vendas} meta={Number(m.meta_novos_clientes) || 0} fmt={fmtN} />
        </section>
      </div>

      {/* Anual */}
      <div className="pm-g-2">
        <section className="pm-card">
          <div className="pm-c-head"><h3>Leads por mês</h3><span className="pm-c-hint">{ano}</span></div>
          <Colunas dados={D.anual} chave="leads" metaChave="metaLeads" formato={fmtN} />
        </section>
        <section className="pm-card">
          <div className="pm-c-head"><h3>Vendas por mês</h3><span className="pm-c-hint">{ano}</span></div>
          <Colunas dados={D.anual} chave="vendas" metaChave="metaVendas" formato={fmtN} />
        </section>
      </div>

      {/* Base recorrente */}
      <section className="pm-card pm-recorrente">
        <div className="pm-c-head"><h3>Base recorrente</h3></div>
        <div className="pm-rec-grid">
          <div><span className="pm-rec-l">Clientes ativos</span><span className="pm-rec-v">{D.clientes}</span></div>
          <div><span className="pm-rec-l">MRR</span><span className="pm-rec-v">{fmtR(D.mrr)}</span>{m.meta_mrr > 0 && <span className="pm-rec-m">Meta: {fmtR(m.meta_mrr)}</span>}</div>
          <div><span className="pm-rec-l">Ticket médio da base</span><span className="pm-rec-v">{fmtR(D.clientes ? D.mrr / D.clientes : 0)}</span></div>
        </div>
      </section>

      {/* Editor */}
      {editando && (
        <section className="pm-card" style={{ marginTop: 16 }}>
          <div className="pm-c-head"><h3>Editar metas — {MESES_L[mesSel]} de {ano}</h3></div>
          <div className="pm-form">
            {[
              ["investimento", "Investimento (R$)", "1"], ["meta_leads", "Meta de leads", "1"],
              ["cpl_meta", "CPL máximo (R$)", "0.01"], ["taxa_conversao_meta", "Taxa conversão (%)", "0.1"],
              ["meta_fechamento", "Meta de vendas", "1"], ["ticket_medio_meta", "Ticket médio (R$)", "0.01"],
              ["meta_faturamento", "Meta faturamento (R$)", "1"], ["meta_churn", "Meta churn (%)", "0.1"],
              ["meta_mrr", "Meta MRR (R$)", "1"], ["meta_novos_clientes", "Meta novos clientes", "1"],
              ["meta_produtos", "Meta produtos vendidos", "1"],
            ].map(([k, l, step]) => (
              <div key={k} className="pm-f-row">
                <label>{l}</label>
                <input className="pm-input" type="number" step={step} value={form[k] || ""} onChange={(e) => set(k, e.target.value)} />
              </div>
            ))}
          </div>
          <div className="pm-form-acoes">
            <button className="pm-btn" onClick={() => setEditando(false)}>Cancelar</button>
            <button className="pm-btn-primary" onClick={salvarMeta}>Salvar metas</button>
          </div>
        </section>
      )}
    </div>
  );
}
