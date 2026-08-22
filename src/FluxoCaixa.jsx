import { useMemo, useState } from "react";
import { fmtMoeda, fmtData } from "./utils";
import { Icon } from "./components.jsx";
import { gerarRecebiveis, projecoes, porCompetencia, rotuloComp, NOMES_MES, compDe } from "./fluxo";
import { projetarComChurn, churnHistorico, scoreRisco } from "./churnEngine.js";

export default function FluxoCaixa({ clientes, recebiveis, desempenho, onMarcarPago, onToast, onAbrirCliente }) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mesSel, setMesSel] = useState(hoje.getMonth());
  const [busy, setBusy] = useState(false);

  const cliById = useMemo(() => Object.fromEntries((clientes || []).map((c) => [c.id, c])), [clientes]);

  // marcações de pagamento existentes, indexadas por cliente+competência
  const pagosPorChave = useMemo(() => {
    const m = {};
    (recebiveis || []).forEach((r) => { m[`${r.clienteId}|${r.competencia}`] = r; });
    return m;
  }, [recebiveis]);

  // ---- projeções ----
  const proj = useMemo(() => projecoes(clientes || [], hoje), [clientes]); // eslint-disable-line

  /* Projeção descontando o risco de saída de cada cliente */
  const [mesesProj, setMesesProj] = useState(6);
  const churn = useMemo(() => churnHistorico(clientes || []), [clientes]);
  const PC = useMemo(() => {
    const dp = {};
    (desempenho || []).forEach((d) => { if (d.competencia === compDe(hoje)) dp[d.clienteId] = d; });
    return projetarComChurn(clientes || [], recebiveis || [], { meses: mesesProj, desempPorCliente: dp });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, recebiveis, desempenho, mesesProj]);

  const carteiraRisco = useMemo(() => {
    const ativos = (clientes || []).filter((c) => c.ativo);
    const lista = ativos.map((c) => ({ cliente: c, ...PC.riscos[c.id] })).filter((x) => x.score != null);
    return {
      lista: lista.sort((a, b) => b.score - a.score),
      emRisco: lista.filter((x) => x.score > 45),
      receitaEmRisco: lista.filter((x) => x.score > 45).reduce((a, x) => a + (Number(x.cliente.ticket) || 0), 0),
      inadimplencia: lista.reduce((a, x) => a + (x.historico?.valorEmAberto || 0), 0),
    };
  }, [clientes, PC.riscos]);

  // ---- ano inteiro (para o resumo mensal) ----
  const ocorrenciasAno = useMemo(
    () => gerarRecebiveis(clientes || [], new Date(ano, 0, 1), new Date(ano, 11, 31)),
    [clientes, ano]
  );
  const totaisMes = useMemo(() => porCompetencia(ocorrenciasAno), [ocorrenciasAno]);
  const totalAno = Object.values(totaisMes).reduce((a, b) => a + b, 0);

  // ---- mês selecionado (detalhe) ----
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

  async function alternarPago(o) {
    const chave = `${o.clienteId}|${o.competencia}`;
    const atual = pagosPorChave[chave];
    setBusy(true);
    try {
      await onMarcarPago({
        clienteId: o.clienteId,
        competencia: o.competencia,
        valor: atual?.valor ?? o.valor,
        pago: !atual?.pago,
        dataPagamento: !atual?.pago ? new Date().toISOString().split("T")[0] : null,
      });
      onToast(!atual?.pago ? "Marcado como recebido" : "Marcado como pendente");
    } catch (e) {
      onToast("Erro: " + (e.message || "falha ao salvar"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Fluxo de Caixa</h1>
          <p>Recebíveis gerados automaticamente a partir dos clientes e seus tickets.</p>
        </div>
      </div>

      {/* projeções */}
      <div className="tiles">
        <div className="tile"><div className="label">Projeção semana</div><div className="value" style={{ fontSize: 21 }}>{fmtMoeda(proj.semana)}</div><div className="hint">semana atual</div></div>
        <div className="tile"><div className="label">Projeção mês</div><div className="value" style={{ fontSize: 21 }}>{fmtMoeda(proj.mes)}</div><div className="hint">mês atual</div></div>
        <div className="tile"><div className="label">Projeção semestre</div><div className="value" style={{ fontSize: 21 }}>{fmtMoeda(proj.semestre)}</div><div className="hint">semestre atual</div></div>
        <div className="tile"><div className="label">Projeção ano</div><div className="value" style={{ fontSize: 21 }}>{fmtMoeda(proj.ano)}</div><div className="hint">{hoje.getFullYear()}</div></div>
      </div>

      {/* ══ Projeção ajustada pelo churn ══ */}
      <section className="fc-card">
        <div className="fc-card-h">
          <div>
            <h3>Projeção com churn</h3>
            <span className="fc-sub">
              receita esperada descontando a probabilidade de saída de cada cliente
              {churn.confiavel && ` · churn histórico de ${churn.taxaMedia.toFixed(1)}% ao mês`}
            </span>
          </div>
          <select className="select" style={{ width: "auto" }} value={mesesProj}
            onChange={(e) => setMesesProj(Number(e.target.value))}>
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
          </select>
        </div>

        <div className="fc-resumo">
          <div><span>Receita bruta projetada</span><strong>{fmtMoeda(PC.totalBruto)}</strong></div>
          <div><span>Ajustada pelo risco</span><strong className="fc-ok">{fmtMoeda(PC.totalAjustado)}</strong></div>
          <div>
            <span>Perda esperada</span>
            <strong className="fc-ruim">
              {fmtMoeda(PC.totalBruto - PC.totalAjustado)}
              {PC.totalBruto > 0 && <em> ({(((PC.totalBruto - PC.totalAjustado) / PC.totalBruto) * 100).toFixed(1)}%)</em>}
            </strong>
          </div>
          <div><span>Receita em risco hoje</span><strong className="fc-atencao">{fmtMoeda(carteiraRisco.receitaEmRisco)}</strong></div>
        </div>

        <div className="fc-barras">
          {PC.linhas.map((l, i) => {
            const max = Math.max(...PC.linhas.map((x) => x.bruto), 1);
            return (
              <div key={l.competencia} className="fc-barra-col">
                <div className="fc-barra-pilha">
                  <div className="fc-barra-bruto" style={{ height: `${(l.bruto / max) * 100}%` }}>
                    <div className="fc-barra-real" style={{ height: `${l.bruto > 0 ? (l.ajustado / l.bruto) * 100 : 0}%` }} />
                  </div>
                </div>
                <span className="fc-barra-val">{fmtMoeda(l.ajustado)}</span>
                <span className="fc-barra-mes">{NOMES_MES[l.mes]}</span>
                {l.pctPerda > 0.5 && <span className="fc-barra-perda">-{l.pctPerda.toFixed(0)}%</span>}
              </div>
            );
          })}
        </div>
        <div className="fc-legenda">
          <span><i className="fc-l-bruto" />Projeção bruta</span>
          <span><i className="fc-l-real" />Ajustada pelo risco de saída</span>
        </div>

        {!churn.confiavel && (
          <p className="fc-nota">
            Ainda não há histórico de saídas suficiente para calcular o churn da carteira.
            A projeção usa o risco individual de cada cliente — inadimplência, NPS e tempo de casa.
          </p>
        )}
      </section>

      {/* ══ Risco por cliente ══ */}
      <section className="fc-card">
        <div className="fc-card-h">
          <div>
            <h3>Risco por cliente</h3>
            <span className="fc-sub">
              {carteiraRisco.emRisco.length} de {carteiraRisco.lista.length} clientes exigem atenção
              {carteiraRisco.inadimplencia > 0 && ` · ${fmtMoeda(carteiraRisco.inadimplencia)} em aberto`}
            </span>
          </div>
        </div>

        {carteiraRisco.lista.length === 0 ? (
          <p className="fc-vazio">Nenhum cliente ativo para avaliar.</p>
        ) : (
          <div className="fc-tabela-wrap">
            <table className="fc-tabela">
              <thead>
                <tr>
                  <th>Cliente</th><th>Situação</th><th>Motivos</th>
                  <th className="fc-num">Ticket</th><th className="fc-num">Em aberto</th>
                  <th className="fc-num">Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {carteiraRisco.lista.slice(0, 12).map((x) => (
                  <tr key={x.cliente.id} onClick={() => onAbrirCliente && onAbrirCliente(x.cliente)}>
                    <td className="fc-nome">{x.cliente.nome}</td>
                    <td>
                      <span className={`fc-badge tom-${x.faixa.tom}`}>{x.faixa.rot}</span>
                      <span className="fc-score">{x.score}</span>
                    </td>
                    <td className="fc-motivos">
                      {x.motivos.length === 0
                        ? <span className="fc-nada">sem apontamentos</span>
                        : x.motivos.slice(0, 2).map((m, i) => <span key={i} className="fc-motivo">{m}</span>)}
                    </td>
                    <td className="fc-num">{fmtMoeda(Number(x.cliente.ticket) || 0)}</td>
                    <td className={`fc-num ${x.historico.valorEmAberto > 0 ? "fc-ruim" : ""}`}>
                      {x.historico.valorEmAberto > 0 ? fmtMoeda(x.historico.valorEmAberto) : "—"}
                    </td>
                    <td className="fc-num fc-suave">
                      {x.historico.taxaPagamento != null
                        ? `${x.historico.taxaPagamento.toFixed(0)}%`
                        : "sem histórico"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
