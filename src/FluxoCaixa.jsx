import { useMemo, useState } from "react";
import { fmtMoeda, fmtData } from "./utils";
import { Icon } from "./components.jsx";
import { gerarRecebiveis, projecoes, porCompetencia, rotuloComp, NOMES_MES, compDe } from "./fluxo";

export default function FluxoCaixa({ clientes, recebiveis, onMarcarPago, onToast }) {
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
