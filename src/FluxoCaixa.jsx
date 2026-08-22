import { useMemo, useState } from "react";
import { fmtMoeda, fmtData } from "./utils";
import { gerarRecebiveis, projecoes, porCompetencia, rotuloComp, NOMES_MES, compDe } from "./fluxo";
import {
  projecaoAnual, churnHistorico, churnReceita,
  metricasCarteira, calcularLTV, scoreRisco,
} from "./churnEngine.js";

/* ============================================================
   Painel Financeiro.

   Duas camadas: a estratégica (projeção, churn, LTV, risco,
   concentração) e a operacional (recebíveis, vencimentos,
   status). O filtro de churn atravessa as duas.
   ============================================================ */

const fmtPct = (v) => (v == null ? "—" : `${Number(v).toFixed(1)}%`);
const fmtK = (v) => {
  const n = Number(v) || 0;
  if (n >= 1000000) return `R$ ${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return fmtMoeda(n);
};

/* ---------- Indicador ---------- */
function Kpi({ rot, valor, sub, tom, alerta }) {
  return (
    <div className={`pf-kpi ${tom ? "pf-t-" + tom : ""}`}>
      <span className="pf-kpi-l">{rot}</span>
      <span className={`pf-kpi-v ${alerta ? "pf-kpi-alerta" : ""}`}>{valor}</span>
      {sub && <span className="pf-kpi-s">{sub}</span>}
    </div>
  );
}

function Card({ titulo, sub, acao, children }) {
  return (
    <section className="pf-card">
      <div className="pf-card-h">
        <div><h3>{titulo}</h3>{sub && <span className="pf-sub">{sub}</span>}</div>
        {acao}
      </div>
      {children}
    </section>
  );
}

/* ---------- Gráfico anual: bruto x ajustado ---------- */
function GraficoAnual({ linhas, comChurn }) {
  const max = Math.max(...linhas.map((l) => l.bruto), 1);
  return (
    <div className="pf-anual">
      {linhas.map((l) => {
        const hBruto = (l.bruto / max) * 100;
        const hAjust = (l.ajustado / max) * 100;
        return (
          <div key={l.competencia} className="pf-mes">
            <div className="pf-mes-barras">
              {comChurn && (
                <div className="pf-b-bruto" style={{ height: `${hBruto}%` }} title={`Bruto: ${fmtMoeda(l.bruto)}`} />
              )}
              <div className={`pf-b-real ${comChurn ? "" : "pf-b-sozinho"}`}
                style={{ height: `${comChurn ? hAjust : hBruto}%` }}
                title={`${comChurn ? "Ajustado" : "Projetado"}: ${fmtMoeda(comChurn ? l.ajustado : l.bruto)}`} />
            </div>
            <span className="pf-mes-v">{fmtK(comChurn ? l.ajustado : l.bruto)}</span>
            <span className="pf-mes-n">{NOMES_MES[l.mes]}</span>
            {comChurn && l.pctPerda > 1 && <span className="pf-mes-p">-{l.pctPerda.toFixed(0)}%</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function FluxoCaixa({ clientes, recebiveis, desempenho, onMarcarPago, onToast, onAbrirCliente }) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mesSel, setMesSel] = useState(hoje.getMonth());
  const [busy, setBusy] = useState(false);
  const [comChurn, setComChurn] = useState(true);
  const [modoProj, setModoProj] = useState("avancado");

  const cliById = useMemo(() => Object.fromEntries((clientes || []).map((c) => [c.id, c])), [clientes]);

  const pagosPorChave = useMemo(() => {
    const m = {};
    (recebiveis || []).forEach((r) => { m[`${r.clienteId}|${r.competencia}`] = r; });
    return m;
  }, [recebiveis]);

  const proj = useMemo(() => projecoes(clientes || [], hoje), [clientes]); // eslint-disable-line

  /* ---------- Métricas estratégicas ---------- */
  const M = useMemo(() => metricasCarteira(clientes || []), [clientes]);
  const churnCli = useMemo(() => churnHistorico(clientes || []), [clientes]);
  const churnRec = useMemo(() => churnReceita(clientes || []), [clientes]);
  const ltv = useMemo(
    () => calcularLTV(M.ticketMedio, churnRec.taxaMedia, { confiavel: churnRec.confiavel && churnRec.taxaMedia > 0 }),
    [M.ticketMedio, churnRec]
  );

  const PA = useMemo(() => {
    const dp = {};
    (desempenho || []).forEach((d) => { if (d.competencia === compDe(hoje)) dp[d.clienteId] = d; });
    return projecaoAnual(clientes || [], recebiveis || [], {
      modo: modoProj, taxaChurn: churnRec.taxaMedia, desempPorCliente: dp,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, recebiveis, desempenho, modoProj, churnRec.taxaMedia]);

  /* Risco por cliente, com participação e impacto */
  const risco = useMemo(() => {
    const ativos = (clientes || []).filter((c) => c.ativo);
    const lista = ativos.map((c) => {
      const r = PA.riscos[c.id] || scoreRisco(c, recebiveis || []);
      const ticket = Number(c.ticket) || 0;
      return {
        cliente: c, ...r, ticket,
        participacao: M.receita > 0 ? (ticket / M.receita) * 100 : 0,
        impacto: ticket,
      };
    }).sort((a, b) => b.score - a.score);
    const emRisco = lista.filter((x) => x.score > 45);
    return {
      lista, emRisco,
      receitaEmRisco: emRisco.reduce((a, x) => a + x.ticket, 0),
      emAberto: lista.reduce((a, x) => a + (x.historico?.valorEmAberto || 0), 0),
    };
  }, [clientes, recebiveis, PA.riscos, M.receita]);

  /* ---------- Operacional ---------- */
  const ocorrenciasAno = useMemo(
    () => gerarRecebiveis(clientes || [], new Date(ano, 0, 1), new Date(ano, 11, 31)),
    [clientes, ano]
  );
  const totaisMes = useMemo(() => porCompetencia(ocorrenciasAno), [ocorrenciasAno]);
  const totalAno = Object.values(totaisMes).reduce((a, b) => a + b, 0);

  const compSel = `${ano}-${String(mesSel + 1).padStart(2, "0")}`;
  const doMes = useMemo(
    () => ocorrenciasAno.filter((o) => o.competencia === compSel),
    [ocorrenciasAno, compSel]
  );
  const totalMes = doMes.reduce((a, o) => a + o.valor, 0);
  const recebidoMes = doMes.reduce((acc, o) => {
    const r = pagosPorChave[`${o.clienteId}|${o.competencia}`];
    return acc + (r?.pago ? (Number(r.valor) || o.valor) : 0);
  }, 0);
  const pendenteMes = totalMes - recebidoMes;

  /* Vencendo na semana e vencidos */
  const opMes = useMemo(() => {
    const hj = hoje.toISOString().slice(0, 10);
    const fimSemana = new Date(hoje); fimSemana.setDate(hoje.getDate() + 7);
    const fim = fimSemana.toISOString().slice(0, 10);
    let venceSemana = 0, vencidos = 0;
    doMes.forEach((o) => {
      const r = pagosPorChave[`${o.clienteId}|${o.competencia}`];
      if (r?.pago) return;
      const d = o.data || `${o.competencia}-10`;
      if (d < hj) vencidos += o.valor;
      else if (d <= fim) venceSemana += o.valor;
    });
    return {
      venceSemana, vencidos,
      taxaRecebimento: totalMes > 0 ? (recebidoMes / totalMes) * 100 : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doMes, pagosPorChave, totalMes, recebidoMes]);

  /* Fator de churn aplicado aos meses futuros do calendário */
  const fatorChurn = (comp) => {
    if (!comChurn) return 1;
    const l = PA.linhas.find((x) => x.competencia === comp);
    if (!l || l.bruto === 0) return 1;
    return l.ajustado / l.bruto;
  };

  async function alternarPago(o) {
    const chave = `${o.clienteId}|${o.competencia}`;
    const atual = pagosPorChave[chave];
    setBusy(true);
    try { await onMarcarPago(o, !atual?.pago); }
    catch (e) { onToast("Erro: " + e.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Painel Financeiro</h1>
          <p>Projeção, risco da carteira e controle de recebíveis.</p>
        </div>
        <div className="head-actions">
          <label className="pf-toggle">
            <input type="checkbox" checked={comChurn} onChange={(e) => setComChurn(e.target.checked)} />
            <span className="pf-switch" />
            Considerar churn
          </label>
        </div>
      </div>

      {/* ══ 1. KPIs executivos ══ */}
      <div className="pf-kpis">
        <Kpi rot="Receita recorrente ativa" valor={fmtMoeda(M.receita)}
          sub={`${M.comTicket} cliente${M.comTicket !== 1 ? "s" : ""} com ticket`} tom="ok" />
        <Kpi rot="Ticket médio" valor={fmtMoeda(M.ticketMedio)} />
        <Kpi rot="Churn de clientes" valor={churnCli.confiavel ? fmtPct(churnCli.taxaMedia) : "—"}
          sub={churnCli.confiavel ? "média dos 6 meses" : "sem histórico"}
          tom={churnCli.taxaMedia > 5 ? "err" : "ok"} />
        <Kpi rot="Churn de receita" valor={churnRec.confiavel ? fmtPct(churnRec.taxaMedia) : "—"}
          sub={churnRec.perdidaTotal > 0 ? `${fmtMoeda(churnRec.perdidaTotal)} perdidos` : "nenhuma perda"}
          tom={churnRec.taxaMedia > 5 ? "err" : "ok"} />
        <Kpi rot="LTV" valor={ltv.valor ? fmtMoeda(ltv.valor) : "—"}
          sub={ltv.valor ? `vida média de ${ltv.meses.toFixed(0)} meses` : ltv.motivo} />
        <Kpi rot="Projeção do mês" valor={fmtMoeda(proj.mes)} sub={`semana: ${fmtK(proj.semana)}`} />
        <Kpi rot="Projeção do semestre" valor={fmtMoeda(proj.semestre)} />
        <Kpi rot="Projeção do ano" valor={fmtMoeda(proj.ano)} sub={String(hoje.getFullYear())} />
      </div>

      {/* ══ 2. Projeção anualizada ══ */}
      <Card titulo="Projeção financeira — próximos 12 meses"
        sub={comChurn
          ? `receita ajustada pela probabilidade de saída${modoProj === "simples" ? " (churn médio da carteira)" : " (risco individual por cliente)"}`
          : "receita bruta, sem desconto de churn"}
        acao={
          <select className="select" style={{ width: "auto" }} value={modoProj} onChange={(e) => setModoProj(e.target.value)}>
            <option value="avancado">Risco individual</option>
            <option value="simples">Churn médio</option>
          </select>
        }>
        <div className="pf-resumo">
          <div><span>Receita bruta projetada</span><strong>{fmtMoeda(PA.totalBruto)}</strong></div>
          <div><span>Receita ajustada por churn</span><strong className="pf-ok">{fmtMoeda(PA.totalAjustado)}</strong></div>
          <div><span>Perda esperada por churn</span><strong className="pf-ruim">{fmtMoeda(PA.perdaTotal)}<em> ({fmtPct(PA.pctPerdaTotal)})</em></strong></div>
          <div><span>Clientes ativos</span><strong>{M.ativos}<em> · ticket {fmtK(M.ticketMedio)}</em></strong></div>
        </div>

        <GraficoAnual linhas={PA.linhas} comChurn={comChurn} />

        {comChurn && (
          <div className="pf-legenda">
            <span><i className="pf-l-bruto" />Receita bruta projetada</span>
            <span><i className="pf-l-real" />Ajustada por churn</span>
          </div>
        )}

        {!churnRec.confiavel && (
          <p className="pf-nota">
            Histórico insuficiente para calcular o churn da carteira com confiança.
            A projeção usa o risco individual de cada cliente — inadimplência, NPS e tempo de casa.
            Assim que houver saídas registradas no cadastro, a taxa histórica passa a ser considerada.
          </p>
        )}
      </Card>

      {/* ══ 3. Fluxo operacional do mês ══ */}
      <Card titulo={`Fluxo operacional — ${rotuloComp(compSel)}`}
        sub="situação dos recebíveis do mês selecionado">
        <div className="pf-op">
          <div><span>Previsto</span><strong>{fmtMoeda(totalMes)}</strong></div>
          <div><span>Recebido</span><strong className="pf-ok">{fmtMoeda(recebidoMes)}</strong></div>
          <div><span>Pendente</span><strong className={pendenteMes > 0 ? "pf-atencao" : ""}>{fmtMoeda(pendenteMes)}</strong></div>
          <div><span>Vencendo em 7 dias</span><strong>{fmtMoeda(opMes.venceSemana)}</strong></div>
          <div><span>Vencidos</span><strong className={opMes.vencidos > 0 ? "pf-ruim" : ""}>{fmtMoeda(opMes.vencidos)}</strong></div>
          <div><span>Taxa de recebimento</span><strong>{opMes.taxaRecebimento != null ? fmtPct(opMes.taxaRecebimento) : "—"}</strong></div>
        </div>
      </Card>

      {/* ══ 4. Risco da carteira ══ */}
      <Card titulo="Risco da carteira"
        sub={`${risco.emRisco.length} de ${risco.lista.length} clientes exigem atenção · ${fmtMoeda(risco.receitaEmRisco)} de receita em risco${risco.emAberto > 0 ? ` · ${fmtMoeda(risco.emAberto)} em aberto` : ""}`}>
        {risco.lista.length === 0 ? (
          <p className="pf-vazio">Nenhum cliente ativo para avaliar.</p>
        ) : (
          <div className="pf-tabela-wrap">
            <table className="pf-tabela">
              <thead>
                <tr>
                  <th>Cliente</th><th>Situação</th>
                  <th className="pf-num">Ticket</th><th className="pf-num">Participação</th>
                  <th className="pf-num">Em aberto</th><th className="pf-num">Impacto se sair</th>
                  <th>Motivos</th>
                </tr>
              </thead>
              <tbody>
                {risco.lista.slice(0, 15).map((x) => (
                  <tr key={x.cliente.id} onClick={() => onAbrirCliente && onAbrirCliente(x.cliente)}>
                    <td className="pf-nome">{x.cliente.nome}</td>
                    <td>
                      <span className={`pf-badge tom-${x.faixa.tom}`}>{x.faixa.rot}</span>
                      <span className="pf-score">{x.score}</span>
                    </td>
                    <td className="pf-num">{fmtMoeda(x.ticket)}</td>
                    <td className="pf-num">
                      <div className="pf-part">
                        <div className="pf-part-barra" style={{ width: `${Math.min(x.participacao * 3, 100)}%` }} />
                        <span>{fmtPct(x.participacao)}</span>
                      </div>
                    </td>
                    <td className={`pf-num ${x.historico?.valorEmAberto > 0 ? "pf-ruim" : "pf-suave"}`}>
                      {x.historico?.valorEmAberto > 0 ? fmtMoeda(x.historico.valorEmAberto) : "—"}
                    </td>
                    <td className={`pf-num ${x.score > 45 ? "pf-ruim" : "pf-suave"}`}>
                      -{fmtMoeda(x.impacto)}<em>/mês</em>
                    </td>
                    <td className="pf-motivos">
                      {x.motivos.length === 0
                        ? <span className="pf-nada">sem apontamentos</span>
                        : x.motivos.slice(0, 2).map((m, i) => <span key={i} className="pf-motivo">{m}</span>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ══ 5. Concentração da receita ══ */}
      <Card titulo="Participação no faturamento"
        sub={M.concentracaoAlta
          ? `atenção: os 5 maiores concentram ${fmtPct(M.concentracaoTop5)} da receita`
          : `os 5 maiores representam ${fmtPct(M.concentracaoTop5)} da receita`}>
        {M.ranking.length === 0 ? (
          <p className="pf-vazio">Nenhum cliente com ticket cadastrado.</p>
        ) : (
          <div className="pf-conc">
            {M.ranking.slice(0, 8).map((x, i) => (
              <div key={x.cliente.id} className="pf-conc-linha" onClick={() => onAbrirCliente && onAbrirCliente(x.cliente)}>
                <span className="pf-conc-pos">{i + 1}</span>
                <span className="pf-conc-nome">{x.cliente.nome}</span>
                <div className="pf-conc-trilha">
                  <div className="pf-conc-barra" style={{ width: `${(x.participacao / (M.ranking[0]?.participacao || 1)) * 100}%` }} />
                </div>
                <span className="pf-conc-val">{fmtMoeda(x.ticket)}</span>
                <span className="pf-conc-pct">{fmtPct(x.participacao)}</span>
              </div>
            ))}
            {M.ranking.length > 8 && (
              <p className="pf-nota">
                Outros {M.ranking.length - 8} clientes somam {fmtPct(M.ranking.slice(8).reduce((a, x) => a + x.participacao, 0))} da receita.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* calendário anual */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="fluxo-head">
          <h3 className="dash-title" style={{ margin: 0 }}>Recebíveis por mês — {ano}</h3>
          <div className="fluxo-nav">
            <button className="btn btn-sm" onClick={() => setAno((a) => a - 1)}>‹ {ano - 1}</button>
            <span className="fluxo-total">Total do ano: <strong>{fmtMoeda(totalAno)}</strong></span>
            <button className="btn btn-sm" onClick={() => setAno((a) => a + 1)}>{ano + 1} ›</button>
          </div>
        </div>
        <div className="meses-grid">
          {NOMES_MES.map((nome, i) => {
            const comp = `${ano}-${String(i + 1).padStart(2, "0")}`;
            const valor = totaisMes[comp] || 0;
            const ativo = i === mesSel;
            const eAtual = ano === hoje.getFullYear() && i === hoje.getMonth();
            return (
              <button key={comp} className={`mes-card ${ativo ? "on" : ""} ${eAtual ? "atual" : ""}`} onClick={() => setMesSel(i)}>
                <span className="mes-nome">{nome.slice(0, 3)}</span>
                <span className="mes-valor">{valor ? fmtMoeda(valor) : "—"}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* detalhe do mês selecionado */}
      <div className="fluxo-resumo">
        <div className="fr-item"><span>Previsto</span><strong>{fmtMoeda(totalMes)}</strong></div>
        <div className="fr-item ok"><span>Recebido</span><strong>{fmtMoeda(recebidoMes)}</strong></div>
        <div className="fr-item pend"><span>Pendente</span><strong>{fmtMoeda(pendenteMes)}</strong></div>
      </div>

      <h3 className="dash-title" style={{ marginTop: 20 }}>Detalhe de {rotuloComp(compSel)}</h3>
      {doMes.length === 0 ? (
        <div className="card"><div className="empty">
          <h3>Nenhum recebível neste mês</h3>
          <p>Cadastre o ticket e a recorrência dos clientes para o calendário se preencher.</p>
        </div></div>
      ) : (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr><th>Vencimento</th><th>Cliente</th><th>Valor</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {doMes.map((o) => {
                const r = pagosPorChave[`${o.clienteId}|${o.competencia}`];
                const pago = !!r?.pago;
                return (
                  <tr key={`${o.clienteId}-${o.competencia}`}>
                    <td className="cell-num">{fmtData(`${o.data.getFullYear()}-${String(o.data.getMonth() + 1).padStart(2, "0")}-${String(o.data.getDate()).padStart(2, "0")}`)}</td>
                    <td className="cell-cliente">{cliById[o.clienteId]?.nome || "—"}</td>
                    <td className="cell-num">{fmtMoeda(r?.valor ?? o.valor)}</td>
                    <td>
                      <span className={`badge ${pago ? "badge-ok" : "badge-aten"}`}>
                        <span className="dot" /> {pago ? "Recebido" : "Pendente"}
                      </span>
                    </td>
                    <td>
                      <button className={`btn btn-sm ${pago ? "" : "btn-primary"}`} disabled={busy} onClick={() => alternarPago(o)}>
                        {pago ? "Desmarcar" : "Marcar recebido"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
