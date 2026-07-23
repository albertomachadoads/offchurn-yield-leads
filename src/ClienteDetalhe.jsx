import { useMemo } from "react";
import { fmtMoeda, fmtData } from "./utils";
import { Icon } from "./components.jsx";
import { Avatar } from "./Clientes.jsx";
import {
  projecaoVerba, projecaoCPA, corVerba, corCPA,
  tempoDeCasa, faixaNPS, competencia,
} from "./projecao";
import { calcTaxas, corTaxa } from "./taxas";

function Info({ label, valor, cor }) {
  return (
    <div className="info-item">
      <span className="info-label">{label}</span>
      <span className="info-valor" style={cor ? { color: cor } : undefined}>{valor ?? "—"}</span>
    </div>
  );
}

export default function ClienteDetalhe({
  cliente, gestById, desempenho, tarefas, pessoas, painel, acompanhamentos, onVoltar, onEditar, isAdmin,
}) {
  const comp = competencia();
  const desemp = useMemo(
    () => (desempenho || []).find((d) => d.clienteId === cliente.id && d.competencia === comp),
    [desempenho, cliente.id, comp]
  );

  const pv = projecaoVerba(cliente.verbaMensal, desemp?.gasto);
  const pc = projecaoCPA(cliente.cpaMeta, desemp?.gasto, desemp?.leads);
  const nps = faixaNPS(cliente.nps);
  const tempo = tempoDeCasa(cliente.dataEntrada);

  const pesById = useMemo(() => Object.fromEntries((pessoas || []).map((p) => [p.id, p])), [pessoas]);

  const tarefasCliente = useMemo(
    () => (tarefas || [])
      .filter((t) => t.clienteId === cliente.id)
      .sort((a, b) => ((b.dataCriacao || b.data) < (a.dataCriacao || a.data) ? -1 : 1)),
    [tarefas, cliente.id]
  );

  const registroPainel = useMemo(
    () => (painel || []).find((p) => p.clienteId === cliente.id),
    [painel, cliente.id]
  );
  const taxas = registroPainel ? calcTaxas(registroPainel) : null;

  const acompCliente = useMemo(
    () => (acompanhamentos || [])
      .filter((a) => a.clienteId === cliente.id)
      .sort((a, b) => (a.data < b.data ? 1 : -1))
      .slice(0, 5),
    [acompanhamentos, cliente.id]
  );

  const abertas = tarefasCliente.filter((t) => t.etapa !== "Concluída" && t.etapa !== "Cancelada").length;

  return (
    <>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button className="btn btn-sm btn-ghost" onClick={onVoltar}>‹ Voltar</button>
          <Avatar nome={cliente.nome} size={52} />
          <div>
            <h1 style={{ margin: 0 }}>{cliente.nome}</h1>
            <p style={{ margin: 0 }}>
              {cliente.nicho || "sem nicho"}
              {tempo && <> · na agência há {tempo}</>}
              {!cliente.ativo && <> · <span className="pill off">Inativo</span></>}
            </p>
          </div>
        </div>
        <div className="head-actions">
          {cliente.linkDrive && (
            <a className="btn" href={cliente.linkDrive} target="_blank" rel="noopener noreferrer">
              <Icon.Folder /> Drive do cliente
            </a>
          )}
          {isAdmin && <button className="btn btn-primary" onClick={() => onEditar(cliente)}><Icon.Edit /> Editar cadastro</button>}
        </div>
      </div>

      {/* indicadores do mês */}
      <div className="tiles">
        <div className="tile">
          <div className="label">Verba do mês</div>
          <div className="value" style={{ fontSize: 20, color: pv ? corVerba(pv.status) : "inherit" }}>
            {pv ? fmtMoeda(pv.gasto) : "—"}
          </div>
          <div className="hint">{pv ? `de ${fmtMoeda(pv.verba)} · esperado ${fmtMoeda(pv.esperado)}` : "verba não definida"}</div>
        </div>
        <div className="tile">
          <div className="label">CPA do mês</div>
          <div className="value" style={{ fontSize: 20, color: pc && pc.cpaReal != null ? corCPA(pc.status) : "inherit" }}>
            {pc && pc.cpaReal != null ? fmtMoeda(pc.cpaReal) : "—"}
          </div>
          <div className="hint">{pc ? `alvo ${fmtMoeda(pc.alvo)}` : "CPA alvo não definido"}</div>
        </div>
        <div className="tile">
          <div className="label">NPS</div>
          <div className="value" style={{ color: nps.cor }}>{cliente.nps ?? "—"}</div>
          <div className="hint">{nps.label}</div>
        </div>
        <div className="tile">
          <div className="label">Tarefas abertas</div>
          <div className="value">{abertas}</div>
          <div className="hint">de {tarefasCliente.length} no total</div>
        </div>
      </div>

      <div className="det-grid">
        {/* dados de cadastro */}
        <div className="card card-pad">
          <h3 className="dash-title">Dados de cadastro</h3>
          <div className="info-grid">
            <Info label="Gestor responsável" valor={gestById?.[cliente.responsavelId]?.nome} />
            <Info label="Nicho" valor={cliente.nicho} />
            <Info label="Entrada" valor={cliente.dataEntrada ? fmtData(cliente.dataEntrada) : null} />
            <Info label="Saída prevista" valor={cliente.dataSaidaPrevista ? fmtData(cliente.dataSaidaPrevista) : null} />
            <Info label="Ticket" valor={cliente.ticket ? fmtMoeda(cliente.ticket) : null} />
            <Info label="Recorrência" valor={cliente.ticket ? (cliente.recorrencia === "Único" ? "Pagamento único" : `Mensal · dia ${cliente.diaPagamento || "?"}`) : null} />
            <Info label="Verba mensal" valor={cliente.verbaMensal ? fmtMoeda(cliente.verbaMensal) : null} />
            <Info label="CPA alvo" valor={cliente.cpaMeta ? fmtMoeda(cliente.cpaMeta) : null} />
            <Info label="Plataformas" valor={[cliente.platGoogle && "Google", cliente.platMeta && "Meta"].filter(Boolean).join(" · ") || null} />
          </div>
        </div>

        {/* funil (do Painel) */}
        <div className="card card-pad">
          <h3 className="dash-title">Funil de leads</h3>
          {registroPainel ? (
            <div className="info-grid">
              <Info label="Captados" valor={registroPainel.captados} />
              <Info label="Qualificados" valor={registroPainel.qualificados} />
              <Info label="Fechados" valor={registroPainel.fechados} />
              <Info label="Qualificação" valor={taxas.qualificacao != null ? `${taxas.qualificacao}%` : null} cor={corTaxa(taxas.qualificacao)} />
              <Info label="Fechamento" valor={taxas.fechamento != null ? `${taxas.fechamento}%` : null} cor={corTaxa(taxas.fechamento)} />
              <Info label="Conversão" valor={taxas.conversao != null ? `${taxas.conversao}%` : null} cor={corTaxa(taxas.conversao)} />
            </div>
          ) : (
            <div className="proj-vazia">Nenhum número lançado no Painel para este cliente.</div>
          )}
        </div>
      </div>

      {/* últimos acompanhamentos */}
      <h3 className="dash-title" style={{ marginTop: 22 }}>Últimos acompanhamentos</h3>
      {acompCliente.length === 0 ? (
        <div className="card"><div className="empty"><p>Nenhum acompanhamento registrado.</p></div></div>
      ) : (
        <div className="card">
          {acompCliente.map((a) => (
            <div className="list-row" key={a.id}>
              <div>
                <div className="lr-meta">{fmtData(a.data)}</div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 3 }}>{a.acompanhamento || "—"}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* tarefas do cliente */}
      <h3 className="dash-title" style={{ marginTop: 22 }}>Tarefas ({tarefasCliente.length})</h3>
      {tarefasCliente.length === 0 ? (
        <div className="card"><div className="empty"><p>Nenhuma tarefa criada para este cliente.</p></div></div>
      ) : (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr><th>Criação</th><th>Ação</th><th>Responsável</th><th>Etapa</th><th>Prazo</th><th>Conclusão</th></tr>
            </thead>
            <tbody>
              {tarefasCliente.map((t) => (
                <tr key={t.id}>
                  <td className="cell-num">{fmtData(t.dataCriacao || t.data)}</td>
                  <td className="cell-acomp">{t.acao || "—"}</td>
                  <td>{pesById[t.responsavelId]?.nome || "—"}</td>
                  <td><span className="etapa-badge" style={{ "--c": "var(--green)" }}><span className="dot" /> {t.etapa}</span></td>
                  <td className="cell-num">{t.prazo ? fmtData(t.prazo) : "—"}</td>
                  <td className="cell-num">{t.dataConclusao ? fmtData(t.dataConclusao) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
