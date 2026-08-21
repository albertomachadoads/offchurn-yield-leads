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

/* ---------- Gráfico de linhas: cliques e CTR ---------- */
function LinhaDupla({ serie }) {
  if (!serie?.length) return <p className="rp-vazio">Sem dados diários no período.</p>;
  const W = 720, H = 240, P = { t: 18, r: 52, b: 32, l: 56 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const maxA = Math.max(...serie.map((d) => d.cliques), 1);
  const maxB = Math.max(...serie.map((d) => d.ctr), 0.1);
  const x = (i) => P.l + (serie.length === 1 ? iw / 2 : (i / (serie.length - 1)) * iw);
  const yA = (v) => P.t + ih - (v / maxA) * ih;
  const yB = (v) => P.t + ih - (v / maxB) * ih;

  const linhaA = serie.map((d, i) => `${x(i)},${yA(d.cliques)}`).join(" ");
  const linhaB = serie.map((d, i) => `${x(i)},${yB(d.ctr)}`).join(" ");
  const area = `M ${x(0)},${yA(0)} L ${linhaA.replace(/ /g, " L ")} L ${x(serie.length - 1)},${yA(0)} Z`;

  const passo = Math.max(1, Math.ceil(serie.length / 8));
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

/* ---------- Rosca ---------- */
function Rosca({ fatias }) {
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
            <linearGradient key={i} id={`rgd${i}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={cores[i % 4][0]} />
              <stop offset="100%" stopColor={cores[i % 4][1]} />
            </linearGradient>
          ))}
        </defs>
        {fatias.map((f, i) => {
          const dash = (f.v / soma) * circ; const o = off; off += dash;
          return f.v > 0 && (
            <circle key={i} cx={C} cy={C} r={R} fill="none" stroke={`url(#rgd${i})`} strokeWidth={W}
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
      <div className="rp-cabecalho">
        <div>
          <span className="rp-cliente">{cliente}</span>
          <span className="rp-periodo">{periodo}</span>
        </div>
        <span className="rp-marca">OffChurn</span>
      </div>
      <div className="rp-corpo">{children}</div>
      <div className="rp-rodape">
        <span>Relatório gerado em {new Date().toLocaleDateString("pt-BR")}</span>
        <span>Página {num} de {total}</span>
      </div>
    </div>
  );
}

/* ================= MÓDULO ================= */
export default function Relatorios({ clientes, onToast }) {
  const [clienteId, setClienteId] = useState("");
  const [periodo, setPeriodo] = useState("30d");
  const [de, setDe] = useState(diasAtras(29));
  const [ate, setAte] = useState(hojeISO());
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const comConta = useMemo(
    () => (clientes || []).filter((c) => c.ativo && (c.metaAdAccountId || c.googleAdCustomerId)),
    [clientes]
  );
  const cliente = comConta.find((c) => c.id === clienteId);

  useEffect(() => {
    if (!clienteId && comConta.length) setClienteId(comConta[0].id);
  }, [comConta, clienteId]);

  function aplicarPeriodo(p) {
    setPeriodo(p.id);
    if (p.calc) { const r = p.calc(); setDe(r.de); setAte(r.ate); }
  }

  async function buscar() {
    if (!cliente) return;
    setCarregando(true); setErro("");
    try {
      const r = await api.metaInsights(cliente.id, de, ate);
      setDados(r);
    } catch (e) {
      setErro(e.message || "Falha ao buscar dados da plataforma");
      setDados(null);
    } finally { setCarregando(false); }
  }

  useEffect(() => { if (cliente) buscar(); /* eslint-disable-next-line */ }, [clienteId]);

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

  const serie = dados?.serieDiaria || [];
  const porIdade = dados?.porIdade || [];
  const porGenero = dados?.porGenero || [];
  const porDispositivo = dados?.porDispositivo || [];
  const criativos = dados?.criativos || [];
  const campanhas = dados?.campanhas || [];

  const temSegmentacao = porIdade.length || porGenero.length || porDispositivo.length || serie.length;
  const rotuloPeriodo = `${dataBR(de)} a ${dataBR(ate)}`;
  const totalPaginas = temSegmentacao ? 3 : 2;

  return (
    <div className="rp">
      {/* Barra de controle — não sai na impressão */}
      <div className="page-head rp-controles">
        <div>
          <h1>Relatórios</h1>
          <p>Visão consolidada da conta, pronta para enviar ao cliente</p>
        </div>
        <div className="head-actions">
          <select className="select" style={{ width: "auto" }} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            {comConta.length === 0 && <option value="">Nenhum cliente com conta vinculada</option>}
            {comConta.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select className="select" style={{ width: "auto" }} value={periodo}
            onChange={(e) => aplicarPeriodo(PERIODOS.find((p) => p.id === e.target.value))}>
            {PERIODOS.map((p) => <option key={p.id} value={p.id}>{p.l}</option>)}
          </select>
          {periodo === "custom" && (<>
            <input type="date" className="select" style={{ width: "auto" }} value={de} onChange={(e) => setDe(e.target.value)} />
            <input type="date" className="select" style={{ width: "auto" }} value={ate} onChange={(e) => setAte(e.target.value)} />
          </>)}
          <button className="toolbar-btn" onClick={buscar} disabled={carregando || !cliente}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            {carregando ? "Buscando…" : "Atualizar"}
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => window.print()} disabled={!dados}>
            Gerar PDF
          </button>
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
          {/* ── Página 1: visão geral ── */}
          <Pagina cliente={cliente.nome} periodo={rotuloPeriodo} num={1} total={totalPaginas}>
            <h2 className="rp-h2">Visão geral do período</h2>
            <div className="rp-kpis">
              {metricas.slice(0, 12).map((m) => (
                <Kpi key={m.campo} rotulo={m.rotulo} valor={formatar(m.formato, atual[m.campo])}
                  variacao={variacao(m.campo)} menorMelhor={m.menorMelhor} />
              ))}
            </div>

            <h3 className="rp-h3">Cliques e CTR ao longo do tempo</h3>
            <LinhaDupla serie={serie} />
          </Pagina>

          {/* ── Página 2: público ── */}
          {temSegmentacao && (
            <Pagina cliente={cliente.nome} periodo={rotuloPeriodo} num={2} total={totalPaginas}>
              <h2 className="rp-h2">Perfil do público alcançado</h2>

              <h3 className="rp-h3">Impressões e alcance por idade</h3>
              <BarrasDuplas dados={porIdade} />

              <div className="rp-duas">
                <div>
                  <h3 className="rp-h3">Por gênero</h3>
                  <BarrasDuplas dados={porGenero} />
                </div>
                <div>
                  <h3 className="rp-h3">Alcance por dispositivo</h3>
                  <Rosca fatias={porDispositivo} />
                </div>
              </div>
            </Pagina>
          )}

          {/* ── Página final: criativos e campanhas ── */}
          <Pagina cliente={cliente.nome} periodo={rotuloPeriodo} num={totalPaginas} total={totalPaginas}>
            <h2 className="rp-h2">Desempenho por criativo</h2>
            {criativos.length === 0 ? (
              <p className="rp-vazio">Dados de criativos indisponíveis para este período.</p>
            ) : (
              <div className="rp-criativos">
                {criativos.slice(0, 6).map((c, i) => (
                  <div key={i} className="rp-criativo">
                    <div className="rp-cri-pos">{i + 1}</div>
                    {c.thumb && <img src={c.thumb} alt="" className="rp-cri-img" />}
                    <div className="rp-cri-info">
                      <div className="rp-cri-nome" title={c.nome}>{c.nome}</div>
                      <div className="rp-cri-metricas">
                        <span>Investido<strong>{fmtMoeda(c.gasto)}</strong></span>
                        <span>Impressões<strong>{fmtNum(c.impressoes)}</strong></span>
                        <span>Cliques<strong>{fmtNum(c.cliques)}</strong></span>
                        <span>CTR<strong>{fmtPct(c.ctr)}</strong></span>
                        {c.resultados != null && <span>Resultados<strong>{fmtNum(c.resultados)}</strong></span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h3 className="rp-h3">Campanhas no período</h3>
            {campanhas.length === 0 ? (
              <p className="rp-vazio">Nenhuma campanha com dados no período.</p>
            ) : (
              <table className="rp-tabela">
                <thead>
                  <tr><th>Campanha</th><th>Investido</th><th>Impressões</th><th>Cliques</th><th>CTR</th><th>CPC</th><th>Resultados</th></tr>
                </thead>
                <tbody>
                  {campanhas.slice(0, 12).map((c, i) => (
                    <tr key={i}>
                      <td className="rp-td-nome" title={c.nome}>{c.nome}</td>
                      <td>{fmtMoeda(c.gasto)}</td>
                      <td>{fmtNum(c.impressoes)}</td>
                      <td>{fmtNum(c.cliquesLink ?? c.cliques)}</td>
                      <td>{fmtPct(c.ctrLink ?? c.ctr)}</td>
                      <td>{fmtMoeda(c.cpc)}</td>
                      <td>{fmtNum(c.resultados)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Pagina>

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
