import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { load, save, resetAll, CRITICIDADES, TIPOS_META, ADERENCIAS, uid } from "./store";
import { fmtData, fmtValor, hoje, exportarXLSX } from "./utils";
import { Icon, AderenciaBadge, AderenciaBar, Modal } from "./components.jsx";
import FollowAcoes from "./FollowAcoes.jsx";

export default function App() {
  const [data, setData] = useState(() => load());
  const [view, setView] = useState("acompanhamento");
  const [toast, setToast] = useState(null);

  // seleção de clientes da semana
  const [semana, setSemana] = useState(() => new Set(load().clientes.filter((c) => c.ativo).map((c) => c.id)));

  // filtros do acompanhamento
  const [busca, setBusca] = useState("");
  const [fGestor, setFGestor] = useState("todos");
  const [fAder, setFAder] = useState("todas");
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");

  // modais
  const [regModal, setRegModal] = useState(null); // registro em edição/criação
  const [cliModal, setCliModal] = useState(null);
  const [gestModal, setGestModal] = useState(null);

  useEffect(() => { save(data); }, [data]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  const cliById = useMemo(() => Object.fromEntries(data.clientes.map((c) => [c.id, c])), [data.clientes]);
  const gestById = useMemo(() => Object.fromEntries(data.gestores.map((g) => [g.id, g])), [data.gestores]);
  const respDoCliente = (clienteId) => gestById[cliById[clienteId]?.responsavelId]?.nome || "—";

  // registros visíveis (semana + filtros)
  const registrosFiltrados = useMemo(() => {
    return data.registros
      .filter((r) => semana.size === 0 ? true : semana.has(r.clienteId))
      .filter((r) => {
        if (fGestor !== "todos" && cliById[r.clienteId]?.responsavelId !== fGestor) return false;
        if (fAder !== "todas" && r.aderencia !== fAder) return false;
        if (fDe && r.data < fDe) return false;
        if (fAte && r.data > fAte) return false;
        if (busca.trim()) {
          const q = busca.toLowerCase();
          const nome = cliById[r.clienteId]?.nome?.toLowerCase() || "";
          if (!nome.includes(q) && !r.acompanhamento.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : (b.criadoEm || 0) - (a.criadoEm || 0)));
  }, [data.registros, semana, fGestor, fAder, fDe, fAte, busca, cliById]);

  const stats = useMemo(() => {
    const set = registrosFiltrados;
    const ok = set.filter((r) => r.aderencia === "Ok").length;
    const aten = set.filter((r) => r.aderencia === "Atenção").length;
    const abaixo = set.filter((r) => r.aderencia === "Abaixo").length;
    return { total: set.length, ok, aten, abaixo, clientes: new Set(set.map((r) => r.clienteId)).size };
  }, [registrosFiltrados]);

  // ---- ações registros ----
  function salvarRegistro(reg) {
    setData((d) => {
      const existe = d.registros.some((r) => r.id === reg.id);
      const registros = existe
        ? d.registros.map((r) => (r.id === reg.id ? reg : r))
        : [...d.registros, { ...reg, criadoEm: Date.now() }];
      return { ...d, registros };
    });
    setRegModal(null);
    showToast(reg.id && data.registros.some((r) => r.id === reg.id) ? "Acompanhamento atualizado" : "Acompanhamento registrado");
  }
  function excluirRegistro(id) {
    if (!confirm("Excluir este registro do histórico?")) return;
    setData((d) => ({ ...d, registros: d.registros.filter((r) => r.id !== id) }));
    showToast("Registro removido");
  }

  // ---- ações clientes ----
  function salvarCliente(c) {
    setData((d) => {
      const existe = d.clientes.some((x) => x.id === c.id);
      const clientes = existe ? d.clientes.map((x) => (x.id === c.id ? c : x)) : [...d.clientes, c];
      return { ...d, clientes };
    });
    if (c.ativo) setSemana((s) => new Set(s).add(c.id));
    setCliModal(null);
    showToast("Cliente salvo");
  }
  function toggleAtivo(id) {
    setData((d) => ({ ...d, clientes: d.clientes.map((c) => (c.id === id ? { ...c, ativo: !c.ativo } : c)) }));
  }

  // ---- ações gestores ----
  function salvarGestor(g) {
    setData((d) => {
      const existe = d.gestores.some((x) => x.id === g.id);
      const gestores = existe ? d.gestores.map((x) => (x.id === g.id ? g : x)) : [...d.gestores, g];
      return { ...d, gestores };
    });
    setGestModal(null);
    showToast("Gestor salvo");
  }

  function exportar() {
    const base = registrosFiltrados.length ? registrosFiltrados : data.registros;
    exportarXLSX(base, data.clientes, data.gestores);
    showToast("Relatório exportado (.xlsx)");
  }

  // ---- ações reuniões (Follow de Ações) ----
  function salvarReuniao(r) {
    setData((d) => {
      const lista = d.reunioes || [];
      const existe = lista.some((x) => x.id === r.id);
      const reunioes = existe
        ? lista.map((x) => (x.id === r.id ? r : x))
        : [...lista, { ...r, criadoEm: Date.now() }];
      return { ...d, reunioes };
    });
  }
  function excluirReuniao(id) {
    setData((d) => ({ ...d, reunioes: (d.reunioes || []).filter((r) => r.id !== id) }));
  }

  function resetar() {
    if (!confirm("Restaurar dados de exemplo? Isso substitui todo o histórico atual.")) return;
    const fresh = resetAll();
    setData(fresh);
    setSemana(new Set(fresh.clientes.filter((c) => c.ativo).map((c) => c.id)));
    showToast("Dados restaurados");
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark">O</span>
          <span className="name">OffChurn Yield Leads</span>
        </div>
        <nav className="nav">
          <button className={view === "acompanhamento" ? "active" : ""} onClick={() => setView("acompanhamento")}>Acompanhamento</button>
          <button className={view === "follow" ? "active" : ""} onClick={() => setView("follow")}>Follow de Ações</button>
          <button className={view === "semana" ? "active" : ""} onClick={() => setView("semana")}>Clientes da semana</button>
          <button className={view === "cadastros" ? "active" : ""} onClick={() => setView("cadastros")}>Cadastros</button>
        </nav>
        <div className="spacer" />
        <span className="meta-info">{data.clientes.filter((c) => c.ativo).length} clientes ativos · {data.registros.length} registros</span>
      </header>

      <main className="main">
        {view === "acompanhamento" && (
          <Acompanhamento
            stats={stats} registros={registrosFiltrados} semana={semana}
            respDoCliente={respDoCliente} cliById={cliById}
            busca={busca} setBusca={setBusca}
            fGestor={fGestor} setFGestor={setFGestor}
            fAder={fAder} setFAder={setFAder}
            fDe={fDe} setFDe={setFDe} fAte={fAte} setFAte={setFAte}
            gestores={data.gestores}
            onNovo={() => setRegModal({ novo: true })}
            onEditar={(r) => setRegModal(r)}
            onExcluir={excluirRegistro}
            onExportar={exportar}
          />
        )}
        {view === "follow" && (
          <FollowAcoes
            reunioes={data.reunioes || []}
            clientes={data.clientes}
            gestores={data.gestores}
            onSave={salvarReuniao}
            onDelete={excluirReuniao}
            onToast={showToast}
          />
        )}
        {view === "semana" && (
          <SemanaSelector
            clientes={data.clientes} semana={semana} setSemana={setSemana}
            respDoCliente={respDoCliente}
          />
        )}
        {view === "cadastros" && (
          <Cadastros
            data={data}
            onNovoCliente={() => setCliModal({ novo: true })}
            onEditarCliente={(c) => setCliModal(c)}
            onToggleAtivo={toggleAtivo}
            onNovoGestor={() => setGestModal({ novo: true })}
            onEditarGestor={(g) => setGestModal(g)}
            gestById={gestById}
            onResetar={resetar}
          />
        )}
      </main>

      {regModal && (
        <RegistroModal
          base={regModal} clientes={data.clientes.filter((c) => c.ativo || c.id === regModal.clienteId)}
          onClose={() => setRegModal(null)} onSave={salvarRegistro}
          respDoCliente={respDoCliente}
        />
      )}
      {cliModal && (
        <ClienteModal base={cliModal} gestores={data.gestores} onClose={() => setCliModal(null)} onSave={salvarCliente} />
      )}
      {gestModal && (
        <GestorModal base={gestModal} onClose={() => setGestModal(null)} onSave={salvarGestor} />
      )}

      {toast && <div className="toast"><Icon.Check stroke="#7ee0a6" /> {toast}</div>}
    </div>
  );
}

/* ============ ACOMPANHAMENTO ============ */
function Acompanhamento(props) {
  const { stats, registros, semana, respDoCliente, cliById, busca, setBusca,
    fGestor, setFGestor, fAder, setFAder, fDe, setFDe, fAte, setFAte,
    gestores, onNovo, onEditar, onExcluir, onExportar } = props;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Acompanhamento da semana</h1>
          <p>Registros dos clientes selecionados · {semana.size} cliente(s) no foco da semana</p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={onExportar}><Icon.Download /> Baixar relatório</button>
          <button className="btn btn-primary" onClick={onNovo}><Icon.Plus /> Novo acompanhamento</button>
        </div>
      </div>

      <div className="tiles">
        <div className="tile"><div className="label">Registros</div><div className="value">{stats.total}</div><div className="hint">{stats.clientes} clientes</div></div>
        <div className="tile"><div className="label">Na meta (Ok)</div><div className="value">{stats.ok}</div><div className="hint">aderência adequada</div></div>
        <div className="tile"><div className="label">Atenção</div><div className="value">{stats.aten}</div><div className="hint">monitorar de perto</div></div>
        <div className="tile"><div className="label">Abaixo</div><div className="value">{stats.abaixo}</div><div className="hint">ação imediata</div></div>
      </div>

      <div className="toolbar">
        <div className="search">
          <Icon.Search />
          <input className="input" placeholder="Buscar cliente ou texto…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="field">
          <label>Gestor</label>
          <select className="select" value={fGestor} onChange={(e) => setFGestor(e.target.value)}>
            <option value="todos">Todos</option>
            {gestores.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Aderência</label>
          <select className="select" value={fAder} onChange={(e) => setFAder(e.target.value)}>
            <option value="todas">Todas</option>
            {ADERENCIAS.map((a) => <option key={a} value={a}>{a}</option>)}
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
        {(fDe || fAte) && (
          <div className="field"><label>&nbsp;</label>
            <button className="btn btn-ghost" onClick={() => { setFDe(""); setFAte(""); }}>Limpar datas</button>
          </div>
        )}
      </div>

      {registros.length === 0 ? (
        <div className="card"><div className="empty">
          <h3>Nenhum registro para mostrar</h3>
          <p>Ajuste os filtros, selecione clientes na aba "Clientes da semana" ou crie um novo acompanhamento.</p>
          <button className="btn btn-primary" onClick={onNovo}><Icon.Plus /> Novo acompanhamento</button>
        </div></div>
      ) : (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Data</th><th>Responsável</th><th>Cliente</th><th>Criticidade</th>
                <th>Meta</th><th>Realizado</th><th>Aderência</th><th>Status</th>
                <th>Acompanhamento</th><th></th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id}>
                  <td className="cell-num">{fmtData(r.data)}</td>
                  <td>{respDoCliente(r.clienteId)}</td>
                  <td className="cell-cliente">{cliById[r.clienteId]?.nome || "—"}</td>
                  <td><span className={`crit crit-${r.criticidade}`}>{r.criticidade}</span></td>
                  <td className="cell-num">{fmtValor(r.tipoMeta, r.meta)}</td>
                  <td className="cell-num">{fmtValor(r.tipoMeta, r.realizado)}</td>
                  <td><AderenciaBar meta={r.meta} realizado={r.realizado} /></td>
                  <td><AderenciaBadge value={r.aderencia} /></td>
                  <td className="cell-acomp">{r.acompanhamento || "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 2 }}>
                      <button className="iconbtn" onClick={() => onEditar(r)} aria-label="Editar"><Icon.Edit /></button>
                      <button className="iconbtn" onClick={() => onExcluir(r.id)} aria-label="Excluir"><Icon.Trash /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ============ SELETOR DE CLIENTES DA SEMANA ============ */
function SemanaSelector({ clientes, semana, setSemana, respDoCliente }) {
  const ativos = clientes.filter((c) => c.ativo);
  function toggle(id) {
    setSemana((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Clientes da semana</h1>
          <p>Marque os clientes que serão trabalhados nesta semana. O acompanhamento mostra apenas os selecionados.</p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => setSemana(new Set(ativos.map((c) => c.id)))}>Selecionar todos</button>
          <button className="btn btn-ghost" onClick={() => setSemana(new Set())}>Limpar</button>
        </div>
      </div>
      {ativos.length === 0 ? (
        <div className="card"><div className="empty"><h3>Nenhum cliente ativo</h3><p>Cadastre ou ative clientes na aba "Cadastros".</p></div></div>
      ) : (
        <div className="picker-grid">
          {ativos.map((c) => {
            const on = semana.has(c.id);
            return (
              <div key={c.id} className={`picker-item ${on ? "on" : ""}`} onClick={() => toggle(c.id)}>
                <span className="check">{on && <Icon.Check />}</span>
                <div>
                  <div className="pi-name">{c.nome}</div>
                  <div className="pi-resp">{respDoCliente(c.id)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ============ CADASTROS ============ */
function Cadastros({ data, onNovoCliente, onEditarCliente, onToggleAtivo, onNovoGestor, onEditarGestor, gestById, onResetar }) {
  return (
    <>
      <div className="page-head">
        <div><h1>Cadastros</h1><p>Gerencie clientes ativos e gestores de tráfego.</p></div>
        <div className="head-actions">
          <button className="btn btn-danger" onClick={onResetar}>Restaurar exemplo</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }} className="cad-grid">
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", borderBottom: "1px solid var(--line)" }}>
            <h2 className="section-title" style={{ margin: 0 }}>Clientes ({data.clientes.length})</h2>
            <button className="btn btn-primary btn-sm" onClick={onNovoCliente}><Icon.Plus /> Novo cliente</button>
          </div>
          <div>
            {data.clientes.map((c) => (
              <div className="list-row" key={c.id}>
                <div>
                  <div className="lr-name">{c.nome}</div>
                  <div className="lr-meta">{gestById[c.responsavelId]?.nome || "Sem gestor"}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`pill ${c.ativo ? "" : "off"}`} onClick={() => onToggleAtivo(c.id)} style={{ cursor: "pointer" }}>
                    {c.ativo ? "Ativo" : "Inativo"}
                  </span>
                  <button className="iconbtn" onClick={() => onEditarCliente(c)} aria-label="Editar"><Icon.Edit /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", borderBottom: "1px solid var(--line)" }}>
            <h2 className="section-title" style={{ margin: 0 }}>Gestores ({data.gestores.length})</h2>
            <button className="btn btn-primary btn-sm" onClick={onNovoGestor}><Icon.Plus /> Novo gestor</button>
          </div>
          <div>
            {data.gestores.map((g) => {
              const qtd = data.clientes.filter((c) => c.responsavelId === g.id).length;
              return (
                <div className="list-row" key={g.id}>
                  <div>
                    <div className="lr-name">{g.nome}</div>
                    <div className="lr-meta">{qtd} cliente(s)</div>
                  </div>
                  <button className="iconbtn" onClick={() => onEditarGestor(g)} aria-label="Editar"><Icon.Edit /></button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

/* ============ MODAL: REGISTRO ============ */
function RegistroModal({ base, clientes, onClose, onSave, respDoCliente }) {
  const [f, setF] = useState(() => ({
    id: base.id || uid(),
    data: base.data || hoje(),
    clienteId: base.clienteId || clientes[0]?.id || "",
    criticidade: base.criticidade || "Normal",
    tipoMeta: base.tipoMeta || "Faturamento",
    meta: base.meta ?? "",
    realizado: base.realizado ?? "",
    aderencia: base.aderencia || "Sem dados",
    acompanhamento: base.acompanhamento || "",
    criadoEm: base.criadoEm,
  }));
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const valido = f.clienteId && f.data;

  function submit() {
    if (!valido) return;
    onSave({
      ...f,
      meta: f.meta === "" ? null : Number(f.meta),
      realizado: f.realizado === "" ? null : Number(f.realizado),
    });
  }

  return (
    <Modal
      title={base.novo ? "Novo acompanhamento" : "Editar acompanhamento"}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={submit} disabled={!valido}>Salvar registro</button>
      </>}
    >
      <div className="form-grid">
        <div className="form-row">
          <label>Data</label>
          <input type="date" className="input" value={f.data} onChange={(e) => set("data", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Cliente</label>
          <select className="select" value={f.clienteId} onChange={(e) => set("clienteId", e.target.value)}>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Criticidade</label>
          <select className="select" value={f.criticidade} onChange={(e) => set("criticidade", e.target.value)}>
            {CRITICIDADES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Responsável</label>
          <input className="input" value={f.clienteId ? respDoCliente(f.clienteId) : "—"} disabled />
        </div>
        <div className="form-row">
          <label>Tipo de meta</label>
          <select className="select" value={f.tipoMeta} onChange={(e) => set("tipoMeta", e.target.value)}>
            {TIPOS_META.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Aderência a meta</label>
          <select className="select" value={f.aderencia} onChange={(e) => set("aderencia", e.target.value)}>
            {ADERENCIAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Meta {f.tipoMeta === "Faturamento" ? "(R$)" : "(leads)"}</label>
          <input type="number" className="input" placeholder="Opcional" value={f.meta} onChange={(e) => set("meta", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Realizado {f.tipoMeta === "Faturamento" ? "(R$)" : "(leads)"}</label>
          <input type="number" className="input" placeholder="Opcional" value={f.realizado} onChange={(e) => set("realizado", e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <label>Acompanhamento</label>
        <textarea className="input" rows={4} placeholder="Comentários do responsável…" value={f.acompanhamento} onChange={(e) => set("acompanhamento", e.target.value)} />
      </div>
    </Modal>
  );
}

/* ============ MODAL: CLIENTE ============ */
function ClienteModal({ base, gestores, onClose, onSave }) {
  const [f, setF] = useState(() => ({
    id: base.id || uid(),
    nome: base.nome || "",
    responsavelId: base.responsavelId || gestores[0]?.id || "",
    ativo: base.ativo ?? true,
  }));
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <Modal
      title={base.novo ? "Novo cliente" : "Editar cliente"}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => f.nome.trim() && onSave(f)} disabled={!f.nome.trim()}>Salvar</button>
      </>}
    >
      <div className="form-row">
        <label>Nome do cliente</label>
        <input className="input" value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Pink Ninas" autoFocus />
      </div>
      <div className="form-row">
        <label>Gestor responsável</label>
        <select className="select" value={f.responsavelId} onChange={(e) => set("responsavelId", e.target.value)}>
          {gestores.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
        </select>
      </div>
      <div className="form-row" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <input type="checkbox" id="ativo" checked={f.ativo} onChange={(e) => set("ativo", e.target.checked)} />
        <label htmlFor="ativo" style={{ margin: 0 }}>Cliente ativo (aparece no seletor da semana)</label>
      </div>
    </Modal>
  );
}

/* ============ MODAL: GESTOR ============ */
function GestorModal({ base, onClose, onSave }) {
  const [nome, setNome] = useState(base.nome || "");
  const id = base.id || uid();
  return (
    <Modal
      title={base.novo ? "Novo gestor de tráfego" : "Editar gestor"}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => nome.trim() && onSave({ id, nome: nome.trim() })} disabled={!nome.trim()}>Salvar</button>
      </>}
    >
      <div className="form-row">
        <label>Nome do gestor</label>
        <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: João" autoFocus />
      </div>
    </Modal>
  );
}
