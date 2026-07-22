import { useMemo, useState, useEffect } from "react";
import { calcTaxas, corTaxa } from "./taxas";
import { Icon } from "./components.jsx";

function TaxaChip({ label, pct }) {
  return (
    <div className="taxa-chip">
      <span className="taxa-chip-label">{label}</span>
      <span className="taxa-chip-val" style={{ color: corTaxa(pct) }}>
        {pct == null ? "—" : `${pct}%`}
      </span>
      <div className="taxa-chip-bar">
        <div className="taxa-chip-fill" style={{ width: pct == null ? "0%" : `${Math.min(pct, 100)}%`, background: corTaxa(pct) }} />
      </div>
    </div>
  );
}

// Linha editável de um cliente no painel
function LinhaPainel({ cliente, registro, onSalvar, busy }) {
  const [captados, setCaptados] = useState(registro?.captados ?? "");
  const [qualificados, setQualificados] = useState(registro?.qualificados ?? "");
  const [fechados, setFechados] = useState(registro?.fechados ?? "");
  const [sujo, setSujo] = useState(false);

  // sincroniza quando o registro muda por fora (realtime)
  useEffect(() => {
    if (sujo) return; // não sobrescreve o que o usuário está digitando
    setCaptados(registro?.captados ?? "");
    setQualificados(registro?.qualificados ?? "");
    setFechados(registro?.fechados ?? "");
  }, [registro?.captados, registro?.qualificados, registro?.fechados]); // eslint-disable-line

  const taxas = calcTaxas({ captados, qualificados, fechados });
  const alterar = (setter) => (e) => { setter(e.target.value); setSujo(true); };

  function salvar() {
    onSalvar({ clienteId: cliente.id, captados, qualificados, fechados });
    setSujo(false);
  }

  return (
    <tr>
      <td className="cell-cliente">{cliente.nome}</td>
      <td><input type="number" min="0" className="input input-num" value={captados} onChange={alterar(setCaptados)} placeholder="0" /></td>
      <td><input type="number" min="0" className="input input-num" value={qualificados} onChange={alterar(setQualificados)} placeholder="0" /></td>
      <td><input type="number" min="0" className="input input-num" value={fechados} onChange={alterar(setFechados)} placeholder="0" /></td>
      <td><span style={{ color: corTaxa(taxas.qualificacao), fontWeight: 700 }}>{taxas.qualificacao == null ? "—" : `${taxas.qualificacao}%`}</span></td>
      <td><span style={{ color: corTaxa(taxas.fechamento), fontWeight: 700 }}>{taxas.fechamento == null ? "—" : `${taxas.fechamento}%`}</span></td>
      <td><span style={{ color: corTaxa(taxas.conversao), fontWeight: 700 }}>{taxas.conversao == null ? "—" : `${taxas.conversao}%`}</span></td>
      <td>
        <button className={`btn btn-sm ${sujo ? "btn-primary" : ""}`} onClick={salvar} disabled={busy || !sujo}>
          {sujo ? "Salvar" : "Salvo"}
        </button>
      </td>
    </tr>
  );
}

export default function Painel({ clientes, painel, onSalvar, onToast }) {
  const [busy, setBusy] = useState(false);
  const ativos = useMemo(() => clientes.filter((c) => c.ativo), [clientes]);
  const painelPorCliente = useMemo(
    () => Object.fromEntries((painel || []).map((p) => [p.clienteId, p])),
    [painel]
  );

  // totais agregados
  const totais = useMemo(() => {
    let cap = 0, qua = 0, fec = 0;
    ativos.forEach((c) => {
      const r = painelPorCliente[c.id];
      if (r) { cap += r.captados || 0; qua += r.qualificados || 0; fec += r.fechados || 0; }
    });
    return { cap, qua, fec, taxas: calcTaxas({ captados: cap, qualificados: qua, fechados: fec }) };
  }, [ativos, painelPorCliente]);

  async function salvar(dados) {
    setBusy(true);
    try {
      await onSalvar(dados);
      onToast("Painel atualizado");
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
          <h1>Painel</h1>
          <p>Lance os números de leads de cada cliente ativo. As taxas são calculadas automaticamente.</p>
        </div>
      </div>

      {/* taxas gerais */}
      <div className="taxa-chips">
        <TaxaChip label="Taxa de qualificação (geral)" pct={totais.taxas.qualificacao} />
        <TaxaChip label="Taxa de fechamento (geral)" pct={totais.taxas.fechamento} />
        <TaxaChip label="Taxa de conversão total (geral)" pct={totais.taxas.conversao} />
      </div>

      {ativos.length === 0 ? (
        <div className="card"><div className="empty">
          <h3>Nenhum cliente ativo</h3>
          <p>Ative clientes na aba Cadastros para lançar os números aqui.</p>
        </div></div>
      ) : (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Leads captados</th>
                <th>Leads qualificados</th>
                <th>Leads fechados</th>
                <th>Qualificação</th>
                <th>Fechamento</th>
                <th>Conversão</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ativos.map((c) => (
                <LinhaPainel
                  key={c.id}
                  cliente={c}
                  registro={painelPorCliente[c.id]}
                  onSalvar={salvar}
                  busy={busy}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="painel-total">
                <td>Total</td>
                <td>{totais.cap}</td>
                <td>{totais.qua}</td>
                <td>{totais.fec}</td>
                <td style={{ color: corTaxa(totais.taxas.qualificacao), fontWeight: 700 }}>{totais.taxas.qualificacao == null ? "—" : `${totais.taxas.qualificacao}%`}</td>
                <td style={{ color: corTaxa(totais.taxas.fechamento), fontWeight: 700 }}>{totais.taxas.fechamento == null ? "—" : `${totais.taxas.fechamento}%`}</td>
                <td style={{ color: corTaxa(totais.taxas.conversao), fontWeight: 700 }}>{totais.taxas.conversao == null ? "—" : `${totais.taxas.conversao}%`}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
