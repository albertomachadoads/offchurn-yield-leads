import { useEffect, useMemo, useState } from "react";
import { fmtMoeda } from "./utils.js";
import { supabase } from "./supabaseClient.js";
import * as api from "./api.js";

/* ============================================================
   Dashboard — Central de comando comercial
   ============================================================ */

/* ---------- Ícones (linha única, 18px, Lucide-style) ---------- */
const I = {
  users: <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />,
  target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  trophy: <><path d="M6 9H4.5a2.5 2.5 0 010-5H6M18 9h1.5a2.5 2.5 0 000-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0012 0V2z" /></>,
  wallet: <><path d="M21 12V7H5a2 2 0 010-4h14v4M3 5v14a2 2 0 002 2h16v-5" /><path d="M18 12a2 2 0 000 4h4v-4h-4z" /></>,
  percent: <><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>,
  layers: <><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  alert: <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  refresh: <><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></>,
  check: <polyline points="20 6 9 17 4 12" />,
  x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  arrow: <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
  trendUp: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
  trendDown: <><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></>,
};
const Ico = ({ d, size = 18, color, sw = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

/* ---------- Períodos ---------- */
const PERIODOS = [
  { v: "hoje", l: "Hoje" }, { v: "7d", l: "Últimos 7 dias" }, { v: "mes", l: "Mês atual" },
  { v: "30d", l: "Últimos 30 dias" }, { v: "90d", l: "Últimos 90 dias" }, { v: "custom", l: "Personalizado" },
];
function rangePeriodo(p, ini, fim) {
  const hoje = new Date(); const d = new Date();
  if (p === "hoje") { d.setHours(0, 0, 0, 0); return [d.toISOString(), hoje.toISOString()]; }
  if (p === "7d") d.setDate(d.getDate() - 7);
  else if (p === "30d") d.setDate(d.getDate() - 30);
  else if (p === "90d") d.setDate(d.getDate() - 90);
  else if (p === "mes") { d.setDate(1); d.setHours(0, 0, 0, 0); }
  else if (p === "custom" && ini) return [new Date(ini).toISOString(), fim ? new Date(fim + "T23:59:59").toISOString() : hoje.toISOString()];
  return [d.toISOString(), hoje.toISOString()];
}

/* ---------- Probabilidades por posição no funil ---------- */
function probEtapa(ordem, total, tipo) {
  if (tipo === "ganho") return 1;
  if (tipo === "perdido") return 0;
  if (total <= 1) return 0.3;
  const escala = [0.1, 0.2, 0.4, 0.55, 0.75, 0.9];
  const idx = Math.min(Math.round((ordem / Math.max(total - 1, 1)) * (escala.length - 1)), escala.length - 1);
  return escala[idx];
}

const saudacao = () => { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; };
const soData = (s) => (s || "").slice(0, 10);
const brData = (s) => soData(s).split("-").reverse().join("/");
const hojeISO = () => new Date().toISOString().slice(0, 10);

/* ================= COMPONENTES ================= */

function Kpi({ icon, label, valor, linha2, linha3, variacao, onClick }) {
  return (
    <div className={`k-card ${onClick ? "k-click" : ""}`} onClick={onClick}>
      <div className="k-top">
        <span className="k-ico"><Ico d={icon} size={17} /></span>
        <span className="k-label">{label}</span>
      </div>
      <div className="k-valor">{valor}</div>
      <div className="k-foot">
        {linha2 && <span className="k-sub">{linha2}</span>}
        {variacao != null && Math.abs(variacao) >= 0.1 && (
          <span className={`k-var ${variacao >= 0 ? "up" : "down"}`}>
            <Ico d={variacao >= 0 ? I.trendUp : I.trendDown} size={11} sw={2.2} />
            {Math.abs(variacao).toFixed(1)}%
          </span>
        )}
      </div>
      {linha3 && <div className="k-sub2">{linha3}</div>}
    </div>
  );
}

/* Card de meta com barra + marcador de ritmo ideal */
function CardMeta({ meta, receita, vendas, metaVendas, diasTotal, diasDecorridos }) {
  const pct = meta > 0 ? (receita / meta) * 100 : 0;
  const restante = Math.max(meta - receita, 0);
  const diasRestantes = Math.max(diasTotal - diasDecorridos, 0);
  const ritmoIdeal = diasTotal > 0 ? (diasDecorridos / diasTotal) * 100 : 0;
  const projecao = diasDecorridos > 0 ? (receita / diasDecorridos) * diasTotal : 0;
  const porDia = diasRestantes > 0 ? restante / diasRestantes : restante;
  const acima = pct >= ritmoIdeal;

  if (!meta) return (
    <div className="m-card m-vazio">
      <div className="m-titulo">Meta do mês</div>
      <p className="vazio-txt">Nenhuma meta definida para este mês.</p>
      <p className="vazio-txt" style={{ opacity: .7 }}>Defina em Painel de Metas para acompanhar sua aderência aqui.</p>
    </div>
  );

  return (
    <div className="m-card">
      <div className="m-head">
        <div>
          <div className="m-titulo">Aderência à meta</div>
          <div className="m-valores"><strong>{fmtMoeda(receita)}</strong> de {fmtMoeda(meta)}</div>
        </div>
        <div className="m-pct">{pct.toFixed(1)}%</div>
      </div>

      <div className="m-barra">
        <div className="m-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
        <div className="m-marca" style={{ left: `${Math.min(ritmoIdeal, 100)}%` }} title="Onde você deveria estar hoje" />
      </div>
      <div className="m-legenda">
        <span>Ritmo ideal hoje: {ritmoIdeal.toFixed(0)}%</span>
        <span>{diasRestantes} dias restantes</span>
      </div>

      <div className="m-grid">
        <div><span className="m-g-l">Faltam</span><span className="m-g-v">{fmtMoeda(restante)}</span></div>
        <div><span className="m-g-l">Projeção</span><span className="m-g-v">{fmtMoeda(projecao)}</span></div>
        <div><span className="m-g-l">Vendas</span><span className="m-g-v">{vendas}{metaVendas > 0 && <em> / {metaVendas}</em>}</span></div>
      </div>

      <div className={`m-insight ${acima ? "ok" : "warn"}`}>
        {acima
          ? `Você está no ritmo. Mantendo a média atual, fecha o mês em ${fmtMoeda(projecao)}.`
          : `Abaixo do ritmo necessário. Para bater a meta, gere ${fmtMoeda(porDia)} por dia nos próximos ${diasRestantes} dias.`}
      </div>
    </div>
  );
}

/* Forecast */
function CardForecast({ conquistado, ponderado, pipeline, meta }) {
  const melhor = conquistado + pipeline;
  const projetado = conquistado + ponderado;
  const cobertura = meta > conquistado ? pipeline / (meta - conquistado) : null;
  const pctMeta = meta > 0 ? (projetado / meta) * 100 : 0;
  const linhas = [
    { l: "Receita conquistada", v: conquistado, c: "var(--ok)" },
    { l: "Pipeline ponderado", v: ponderado, c: "var(--info)" },
    { l: "Melhor cenário", v: melhor, c: "var(--txt2)" },
  ];
  return (
    <div className="f-card">
      <div className="c-head"><h3>Previsão do mês</h3></div>
      <div className="f-linhas">
        {linhas.map((x, i) => (
          <div key={i} className="f-linha">
            <span className="f-dot" style={{ background: x.c }} />
            <span className="f-l">{x.l}</span>
            <span className="f-v">{fmtMoeda(x.v)}</span>
          </div>
        ))}
      </div>
      {meta > 0 && (
        <div className="f-insight">
          Considerando as oportunidades em aberto ponderadas, a projeção cobre <strong>{pctMeta.toFixed(0)}%</strong> da meta.
          {cobertura != null && <> Cobertura do pipeline: <strong>{cobertura.toFixed(1)}x</strong> o valor restante.</>}
        </div>
      )}
    </div>
  );
}

/* Barra segmentada */
function BarraSeg({ segs, formato }) {
  const total = segs.reduce((a, s) => a + s.v, 0) || 1;
  return (
    <div className="seg-wrap">
      <div className="seg-bar">
        {segs.map((s, i) => s.v > 0 && <div key={i} style={{ width: `${(s.v / total) * 100}%`, background: s.c }} title={`${s.l}: ${formato(s.v)}`} />)}
      </div>
      <div className="seg-legenda">
        {segs.map((s, i) => (
          <div key={i} className="seg-item">
            <span className="seg-dot" style={{ background: s.c }} />
            <span className="seg-l">{s.l}</span>
            <span className="seg-v">{formato(s.v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Funil analítico */
function Funil({ etapas, onEtapa }) {
  const max = Math.max(...etapas.map((e) => e.qtd), 1);
  return (
    <div className="fn-tabela">
      <div className="fn-head"><span>Etapa</span><span>Opor.</span><span>Valor</span><span>Conv.</span></div>
      {etapas.map((e, i) => (
        <div key={i} className="fn-row" onClick={() => onEtapa && onEtapa(e)}>
          <div className="fn-nome">
            <span>{e.nome}</span>
            <div className="fn-bar"><div style={{ width: `${Math.max((e.qtd / max) * 100, 1.5)}%` }} /></div>
          </div>
          <span className="fn-n">{e.qtd}</span>
          <span className="fn-n">{e.valor > 0 ? fmtMoeda(e.valor) : "—"}</span>
          <span className="fn-n">{e.conv == null ? "—" : `${e.conv.toFixed(0)}%`}</span>
        </div>
      ))}
    </div>
  );
}

/* Lista vazia padronizada */
function Vazio({ texto, acao, onAcao }) {
  return (
    <div className="vazio">
      <p className="vazio-txt">{texto}</p>
      {acao && <button className="btn-txt" onClick={onAcao}>{acao}</button>}
    </div>
  );
}

/* ================= DASHBOARD ================= */
export default function Dashboard({ clientes, tarefas, pessoas, onToast, isAdmin, onVerLead, onReload, userName }) {
  const [periodo, setPeriodo] = useState("mes");
  const [dtIni, setDtIni] = useState("");
  const [dtFim, setDtFim] = useState("");
  const [respFiltro, setRespFiltro] = useState("todos");
  const [crm, setCrm] = useState(null);
  const [metas, setMetas] = useState([]);
  const [atualizadoEm, setAtualizadoEm] = useState(new Date());
  const [carregando, setCarregando] = useState(true);

  async function carregarCRM() {
    setCarregando(true);
    try { setCrm(await api.fetchCRM()); setAtualizadoEm(new Date()); } catch {}
    setCarregando(false);
  }
  useEffect(() => { carregarCRM(); }, []);
  useEffect(() => {
    const comp = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    supabase.from("metas_comerciais").select("*").eq("competencia", comp).then(({ data }) => setMetas(data || []));
  }, []);

  const vendedores = useMemo(() => (pessoas || []).filter((p) => p.nome), [pessoas]);

  async function mudarStatusTarefa(id, status) {
    try { await supabase.from("crm_atividades").update({ status }).eq("id", id); carregarCRM(); onToast && onToast(status === "concluida" ? "Tarefa concluída" : "Tarefa cancelada"); }
    catch (e) { onToast && onToast("Erro: " + e.message); }
  }

  const D = useMemo(() => {
    const [desde, ate] = rangePeriodo(periodo, dtIni, dtFim);
    const etapas = (crm?.etapas || []).slice().sort((a, b) => a.ordem - b.ordem);
    const comerciais = etapas.filter((e) => e.tipo !== "perdido");
    const setGanho = new Set(etapas.filter((e) => e.tipo === "ganho").map((e) => e.id));
    const setPerdido = new Set(etapas.filter((e) => e.tipo === "perdido").map((e) => e.id));
    const porResp = (x) => respFiltro === "todos" || x.responsavelId === respFiltro;

    const todos = (crm?.leads || []).filter(porResp);
    const noPeriodo = todos.filter((l) => l.criadoEm >= desde && l.criadoEm <= ate);
    const ganhos = noPeriodo.filter((l) => setGanho.has(l.etapaId));
    const perdidos = noPeriodo.filter((l) => setPerdido.has(l.etapaId));
    const abertos = todos.filter((l) => !setGanho.has(l.etapaId) && !setPerdido.has(l.etapaId));

    const receita = ganhos.reduce((s, l) => s + l.valor, 0);
    const perdida = perdidos.reduce((s, l) => s + l.valor, 0);
    const pipeline = abertos.reduce((s, l) => s + l.valor, 0);
    const ticket = ganhos.length ? receita / ganhos.length : 0;
    const conversao = noPeriodo.length ? (ganhos.length / noPeriodo.length) * 100 : 0;

    // período anterior (mesma duração)
    const dur = new Date(ate) - new Date(desde);
    const antDesde = new Date(new Date(desde) - dur).toISOString();
    const ant = todos.filter((l) => l.criadoEm >= antDesde && l.criadoEm < desde);
    const antGanhos = ant.filter((l) => setGanho.has(l.etapaId));
    const antReceita = antGanhos.reduce((s, l) => s + l.valor, 0);
    const varia = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);

    // qualificados = a partir da 3ª etapa comercial
    const idxQual = Math.min(2, Math.max(comerciais.length - 1, 0));
    const idsQual = new Set(comerciais.slice(idxQual).map((e) => e.id));
    const qualificados = noPeriodo.filter((l) => idsQual.has(l.etapaId) || setGanho.has(l.etapaId));

    // pipeline ponderado
    const ponderado = abertos.reduce((s, l) => {
      const e = etapas.find((x) => x.id === l.etapaId);
      return s + l.valor * probEtapa(e?.ordem ?? 0, comerciais.length, e?.tipo);
    }, 0);

    // funil analítico
    const funil = comerciais.map((e, i) => {
      const leadsEt = noPeriodo.filter((l) => l.etapaId === e.id);
      const acumAtual = comerciais.slice(i).reduce((s, x) => s + noPeriodo.filter((l) => l.etapaId === x.id).length, 0);
      const acumAnt = i === 0 ? null : comerciais.slice(i - 1).reduce((s, x) => s + noPeriodo.filter((l) => l.etapaId === x.id).length, 0);
      return { id: e.id, nome: e.nome, qtd: leadsEt.length, valor: leadsEt.reduce((s, l) => s + l.valor, 0), conv: acumAnt ? (acumAtual / acumAnt) * 100 : null };
    });

    // tarefas do CRM
    const leadsMap = {}; todos.forEach((l) => { leadsMap[l.id] = l; });
    const hj = hojeISO();
    const tarefasCRM = (crm?.atividades || [])
      .filter((a) => ["tarefa", "ligacao", "email"].includes(a.tipo) && a.status !== "cancelada")
      .filter((a) => respFiltro === "todos" || a.responsavelId === respFiltro)
      .map((a) => {
        const lead = leadsMap[a.leadId];
        const dp = soData(a.dataPrevista);
        const concluida = a.status === "concluida";
        return { ...a, lead, leadNome: lead?.nome || "—", valor: lead?.valor || 0, dp,
          atrasada: !!dp && dp < hj && !concluida, hoje: dp === hj && !concluida, concluida };
      });
    const pend = tarefasCRM.filter((t) => !t.concluida);
    const atrasadas = pend.filter((t) => t.atrasada);
    const deHoje = pend.filter((t) => t.hoje);
    const concluidas = tarefasCRM.filter((t) => t.concluida);
    const taxaConcl = tarefasCRM.length ? (concluidas.length / tarefasCRM.length) * 100 : 0;

    // prioridades: atrasada > valor > data
    const prioridades = pend.slice().sort((a, b) => {
      if (a.atrasada !== b.atrasada) return a.atrasada ? -1 : 1;
      if (a.hoje !== b.hoje) return a.hoje ? -1 : 1;
      if (b.valor !== a.valor) return b.valor - a.valor;
      return (a.dp || "9") < (b.dp || "9") ? -1 : 1;
    });

    // reuniões
    const idsReuniao = etapas.filter((e) => /reuni/i.test(e.nome || "")).map((e) => e.id);
    const reunioes = abertos.filter((l) => idsReuniao.includes(l.etapaId)).sort((a, b) => b.valor - a.valor);

    // oportunidades em risco
    const ultimaAtiv = {};
    (crm?.atividades || []).forEach((a) => { if (!ultimaAtiv[a.leadId] || a.criadoEm > ultimaAtiv[a.leadId]) ultimaAtiv[a.leadId] = a.criadoEm; });
    const comTarefa = new Set(pend.map((t) => t.leadId));
    const risco = abertos.map((l) => {
      const ref = ultimaAtiv[l.id] || l.atualizadoEm || l.criadoEm;
      const dias = Math.floor((Date.now() - new Date(ref)) / 86400000);
      let motivo = null;
      if (!comTarefa.has(l.id) && dias >= 3) motivo = "Sem próxima tarefa";
      else if (dias >= 7) motivo = "Sem interação";
      else if (!l.responsavelId) motivo = "Sem responsável";
      else if (!l.valor) motivo = "Sem valor definido";
      return motivo ? { ...l, dias, motivo } : null;
    }).filter(Boolean).sort((a, b) => (b.valor - a.valor) || (b.dias - a.dias));

    // motivos de perda
    const motivosMap = {}; (crm?.motivos || []).forEach((m) => { motivosMap[m.id] = m.nome; });
    const agrup = {};
    perdidos.forEach((l) => {
      const k = l.motivoPerdaId || "_sem";
      if (!agrup[k]) agrup[k] = { nome: motivosMap[l.motivoPerdaId] || "Não informado", qtd: 0, valor: 0 };
      agrup[k].qtd++; agrup[k].valor += l.valor;
    });
    const motivosPerda = Object.values(agrup).sort((a, b) => b.qtd - a.qtd);

    // meta do mês
    const metaObj = metas.find((m) => m.vendedor_id === respFiltro) || metas.find((m) => !m.vendedor_id) || {};
    const agora = new Date();
    const diasTotal = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
    const iniMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
    const ganhosMes = todos.filter((l) => setGanho.has(l.etapaId) && l.criadoEm >= iniMes);
    const receitaMes = ganhosMes.reduce((s, l) => s + l.valor, 0);

    return {
      leads: noPeriodo.length, semContato: noPeriodo.filter((l) => !ultimaAtiv[l.id]).length,
      qualificados: qualificados.length, taxaQual: noPeriodo.length ? (qualificados.length / noPeriodo.length) * 100 : 0,
      vendas: ganhos.length, receita, perdida, ticket, conversao, pipeline, ponderado,
      abertos: abertos.length, perdidos: perdidos.length,
      varLeads: varia(noPeriodo.length, ant.length), varVendas: varia(ganhos.length, antGanhos.length), varReceita: varia(receita, antReceita),
      funil, prioridades, atrasadas, deHoje, concluidas: concluidas.length, pendTotal: pend.length, taxaConcl,
      reunioes, risco, motivosPerda,
      meta: Number(metaObj.meta_faturamento) || 0, metaVendas: Number(metaObj.meta_fechamento) || 0,
      receitaMes, vendasMes: ganhosMes.length, diasTotal, diasDecorridos: agora.getDate(),
    };
  }, [crm, metas, periodo, dtIni, dtFim, respFiltro]);

  const minAtras = Math.floor((Date.now() - atualizadoEm) / 60000);

  return (
    <div className="dash">
      {/* CABEÇALHO */}
      <div className="d-head">
        <div>
          <h1 className="d-h1">{saudacao()}{userName ? `, ${userName.split(" ")[0]}` : ""}</h1>
          <p className="d-sub">Aqui está o resumo da sua operação comercial.</p>
        </div>
        <div className="d-filtros">
          <select className="sel" value={respFiltro} onChange={(e) => setRespFiltro(e.target.value)}>
            <option value="todos">Todos os responsáveis</option>
            {vendedores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <select className="sel" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {PERIODOS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
          </select>
          {periodo === "custom" && (<>
            <input type="date" className="sel sel-data" value={dtIni} onChange={(e) => setDtIni(e.target.value)} />
            <input type="date" className="sel sel-data" value={dtFim} onChange={(e) => setDtFim(e.target.value)} />
          </>)}
          <button className="btn-refresh" onClick={() => { carregarCRM(); onReload && onReload(); }} disabled={carregando}>
            <Ico d={I.refresh} size={14} />
            <span>{carregando ? "Atualizando" : "Atualizar"}</span>
          </button>
        </div>
      </div>
      <div className="d-timestamp">Atualizado {minAtras < 1 ? "agora" : `há ${minAtras} min`}</div>

      {/* META + FORECAST */}
      <div className="g-meta">
        <CardMeta meta={D.meta} receita={D.receitaMes} vendas={D.vendasMes} metaVendas={D.metaVendas}
          diasTotal={D.diasTotal} diasDecorridos={D.diasDecorridos} />
        <CardForecast conquistado={D.receitaMes} ponderado={D.ponderado} pipeline={D.pipeline} meta={D.meta} />
      </div>

      {/* KPIs */}
      <div className="g-kpi">
        <Kpi icon={I.users} label="Leads recebidos" valor={D.leads} linha2={`${D.semContato} sem contato`} variacao={D.varLeads} />
        <Kpi icon={I.target} label="Qualificadas" valor={D.qualificados} linha2={`${D.taxaQual.toFixed(1)}% dos leads`} />
        <Kpi icon={I.trophy} label="Vendas" valor={D.vendas} linha2={D.metaVendas > 0 ? `Meta: ${D.metaVendas}` : null} variacao={D.varVendas} />
        <Kpi icon={I.wallet} label="Receita conquistada" valor={fmtMoeda(D.receita)} linha2={D.ticket > 0 ? `Ticket ${fmtMoeda(D.ticket)}` : null} variacao={D.varReceita} />
        <Kpi icon={I.percent} label="Taxa de conversão" valor={`${D.conversao.toFixed(1)}%`} linha2={`${D.vendas} em ${D.leads} leads`} />
        <Kpi icon={I.layers} label="Pipeline aberto" valor={fmtMoeda(D.pipeline)} linha2={`${D.abertos} oportunidades`} linha3={`Ponderado ${fmtMoeda(D.ponderado)}`} />
      </div>

      {/* PRIORIDADES + REUNIÕES */}
      <div className="g-2">
        <section className="c-card">
          <div className="c-head">
            <h3>Prioridades de hoje</h3>
            <div className="c-tags">
              {D.atrasadas.length > 0 && <span className="tag tag-erro">{D.atrasadas.length} atrasadas</span>}
              {D.deHoje.length > 0 && <span className="tag tag-aviso">{D.deHoje.length} para hoje</span>}
            </div>
          </div>
          {D.prioridades.length === 0
            ? <Vazio texto="Nenhuma tarefa pendente. Sua agenda está organizada." />
            : <div className="p-lista">
                {D.prioridades.slice(0, 8).map((t) => (
                  <div key={t.id} className={`p-row ${t.atrasada ? "p-atras" : ""}`} onClick={() => onVerLead && onVerLead(t.leadId)}>
                    <span className={`p-prio ${t.atrasada ? "alta" : t.hoje ? "media" : "baixa"}`}>{t.atrasada ? "Alta" : t.hoje ? "Média" : "Baixa"}</span>
                    <div className="p-info">
                      <div className="p-desc">{t.descricao}</div>
                      <div className="p-meta">
                        {t.leadNome}
                        {t.valor > 0 && <> · {fmtMoeda(t.valor)}</>}
                        {t.dp && <> · {t.atrasada ? "Venceu" : "Prevista"} {brData(t.dp)}</>}
                        {t.responsavelNome && <> · {t.responsavelNome}</>}
                      </div>
                    </div>
                    <div className="p-acoes" onClick={(e) => e.stopPropagation()}>
                      <button className="ico-btn ok" title="Concluir" onClick={() => mudarStatusTarefa(t.id, "concluida")}><Ico d={I.check} size={13} sw={2.4} /></button>
                      <button className="ico-btn del" title="Cancelar" onClick={() => mudarStatusTarefa(t.id, "cancelada")}><Ico d={I.x} size={13} sw={2.4} /></button>
                      <button className="ico-btn" title="Abrir" onClick={() => onVerLead && onVerLead(t.leadId)}><Ico d={I.arrow} size={13} sw={2.2} /></button>
                    </div>
                  </div>
                ))}
              </div>}
        </section>

        <section className="c-card">
          <div className="c-head"><h3>Próximas reuniões</h3>{D.reunioes.length > 0 && <span className="c-num">{D.reunioes.length}</span>}</div>
          {D.reunioes.length === 0
            ? <Vazio texto="Nenhuma reunião agendada." />
            : <div className="r-lista">
                {D.reunioes.slice(0, 6).map((l) => (
                  <div key={l.id} className="r-row" onClick={() => onVerLead && onVerLead(l.id)}>
                    <span className="r-ico"><Ico d={I.calendar} size={15} /></span>
                    <div className="r-info">
                      <div className="r-nome">{l.nome}</div>
                      <div className="r-meta">{l.valor > 0 ? fmtMoeda(l.valor) : "Sem valor"}{l.whatsapp && <> · {l.whatsapp}</>}</div>
                    </div>
                    <Ico d={I.arrow} size={14} />
                  </div>
                ))}
              </div>}
        </section>
      </div>

      {/* FUNIL + RISCO */}
      <div className="g-2">
        <section className="c-card">
          <div className="c-head"><h3>Funil de vendas</h3></div>
          {D.funil.length === 0
            ? <Vazio texto="Sem oportunidades no período." />
            : <>
                <Funil etapas={D.funil} />
                {(() => {
                  const gargalo = D.funil.filter((e) => e.conv != null).sort((a, b) => a.conv - b.conv)[0];
                  return gargalo ? <div className="insight">Maior queda em <strong>{gargalo.nome}</strong>: apenas {gargalo.conv.toFixed(0)}% das oportunidades avançam.</div> : null;
                })()}
              </>}
        </section>

        <section className="c-card">
          <div className="c-head"><h3>Oportunidades em risco</h3>{D.risco.length > 0 && <span className="c-num alerta">{D.risco.length}</span>}</div>
          {D.risco.length === 0
            ? <Vazio texto="Nenhuma oportunidade crítica. Seu pipeline está atualizado." />
            : <div className="risco-lista">
                {D.risco.slice(0, 6).map((l) => (
                  <div key={l.id} className="risco-row" onClick={() => onVerLead && onVerLead(l.id)}>
                    <span className="risco-ico"><Ico d={I.alert} size={14} /></span>
                    <div className="risco-info">
                      <div className="risco-nome">{l.nome}</div>
                      <div className="risco-meta">{l.motivo} · {l.dias === 0 ? "hoje" : `${l.dias} dia${l.dias > 1 ? "s" : ""}`}</div>
                    </div>
                    <span className="risco-valor">{l.valor > 0 ? fmtMoeda(l.valor) : "—"}</span>
                  </div>
                ))}
              </div>}
        </section>
      </div>

      {/* DISTRIBUIÇÃO + TAREFAS + PERDAS */}
      <div className="g-3">
        <section className="c-card">
          <div className="c-head"><h3>Oportunidades por valor</h3></div>
          <BarraSeg formato={fmtMoeda} segs={[
            { l: "Em aberto", v: D.pipeline, c: "var(--info)" },
            { l: "Ganhas", v: D.receita, c: "var(--ok)" },
            { l: "Perdidas", v: D.perdida, c: "var(--erro)" },
          ]} />
          <div className="sub-div" />
          <BarraSeg formato={(v) => String(v)} segs={[
            { l: "Em aberto", v: D.abertos, c: "var(--info)" },
            { l: "Ganhas", v: D.vendas, c: "var(--ok)" },
            { l: "Perdidas", v: D.perdidos, c: "var(--erro)" },
          ]} />
        </section>

        <section className="c-card">
          <div className="c-head"><h3>Suas tarefas</h3></div>
          <div className="t-nums">
            <div><span className="t-n" style={{ color: "var(--aviso)" }}>{D.deHoje.length}</span><span className="t-l">Hoje</span></div>
            <div><span className="t-n" style={{ color: "var(--erro)" }}>{D.atrasadas.length}</span><span className="t-l">Atrasadas</span></div>
            <div><span className="t-n" style={{ color: "var(--ok)" }}>{D.concluidas}</span><span className="t-l">Concluídas</span></div>
          </div>
          <BarraSeg formato={(v) => String(v)} segs={[
            { l: "Concluídas", v: D.concluidas, c: "var(--ok)" },
            { l: "Pendentes", v: Math.max(D.pendTotal - D.atrasadas.length, 0), c: "var(--aviso)" },
            { l: "Atrasadas", v: D.atrasadas.length, c: "var(--erro)" },
          ]} />
          <div className="insight">{D.taxaConcl.toFixed(0)}% das tarefas do período já foram concluídas.</div>
        </section>

        <section className="c-card">
          <div className="c-head"><h3>Motivos de perda</h3></div>
          {D.motivosPerda.length === 0
            ? <Vazio texto="Nenhuma perda registrada no período." />
            : <div className="mp-lista">
                {(() => { const mx = Math.max(...D.motivosPerda.map((m) => m.qtd), 1);
                  return D.motivosPerda.slice(0, 6).map((m, i) => (
                    <div key={i} className="mp-row">
                      <div className="mp-top"><span>{m.nome}</span><span className="mp-qtd">{m.qtd} · {fmtMoeda(m.valor)}</span></div>
                      <div className="mp-bar"><div style={{ width: `${(m.qtd / mx) * 100}%` }} /></div>
                    </div>
                  )); })()}
              </div>}
        </section>
      </div>

      {/* RESUMO DO DIA */}
      <section className="resumo">
        <div className="resumo-t">Resumo do seu dia</div>
        <p className="resumo-p">
          {D.deHoje.length > 0 ? `Você tem ${D.deHoje.length} tarefa${D.deHoje.length > 1 ? "s" : ""} programada${D.deHoje.length > 1 ? "s" : ""} para hoje` : "Nenhuma tarefa programada para hoje"}
          {D.atrasadas.length > 0 && ` e ${D.atrasadas.length} atividade${D.atrasadas.length > 1 ? "s" : ""} atrasada${D.atrasadas.length > 1 ? "s" : ""}`}.
          {D.reunioes.length > 0 && ` Há ${D.reunioes.length} reunião${D.reunioes.length > 1 ? "ões" : ""} no funil.`}
          {D.risco.length > 0 && ` ${D.risco.length} oportunidade${D.risco.length > 1 ? "s precisam" : " precisa"} de atenção.`}
          {D.risco[0]?.valor > 0 && ` Priorize ${D.risco[0].nome}, com valor estimado de ${fmtMoeda(D.risco[0].valor)}.`}
          {D.semContato > 0 && ` ${D.semContato} lead${D.semContato > 1 ? "s ainda não foram contatados" : " ainda não foi contatado"}.`}
        </p>
      </section>
    </div>
  );
}
