import { useMemo, useState } from "react";
import { fmtMoeda, fmtData } from "./utils";
import { Icon } from "./components.jsx";

export default function GestaoClientes({ clientes, gestById, onEditar, isAdmin }) {
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState("ativos");

  const lista = useMemo(() => {
    return (clientes || [])
      .filter((c) => fStatus === "todos" ? true : fStatus === "ativos" ? c.ativo : !c.ativo)
      .filter((c) => {
        if (!busca.trim()) return true;
        const q = busca.toLowerCase();
        return (c.nome || "").toLowerCase().includes(q) || (c.nicho || "").toLowerCase().includes(q);
      })
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  }, [clientes, busca, fStatus]);

  const totalTicket = lista.reduce((acc, c) => acc + (Number(c.ticket) || 0), 0);
  const comDrive = lista.filter((c) => c.linkDrive).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Gestão de Clientes</h1>
          <p>Visão geral da carteira: nicho, entrada, saída prevista, ticket e acesso ao Drive.</p>
        </div>
      </div>

      <div className="tiles">
        <div className="tile"><div className="label">Clientes</div><div className="value">{lista.length}</div><div className="hint">{fStatus === "ativos" ? "ativos" : fStatus === "inativos" ? "inativos" : "no total"}</div></div>
        <div className="tile"><div className="label">Ticket somado</div><div className="value" style={{ fontSize: 22 }}>{fmtMoeda(totalTicket)}</div><div className="hint">soma dos tickets</div></div>
        <div className="tile"><div className="label">Com Drive</div><div className="value">{comDrive}</div><div className="hint">link cadastrado</div></div>
        <div className="tile"><div className="label">Sem ticket</div><div className="value">{lista.filter((c) => !c.ticket).length}</div><div className="hint">a preencher</div></div>
      </div>

      <div className="toolbar">
        <div className="search">
          <Icon.Search />
          <input className="input" placeholder="Buscar cliente ou nicho…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="field">
          <label>Status</label>
          <select className="select" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
            <option value="todos">Todos</option>
          </select>
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="card"><div className="empty">
          <h3>Nenhum cliente encontrado</h3>
          <p>Ajuste os filtros ou cadastre clientes na aba Cadastros.</p>
        </div></div>
      ) : (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Cliente</th><th>Nicho</th><th>Gestor</th>
                <th>Entrada</th><th>Saída prevista</th>
                <th>Ticket</th><th>Recorrência</th><th>Drive</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td className="cell-cliente">
                    {c.nome}
                    {!c.ativo && <span className="pill off" style={{ marginLeft: 8 }}>Inativo</span>}
                  </td>
                  <td>{c.nicho || "—"}</td>
                  <td>{gestById?.[c.responsavelId]?.nome || "—"}</td>
                  <td className="cell-num">{c.dataEntrada ? fmtData(c.dataEntrada) : "—"}</td>
                  <td className="cell-num">{c.dataSaidaPrevista ? fmtData(c.dataSaidaPrevista) : "—"}</td>
                  <td className="cell-num">{c.ticket ? fmtMoeda(c.ticket) : "—"}</td>
                  <td>
                    {c.ticket
                      ? <span className="pill">{c.recorrencia === "Único" ? "Único" : `Mensal · dia ${c.diaPagamento || "?"}`}</span>
                      : "—"}
                  </td>
                  <td>
                    {c.linkDrive
                      ? <a className="btn btn-sm" href={c.linkDrive} target="_blank" rel="noopener noreferrer"><Icon.Folder /> Abrir</a>
                      : <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>sem link</span>}
                  </td>
                  {isAdmin && (
                    <td>
                      <button className="iconbtn" onClick={() => onEditar(c)} aria-label="Editar"><Icon.Edit /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
