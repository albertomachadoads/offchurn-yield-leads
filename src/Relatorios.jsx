import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient.js";
import * as api from "./api.js";
import { CATALOGO, POR_CAMPO, PADRAO, calcularDerivadas } from "./metricasCatalogo.js";

/* ============================================================
   Relatórios — visão consolidada da conta em formato A4,
   pronta para virar PDF e ser enviada ao cliente.
   ============================================================ */

const hojeISO = () => new Date().toISOString().slice(0, 10);
const diasAtras = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const inicioMes = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };

const PERIODOS = [
  { id: "7d", l: "Últimos 7 dias", calc: () => ({ de: diasAtras(6), ate: hojeISO() }) },
  { id: "14d", l: "Últimos 14 dias", calc: () => ({ de: diasAtras(13), ate: hojeISO() }) },
  { id: "30d", l: "Últimos 30 dias", calc: () => ({ de: diasAtras(29), ate: hojeISO() }) },
  { id: "mes", l: "Mês atual", calc: () => ({ de: inicioMes(), ate: hojeISO() }) },
  { id: "custom", l: "Personalizado", calc: null },
];

const fmtMoeda = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const fmtNum = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 }));
const fmtPct = (v) => (v == null ? "—" : `${Number(v).toFixed(2)}%`);
const fmtDec = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const formatar = (tipo, v) => (tipo === "moeda" ? fmtMoeda(v) : tipo === "percentual" ? fmtPct(v) : tipo === "decimal" ? fmtDec(v) : fmtNum(v));
const dataBR = (s) => (s ? s.split("-").reverse().join("/") : "");

/* ---------- Cartão de métrica ---------- */
function Kpi({ rotulo, valor, variacao, menorMelhor }) {
  const tom = variacao == null || Math.abs(variacao) < 0.05 ? ""
    : (variacao > 0) === !menorMelhor ? "sobe" : "desce";
  return (
    <div className="rp-kpi">
      <span className="rp-kpi-l">{rotulo}</span>
      <span className="rp-kpi-v">{valor}</span>
      {variacao != null && Math.abs(variacao) >= 0.05 && (
        <span className={`rp-kpi-var ${tom}`}>
          {variacao > 0 ? "▲" : "▼"} {Math.abs(variacao).toFixed(1)}%
        </span>
      )}
    </div>
  );
}

/* ---------- Quadro do funil de qualificação ---------- */
function QuadroFunil({ dados }) {
  const itens = [
    { rot: "Leads", v: fmtNum(dados.captados), tom: "info" },
    { rot: "Qualificados", v: fmtNum(dados.qualificados), tom: "roxo" },
    { rot: "Fechados", v: fmtNum(dados.vendidos), tom: "ok" },
    { rot: "Taxa de conversão", v: dados.conversao == null ? "—" : `${dados.conversao.toFixed(1)}%`, tom: "verde" },
  ];
  return (
    <div className="rp-funil">
      {itens.map((i, k) => (
        <div key={k} className={`rp-funil-q rp-fq-${i.tom}`}>
          <span className="rp-funil-v">{i.v}</span>
          <span className="rp-funil-r">{i.rot}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Gráfico de linhas: cliques e CTR ---------- */
function LinhaDupla({ serie }) {
  if (!serie?.length) return <p className="rp-vazio">Sem dados diários no período.</p>;
  const W = 380, H = 200, P = { t: 14, r: 34, b: 26, l: 42 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const maxA = Math.max(...serie.map((d) => d.cliques), 1);
  const maxB = Math.max(...serie.map((d) => d.ctr), 0.1);
  const x = (i) => P.l + (serie.length === 1 ? iw / 2 : (i / (serie.length - 1)) * iw);
  const yA = (v) => P.t + ih - (v / maxA) * ih;
  const yB = (v) => P.t + ih - (v / maxB) * ih;

  const linhaA = serie.map((d, i) => `${x(i)},${yA(d.cliques)}`).join(" ");
  const linhaB = serie.map((d, i) => `${x(i)},${yB(d.ctr)}`).join(" ");
  const area = `M ${x(0)},${yA(0)} L ${linhaA.replace(/ /g, " L ")} L ${x(serie.length - 1)},${yA(0)} Z`;

  const passo = Math.max(1, Math.ceil(serie.length / 5));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="rp-svg">
        <defs>
          <linearGradient id="grCliques" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#18A35F" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#18A35F" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f, i) => (
          <g key={i}>
            <line x1={P.l} y1={yA(maxA * f)} x2={W - P.r} y2={yA(maxA * f)} stroke="var(--rp-grid)" strokeWidth="1" />
            <text x={P.l - 8} y={yA(maxA * f) + 4} textAnchor="end" className="rp-ax">{fmtNum(Math.round(maxA * f))}</text>
            <text x={W - P.r + 8} y={yB(maxB * f) + 4} className="rp-ax rp-ax-b">{(maxB * f).toFixed(1)}%</text>
          </g>
        ))}
        <path d={area} fill="url(#grCliques)" />
        <polyline points={linhaA} fill="none" stroke="#18A35F" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={linhaB} fill="none" stroke="#2563EB" strokeWidth="2.2" strokeDasharray="4 3" strokeLinejoin="round" />
        {serie.map((d, i) => i % passo === 0 && (
          <text key={i} x={x(i)} y={H - 10} textAnchor="middle" className="rp-ax">{d.data.slice(8, 10)}/{d.data.slice(5, 7)}</text>
        ))}
      </svg>
      <div className="rp-legenda">
        <span><i style={{ background: "#18A35F" }} />Cliques no link</span>
        <span><i className="tracejado" />CTR</span>
      </div>
    </div>
  );
}

/* ---------- Barras horizontais agrupadas ---------- */
function BarrasDuplas({ dados, rotuloA = "Impressões", rotuloB = "Alcance" }) {
  if (!dados?.length) return <p className="rp-vazio">Sem dados de segmentação no período.</p>;
  const max = Math.max(...dados.map((d) => Math.max(d.a, d.b)), 1);
  return (
    <div>
      <div className="rp-barras">
        {dados.map((d, i) => (
          <div key={i} className="rp-barra-grupo">
            <span className="rp-barra-rot">{d.rotulo}</span>
            <div className="rp-barra-par">
              <div className="rp-barra-trilha">
                <div className="rp-barra rp-barra-a" style={{ width: `${(d.a / max) * 100}%` }} />
                <span className="rp-barra-v">{fmtNum(d.a)}</span>
              </div>
              <div className="rp-barra-trilha">
                <div className="rp-barra rp-barra-b" style={{ width: `${(d.b / max) * 100}%` }} />
                <span className="rp-barra-v">{fmtNum(d.b)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="rp-legenda">
        <span><i style={{ background: "linear-gradient(90deg,#0C5530,#18A35F)" }} />{rotuloA}</span>
        <span><i style={{ background: "linear-gradient(90deg,#1E4D8C,#3B82F6)" }} />{rotuloB}</span>
      </div>
    </div>
  );
}

/* ---------- Barras verticais agrupadas ---------- */
function BarrasVerticais({ dados, rotuloA = "Impressões", rotuloB = "Alcance" }) {
  if (!dados?.length) return <p className="rp-vazio">Sem dados no período.</p>;
  const W = 380, H = 200, P = { t: 14, r: 10, b: 30, l: 44 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const max = Math.max(...dados.map((d) => Math.max(d.a, d.b)), 1);
  const grupo = iw / dados.length;
  const larg = Math.min(grupo * 0.32, 26);
  const y = (v) => P.t + ih - (v / max) * ih;
  const kNum = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="rp-svg">
        <defs>
          <linearGradient id="bvA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#18A35F" /><stop offset="100%" stopColor="#0C5530" />
          </linearGradient>
          <linearGradient id="bvB" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" /><stop offset="100%" stopColor="#1E4D8C" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f, i) => (
          <g key={i}>
            <line x1={P.l} y1={y(max * f)} x2={W - P.r} y2={y(max * f)} stroke="#EAECF0" strokeWidth="1" />
            <text x={P.l - 6} y={y(max * f) + 3} textAnchor="end" className="rp-ax">{kNum(Math.round(max * f))}</text>
          </g>
        ))}
        {dados.map((d, i) => {
          const cx = P.l + grupo * i + grupo / 2;
          return (
            <g key={i}>
              <rect x={cx - larg - 2} y={y(d.a)} width={larg} height={Math.max(P.t + ih - y(d.a), 1)} fill="url(#bvA)" rx="3" />
              <rect x={cx + 2} y={y(d.b)} width={larg} height={Math.max(P.t + ih - y(d.b), 1)} fill="url(#bvB)" rx="3" />
              <text x={cx} y={H - 10} textAnchor="middle" className="rp-ax">{d.rotulo}</text>
            </g>
          );
        })}
      </svg>
      <div className="rp-legenda">
        <span><i style={{ background: "linear-gradient(180deg,#18A35F,#0C5530)" }} />{rotuloA}</span>
        <span><i style={{ background: "linear-gradient(180deg,#3B82F6,#1E4D8C)" }} />{rotuloB}</span>
      </div>
    </div>
  );
}

/* ---------- Pizza ---------- */
function Pizza({ fatias, titulo, horizontal }) {
  if (!fatias?.length) return <p className="rp-vazio">Sem dados no período.</p>;
  const S = 150, R = 62, C = S / 2;
  const soma = fatias.reduce((a, f) => a + f.v, 0) || 1;
  const cores = [["#0C5530", "#18A35F"], ["#1E4D8C", "#3B82F6"], ["#6941C6", "#9E77ED"],
                 ["#B54708", "#F5A524"], ["#B42318", "#F97066"], ["#026AA2", "#36BFFA"]];
  let ang = -Math.PI / 2;
  const setores = fatias.map((f, i) => {
    const fatia = (f.v / soma) * Math.PI * 2;
    const x1 = C + R * Math.cos(ang), y1 = C + R * Math.sin(ang);
    ang += fatia;
    const x2 = C + R * Math.cos(ang), y2 = C + R * Math.sin(ang);
    const grande = fatia > Math.PI ? 1 : 0;
    return { d: `M ${C},${C} L ${x1},${y1} A ${R},${R} 0 ${grande} 1 ${x2},${y2} Z`, i, f };
  });
  return (
    <div className={`rp-pizza-wrap ${horizontal ? "rp-horizontal" : ""}`}>
      <svg viewBox={`0 0 ${S} ${S}`} className="rp-pizza">
        <defs>
          {fatias.map((_, i) => (
            <linearGradient key={i} id={`pz${titulo}${i}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={cores[i % 6][0]} />
              <stop offset="100%" stopColor={cores[i % 6][1]} />
            </linearGradient>
          ))}
        </defs>
        {setores.map((s2) => (
          <path key={s2.i} d={s2.d} fill={`url(#pz${titulo}${s2.i})`} stroke="#fff" strokeWidth="1.5" />
        ))}
      </svg>
      <div className="rp-pizza-leg">
        {fatias.map((f, i) => (
          <div key={i}>
            <span className="rp-dot" style={{ background: `linear-gradient(135deg,${cores[i % 6][0]},${cores[i % 6][1]})` }} />
            <span className="rp-leg-nome">{f.rotulo}</span>
            <strong>{((f.v / soma) * 100).toFixed(1)}%</strong>
            <span className="rp-leg-abs">{fmtNum(f.v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Rosca ---------- */
function Rosca({ fatias, titulo = "r" }) {
  if (!fatias?.length) return <p className="rp-vazio">Sem dados por dispositivo no período.</p>;
  const S = 150, R = 56, W = 20, C = S / 2;
  const circ = 2 * Math.PI * R;
  const soma = fatias.reduce((a, f) => a + f.v, 0) || 1;
  let off = 0;
  const cores = [["#0C5530", "#18A35F"], ["#1E4D8C", "#3B82F6"], ["#6941C6", "#9E77ED"], ["#B54708", "#F5A524"]];
  return (
    <div className="rp-rosca-wrap">
      <svg viewBox={`0 0 ${S} ${S}`} className="rp-rosca">
        <defs>
          {fatias.map((f, i) => (
            <linearGradient key={i} id={`rgd${titulo}${i}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={cores[i % 4][0]} />
              <stop offset="100%" stopColor={cores[i % 4][1]} />
            </linearGradient>
          ))}
        </defs>
        {fatias.map((f, i) => {
          const dash = (f.v / soma) * circ; const o = off; off += dash;
          return f.v > 0 && (
            <circle key={i} cx={C} cy={C} r={R} fill="none" stroke={`url(#rgd${titulo}${i})`} strokeWidth={W}
              strokeDasharray={`${Math.max(dash - 2, 0)} ${circ - dash + 2}`} strokeDashoffset={-o}
              strokeLinecap="round" transform={`rotate(-90 ${C} ${C})`} />
          );
        })}
        <text x={C} y={C + 5} textAnchor="middle" className="rp-rosca-n">{fmtNum(soma)}</text>
      </svg>
      <div className="rp-rosca-leg">
        {fatias.map((f, i) => (
          <div key={i}>
            <span className="rp-dot" style={{ background: `linear-gradient(135deg,${cores[i % 4][0]},${cores[i % 4][1]})` }} />
            <span className="rp-leg-nome">{f.rotulo}</span>
            <strong>{((f.v / soma) * 100).toFixed(1)}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Página A4 ---------- */
function Pagina({ children, cliente, periodo, num, total }) {
  return (
    <div className="rp-a4">
      <div className="rp-faixa">
        <div className="rp-faixa-esq">
          <span className="rp-faixa-cliente">{cliente}</span>
          <span className="rp-faixa-agencia">Mads Growth Marketing</span>
        </div>
        <span className="rp-faixa-periodo">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {periodo}
        </span>
      </div>
      <div className="rp-corpo">{children}</div>
      <div className="rp-rodape">
        <span>Mads Growth Marketing</span>
        <span>Página {num} de {total}</span>
      </div>
    </div>
  );
}

/* Selo da plataforma */
function SeloPlataforma({ plataforma = "meta" }) {
  const meta = plataforma === "meta";
  return (
    <div className={`rp-selo ${meta ? "rp-selo-meta" : "rp-selo-google"}`}>
      {meta ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6.9 4C4.2 4 2 6.6 2 10.4c0 3.5 1.9 5.6 4.2 5.6 1.6 0 2.8-.9 4.1-3.2l1.2-2.2c.3.5.6 1.1.9 1.7l1 1.9C14.6 15.6 16 17 18 17c2.4 0 4-2.3 4-5.8C22 6.9 19.9 4 17.2 4c-1.6 0-2.9 1-4.1 3.1l-.9 1.5c-.3-.5-.6-1-.8-1.4C9.9 4.7 8.6 4 6.9 4zm-.1 2.4c1 0 1.8.7 2.7 2.3l.6 1.1-1 1.9c-.9 1.6-1.5 2-2.2 2-1.1 0-1.9-1.1-1.9-3.2 0-2.4 1-4.1 1.8-4.1zm10.3 0c1 0 2.2 1.4 2.2 4.2 0 2.1-.7 3.2-1.8 3.2-.8 0-1.4-.5-2.4-2.2l-1-1.8.5-.9c1-1.7 1.7-2.5 2.5-2.5z"/></svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 11v2.9h4.1c-.2 1.1-1.3 3.2-4.1 3.2-2.5 0-4.5-2-4.5-4.6s2-4.6 4.5-4.6c1.4 0 2.3.6 2.9 1.1l2-1.9C15.6 5.9 14 5.2 12 5.2 8.1 5.2 5 8.3 5 12.2s3.1 7 7 7c4 0 6.7-2.8 6.7-6.8 0-.5 0-.8-.1-1.2H12z"/></svg>
      )}
      {meta ? "Meta Ads" : "Google Ads"}
    </div>
  );
}

/* Cartão que envolve cada gráfico */
function Bloco({ titulo, children, altura, cresce }) {
  const estilo = altura ? { height: `${altura}px`, flex: "0 0 auto" } : undefined;
  return (
    <div className={`rp-bloco ${cresce ? "rp-bloco-cresce" : ""}`} style={estilo}>
      <h3 className="rp-bloco-t">{titulo}</h3>
      <div className="rp-bloco-c">{children}</div>
    </div>
  );
}

/* ================= MÓDULO ================= */
export default function Relatorios({ cliente, funil, onBuscar, onBuscarGoogle, onToast }) {
  const [periodo, setPeriodo] = useState("30d");
  const [de, setDe] = useState(diasAtras(29));
  const [ate, setAte] = useState(hojeISO());
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  function aplicarPeriodo(p) {
    setPeriodo(p.id);
    if (p.calc) { const r = p.calc(); setDe(r.de); setAte(r.ate); }
  }

  // Recebe as datas por parâmetro: o estado ainda não atualizou
  // quando a busca é disparada pela troca de período.
  async function buscar(dDe = de, dAte = ate) {
    if (!cliente) return;
    setCarregando(true); setErro("");
    try {
      const r = await onBuscar(cliente.id, dDe, dAte);
      setDados(r);
    } catch (e) {
      setErro(e.message || "Falha ao buscar dados da plataforma");
      setDados(null);
    } finally { setCarregando(false); }
  }

  /* Busca sempre que o cliente ou o intervalo mudar.
     Em "Personalizado" só busca com as duas datas preenchidas. */
  useEffect(() => {
    if (!cliente || !de || !ate) return;
    if (de > ate) return;              // intervalo inválido: aguarda o ajuste
    buscar(de, ate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente?.id, de, ate]);

  const metricas = useMemo(() => {
    const lista = cliente?.metricasMeta?.length ? cliente.metricasMeta : PADRAO;
    return lista.map((c) => POR_CAMPO[c]).filter(Boolean);
  }, [cliente]);

  const atual = useMemo(() => calcularDerivadas(dados?.atual || {}), [dados]);
  const anterior = useMemo(() => calcularDerivadas(dados?.anterior || {}), [dados]);
  const variacao = (campo) => {
    const a = atual[campo], b = anterior[campo];
    if (a == null || b == null || Number(b) === 0) return null;
    return ((Number(a) - Number(b)) / Number(b)) * 100;
  };

  // Funil de qualificação no período (soma das plataformas e competências)
  const resumoFunil = useMemo(() => {
    const compDe = de.slice(0, 7), compAte = ate.slice(0, 7);
    const linhas = (funil || []).filter(
      (f) => f.clienteId === cliente?.id && f.competencia >= compDe && f.competencia <= compAte
    );
    const t = linhas.reduce((a, f) => ({
      captados: a.captados + (Number(f.captados) || 0),
      qualificados: a.qualificados + (Number(f.qualificados) || 0),
      vendidos: a.vendidos + (Number(f.vendidos) || 0),
    }), { captados: 0, qualificados: 0, vendidos: 0 });
    return {
      ...t,
      temDados: linhas.length > 0,
      conversao: t.captados > 0 ? (t.vendidos / t.captados) * 100 : null,
    };
  }, [funil, cliente?.id, de, ate]);

  const serie = dados?.serieDiaria || [];
  const porIdade = dados?.porIdade || [];
  const porGenero = dados?.porGenero || [];
  const porDispositivo = dados?.porDispositivo || [];
  const porPlataforma = dados?.porPlataforma || [];
  const criativos = dados?.criativos || [];
  // Altura do rank medida no navegador: linha 54px, gap 7px, moldura 53px
  const nCriativos = Math.max(Math.min(criativos.length, 8), 1);
  const alturaRank = 54 * nCriativos + 7 * (nCriativos - 1) + 53;
  const campanhas = dados?.campanhas || [];

  const temSegmentacao = porIdade.length || porGenero.length || porDispositivo.length || serie.length;
  const rotuloPeriodo = `${dataBR(de)} a ${dataBR(ate)}`;
  const totalPaginas = 3;

  return (
    <div className="rp">
      {/* Barra de controle — não sai na impressão */}
      <div className="rp-controles">
        <div>
          <h3 className="rp-titulo">Relatório do cliente</h3>
          <span className="rp-sub">Visão consolidada em A4, pronta para enviar</span>
        </div>
        <div className="rp-acoes">
          <select className="select" style={{ width: "auto" }} value={periodo}
            onChange={(e) => aplicarPeriodo(PERIODOS.find((p) => p.id === e.target.value))}>
            {PERIODOS.map((p) => <option key={p.id} value={p.id}>{p.l}</option>)}
          </select>
          {periodo === "custom" && (<>
            <input type="date" className="select" style={{ width: "auto" }} value={de} onChange={(e) => setDe(e.target.value)} />
            <input type="date" className="select" style={{ width: "auto" }} value={ate} onChange={(e) => setAte(e.target.value)} />
          </>)}
          <button className="toolbar-btn" onClick={buscar} disabled={carregando}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            {carregando ? "Buscando…" : "Atualizar"}
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => window.print()} disabled={!dados}>Gerar PDF</button>
        </div>
      </div>

      {!cliente ? (
        <div className="rp-aviso">Vincule uma conta de anúncios a um cliente para gerar relatórios.</div>
      ) : erro ? (
        <div className="rp-aviso rp-erro">{erro}</div>
      ) : carregando ? (
        <div className="rp-aviso">Buscando dados da plataforma…</div>
      ) : !dados ? (
        <div className="rp-aviso">Clique em Atualizar para carregar os dados.</div>
      ) : (
        <div className="rp-folhas">
          {/* ══ Página 1 — visão geral ══ */}
          <Pagina cliente={cliente.nome} periodo={rotuloPeriodo} num={1} total={3}>
            <div className="rp-secao-cab">
              <h2 className="rp-h2">Visão geral do período</h2>
              <SeloPlataforma plataforma="meta" />
            </div>

            {resumoFunil.temDados && <QuadroFunil dados={resumoFunil} />}

            <div className="rp-kpis">
              {metricas.slice(0, 12).map((m) => (
                <Kpi key={m.campo} rotulo={m.rotulo} valor={formatar(m.formato, atual[m.campo])}
                  variacao={variacao(m.campo)} menorMelhor={m.menorMelhor} />
              ))}
            </div>

            <Bloco titulo="Rank de criativos" altura={alturaRank}>
              {criativos.length === 0 ? (
                <p className="rp-vazio">Dados de criativos indisponíveis no período.</p>
              ) : (
                <div className="rp-criativos">
                  {criativos.slice(0, 8).map((c, i) => (
                    <div key={i} className="rp-criativo">
                      <div className="rp-cri-pos">{i + 1}</div>
                      {c.thumb && <img src={c.thumb} alt="" className="rp-cri-img" />}
                      <div className="rp-cri-info">
                        <div className="rp-cri-nome" title={c.nome}>{c.nome}</div>
                        <div className="rp-cri-metricas">
                          <span>Investido<strong>{fmtMoeda(c.gasto)}</strong></span>
                          <span>Impressões<strong>{fmtNum(c.impressoes)}</strong></span>
                          <span>Cliques<strong>{fmtNum(c.cliquesLink)}</strong></span>
                          <span>CTR<strong>{fmtPct(c.ctrLink)}</strong></span>
                          {c.resultados > 0 && <span>Resultados<strong>{fmtNum(c.resultados)}</strong></span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Bloco>

            <Bloco titulo="Principais campanhas" cresce>
              {campanhas.length === 0 ? (
                <p className="rp-vazio">Nenhuma campanha com dados no período.</p>
              ) : (
                <table className="rp-tabela">
                  <colgroup><col style={{ width: "44%" }} /><col span="4" /></colgroup>
                  <thead>
                    <tr><th>Campanha</th><th>Investido</th><th>Cliques</th><th>Result.</th><th>Custo/res.</th></tr>
                  </thead>
                  <tbody>
                    {[...campanhas].sort((a, b) => b.gasto - a.gasto).slice(0, 6).map((c, i) => (
                      <tr key={i}>
                        <td className="rp-td-nome">{c.nome}</td>
                        <td>{fmtMoeda(c.gasto)}</td>
                        <td>{fmtNum(c.cliquesLink)}</td>
                        <td>{fmtNum(c.resultados)}</td>
                        <td>{fmtMoeda(c.custoResultado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Bloco>
          </Pagina>

          {/* ══ Página 2 — perfil do público ══ */}
          <Pagina cliente={cliente.nome} periodo={rotuloPeriodo} num={2} total={3}>
            <div className="rp-secao-cab">
              <h2 className="rp-h2">Perfil do público alcançado</h2>
              <SeloPlataforma plataforma="meta" />
            </div>

            {/* Linha 1: série temporal em largura total */}
            <Bloco titulo="Cliques e CTR ao longo do tempo" altura={288}>
              <LinhaDupla serie={serie} />
            </Bloco>

            {/* Linha 2: gênero e idade lado a lado */}
            <div className="rp-linha2">
              <Bloco titulo="Impressões e alcance por gênero" altura={300}>
                <BarrasVerticais dados={porGenero} />
              </Bloco>
              <Bloco titulo="Impressões e alcance por idade" altura={300}>
                <BarrasDuplas dados={porIdade} />
              </Bloco>
            </div>

            {/* Linha 3: dispositivo, área menor por ter menos informação */}
            <Bloco titulo="Alcance por dispositivo" altura={250}>
              <Pizza titulo="disp" fatias={porDispositivo} horizontal />
            </Bloco>
          </Pagina>

          {/* ══ Página 3 — campanhas ══ */}
          <Pagina cliente={cliente.nome} periodo={rotuloPeriodo} num={3} total={3}>
            <div className="rp-secao-cab">
              <h2 className="rp-h2">Desempenho por campanha</h2>
              <SeloPlataforma plataforma="meta" />
            </div>

            <div className="rp-linha2">
              <Bloco titulo="Alcance por plataforma" altura={215}>
                <Rosca titulo="plat" fatias={porPlataforma.length ? porPlataforma : porDispositivo} />
              </Bloco>
              <Bloco titulo="Distribuição por gênero" altura={215}>
                <Pizza titulo="gen" fatias={porGenero.map((g) => ({ rotulo: g.rotulo, v: g.b }))} />
              </Bloco>
            </div>

            <Bloco titulo="Campanhas no período" cresce>
              {campanhas.length === 0 ? (
                <p className="rp-vazio">Nenhuma campanha com dados no período.</p>
              ) : (
                <table className="rp-tabela">
                  <colgroup>
                    <col style={{ width: "34%" }} />
                    <col span="7" />
                  </colgroup>
                  <thead>
                    <tr><th>Campanha</th><th>Investido</th><th>Impressões</th><th>Cliques</th><th>CTR</th><th>CPC</th><th>Result.</th><th>Custo/res.</th></tr>
                  </thead>
                  <tbody>
                    {campanhas.slice(0, 22).map((c, i) => (
                      <tr key={i}>
                        <td className="rp-td-nome">{c.nome}</td>
                        <td>{fmtMoeda(c.gasto)}</td>
                        <td>{fmtNum(c.impressoes)}</td>
                        <td>{fmtNum(c.cliquesLink)}</td>
                        <td>{fmtPct(c.ctrLink)}</td>
                        <td>{fmtMoeda(c.cpc)}</td>
                        <td>{fmtNum(c.resultados)}</td>
                        <td>{fmtMoeda(c.custoResultado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Bloco>
          </Pagina>

          {dados?.avisos?.length > 0 && (
            <div className="rp-aviso rp-nota">
              Algumas seções não puderam ser carregadas: {dados.avisos.join(" · ")}
            </div>
          )}

          {!temSegmentacao && (
            <div className="rp-aviso rp-nota">
              Os dados de público (idade, gênero, dispositivo e série diária) exigem a atualização
              da função <strong>meta-sync</strong> no servidor. As demais seções já funcionam.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
