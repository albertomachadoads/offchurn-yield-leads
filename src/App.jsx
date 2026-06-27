import { useEffect, useMemo, useState, useCallback } from "react";
import "./App.css";
import { CRITICIDADES, TIPOS_META, ADERENCIAS } from "./store";
import { fmtData, fmtValor, fmtMoeda, hoje, exportarXLSX } from "./utils";
import { Icon, AderenciaBadge, AderenciaBar, Modal } from "./components.jsx";
import FollowAcoes from "./FollowAcoes.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import Login from "./Login.jsx";
import Admin from "./Admin.jsx";
import { supabaseConfigured } from "./supabaseClient";
import { getSessionUser, onAuthChange, signOut } from "./auth";
import * as api from "./api";

const EMPTY = { clientes: [], gestores: [], pessoas: [], acompanhamentos: [], tarefas: [], perfis: [] };

export default function App() {
  // ----- sessão / auth -----
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);

  // ----- dados (do Supabase) -----
  const [data, setData] = useState(EMPTY);
  const [carregando, setCarregando] = useState(false);
  const [erroCarga, setErroCarga] = useState("");

  const [view, setView] = useState("acompanhamento");
  const [toast, setToast] = useState(null);
  const [semana, setSemana] = useState(new Set());

  // filtros do acompanhamento
  const [busca, setBusca] = useState("");
  const [fGestor, setFGestor] = useState("todos");
  const [fAder, setFAder] = useState("todas");
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");

  // modais
  const [regModal, setRegModal] = useState(null);
  const [cliModal, setCliModal] = useState(null);
  const [gestModal, setGestModal] = useState(null);
  const [pesModal, setPesModal] = useState(null);

  const isAdmin = user?.papel === "admin";
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // ----- inicialização da sessão -----
  useEffect(() => {
    if (!supabaseConfigured) { setBooting(false); return; }
    let unsub;
    (async () => {
      try {
        const u = await getSessionUser();
        setUser(u);
      } finally {
        setBooting(false);
      }
      unsub = onAuthChange(async (session) => {
        if (!session) { setUser(null); setData(EMPTY); return; }
        const u = await getSessionUser();
        setUser(u);
      });
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  // ----- carregar dados quando logado -----
  const recarregar = useCallback(async () => {
    if (!user) return;
    setCarregando(true);
    setErroCarga("");
    try {
      const all = await api.fetchAll();
      setData(all);
      // por padrão, foca todos os clientes ativos na semana (só na 1ª carga)
      setSemana((prev) => prev.size > 0 ? prev : new Set(all.clientes.filter((c) => c.ativo).map((c) => c.id)));
    } catch (e) {
      setErroCarga(e.message || "Falha ao carregar dados.");
    } finally {
      setCarregando(false);
    }
  }, [user]);

  useEffect(() => { if (user) recarregar(); }, [user, recarregar]);

  // ----- tempo real -----
  useEffect(() => {
    if (!user || !supabaseConfigured) return;
    const unsub = api.subscribeAll(() => { recarregar(); });
    return () => unsub();
  }, [user, recarregar]);

  // ----- derivados -----
  const cliById = useMemo(() => Object.fromEntries(data.clientes.map((c) => [c.id, c])), [data.clientes]);
  const gestById = useMemo(() => Object.fromEntries(data.gestores.map((g) => [g.id, g])), [data.gestores]);
  const respDoCliente = (clienteId) => gestById[cliById[clienteId]?.responsavelId]?.nome || "—";

  const registrosFiltrados = useMemo(() => {
    return (data.acompanhamentos || [])
      .filter((r) => semana.size === 0 ? true : semana.has(r.clienteId))
      .filter((r) => {
        if (fGestor !== "todos" && cliById[r.clienteId]?.responsavelId !== fGestor) return false;
        if (fAder !== "todas" && r.aderencia !== fAder) return false;
        if (fDe && r.data < fDe) return false;
        if (fAte && r.data > fAte) return false;
        if (busca.trim()) {
          const q = busca.toLowerCase();
          const nome = cliById[r.clienteId]?.nome?.toLowerCase() || "";
          if (!nome.includes(q) && !(r.acompanhamento || "").toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  }, [data.acompanhamentos, semana, fGestor, fAder, fDe, fAte, busca, cliById]);

  const stats = useMemo(() => {
    const set = registrosFiltrados;
    return {
      total: set.length,
      ok: set.filter((r) => r.aderencia === "Ok").length,
      aten: set.filter((r) => r.aderencia === "Atenção").length,
      abaixo: set.filter((r) => r.aderencia === "Abaixo").length,
      clientes: new Set(set.map((r) => r.clienteId)).size,
    };
  }, [registrosFiltrados]);

  // ----- ações (gravam no banco; realtime atualiza a tela) -----
  async function salvarRegistro(reg) {
    try {
      await api.upsertAcomp(reg, user?.id);
      setRegModal(null);
      showToast("Acompanhamento salvo");
      recarregar();
    } catch (e) { showToast("Erro: " + (e.message || "falha ao salvar")); }
  }
  async function excluirRegistro(id) {
    if (!confirm("Excluir este registro do histórico?")) return;
    try { await api.deleteAcomp(id); showToast("Registro removido"); recarregar(); }
    catch (e) { showToast("Erro: " + (e.message || "falha")); }
  }

  async function salvarCliente(c) {
    try {
      const saved = await api.upsertCliente(c);
      if (saved.ativo) setSemana((s) => new Set(s).add(saved.id));
      setCliModal(null); showToast("Cliente salvo"); recarregar();
    } catch (e) { showToast("Erro: " + (e.message || "falha")); }
  }
  async function toggleAtivo(c) {
    try { await api.upsertCliente({ ...c, ativo: !c.ativo }); recarregar(); }
    catch (e) { showToast("Erro: " + (e.message || "falha")); }
  }

  async function salvarGestor(g) {
    try { await api.upsertGestor(g); setGestModal(null); showToast("Gestor salvo"); recarregar(); }
    catch (e) { showToast("Erro: " + (e.message || "falha")); }
  }
  async function salvarPessoa(p) {
    try { await api.upsertPessoa(p); setPesModal(null); showToast("Pessoa salva"); recarregar(); }
    catch (e) { showToast("Erro: " + (e.message || "falha")); }
  }

  async function salvarTarefa(t) {
    try { await api.upsertTarefa(t, user?.id); recarregar(); }
    catch (e) { showToast("Erro: " + (e.message || "falha")); }
  }
  async function excluirTarefa(id) {
    try { await api.deleteTarefa(id); recarregar(); }
    catch (e) { showToast("Erro: " + (e.message || "falha")); }
  }

  function exportar() {
    const base = registrosFiltrados.length ? registrosFiltrados : data.acompanhamentos;
    exportarXLSX(base, data.clientes, data.gestores);
    showToast("Relatório exportado (.xlsx)");
  }

  // ----- telas de gate -----
  if (!supabaseConfigured) return <SetupNeeded />;
  if (booting) return <FullLoader texto="Carregando…" />;
  if (!user) return <Login />;

  return (
    <div className="app app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="mark">O</span>
          <span className="name">OffChurn Yield Leads</span>
        </div>
        <nav className="nav">
          <button className={view === "acompanhamento" ? "active" : ""} onClick={() => setView("acompanhamento")}>
            <Icon.ListCheck /> Acompanhamento
          </button>
          <button className={view === "follow" ? "active" : ""} onClick={() => setView("follow")}>
            <Icon.Target /> Follow de Ações
          </button>
          <button className={view === "semana" ? "active" : ""} onClick={() => setView("semana")}>
            <Icon.Calendar /> Clientes da semana
          </button>
          {isAdmin && <button className={view === "cadastros" ? "active" : ""} onClick={() => setView("cadastros")}>
            <Icon.Folder /> Cadastros
          </button>}
          {isAdmin && <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}>
            <Icon.Users /> Administradores
          </button>}
        </nav>
        <div className="sidebar-foot">
          <div className="user-box">
            <div className="user-avatar">{(user.nome || "?").charAt(0).toUpperCase()}</div>
            <div className="user-info">
              <span className="user-nome">{user.nome}</span>
              <span className="user-papel">{isAdmin ? "Administrador" : "Gestor"}</span>
            </div>
          </div>
          <button className="btn btn-sm btn-ghost sidebar-sair" onClick={() => signOut()}>Sair</button>
        </div>
      </aside>

      <main className="main">
        <ErrorBoundary>
        {erroCarga && <div className="login-erro" style={{ marginBottom: 16 }}>Erro ao carregar: {erroCarga}</div>}

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
            tarefas={data.tarefas || []}
            clientes={data.clientes}
            pessoas={data.pessoas || []}
            onSave={salvarTarefa}
            onDelete={excluirTarefa}
            onToast={showToast}
            isAdmin={isAdmin}
          />
        )}
        {view === "semana" && (
          <SemanaSelector
            clientes={data.clientes} semana={semana} setSemana={setSemana}
            respDoCliente={respDoCliente}
          />
        )}
        {view === "cadastros" && isAdmin && (
          <Cadastros
            data={{ ...data, registros: data.acompanhamentos }}
            onNovoCliente={() => setCliModal({ novo: true })}
            onEditarCliente={(c) => setCliModal(c)}
            onToggleAtivo={(id) => { const c = cliById[id]; if (c) toggleAtivo(c); }}
            onNovoGestor={() => setGestModal({ novo: true })}
            onEditarGestor={(g) => setGestModal(g)}
            onNovaPessoa={() => setPesModal({ novo: true })}
            onEditarPessoa={(p) => setPesModal(p)}
            gestById={gestById}
          />
        )}
        {view === "admin" && isAdmin && (
          <Admin perfis={data.perfis || []} onToast={showToast} onReload={recarregar} />
        )}
        </ErrorBoundary>
      </main>

      {regModal && (
        <RegistroModal
          base={regModal} clientes={data.clientes.filter((c) => c.ativo || c.id === regModal.clienteId)}
          onClose={() => setRegModal(null)} onSave={salvarRegistro}
          respDoCliente={respDoCliente}
        />
      )}
      {cliModal && isAdmin && (
        <ClienteModal base={cliModal} gestores={data.gestores} onClose={() => setCliModal(null)} onSave={salvarCliente} />
      )}
      {gestModal && isAdmin && (
        <GestorModal base={gestModal} onClose={() => setGestModal(null)} onSave={salvarGestor} />
      )}
      {pesModal && isAdmin && (
        <PessoaModal base={pesModal} onClose={() => setPesModal(null)} onSave={salvarPessoa} />
      )}

      {toast && <div className="toast"><Icon.Check stroke="#7ee0a6" /> {toast}</div>}
    </div>
  );
}

/* ====== telas auxiliares ====== */
function FullLoader({ texto }) {
  return <div className="login-wrap"><div className="full-loader">{texto}</div></div>;
}

function SetupNeeded() {
  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: 460 }}>
        <div className="login-brand">
          <span className="mark">O</span>
          <div>
            <div className="login-name">OffChurn Yield Leads</div>
            <div className="login-sub">Configuração necessária</div>
          </div>
        </div>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.6 }}>
          O sistema ainda não está conectado ao banco de dados. Defina as variáveis
          <code> VITE_SUPABASE_URL </code> e <code> VITE_SUPABASE_ANON_KEY </code>
          no arquivo <code>.env</code> (local) e nas variáveis de ambiente do Vercel.
          Consulte o <strong>README</strong> para o passo a passo.
        </p>
      </div>
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
function Cadastros({ data, onNovoCliente, onEditarCliente, onToggleAtivo, onNovoGestor, onEditarGestor, onNovaPessoa, onEditarPessoa, gestById }) {
  const pessoas = data.pessoas || [];
  const tarefas = data.tarefas || [];
  return (
    <>
      <div className="page-head">
        <div><h1>Cadastros</h1><p>Gerencie clientes, gestores de tráfego e a equipe do Follow de Ações.</p></div>
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
                  <div className="lr-meta">
                    {gestById[c.responsavelId]?.nome || "Sem gestor"}
                    {(c.verbaMensal != null || c.cpa != null) && (
                      <span className="lr-extra">
                        {c.verbaMensal != null && <> · Verba {fmtMoeda(c.verbaMensal)}</>}
                        {c.cpa != null && <> · CPA {fmtMoeda(c.cpa)}</>}
                      </span>
                    )}
                  </div>
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

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", borderBottom: "1px solid var(--line)" }}>
              <h2 className="section-title" style={{ margin: 0 }}>Equipe ({pessoas.length})</h2>
              <button className="btn btn-primary btn-sm" onClick={onNovaPessoa}><Icon.Plus /> Nova pessoa</button>
            </div>
            <div>
              {pessoas.length === 0 ? (
                <div className="list-row"><div className="lr-meta">Nenhuma pessoa cadastrada.</div></div>
              ) : pessoas.map((p) => {
                const qtd = tarefas.filter((t) => t.responsavelId === p.id || t.criadaPorId === p.id).length;
                return (
                  <div className="list-row" key={p.id}>
                    <div>
                      <div className="lr-name">{p.nome}</div>
                      <div className="lr-meta">{qtd} tarefa(s) vinculada(s)</div>
                    </div>
                    <button className="iconbtn" onClick={() => onEditarPessoa(p)} aria-label="Editar"><Icon.Edit /></button>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: "10px 18px", borderTop: "1px solid var(--line)", fontSize: 12, color: "var(--ink-faint)" }}>
              A equipe alimenta os campos "Criada por" e "Responsável" no Follow de Ações.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ============ MODAL: REGISTRO ============ */
function RegistroModal({ base, clientes, onClose, onSave, respDoCliente }) {
  const [f, setF] = useState(() => ({
    id: base.id || null,
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
    id: base.id || null,
    nome: base.nome || "",
    responsavelId: base.responsavelId || gestores[0]?.id || "",
    ativo: base.ativo ?? true,
    cpa: base.cpa ?? "",
    verbaMensal: base.verbaMensal ?? "",
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
      <div className="form-grid">
        <div className="form-row">
          <label>CPA (R$)</label>
          <input type="number" min="0" step="0.01" className="input" placeholder="Ex.: 45,00"
            value={f.cpa} onChange={(e) => set("cpa", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Verba mensal (R$)</label>
          <input type="number" min="0" step="0.01" className="input" placeholder="Ex.: 10000,00"
            value={f.verbaMensal} onChange={(e) => set("verbaMensal", e.target.value)} />
        </div>
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
  const salvar = () => {
    if (!nome.trim()) return;
    onSave(base.id ? { id: base.id, nome: nome.trim() } : { nome: nome.trim() });
  };
  return (
    <Modal
      title={base.novo ? "Novo gestor de tráfego" : "Editar gestor"}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={salvar} disabled={!nome.trim()}>Salvar</button>
      </>}
    >
      <div className="form-row">
        <label>Nome do gestor</label>
        <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: João" autoFocus />
      </div>
    </Modal>
  );
}

/* ============ MODAL: PESSOA (equipe) ============ */
function PessoaModal({ base, onClose, onSave }) {
  const [nome, setNome] = useState(base.nome || "");
  const salvar = () => {
    if (!nome.trim()) return;
    onSave(base.id ? { id: base.id, nome: nome.trim() } : { nome: nome.trim() });
  };
  return (
    <Modal
      title={base.novo ? "Nova pessoa na equipe" : "Editar pessoa"}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={salvar} disabled={!nome.trim()}>Salvar</button>
      </>}
    >
      <div className="form-row">
        <label>Nome</label>
        <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Habiel" autoFocus />
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
        Aparece nos campos "Criada por" e "Responsável" do Follow de Ações.
      </div>
    </Modal>
  );
}
