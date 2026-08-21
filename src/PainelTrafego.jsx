import { useMemo, useState } from "react";
import * as api from "./api.js";
import { fmtMoeda } from "./utils";
import { competencia } from "./projecao";
import {
  pacingPeriodo, classificarPacing, scoreCriticidade,
  gerarInsights, detectarProblemas,
} from "./trafegoEngine.js";

/* ============================================================
   Painel de Tráfego — central de comando do gestor.
   Cada bloco responde a uma pergunta operacional; nada aqui
   existe apenas para preencher espaço.
   ============================================================ */

const fmtNum = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 }));
const fmtPct = (v) => (v == null ? "—" : `${Number(v).toFixed(1)}%`);
const hojeISO = () => new Date().toISOString().slice(0, 10);
const saudacao = () => { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; };
const desde = (ts) => {
  if (!ts) return null;
  const min = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `há ${h}h` : `há ${Math.floor(h / 24)}d`;
};

const PERIODOS = [
  { id: "hoje", l: "Hoje" }, { id: "7d", l: "7 dias" }, { id: "14d", l: "14 dias" },
  { id: "30d", l: "30 dias" }, { id: "mes", l: "Mês atual" },
];

function Ind({ rot, valor, sub, tom, onClick, ativo }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`ct-ind ${tom ? "ct-t-" + tom : ""} ${onClick ? "ct-click" : ""} ${ativo ? "ct-ativo" : ""}`} onClick={onClick}>
      <span className="ct-ind-l">{rot}</span>
      <span className="ct-ind-v">{valor}</span>
      {sub && <span className="ct-ind-s">{sub}</span>}
    </Tag>
  );
}

function Card({ titulo, acao, children, className = "" }) {
  return (
    <section className={`ct-card ${className}`}>
      <div className="ct-card-h"><h3>{titulo}</h3>{acao}</div>
      {children}
    </section>
  );
}

const Vazio = ({ children }) => <p className="ct-vazio">{children}</p>;

function BarraSeg({ segmentos }) {
  const total = segmentos.reduce((a, s) => a + s.v, 0) || 1;
  return (
    <>
      <div className="ct-barra">
        {segmentos.map((s, i) => s.v > 0 && (
          <div key={i} className={`ct-seg ct-s-${s.tom}`} style={{ width: `${(s.v / total) * 100}%` }} title={`${s.rot}: ${s.v}`} />
        ))}
      </div>
      <div className="ct-barra-leg">
        {segmentos.map((s, i) => (
          <span key={i}><i className={`ct-dot ct-s-${s.tom}`} />{s.rot} <strong>{s.v}</strong></span>
        ))}
      </div>
    </>
  );
}

function Pacing({ consumido, esperado, status }) {
  return (
    <div className="ct-pacing">
      <div className="ct-pacing-trilha">
        <div className={`ct-pacing-barra ct-s-${status.tom}`} style={{ width: `${Math.min(consumido, 100)}%` }} />
        <div className="ct-pacing-marca" style={{ left: `${Math.min(esperado, 100)}%` }} title="Ritmo ideal" />
      </div>
      <div className="ct-pacing-txt">
        <span>Consumido <strong>{fmtPct(consumido)}</strong></span>
        <span className="ct-pacing-ideal">Ritmo ideal {fmtPct(esperado)}</span>
        <span className={`ct-badge tom-${status.tom}`}>{status.rot}</span>
      </div>
    </div>
  );
}

/* ================= COMPONENTE ================= */
export default function PainelTrafego({
  clientes, desempenho, tarefas, pessoas, usuario, isAdmin, onToast,
  onAbrirCliente, onAbrirTarefas, onConcluirTarefa,
}) {
  const [periodo, setPeriodo] = useState("mes");
  const [fResp, setFResp] = useState("todos");
  const [fCliente, setFCliente] = useState("todos");
  const [fPlataforma, setFPlataforma] = useState("todas");
  const [carregando, setCarregando] = useState(false);
  const [ultimaSync, setUltimaSync] = useState(null);
  const [resolvidos, setResolvidos] = useState({});

  const comp = competencia();
  const P = pacingPeriodo();

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
        const gasto = d?.gasto || 0;
        const verba = c.verbaMensal || 0;
        const leads = d?.leads || 0;
        const pctConsumido = verba > 0 ? (gasto / verba) * 100 : 0;
        const pctEsperado = P.pctTranscorrido;
        const item = {
          ...c,
          temConta: !!(c.metaAdAccountId || c.googleAdCustomerId),
          plataformaPrincipal: c.metaAdAccountId ? "Meta Ads" : c.googleAdCustomerId ? "Google Ads" : null,
          gasto, verba, leads,
          leadsAnterior: dAnt?.leads || 0,
          cpaReal: d?.cpaReal ?? (leads > 0 ? gasto / leads : null),
          pctConsumido, pctEsperado,
          pacing: classificarPacing(pctConsumido, pctEsperado),
          projecao: P.diaAtual > 0 ? (gasto / P.diaAtual) * P.diasNoMes : 0,
          diasRestantes: P.diasRestantes,
          atualizadoEm: d?.atualizadoEm,
          esperadoValor: (verba * pctEsperado) / 100,
        };
        item.problemas = detectarProblemas(item);
        const sc = scoreCriticidade(item);
        item.score = sc.score; item.faixa = sc.faixa; item.motivos = sc.motivos;
        item.insights = gerarInsights(item);
        return item;
      })
      .sort((x, y) => y.score - x.score);
  }, [clientes, desempenho, comp, fResp, fCliente, fPlataforma,
      P.pctTranscorrido, P.diaAtual, P.diasNoMes, P.diasRestantes]);

  const T = useMemo(() => {
    const hoje = hojeISO();
    const ids = new Set(carteira.map((c) => c.id));
    let lista = (tarefas || []).filter((t) => !t.clienteId || ids.has(t.clienteId));
    if (fResp !== "todos") lista = lista.filter((t) => t.responsavelId === fResp);

    const fechada = (t) => t.etapa === "Concluída" || t.etapa === "Cancelada";
    const abertas = lista.filter((t) => !fechada(t));
    const atrasadas = abertas.filter((t) => t.prazo && t.prazo < hoje);
    const paraHoje = abertas.filter((t) => t.prazo === hoje);
    const andamento = abertas.filter((t) => t.etapa === "Em andamento");
    const pendentes = abertas.filter((t) => t.etapa === "A executar");
    const concluidasHoje = lista.filter((t) => fechada(t) && (t.dataConclusao || "").slice(0, 10) === hoje);

    const d = new Date(); d.setDate(d.getDate() - d.getDay());
    const ini = d.toISOString().slice(0, 10);
    const daSemana = lista.filter((t) => (t.prazo || t.data || "") >= ini);
    const concluidasSemana = daSemana.filter(fechada);

    const porScore = Object.fromEntries(carteira.map((c) => [c.id, c.score]));
    const prioridades = [...atrasadas, ...paraHoje]
      .map((t) => ({
        ...t,
        cliente: carteira.find((c) => c.id === t.clienteId),
        atrasada: !!(t.prazo && t.prazo < hoje),
        prioridade: t.prazo && t.prazo < hoje ? "critica" : (porScore[t.clienteId] || 0) > 50 ? "alta" : "media",
      }))
      .sort((x, y) => (y.atrasada ? 1 : 0) - (x.atrasada ? 1 : 0) || (porScore[y.clienteId] || 0) - (porScore[x.clienteId] || 0))
      .slice(0, 8);

    return {
      abertas: abertas.length, atrasadas: atrasadas.length, paraHoje: paraHoje.length,
      andamento: andamento.length, pendentes: pendentes.length,
      concluidasHoje: concluidasHoje.length, concluidasSemana: concluidasSemana.length,
      taxaSemana: daSemana.length > 0 ? (concluidasSemana.length / daSemana.length) * 100 : null,
      prioridades,
    };
  }, [tarefas, carteira, fResp]);

  const V = useMemo(() => {
    const ativas = carteira.filter((c) => c.temConta);
    const verba = ativas.reduce((s, c) => s + c.verba, 0);
    const gasto = ativas.reduce((s, c) => s + c.gasto, 0);
    const projecao = ativas.reduce((s, c) => s + c.projecao, 0);
    const pctConsumido = verba > 0 ? (gasto / verba) * 100 : 0;
    return {
      verba, gasto, projecao, pctConsumido,
      pctEsperado: P.pctTranscorrido,
      status: classificarPacing(pctConsumido, P.pctTranscorrido),
      diferenca: projecao - verba,
      acima: ativas.filter((c) => c.pacing.desvio > 10).sort((x, y) => y.pacing.desvio - x.pacing.desvio).slice(0, 5),
      abaixo: ativas.filter((c) => c.pacing.desvio < -10).sort((x, y) => x.pacing.desvio - y.pacing.desvio).slice(0, 5),
    };
  }, [carteira, P.pctTranscorrido]);

  const saude = useMemo(() => ({
    total: carteira.length,
    saudaveis: carteira.filter((c) => c.faixa.id === "saudavel").length,
    atencao: carteira.filter((c) => c.faixa.id === "atencao").length,
    risco: carteira.filter((c) => c.faixa.id === "risco").length,
    criticos: carteira.filter((c) => c.faixa.id === "critico").length,
  }), [carteira]);

  const criticos = useMemo(() => carteira.filter((c) => c.score > 30).slice(0, 5), [carteira]);

  const insights = useMemo(() => {
    const ordem = { critico: 0, alto: 1, medio: 2, baixo: 3 };
    return carteira
      .flatMap((c) => c.insights.map((i) => ({ ...i, scoreCliente: c.score })))
      .filter((i) => !resolvidos[i.clienteId + i.titulo])
      .sort((x, y) => ordem[x.prioridade] - ordem[y.prioridade] || y.scoreCliente - x.scoreCliente);
  }, [carteira, resolvidos]);

  const acionaveis = insights.filter((i) => i.tipo !== "saudavel" && i.tipo !== "monitoramento");
  const problemas = useMemo(
    () => carteira.flatMap((c) => c.problemas.map((p) => ({ ...p, cliente: c })))
      .sort((x, y) => (x.nivel === "critico" ? -1 : 1) - (y.nivel === "critico" ? -1 : 1)),
    [carteira]
  );
  const dadosVelhos = carteira.filter((c) => c.temConta && c.atualizadoEm &&
    (Date.now() - new Date(c.atualizadoEm)) / 3600000 > 24);

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

  const marcar = (i, estado, msg) => {
    setResolvidos((p) => ({ ...p, [i.clienteId + i.titulo]: estado }));
    onToast(msg);
  };

  return (
    <div className="ct">
      <div className="ct-topo">
        <div>
          <h1>{saudacao()}{nome ? `, ${nome}` : ""}</h1>
          <p>
            Aqui está o resumo da sua operação de tráfego hoje.
            {ultimaSync && <span className="ct-sync"> · dados atualizados {desde(ultimaSync)}</span>}
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
          <select className="select" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            {PERIODOS.map((p) => <option key={p.id} value={p.id}>{p.l}</option>)}
          </select>
          <button className="toolbar-btn" onClick={sincronizar} disabled={carregando}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            {carregando ? "Atualizando…" : "Atualizar dados"}
          </button>
        </div>
      </div>

      {dadosVelhos.length > 0 && (
        <div className="ct-aviso-topo">
          <strong>{dadosVelhos.length} conta{dadosVelhos.length > 1 ? "s" : ""}</strong> com dados desatualizados há mais de 24 horas.
          <button className="ct-link" onClick={sincronizar}>Sincronizar agora</button>
        </div>
      )}

      <div className="ct-inds">
        <Ind rot="Tarefas em aberto" valor={T.abertas} sub={T.paraHoje > 0 ? `${T.paraHoje} vencem hoje` : "nenhuma vence hoje"} />
        <Ind rot="Atrasadas" valor={T.atrasadas} tom={T.atrasadas > 0 ? "err" : "ok"} sub={T.atrasadas > 0 ? "exigem ação" : "tudo em dia"} />
        <Ind rot="Em andamento" valor={T.andamento} tom="info" />
        <Ind rot="Concluídas hoje" valor={T.concluidasHoje} tom={T.concluidasHoje > 0 ? "ok" : null} />
        <Ind rot="Clientes em atenção" valor={`${criticos.length} de ${carteira.length}`}
          tom={saude.criticos > 0 ? "err" : criticos.length > 0 ? "avi" : "ok"}
          sub={saude.criticos > 0 ? `${saude.criticos} crítico${saude.criticos > 1 ? "s" : ""}` : null} />
        <Ind rot="Insights" valor={insights.length} tom="info"
          sub={acionaveis.length > 0 ? `${acionaveis.length} acionáveis` : "nada crítico"} />
      </div>

      <div className="ct-l2">
        <Card titulo="Clientes que exigem atenção" acao={<span className="ct-nota">{saude.saudaveis} sem alertas críticos</span>}>
          {criticos.length === 0 ? (
            <Vazio>Nenhum cliente em situação crítica. A carteira está dentro dos parâmetros.</Vazio>
          ) : (
            <div className="ct-criticos">
              {criticos.map((c) => (
                <div key={c.id} className="ct-cri" onClick={() => onAbrirCliente && onAbrirCliente(c)}>
                  <div className="ct-cri-score">
                    <span className={`ct-score ct-t-${c.faixa.tom}`}>{c.score}</span>
                    <span className="ct-score-l">{c.faixa.rot}</span>
                  </div>
                  <div className="ct-cri-info">
                    <div className="ct-cri-nome">{c.nome}<span className="ct-plat">{c.plataformaPrincipal || "sem conta"}</span></div>
                    <div className="ct-cri-motivos">{c.motivos.join(" · ") || "sem apontamentos"}</div>
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

        <Card titulo="Prioridades de hoje"
          acao={onAbrirTarefas && <button className="ct-link" onClick={onAbrirTarefas}>Ver todas</button>}>
          {T.prioridades.length === 0 ? (
            <Vazio>Nenhuma tarefa atrasada ou para hoje. Tudo em dia.</Vazio>
          ) : (
            <div className="ct-prios">
              {T.prioridades.map((t) => (
                <div key={t.id} className="ct-prio">
                  <span className={`ct-pri-tag ct-p-${t.prioridade}`}>
                    {t.prioridade === "critica" ? "CRÍTICA" : t.prioridade === "alta" ? "ALTA" : "MÉDIA"}
                  </span>
                  <div className="ct-prio-txt">
                    <div className="ct-prio-cli">{t.cliente?.nome || "Geral"}</div>
                    <div className="ct-prio-acao">{t.titulo || t.acao}</div>
                    <div className="ct-prio-meta">
                      {t.atrasada ? <span className="ct-atraso">atrasada</span> : "vence hoje"}
                      {t.etapa && <span> · {t.etapa}</span>}
                    </div>
                  </div>
                  {onConcluirTarefa && <button className="ct-ok" title="Concluir" onClick={() => onConcluirTarefa(t)}>✓</button>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="ct-l3">
        <Card titulo="Gestão de verba" acao={<span className="ct-nota">dia {P.diaAtual} de {P.diasNoMes}</span>}>
          <div className="ct-verba-nums">
            <div><span>Verba mensal</span><strong>{fmtMoeda(V.verba)}</strong></div>
            <div><span>Investido</span><strong>{fmtMoeda(V.gasto)}</strong></div>
            <div><span>Projeção</span><strong>{fmtMoeda(V.projecao)}</strong></div>
            <div>
              <span>Diferença projetada</span>
              <strong className={V.diferenca < -V.verba * 0.05 ? "ct-ruim" : V.diferenca > V.verba * 0.05 ? "ct-atencao" : ""}>
                {V.diferenca >= 0 ? "+" : ""}{fmtMoeda(V.diferenca)}
              </strong>
            </div>
          </div>
          <Pacing consumido={V.pctConsumido} esperado={V.pctEsperado} status={V.status} />
        </Card>

        <Card titulo="Fora do ritmo de verba">
          {V.acima.length === 0 && V.abaixo.length === 0 ? (
            <Vazio>Todas as contas dentro do ritmo esperado.</Vazio>
          ) : (
            <div className="ct-pacing-listas">
              <div>
                <h4 className="ct-sub ct-sub-avi">Acima do previsto</h4>
                {V.acima.length === 0 ? <span className="ct-nada">nenhuma</span> : V.acima.map((c) => (
                  <div key={c.id} className="ct-pac-item" onClick={() => onAbrirCliente && onAbrirCliente(c)}>
                    <span className="ct-pac-nome">{c.nome}</span>
                    <span className="ct-pac-val">{fmtMoeda(c.gasto)} <em>de {fmtMoeda(c.esperadoValor)}</em></span>
                    <span className="ct-pac-desv ct-ruim">+{c.pacing.desvio.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="ct-sub ct-sub-info">Abaixo do previsto</h4>
                {V.abaixo.length === 0 ? <span className="ct-nada">nenhuma</span> : V.abaixo.map((c) => (
                  <div key={c.id} className="ct-pac-item" onClick={() => onAbrirCliente && onAbrirCliente(c)}>
                    <span className="ct-pac-nome">{c.nome}</span>
                    <span className="ct-pac-val">{fmtMoeda(c.gasto)} <em>de {fmtMoeda(c.esperadoValor)}</em></span>
                    <span className="ct-pac-desv ct-atencao">{c.pacing.desvio.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card titulo="Insights de otimização"
        acao={<span className="ct-nota">{acionaveis.length} acionáveis · {insights.length - acionaveis.length} em monitoramento</span>}>
        {insights.length === 0 ? (
          <Vazio>Nenhum insight disponível. Sincronize as contas para gerar a análise do dia.</Vazio>
        ) : (
          <div className="ct-insights">
            {insights.slice(0, 6).map((i, k) => (
              <div key={k} className={`ct-ins ct-ins-${i.prioridade}`}>
                <div className="ct-ins-h">
                  <span className={`ct-pri-tag ct-p-${i.prioridade}`}>
                    {i.prioridade === "critico" ? "CRÍTICO" : i.prioridade === "alto" ? "ALTA" : i.prioridade === "medio" ? "MÉDIA" : "MONITORAR"}
                  </span>
                  <span className="ct-ins-cli">{i.cliente}</span>
                  <span className="ct-plat">{i.plataforma}</span>
                  <span className={`ct-conf ct-conf-${i.confianca.id}`}>{i.confianca.rot}</span>
                </div>
                <div className="ct-ins-tit">{i.titulo}</div>
                <p className="ct-ins-ev">{i.evidencia}</p>
                {i.recomendacao && <p className="ct-ins-rec"><strong>Recomendação:</strong> {i.recomendacao}</p>}
                {i.impacto && <p className="ct-ins-imp">Impacto esperado: {i.impacto}</p>}
                <div className="ct-ins-acoes">
                  <button className="ct-btn-mini" onClick={() => {
                    const c = carteira.find((x) => x.id === i.clienteId);
                    if (c && onAbrirCliente) onAbrirCliente(c);
                  }}>Ver relatório</button>
                  <button className="ct-btn-mini" onClick={() => marcar(i, "resolvido", "Insight marcado como resolvido")}>Resolvido</button>
                  <button className="ct-btn-mini ct-btn-fraco" onClick={() => marcar(i, "descartado", "Insight descartado")}>Descartar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="ct-l5">
        <Card titulo="Status das tarefas"
          acao={T.taxaSemana != null && <span className="ct-nota">{fmtPct(T.taxaSemana)} concluídas na semana</span>}>
          <BarraSeg segmentos={[
            { rot: "Atrasadas", v: T.atrasadas, tom: "err" },
            { rot: "Pendentes", v: T.pendentes, tom: "avi" },
            { rot: "Em andamento", v: T.andamento, tom: "info" },
            { rot: "Concluídas", v: T.concluidasSemana, tom: "ok" },
          ]} />
        </Card>

        <Card titulo="Saúde da carteira" acao={<span className="ct-nota">{saude.total} clientes ativos</span>}>
          <BarraSeg segmentos={[
            { rot: "Saudáveis", v: saude.saudaveis, tom: "ok" },
            { rot: "Atenção", v: saude.atencao, tom: "avi" },
            { rot: "Risco", v: saude.risco, tom: "laranja" },
            { rot: "Críticos", v: saude.criticos, tom: "err" },
          ]} />
        </Card>
      </div>

      <Card titulo="Problemas detectados">
        {problemas.length === 0 ? (
          <Vazio>Todas as integrações funcionando normalmente.</Vazio>
        ) : (
          <div className="ct-probs">
            {problemas.slice(0, 8).map((p, i) => (
              <div key={i} className="ct-prob" onClick={() => onAbrirCliente && onAbrirCliente(p.cliente)}>
                <span className={`ct-badge tom-${p.nivel === "critico" ? "err" : "avi"}`}>
                  {p.nivel === "critico" ? "CRÍTICO" : "AVISO"}
                </span>
                <div className="ct-prob-txt">
                  <div className="ct-prob-cli">{p.cliente.nome} — {p.titulo}</div>
                  <div className="ct-prob-det">{p.detalhe}</div>
                </div>
                <span className="ct-abrir">›</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
