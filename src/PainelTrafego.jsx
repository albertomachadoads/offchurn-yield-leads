import { useMemo, useState } from "react";
import * as api from "./api.js";
import { fmtMoeda } from "./utils";
import { competencia } from "./projecao";
import {
  pacingPeriodo, classificarPacing, scoreCriticidade, detectarProblemas,
} from "./trafegoEngine.js";
import { resumirTarefas, prioridadesDoDia } from "./tarefasCore.js";
import { churnHistorico } from "./churnEngine.js";
import CentralTarefas from "./CentralTarefas.jsx";

/* ============================================================
   Central de comando do gestor de tráfego.

   As tarefas vêm de tarefasCore.js — a mesma fonte que o módulo
   de Tarefas usa. Nenhuma contagem é recalculada aqui.
   ============================================================ */

const fmtNum = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 }));
const fmtPct = (v) => (v == null ? "—" : `${Number(v).toFixed(1)}%`);
const fmtK = (v) => {
  const n = Number(v) || 0;
  if (n >= 1000000) return `R$ ${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return fmtMoeda(n);
};
const saudacao = () => { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; };
const desde = (ts) => {
  if (!ts) return null;
  const min = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `há ${h}h` : `há ${Math.floor(h / 24)}d`;
};

/* ---------- Donut compacto ---------- */
function Donut({ fatias, total, legenda, tamanho = 128 }) {
  const R = tamanho * 0.36, W = tamanho * 0.15, C = tamanho / 2;
  const circ = 2 * Math.PI * R;
  const soma = fatias.reduce((a, f) => a + f.v, 0) || 1;
  let off = 0;
  return (
    <div className="ct-donut-wrap">
      <svg viewBox={`0 0 ${tamanho} ${tamanho}`} className="ct-donut" style={{ width: tamanho }}>
        <defs>
          {fatias.map((f, i) => (
            <linearGradient key={i} id={`dn${legenda}${i}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={f.c1} /><stop offset="100%" stopColor={f.c2} />
            </linearGradient>
          ))}
        </defs>
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--line)" strokeWidth={W} opacity=".4" />
        {fatias.map((f, i) => {
          const dash = (f.v / soma) * circ; const o = off; off += dash;
          return f.v > 0 && (
            <circle key={i} cx={C} cy={C} r={R} fill="none" stroke={`url(#dn${legenda}${i})`} strokeWidth={W}
              strokeDasharray={`${Math.max(dash - 1.5, 0)} ${circ - dash + 1.5}`} strokeDashoffset={-o}
              strokeLinecap="round" transform={`rotate(-90 ${C} ${C})`} style={{ transition: "stroke-dasharray .5s" }} />
          );
        })}
        <text x={C} y={C - 1} textAnchor="middle" className="ct-donut-n">{total}</text>
        <text x={C} y={C + 13} textAnchor="middle" className="ct-donut-l">{legenda}</text>
      </svg>
      <div className="ct-donut-leg">
        {fatias.map((f, i) => (
          <div key={i} className="ct-dl">
            <span className="ct-dot" style={{ background: `linear-gradient(135deg,${f.c1},${f.c2})` }} />
            <span className="ct-dl-nome">{f.rot}</span>
            <strong>{f.v}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Régua de pacing ---------- */
function Regua({ consumido, esperado, projetado, status }) {
  const lim = (v) => Math.max(0, Math.min(v, 118));
  return (
    <div className="ct-regua">
      <div className="ct-regua-trilha">
        <div className="ct-regua-zona" style={{ left: `${lim(esperado - 10)}%`, width: `${Math.min(20, 118 - lim(esperado - 10))}%` }} />
        <div className={`ct-regua-barra ct-s-${status.tom}`} style={{ width: `${lim(consumido)}%` }} />
        {projetado > 0 && (
          <div className="ct-regua-proj" style={{ left: `${lim(projetado)}%` }} title={`Projeção: ${fmtPct(projetado)}`} />
        )}
        <div className="ct-regua-ideal" style={{ left: `${lim(esperado)}%` }}>
          <span>ritmo ideal</span>
        </div>
        {[0, 25, 50, 75, 100].map((m) => (
          <div key={m} className="ct-regua-tick" style={{ left: `${m}%` }} />
        ))}
      </div>
      <div className="ct-regua-base">
        <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
      </div>
    </div>
  );
}

function Card({ titulo, sub, acao, children, className = "" }) {
  return (
    <section className={`ct-card ${className}`}>
      <div className="ct-card-h">
        <div>
          <h3>{titulo}</h3>
          {sub && <span className="ct-card-sub">{sub}</span>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

const Vazio = ({ children }) => <p className="ct-vazio">{children}</p>;

function Ind({ rot, valor, sub, tom }) {
  return (
    <div className={`ct-ind ${tom ? "ct-t-" + tom : ""}`}>
      <span className="ct-ind-l">{rot}</span>
      <span className="ct-ind-v">{valor}</span>
      {sub && <span className="ct-ind-s">{sub}</span>}
    </div>
  );
}

/* ================= COMPONENTE ================= */
export default function PainelTrafego({
  clientes, desempenho, tarefas, pessoas, usuario, isAdmin, onToast,
  onAbrirCliente, onAbrirTarefas, onAbrirTarefa, onSalvarTarefa, onExcluirTarefa,
}) {
  const [fResp, setFResp] = useState("todos");
  const [fCliente, setFCliente] = useState("todos");
  const [fPlataforma, setFPlataforma] = useState("todas");
  const [carregando, setCarregando] = useState(false);
  const [ultimaSync, setUltimaSync] = useState(null);

  const comp = competencia();
  const P = pacingPeriodo();

  /* ---------- Carteira ---------- */
  const carteira = useMemo(() => {
    const atual = {}, anterior = {};
    (desempenho || []).filter((d) => d.competencia === comp).forEach((d) => { atual[d.clienteId] = d; });
    const [a, m] = comp.split("-").map(Number);
    const compAnt = m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
    (desempenho || []).filter((d) => d.competencia === compAnt).forEach((d) => { anterior[d.clienteId] = d; });

    return (clientes || [])
      .filter((c) => c.ativo)
      .filter((c) => fResp === "todos" || c.gestorId === fResp)
      .filter((c) => fCliente === "todos" || c.id === fCliente)
      .filter((c) => fPlataforma === "todas"
        || (fPlataforma === "meta" && c.metaAdAccountId)
        || (fPlataforma === "google" && c.googleAdCustomerId))
      .map((c) => {
        const d = atual[c.id], dAnt = anterior[c.id];
        const gasto = d?.gasto || 0, verba = c.verbaMensal || 0, leads = d?.leads || 0;
        const pctConsumido = verba > 0 ? (gasto / verba) * 100 : 0;
        const item = {
          ...c,
          temConta: !!(c.metaAdAccountId || c.googleAdCustomerId),
          plataformaPrincipal: c.metaAdAccountId ? "Meta Ads" : c.googleAdCustomerId ? "Google Ads" : null,
          gasto, verba, leads,
          leadsAnterior: dAnt?.leads || 0,
          cpaReal: d?.cpaReal ?? (leads > 0 ? gasto / leads : null),
          pctConsumido, pctEsperado: P.pctTranscorrido,
          pacing: classificarPacing(pctConsumido, P.pctTranscorrido),
          projecao: P.diaAtual > 0 ? (gasto / P.diaAtual) * P.diasNoMes : 0,
          diasRestantes: P.diasRestantes,
          atualizadoEm: d?.atualizadoEm,
          esperadoValor: (verba * P.pctTranscorrido) / 100,
        };
        item.problemas = detectarProblemas(item);
        const sc = scoreCriticidade(item);
        item.score = sc.score; item.faixa = sc.faixa; item.motivos = sc.motivos;
        return item;
      })
      .sort((x, y) => y.score - x.score);
  }, [clientes, desempenho, comp, fResp, fCliente, fPlataforma,
      P.pctTranscorrido, P.diaAtual, P.diasNoMes, P.diasRestantes]);

  /* ---------- Tarefas: mesma fonte do módulo ---------- */

  /* Tarefas da carteira, com os mesmos filtros — a Central recebe
     esta lista e nunca uma cópia separada. */
  const tarefasDaCarteira = useMemo(() => {
    const ids = new Set(carteira.map((c) => c.id));
    let l = (tarefas || []).filter((t) => !t.clienteId || ids.has(t.clienteId));
    if (fResp !== "todos") l = l.filter((t) => t.responsavelId === fResp);
    if (fCliente !== "todos") l = l.filter((t) => t.clienteId === fCliente);
    return l;
  }, [tarefas, carteira, fResp, fCliente]);

  const scorePorCliente = useMemo(
    () => Object.fromEntries(carteira.map((c) => [c.id, c.score])),
    [carteira]
  );

  const T = useMemo(() => {
    return {
      ...resumirTarefas(tarefasDaCarteira),
      prioridades: prioridadesDoDia(tarefasDaCarteira, { scorePorCliente, limite: 7 })
        .map((t) => ({ ...t, cliente: carteira.find((c) => c.id === t.clienteId) })),
    };
  }, [tarefas, carteira, fResp, fCliente]);

  /* ---------- Verba consolidada ---------- */
  const V = useMemo(() => {
    const ativas = carteira.filter((c) => c.temConta);
    const verba = ativas.reduce((s, c) => s + c.verba, 0);
    const gasto = ativas.reduce((s, c) => s + c.gasto, 0);
    const projecao = ativas.reduce((s, c) => s + c.projecao, 0);
    const pctConsumido = verba > 0 ? (gasto / verba) * 100 : 0;
    return {
      verba, gasto, projecao, pctConsumido,
      pctProjetado: verba > 0 ? (projecao / verba) * 100 : 0,
      pctEsperado: P.pctTranscorrido,
      status: classificarPacing(pctConsumido, P.pctTranscorrido),
      diferenca: projecao - verba,
      acima: ativas.filter((c) => c.pacing.desvio > 10).sort((x, y) => y.pacing.desvio - x.pacing.desvio).slice(0, 4),
      abaixo: ativas.filter((c) => c.pacing.desvio < -10).sort((x, y) => x.pacing.desvio - y.pacing.desvio).slice(0, 4),
    };
  }, [carteira, P.pctTranscorrido]);

  /* Mesma função do painel financeiro — uma fórmula só no sistema */
  const META_CHURN = 5;
  const churnBase = useMemo(() => churnHistorico(clientes || []), [clientes]);
  const churn = useMemo(() => ({
    taxa: churnBase.taxaAtual,
    perdidos: churnBase.perdidosAtual,
    base: churnBase.ativosInicioAtual,
    metaAceitavel: META_CHURN,
    acimaDaMeta: churnBase.taxaAtual > META_CHURN,
  }), [churnBase]);

  const saude = useMemo(() => ({
    total: carteira.length,
    saudaveis: carteira.filter((c) => c.faixa.id === "saudavel").length,
    atencao: carteira.filter((c) => c.faixa.id === "atencao").length,
    risco: carteira.filter((c) => c.faixa.id === "risco").length,
    criticos: carteira.filter((c) => c.faixa.id === "critico").length,
  }), [carteira]);

  const criticos = useMemo(() => carteira.filter((c) => c.score > 30).slice(0, 5), [carteira]);


  /* ---------- Diagnóstico executivo ---------- */
  const diagnostico = useMemo(() => {
    const alertas = [];
    if (V.status.id === "critico")
      alertas.push({ txt: V.pctConsumido < V.pctEsperado ? "Abaixo do ritmo de verba" : "Acima do ritmo de verba", tom: "err" });
    else if (V.status.id === "atencao")
      alertas.push({ txt: "Ritmo de verba exige atenção", tom: "avi" });
    if (churn.acimaDaMeta)
      alertas.push({ txt: "Churn acima do aceitável no período", tom: "err" });
    if (saude.criticos > 0)
      alertas.push({ txt: `${saude.criticos} cliente${saude.criticos > 1 ? "s" : ""} em situação crítica`, tom: "err" });
    if (T.atrasadas > 0)
      alertas.push({ txt: `${T.atrasadas} tarefa${T.atrasadas > 1 ? "s" : ""} atrasada${T.atrasadas > 1 ? "s" : ""}`, tom: "avi" });
    if (alertas.length === 0) alertas.push({ txt: "Operação dentro do esperado", tom: "ok" });
    return alertas.slice(0, 3);
  }, [V, churn, saude, T.atrasadas]);

  async function sincronizar() {
    setCarregando(true);
    try {
      const r = await api.metaSincronizar();
      const ok = (r?.resultados || []).filter((x) => x.ok).length;
      setUltimaSync(new Date().toISOString());
      onToast(`${ok} conta(s) atualizada(s)`);
    } catch (e) { onToast("Não foi possível atualizar: " + e.message); }
    finally { setCarregando(false); }
  }


  const nome = (usuario?.nome || "").split(" ")[0];
  const gestores = useMemo(() => {
    const ids = [...new Set((clientes || []).map((c) => c.gestorId).filter(Boolean))];
    return ids.map((id) => ({ id, nome: (pessoas || []).find((p) => p.id === id)?.nome || "—" }));
  }, [clientes, pessoas]);

  return (
    <div className="ct">
      {/* ── Cabeçalho ── */}
      <div className="ct-topo">
        <div>
          <h1>{saudacao()}{nome ? `, ${nome}` : ""}</h1>
          <p>
            Aqui está o resumo da sua operação de tráfego hoje.
            {ultimaSync && <span className="ct-sync"> · atualizado {desde(ultimaSync)}</span>}
          </p>
        </div>
        <div className="ct-filtros">
          {(isAdmin || gestores.length > 1) && (
            <select className="select" value={fResp} onChange={(e) => setFResp(e.target.value)}>
              <option value="todos">Todos os responsáveis</option>
              {gestores.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          )}
          <select className="select" value={fCliente} onChange={(e) => setFCliente(e.target.value)}>
            <option value="todos">Todos os clientes</option>
            {(clientes || []).filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select className="select" value={fPlataforma} onChange={(e) => setFPlataforma(e.target.value)}>
            <option value="todas">Todas as plataformas</option>
            <option value="meta">Meta Ads</option>
            <option value="google">Google Ads</option>
          </select>
          <button className="toolbar-btn" onClick={sincronizar} disabled={carregando}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            {carregando ? "Atualizando…" : "Atualizar dados"}
          </button>
        </div>
      </div>

      {/* ══ 1. Quadro executivo ══ */}
      <div className="ct-exec">
        <div className="ct-exec-pilares">
          <div className="ct-pilar">
            <span className="ct-pilar-t">Gestão de verba</span>
            <span className="ct-pilar-v">{fmtK(V.gasto)}</span>
            <span className="ct-pilar-s">de {fmtK(V.verba)} · {fmtPct(V.pctConsumido)} consumido</span>
            <div className="ct-pilar-mini">
              <div className="ct-mini-trilha">
                <div className="ct-mini-barra" style={{ width: `${Math.min(V.pctConsumido, 100)}%` }} />
                <div className="ct-mini-marca" style={{ left: `${Math.min(V.pctEsperado, 100)}%` }} />
              </div>
              <span>ritmo ideal {fmtPct(V.pctEsperado)} · projeção {fmtK(V.projecao)}</span>
            </div>
          </div>

          <div className="ct-pilar">
            <span className="ct-pilar-t">Churn do período</span>
            <span className="ct-pilar-v">{fmtPct(churn.taxa)}</span>
            <span className="ct-pilar-s">
              {churn.perdidos} cliente{churn.perdidos !== 1 ? "s" : ""} perdido{churn.perdidos !== 1 ? "s" : ""} · meta até {churn.metaAceitavel}%
            </span>
            <div className="ct-pilar-mini">
              <div className="ct-mini-trilha">
                <div className={`ct-mini-barra ${churn.acimaDaMeta ? "ct-mini-ruim" : ""}`}
                  style={{ width: `${Math.min((churn.taxa / Math.max(churn.metaAceitavel * 2, 1)) * 100, 100)}%` }} />
                <div className="ct-mini-marca" style={{ left: "50%" }} />
              </div>
              <span>{churn.acimaDaMeta ? "acima do aceitável" : "dentro do aceitável"}</span>
            </div>
          </div>

          <div className="ct-pilar">
            <span className="ct-pilar-t">Status da operação</span>
            <span className="ct-pilar-v">{saude.total}</span>
            <span className="ct-pilar-s">clientes ativos na carteira</span>
            <div className="ct-pilar-chips">
              <span className="ct-chip ct-c-ok">{saude.saudaveis} saudáveis</span>
              <span className="ct-chip ct-c-avi">{saude.atencao} atenção</span>
              <span className="ct-chip ct-c-lar">{saude.risco} risco</span>
              <span className="ct-chip ct-c-err">{saude.criticos} críticos</span>
            </div>
          </div>
        </div>

        <div className="ct-exec-diag">
          {diagnostico.map((d, i) => (
            <span key={i} className={`ct-diag ct-d-${d.tom}`}>{d.txt}</span>
          ))}
        </div>
      </div>

      {/* ══ 2. Cards de overview ══ */}
      <div className="ct-inds">
        <Ind rot="Tarefas em aberto" valor={T.abertas} sub={T.deHoje > 0 ? `${T.deHoje} vencem hoje` : "nenhuma vence hoje"} />
        <Ind rot="Atrasadas" valor={T.atrasadas} tom={T.atrasadas > 0 ? "err" : "ok"} sub={T.atrasadas > 0 ? "exigem ação" : "tudo em dia"} />
        <Ind rot="Em andamento" valor={T.andamento} tom="info" />
        <Ind rot="Concluídas hoje" valor={T.concluidasHoje} tom={T.concluidasHoje > 0 ? "ok" : null} />
        <Ind rot="Clientes críticos" valor={saude.criticos + saude.risco}
          tom={saude.criticos > 0 ? "err" : saude.risco > 0 ? "avi" : "ok"}
          sub={`de ${saude.total} na carteira`} />
        <Ind rot="Tarefas na semana" valor={T.daSemana} tom="info"
          sub={T.taxaSemana != null ? `${fmtPct(T.taxaSemana)} concluídas` : "sem planejamento"} />
      </div>

      {/* ══ 3. Saúde da carteira + Status das tarefas ══ */}
      <div className="ct-donuts">
        <Card titulo="Saúde da carteira" sub={`${saude.total} clientes ativos`}>
          <Donut legenda="clientes" total={saude.total} tamanho={124} fatias={[
            { rot: "Saudáveis", v: saude.saudaveis, c1: "#0C5530", c2: "#18A35F" },
            { rot: "Atenção", v: saude.atencao, c1: "#B54708", c2: "#F5A524" },
            { rot: "Risco", v: saude.risco, c1: "#C2410C", c2: "#FB923C" },
            { rot: "Críticos", v: saude.criticos, c1: "#991B1B", c2: "#EF4444" },
          ]} />
        </Card>

        <Card titulo="Status das tarefas"
          sub={T.taxaSemana != null ? `${fmtPct(T.taxaSemana)} das tarefas da semana concluídas` : "sem tarefas na semana"}>
          <Donut legenda="tarefas" total={T.atrasadas + T.pendentes + T.andamento + T.concluidasSemana} tamanho={124} fatias={[
            { rot: "Atrasadas", v: T.atrasadas, c1: "#991B1B", c2: "#EF4444" },
            { rot: "Pendentes", v: T.pendentes, c1: "#B54708", c2: "#F5A524" },
            { rot: "Em andamento", v: T.andamento, c1: "#1E4D8C", c2: "#3B82F6" },
            { rot: "Concluídas", v: T.concluidasSemana, c1: "#0C5530", c2: "#18A35F" },
          ]} />
        </Card>
      </div>

      {/* ══ 4. Prioridades + Clientes críticos ══ */}
      <div className="ct-l2b">
        <Card titulo="Prioridades de hoje"
          sub="atrasadas e com vencimento hoje"
          acao={onAbrirTarefas && <button className="ct-link" onClick={onAbrirTarefas}>Ver todas</button>}>
          {T.prioridades.length === 0 ? (
            <Vazio>Nenhuma tarefa atrasada ou para hoje. Tudo em dia.</Vazio>
          ) : (
            <div className="ct-prios">
              {T.prioridades.slice(0, 6).map((t) => (
                <div key={t.id} className="ct-prio">
                  <span className={`ct-pri-tag ct-p-${t.prioridade}`}>
                    {t.prioridade === "critica" ? "CRÍTICA" : t.prioridade === "alta" ? "ALTA" : "MÉDIA"}
                  </span>
                  <div className="ct-prio-txt">
                    <div className="ct-prio-acao">{t.titulo || t.acao}</div>
                    <div className="ct-prio-cli">{t.cliente?.nome || "Geral"}</div>
                  </div>
                  <span className={`ct-sit ${t.atrasada ? "ct-sit-err" : ""}`}>{t.situacao}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card titulo="Clientes críticos"
        sub="ordenados pelo score de criticidade"
        acao={<span className="ct-nota">{saude.saudaveis} sem alertas</span>}>
        {criticos.length === 0 ? (
          <Vazio>Nenhum cliente em situação crítica. A carteira está dentro dos parâmetros.</Vazio>
        ) : (
          <div className="ct-criticos">
            {criticos.map((c) => (
              <div key={c.id} className="ct-cri" onClick={() => onAbrirCliente && onAbrirCliente(c)}>
                <div className={`ct-cri-score ct-sc-${c.faixa.tom}`}>
                  <span className="ct-score">{c.score}</span>
                  <span className="ct-score-l">{c.faixa.rot}</span>
                </div>
                <div className="ct-cri-info">
                  <div className="ct-cri-nome">
                    {c.nome}
                    <span className="ct-plat">{c.plataformaPrincipal || "sem conta"}</span>
                  </div>
                  <div className="ct-cri-motivos">
                    {c.motivos.length === 0 ? <span className="ct-nada">sem apontamentos</span> :
                      c.motivos.map((m, i) => <span key={i} className="ct-motivo">{m}</span>)}
                  </div>
                </div>
                <div className="ct-cri-metricas">
                  <span>CPL<strong className={c.cpaMeta && c.cpaReal > c.cpaMeta ? "ct-ruim" : ""}>{c.cpaReal ? fmtMoeda(c.cpaReal) : "—"}</strong></span>
                  <span>Meta<strong>{c.cpaMeta ? fmtMoeda(c.cpaMeta) : "—"}</strong></span>
                  <span>Leads<strong>{fmtNum(c.leads)}</strong></span>
                  <span>Investido<strong>{fmtMoeda(c.gasto)}</strong></span>
                </div>
                <span className="ct-abrir">›</span>
              </div>
            ))}
          </div>
        )}
        </Card>
      </div>

      {/* ══ 5. Gestão de verba, com fora do ritmo dentro ══ */}
      <Card titulo="Gestão de verba" sub={`dia ${P.diaAtual} de ${P.diasNoMes} · restam ${P.diasRestantes} dias`}
        acao={<span className={`ct-badge tom-${V.status.tom}`}>{V.status.rot}</span>}>
        <div className="ct-verba-nums">
          <div><span>Verba mensal</span><strong>{fmtMoeda(V.verba)}</strong></div>
          <div><span>Investido</span><strong>{fmtMoeda(V.gasto)}</strong></div>
          <div><span>Projeção final</span><strong>{fmtMoeda(V.projecao)}</strong></div>
          <div>
            <span>Diferença projetada</span>
            <strong className={V.diferenca < -V.verba * 0.05 ? "ct-ruim" : V.diferenca > V.verba * 0.05 ? "ct-atencao" : ""}>
              {V.diferenca >= 0 ? "+" : ""}{fmtMoeda(V.diferenca)}
            </strong>
          </div>
        </div>

        <Regua consumido={V.pctConsumido} esperado={V.pctEsperado} projetado={V.pctProjetado} status={V.status} />

        {(V.acima.length > 0 || V.abaixo.length > 0) && (
          <div className="ct-fora">
            <div className="ct-fora-col">
              <h4 className="ct-sub ct-sub-avi">Acima do previsto</h4>
              {V.acima.length === 0 ? <span className="ct-nada">nenhuma conta</span> : (
                <div className="ct-fora-cards">
                  {V.acima.map((c) => (
                    <div key={c.id} className="ct-fc ct-fc-avi" onClick={() => onAbrirCliente && onAbrirCliente(c)}>
                      <div className="ct-fc-h">
                        <span className="ct-fc-nome">{c.nome}</span>
                        <span className="ct-fc-desv ct-ruim">+{c.pacing.desvio.toFixed(0)}%</span>
                      </div>
                      <span className="ct-plat">{c.plataformaPrincipal}</span>
                      <div className="ct-fc-vals">
                        <span>Investido<strong>{fmtMoeda(c.gasto)}</strong></span>
                        <span>Esperado<strong>{fmtMoeda(c.esperadoValor)}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="ct-fora-col">
              <h4 className="ct-sub ct-sub-info">Abaixo do previsto</h4>
              {V.abaixo.length === 0 ? <span className="ct-nada">nenhuma conta</span> : (
                <div className="ct-fora-cards">
                  {V.abaixo.map((c) => (
                    <div key={c.id} className="ct-fc ct-fc-info" onClick={() => onAbrirCliente && onAbrirCliente(c)}>
                      <div className="ct-fc-h">
                        <span className="ct-fc-nome">{c.nome}</span>
                        <span className="ct-fc-desv ct-atencao">{c.pacing.desvio.toFixed(0)}%</span>
                      </div>
                      <span className="ct-plat">{c.plataformaPrincipal}</span>
                      <div className="ct-fc-vals">
                        <span>Investido<strong>{fmtMoeda(c.gasto)}</strong></span>
                        <span>Esperado<strong>{fmtMoeda(c.esperadoValor)}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* ══ 6. Central de Tarefas ══ */}
      <CentralTarefas
        tarefas={tarefasDaCarteira}
        clientes={clientes}
        pessoas={pessoas}
        usuario={usuario}
        scorePorCliente={scorePorCliente}
        onSalvar={onSalvarTarefa}
        onExcluir={onExcluirTarefa}
        onAbrirModulo={() => onAbrirTarefas && onAbrirTarefas()}
        onToast={onToast}
      />
    </div>
  );
}
