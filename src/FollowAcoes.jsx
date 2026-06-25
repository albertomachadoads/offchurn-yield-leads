import { useMemo, useState } from "react";
import { ETAPAS, uid } from "./store";
import { fmtData, hoje } from "./utils";
import { Icon, Modal } from "./components.jsx";

// soma um campo de etapa em uma lista de reuniões
const somaCampo = (lista, campo) => lista.reduce((acc, r) => acc + (Number(r[campo]) || 0), 0);

/* ====== Gráfico de barras horizontais ====== */
function BarrasHorizontais({ dados, cor = "var(--green)" }) {
  const max = Math.max(1, ...dados.map((d) => d.valor));
  if (dados.length === 0) return <div className="dash-empty">Sem dados para exibir.</div>;
  return (
    <div className="barh-list">
      {dados.map((d) => (
        <div className="barh-row" key={d.label}>
          <div className="barh-label" title={d.label}>{d.label}</div>
          <div className="barh-track">
            <div className="barh-fill" style={{ width: `${(d.valor / max) * 100}%`, background: d.cor || cor }} />
          </div>
          <div className="barh-val">{d.valor}</div>
        </div>
      ))}
    </div>
  );
}

/* ====== Gráfico de barras verticais (timeline de ações criadas) ====== */
function BarrasVerticais({ dados }) {
  const max = Math.max(1, ...dados.map((d) => d.valor));
  if (dados.length === 0) return <div className="dash-empty">Sem reuniões cadastradas.</div>;
  return (
    <div className="barv-wrap">
      {dados.map((d) => (
        <div className="barv-col" key={d.label}>
          <div className="barv-bar-area">
            <span className="barv-num">{d.valor}</span>
            <div className="barv-bar" style={{ height: `${(d.valor / max) * 100}%` }} />
          </div>
          <div className="barv-label">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function FollowAcoes({ reunioes, clientes, gestores, onSave, onDelete, onToast }) {
  const [modal, setModal] = useState(null);
  const [fGestor, setFGestor] = useState("todos");
  const [fCliente, setFCliente] = useState("todos");
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");

  const cliById = useMemo(() => Object.fromEntries(clientes.map((c) => [c.id, c])), [clientes]);
  const gestById = useMemo(() => Object.fromEntries(gestores.map((g) => [g.id, g])), [gestores]);

  const filtradas = useMemo(() => {
    return reunioes
      .filter((r) => fGestor === "todos" || r.gestorId === fGestor)
      .filter((r) => fCliente === "todos" || r.clienteId === fCliente)
      .filter((r) => (!fDe || r.data >= fDe) && (!fAte || r.data <= fAte))
      .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : (b.criadoEm || 0) - (a.criadoEm || 0)));
  }, [reunioes, fGestor, fCliente, fDe, fAte]);

  // ---- métricas ----
  const totalCriadas = somaCampo(filtradas, "criadas");
  const porEtapa = ETAPAS.map((e) => ({ label: e.label, valor: somaCampo(filtradas, e.key), cor: e.cor }));
  const totalAcoes = porEtapa.reduce((a, b) => a + b.valor, 0);
  const totReunioes = filtradas.length;

  // criadas por reunião (timeline por data)
  const criadasPorData = useMemo(() => {
    const m = {};
    filtradas.forEach((r) => { m[r.data] = (m[r.data] || 0) + (Number(r.criadas) || 0); });
    return Object.entries(m)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([data, valor]) => ({ label: fmtData(data).slice(0, 5), valor }));
  }, [filtradas]);

  // por gestor (total de ações = soma das etapas)
  const porGestor = useMemo(() => {
    const m = {};
    filtradas.forEach((r) => {
      const nome = gestById[r.gestorId]?.nome || "—";
      const tot = ETAPAS.reduce((a, e) => a + (Number(r[e.key]) || 0), 0);
      m[nome] = (m[nome] || 0) + tot;
    });
    return Object.entries(m).map(([label, valor]) => ({ label, valor })).sort((a, b) => b.valor - a.valor);
  }, [filtradas, gestById]);

  // por cliente
  const porCliente = useMemo(() => {
    const m = {};
    filtradas.forEach((r) => {
      const nome = cliById[r.clienteId]?.nome || "—";
      const tot = ETAPAS.reduce((a, e) => a + (Number(r[e.key]) || 0), 0);
      m[nome] = (m[nome] || 0) + tot;
    });
    return Object.entries(m).map(([label, valor]) => ({ label, valor })).sort((a, b) => b.valor - a.valor);
  }, [filtradas, cliById]);

  const atrasadas = somaCampo(filtradas, "atrasadas");
  const concluidas = somaCampo(filtradas, "concluidas");

  function excluir(id) {
    if (!confirm("Excluir esta reunião do histórico?")) return;
    onDelete(id);
    onToast("Reunião removida");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Follow de Ações</h1>
          <p>Cadastre as ações de cada reunião e acompanhe o andamento em tempo real.</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary" onClick={() => setModal({ novo: true })}>
            <Icon.Plus /> Nova reunião
          </button>
        </div>
      </div>

      {/* filtros */}
      <div className="toolbar">
        <div className="field">
          <label>Gestor</label>
          <select className="select" value={fGestor} onChange={(e) => setFGestor(e.target.value)}>
            <option value="todos">Todos</option>
            {gestores.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Cliente</label>
          <select className="select" value={fCliente} onChange={(e) => setFCliente(e.target.value)}>
            <option value="todos">Todos</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="field">
          <label>De</label>
          <input type="date" className="input" value={fDe} onChange={(e) => setFDe(e.target.value)} />
        </div>
        <div className="field">
          <label>Até</label>
          <input type="date" className="input" value={fAte} onChange={(e) => setFAte(e.target.value)} />
        </div>
        {(fGestor !== "todos" || fCliente !== "todos" || fDe || fAte) && (
          <div className="field"><label>&nbsp;</label>
            <button className="btn btn-ghost" onClick={() => { setFGestor("todos"); setFCliente("todos"); setFDe(""); setFAte(""); }}>Limpar filtros</button>
          </div>
        )}
      </div>

      {/* tiles de resumo */}
      <div className="tiles tiles-5">
        <div className="tile"><div className="label">Reuniões</div><div className="value">{totReunioes}</div><div className="hint">no período</div></div>
        <div className="tile"><div className="label">Ações criadas</div><div className="value">{totalCriadas}</div><div className="hint">total informado</div></div>
        <div className="tile"><div className="label">Em aberto</div><div className="value">{totalAcoes - concluidas - somaCampo(filtradas, "canceladas")}</div><div className="hint">não finalizadas</div></div>
        <div className="tile"><div className="label">Concluídas</div><div className="value">{concluidas}</div><div className="hint">finalizadas</div></div>
        <div className="tile"><div className="label">Atrasadas</div><div className="value" style={{ color: atrasadas > 0 ? "var(--red)" : "inherit" }}>{atrasadas}</div><div className="hint">ação imediata</div></div>
      </div>

      {/* dashboards */}
      <div className="dash-grid">
        <div className="card card-pad dash-span2">
          <h3 className="dash-title">Volume de ações por etapa</h3>
          <BarrasHorizontais dados={porEtapa} />
        </div>
        <div className="card card-pad">
          <h3 className="dash-title">Ações criadas por reunião</h3>
          <BarrasVerticais dados={criadasPorData} />
        </div>
        <div className="card card-pad">
          <h3 className="dash-title">Ações por gestor</h3>
          <BarrasHorizontais dados={porGestor} cor="var(--green-deep)" />
        </div>
        <div className="card card-pad dash-span2">
          <h3 className="dash-title">Ações por cliente</h3>
          <BarrasHorizontais dados={porCliente} cor="var(--green)" />
        </div>
      </div>

      {/* tabela de reuniões cadastradas */}
      <h3 className="dash-title" style={{ marginTop: 24 }}>Reuniões cadastradas</h3>
      {filtradas.length === 0 ? (
        <div className="card"><div className="empty">
          <h3>Nenhuma reunião no período</h3>
          <p>Cadastre uma reunião para alimentar os dashboards acima.</p>
          <button className="btn btn-primary" onClick={() => setModal({ novo: true })}><Icon.Plus /> Nova reunião</button>
        </div></div>
      ) : (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Data</th><th>Gestor</th><th>Cliente</th><th>Criadas</th>
                {ETAPAS.map((e) => <th key={e.key}>{e.label}</th>)}
                <th>Observações</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r) => (
                <tr key={r.id}>
                  <td className="cell-num">{fmtData(r.data)}</td>
                  <td>{gestById[r.gestorId]?.nome || "—"}</td>
                  <td className="cell-cliente">{cliById[r.clienteId]?.nome || "—"}</td>
                  <td className="cell-num"><strong>{r.criadas || 0}</strong></td>
                  {ETAPAS.map((e) => (
                    <td className="cell-num" key={e.key}>
                      {e.key === "atrasadas" && r[e.key] > 0
                        ? <span style={{ color: "var(--red)", fontWeight: 600 }}>{r[e.key]}</span>
                        : (r[e.key] || 0)}
                    </td>
                  ))}
                  <td className="cell-acomp">{r.obs || "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 2 }}>
                      <button className="iconbtn" onClick={() => setModal(r)} aria-label="Editar"><Icon.Edit /></button>
                      <button className="iconbtn" onClick={() => excluir(r.id)} aria-label="Excluir"><Icon.Trash /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ReuniaoModal
          base={modal} clientes={clientes} gestores={gestores}
          onClose={() => setModal(null)}
          onSave={(r) => { onSave(r); setModal(null); onToast(modal.novo ? "Reunião cadastrada" : "Reunião atualizada"); }}
        />
      )}
    </>
  );
}

/* ====== Modal de cadastro de reunião ====== */
function ReuniaoModal({ base, clientes, gestores, onClose, onSave }) {
  const [f, setF] = useState(() => ({
    id: base.id || uid(),
    data: base.data || hoje(),
    gestorId: base.gestorId || gestores[0]?.id || "",
    clienteId: base.clienteId || clientes[0]?.id || "",
    criadas: base.criadas ?? "",
    aExecutar: base.aExecutar ?? "",
    emAndamento: base.emAndamento ?? "",
    concluidas: base.concluidas ?? "",
    atrasadas: base.atrasadas ?? "",
    canceladas: base.canceladas ?? "",
    obs: base.obs || "",
    criadoEm: base.criadoEm,
  }));
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const num = (v) => (v === "" ? 0 : Number(v));
  const valido = f.data && f.gestorId && f.clienteId;

  const somaEtapas = ["aExecutar", "emAndamento", "concluidas", "atrasadas", "canceladas"]
    .reduce((a, k) => a + num(f[k]), 0);

  function submit() {
    if (!valido) return;
    onSave({
      ...f,
      criadas: num(f.criadas), aExecutar: num(f.aExecutar), emAndamento: num(f.emAndamento),
      concluidas: num(f.concluidas), atrasadas: num(f.atrasadas), canceladas: num(f.canceladas),
    });
  }

  return (
    <Modal
      title={base.novo ? "Nova reunião" : "Editar reunião"}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={submit} disabled={!valido}>Salvar reunião</button>
      </>}
    >
      <div className="form-grid">
        <div className="form-row">
          <label>Data da reunião</label>
          <input type="date" className="input" value={f.data} onChange={(e) => set("data", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Gestor</label>
          <select className="select" value={f.gestorId} onChange={(e) => set("gestorId", e.target.value)}>
            {gestores.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <label>Cliente</label>
        <select className="select" value={f.clienteId} onChange={(e) => set("clienteId", e.target.value)}>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>

      <div className="form-row">
        <label>Ações criadas na reunião</label>
        <input type="number" min="0" className="input" placeholder="0" value={f.criadas} onChange={(e) => set("criadas", e.target.value)} />
      </div>

      <div className="acoes-grid">
        {[
          ["aExecutar", "A executar"],
          ["emAndamento", "Em andamento"],
          ["concluidas", "Concluídas"],
          ["atrasadas", "Atrasadas"],
          ["canceladas", "Canceladas"],
        ].map(([k, label]) => (
          <div className="form-row" key={k}>
            <label>{label}</label>
            <input type="number" min="0" className="input" placeholder="0" value={f[k]} onChange={(e) => set(k, e.target.value)} />
          </div>
        ))}
      </div>
      <div className="soma-hint">Soma das etapas: <strong>{somaEtapas}</strong> ação(ões)</div>

      <div className="form-row">
        <label>Observações</label>
        <textarea className="input" rows={3} placeholder="Notas da reunião…" value={f.obs} onChange={(e) => set("obs", e.target.value)} />
      </div>
    </Modal>
  );
}
