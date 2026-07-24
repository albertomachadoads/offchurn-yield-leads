import { useEffect, useMemo, useState, useCallback } from "react";
import "./App.css";
import { CRITICIDADES, TIPOS_META, ADERENCIAS } from "./store";
import { fmtData, fmtValor, fmtMoeda, hoje, exportarXLSX } from "./utils";
import { Icon, Modal } from "./components.jsx";
import { calcTaxas, corTaxa } from "./taxas";
import GestaoClientes from "./GestaoClientes.jsx";
import FluxoCaixa from "./FluxoCaixa.jsx";
import Clientes from "./Clientes.jsx";
import ClienteDetalhe from "./ClienteDetalhe.jsx";
import FollowAcoes from "./FollowAcoes.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import Logs from "./Logs.jsx";
import OBZ from "./OBZ.jsx";
import { setLogUser, logAcao, logErro, instalarCaptura } from "./logger.js";
import { setProtecaoUser, instalarProtecaoDevTools } from "./protecao.js";
import Login from "./Login.jsx";
import Admin from "./Admin.jsx";
import { supabaseConfigured } from "./supabaseClient";
import { getSessionUser, onAuthChange, signOut } from "./auth";
import * as api from "./api";

const EMPTY = { clientes: [], gestores: [], pessoas: [], acompanhamentos: [], tarefas: [], perfis: [], painel: [], recebiveis: [], desempenho: [] };

export default function App() {
  // ----- sessão / auth -----
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [avisoLogin, setAvisoLogin] = useState("");

  // ----- dados (do Supabase) -----
  const [data, setData] = useState(EMPTY);
  const [carregando, setCarregando] = useState(false);
  const [erroCarga, setErroCarga] = useState("");

  const [view, setView] = useState("acompanhamento");
  const [toast, setToast] = useState(null);
  // sidebar recolhida por padrão; expande no hover ou fixada por botão
  const [sidebarFixa, setSidebarFixa] = useState(false);
  // tema (claro/escuro) — lê preferência salva
  const [agFiltro, setAgFiltro] = useState("todas"); // "todas" | "Yield" | "Mads"

  const [tema, setTema] = useState(() => {
    try { return localStorage.getItem("offchurn_tema") || "claro"; } catch { return "claro"; }
  });
  // instalar captura global de erros (uma vez)
  useEffect(() => { instalarCaptura(); }, []);

  useEffect(() => {
    try { localStorage.setItem("offchurn_tema", tema); } catch { /* ignore */ }
  }, [tema]);
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
  const [clienteAberto, setClienteAberto] = useState(null);

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
        if (u) setLogUser(u.id, u.nome);
      } catch (e) {
        if (e?.bloqueado) { setUser(null); setAvisoLogin(e.message); }
      } finally {
        setBooting(false);
      }
      unsub = onAuthChange(async (session) => {
        if (!session) { setUser(null); setData(EMPTY); return; }
        try {
          const u = await getSessionUser();
          setUser(u);
          setAvisoLogin("");
          if (u) { setLogUser(u.id, u.nome); setProtecaoUser(u); instalarProtecaoDevTools(); logAcao("login", `${u.nome} entrou no sistema`); }
        } catch (e) {
          if (e?.bloqueado) { setUser(null); setAvisoLogin(e.message); }
        }
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
  // filtra TUDO pela agência selecionada (exceto o próprio cadastro de clientes)
  const clientesFiltrados = useMemo(() => {
    if (agFiltro === "todas") return data.clientes;
    return data.clientes.filter((c) => c.agencia === agFiltro);
  }, [data.clientes, agFiltro]);
  const idsAgencia = useMemo(() => new Set(clientesFiltrados.map((c) => c.id)), [clientesFiltrados]);

  const pesById = useMemo(() => Object.fromEntries((data.pessoas || []).map((p) => [p.id, p])), [data.pessoas]);
  const respDoCliente = (clienteId) => gestById[cliById[clienteId]?.responsavelId]?.nome || "—";

  const registrosFiltrados = useMemo(() => {
    return (data.acompanhamentos || [])
      .filter((r) => idsAgencia.has(r.clienteId)) // filtra por agência
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
      logAcao("acompanhamento", `Registro ${dados.id ? "editado" : "criado"} para cliente ${dados.clienteId?.slice(0,8)}`);
      recarregar();
    } catch (e) { showToast("Erro: " + (e.message || "falha ao salvar")); }
  }
  async function excluirRegistro(id) {
    if (!confirm("Excluir este registro do histórico?")) return;
    try { await api.deleteAcomp(id); showToast("Registro removido"); recarregar();
      logAcao("acompanhamento", "Registro de acompanhamento excluído");
    } catch (e) { showToast("Erro: " + (e.message || "falha")); logErro("acompanhamento", "Falha ao excluir: " + e.message); }
  }

  async function excluirCliente(id) {
    if (!confirm("Excluir este cliente permanentemente? Todos os dados relacionados serão removidos.")) return;
    try {
      await api.deleteCliente(id);
      showToast("Cliente excluído");
      logAcao("cliente", "Cliente excluído: " + id.slice(0,8));
      recarregar();
    } catch (e) { showToast("Erro: " + (e.message || "falha")); logErro("cliente", "Falha ao excluir cliente: " + e.message); }
  }

  async function salvarCliente(c) {
    try {
      const saved = await api.upsertCliente(c);
      if (saved.ativo) setSemana((s) => new Set(s).add(saved.id));
      setCliModal(null); showToast("Cliente salvo"); recarregar();
      logAcao("cliente", `Cliente ${c.id ? "editado" : "criado"}: ${c.nome}`);
    } catch (e) { showToast("Erro: " + (e.message || "falha")); logErro("cliente", "Falha ao salvar cliente: " + e.message); }
  }
  async function toggleAtivo(c) {
    try { await api.upsertCliente({ ...c, ativo: !c.ativo }); recarregar();
      logAcao("cliente", `${c.nome} marcado como ${!c.ativo ? "Ativo" : "Inativo"}`);
    } catch (e) { showToast("Erro: " + (e.message || "falha")); logErro("cliente", "Falha ao alternar ativo: " + e.message); }
  }

  async function excluirGestor(id) {
    if (!confirm("Excluir este gestor?")) return;
    try { await api.deleteGestor(id); showToast("Gestor excluído"); recarregar();
      logAcao("gestor", "Gestor excluído");
    } catch (e) { showToast("Erro: " + (e.message || "falha")); }
  }
  async function excluirPessoa(id) {
    if (!confirm("Excluir esta pessoa?")) return;
    try { await api.deletePessoa(id); showToast("Pessoa excluída"); recarregar();
      logAcao("equipe", "Pessoa excluída");
    } catch (e) { showToast("Erro: " + (e.message || "falha")); }
  }

  async function salvarGestor(g) {
    try { await api.upsertGestor(g); setGestModal(null); showToast("Gestor salvo"); recarregar();
      logAcao("gestor", `Gestor ${g.id ? "editado" : "criado"}: ${g.nome}`);
    } catch (e) { showToast("Erro: " + (e.message || "falha")); logErro("gestor", "Falha ao salvar gestor: " + e.message); }
  }
  async function salvarPessoa(p) {
    try { await api.upsertPessoa(p); setPesModal(null); showToast("Pessoa salva"); recarregar();
      logAcao("equipe", `Pessoa ${p.id ? "editada" : "criada"}: ${p.nome}`);
    } catch (e) { showToast("Erro: " + (e.message || "falha")); logErro("equipe", "Falha ao salvar pessoa: " + e.message); }
  }

  async function salvarTarefa(t) {
    try { await api.upsertTarefa(t, user?.id); recarregar();
      logAcao("tarefa", `Tarefa ${t.id ? "editada" : "criada"}: ${(t.acao || "").slice(0,40)}`);
    } catch (e) { showToast("Erro: " + (e.message || "falha")); logErro("tarefa", "Falha ao salvar tarefa: " + e.message); }
  }
  async function excluirTarefa(id) {
    try { await api.deleteTarefa(id); recarregar();
      logAcao("tarefa", "Tarefa excluída");
    } catch (e) { showToast("Erro: " + (e.message || "falha")); logErro("tarefa", "Falha ao excluir tarefa: " + e.message); }
  }

  async function salvarFunil(dados) {
    try {
      await api.upsertFunil(dados, user?.id);
      recarregar();
      logAcao("funil", `Funil salvo: ${dados.plataforma} ${dados.competencia}`);
    } catch (e) { showToast("Erro: " + (e.message || "falha")); logErro("funil", "Falha ao salvar funil: " + e.message); }
  }

  async function salvarPainel(dados) {
    try {
      await api.upsertPainel(dados, user?.id);
      recarregar();
      logAcao("painel", "Painel salvo");
    } catch (e) { showToast("Erro: " + (e.message || "falha")); logErro("painel", "Falha ao salvar painel: " + e.message); }
  }

  async function lancarDesempenho(dados) {
    try {
      await api.upsertDesempenho(dados, user?.id);
      recarregar();
      logAcao("desempenho", "Desempenho lançado manualmente");
    } catch (e) { showToast("Erro: " + (e.message || "falha")); logErro("desempenho", "Falha ao lançar desempenho: " + e.message); }
  }

  async function marcarPago(dados) {
    await api.upsertRecebivel(dados, user?.id);
    recarregar();
  }

  const painelPorCliente = useMemo(() => {
    const d = new Date();
    const comp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const m = {};
    (data.funil || []).filter((f) => f.competencia === comp).forEach((f) => {
      const x = m[f.clienteId] || { captados: 0, qualificados: 0, fechados: 0 };
      x.captados += f.captados || 0;
      x.qualificados += f.qualificados || 0;
      x.fechados += f.vendidos || 0;
      m[f.clienteId] = x;
    });
    return m;
  }, [data.funil]);

  function exportar() {
    const base = registrosFiltrados.length ? registrosFiltrados : data.acompanhamentos;
    exportarXLSX(base, data.clientes, data.gestores);
    showToast("Relatório exportado (.xlsx)");
    logAcao("export", "Relatório de acompanhamento exportado");
  }

  // ----- telas de gate -----
  if (!supabaseConfigured) return <SetupNeeded />;
  if (booting) return <FullLoader texto="Carregando…" />;
  if (!user) return <Login aviso={avisoLogin} />;

  return (
    <div className={`app app-shell tema-${tema} ${sidebarFixa ? "sidebar-fixa" : "sidebar-mini"}`}>
      <aside className="sidebar"
        onMouseEnter={() => !sidebarFixa && document.body.classList.add("sb-hover")}
        onMouseLeave={() => document.body.classList.remove("sb-hover")}>
        <div className="sidebar-top">
          <button className="sidebar-toggle" onClick={() => setSidebarFixa((v) => !v)} aria-label="Expandir/recolher menu" title="Expandir/recolher menu">
            <Icon.Menu />
          </button>
          <div className="brand">
            <span className="mark">O</span>
            <span className="name">OffChurn Yield Leads</span>
          </div>
        </div>
        <div className="ag-filtro">
          <button className={agFiltro === "todas" ? "ag-btn ag-on" : "ag-btn"} onClick={() => setAgFiltro("todas")}>Todas</button>
          <button className={agFiltro === "Yield" ? "ag-btn ag-on" : "ag-btn"} onClick={() => setAgFiltro("Yield")}>Yield</button>
          <button className={agFiltro === "Mads" ? "ag-btn ag-on" : "ag-btn"} onClick={() => setAgFiltro("Mads")}>Mads</button>
        </div>
        <nav className="nav">
          {/* PRINCIPAIS */}
          <div className="nav-grupo">
            <div className="nav-grupo-titulo">Principais</div>
            <button className={view === "acompanhamento" ? "active" : ""} onClick={() => setView("acompanhamento")}>
              <Icon.ListCheck /> <span>Acompanhamento</span>
            </button>
            <button className={view === "follow" ? "active" : ""} onClick={() => setView("follow")}>
              <Icon.Target /> <span>Follow de Ações</span>
            </button>
            <button className={view === "clientes" ? "active" : ""} onClick={() => { setClienteAberto(null); setView("clientes"); }}>
              <Icon.Grid /> <span>Clientes</span>
            </button>
          </div>

          {/* FINANCEIRO */}
          <div className="nav-grupo">
            <div className="nav-grupo-titulo">Financeiro</div>
            <button className={view === "fluxo" ? "active" : ""} onClick={() => setView("fluxo")}>
              <Icon.Cash /> <span>Fluxo de Caixa</span>
            </button>
            <button className={view === "gestao" ? "active" : ""} onClick={() => setView("gestao")}>
              <Icon.Users /> <span>Gestão de Clientes</span>
            </button>
            <button className={view === "obz" ? "active" : ""} onClick={() => setView("obz")}>
              <Icon.Cash /> <span>OBZ</span>
            </button>
          </div>

          {/* LOG DE TAREFAS */}
          <div className="nav-grupo">
            <div className="nav-grupo-titulo">Log de Tarefas</div>
            <button className={view === "registro-tarefas" ? "active" : ""} onClick={() => setView("registro-tarefas")}>
              <Icon.Clipboard /> <span>Registro de Tarefas</span>
            </button>
          </div>

          {/* ADMINISTRATIVO */}
          {isAdmin && (
            <div className="nav-grupo">
              <div className="nav-grupo-titulo">Administrativo</div>
              <button className={view === "cadastros" ? "active" : ""} onClick={() => setView("cadastros")}>
                <Icon.Folder /> <span>Cadastros</span>
              </button>
              <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}>
                <Icon.Users /> <span>Administradores</span>
              </button>
              <button className={view === "logs" ? "active" : ""} onClick={() => setView("logs")}>
                <Icon.List /> <span>Logs</span>
              </button>
            </div>
          )}
        </nav>
        <div className="sidebar-foot">
          <button className="btn btn-sm btn-ghost tema-toggle" onClick={() => setTema((t) => t === "claro" ? "escuro" : "claro")} title="Alternar tema">
            {tema === "claro" ? <><Icon.Lua /> <span className="tt-label">Modo escuro</span></> : <><Icon.Sol /> <span className="tt-label">Modo claro</span></>}
          </button>
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
            painelPorCliente={painelPorCliente}
            onAbrirCliente={(c) => { if (c) { setClienteAberto(c); setView("clientes"); } }}
            onNovo={() => setRegModal({ novo: true })}
            onEditar={(r) => setRegModal(r)}
            onExcluir={excluirRegistro}
            onExportar={exportar}
          />
        )}
                {view === "follow" && (
          <FollowAcoes
            tarefas={(data.tarefas || []).filter((t) => idsAgencia.has(t.clienteId))}
            clientes={clientesFiltrados}
            pessoas={data.pessoas || []}
            onSave={salvarTarefa}
            onDelete={excluirTarefa}
            onToast={showToast}
            isAdmin={isAdmin}
          />
        )}
        {view === "clientes" && !clienteAberto && (
          <Clientes
            clientes={clientesFiltrados}
            desempenho={data.desempenho || []}
            onAbrir={(c) => setClienteAberto(c)}
            onLancar={lancarDesempenho}
            onVincularMeta={{
              listar: api.metaListarContas,
              salvar: async (contaId, clienteId) => {
                // remove o vínculo de quem tinha essa conta e aplica no novo
                const dono = data.clientes.find((c) => c.metaAdAccountId === contaId);
                if (dono && dono.id !== clienteId) {
                  await api.upsertCliente({ ...dono, metaAdAccountId: null });
                }
                if (clienteId) {
                  const cli = data.clientes.find((c) => c.id === clienteId);
                  if (cli) await api.upsertCliente({ ...cli, metaAdAccountId: contaId });
                }
                recarregar();
              },
            }}
            onSincronizarMeta={async () => { const r = await api.metaSincronizar(); recarregar(); return r; }}
            onToast={showToast}
          />
        )}
        {view === "clientes" && clienteAberto && (
          <ClienteDetalhe
            cliente={data.clientes.find((c) => c.id === clienteAberto.id) || clienteAberto}
            gestById={gestById}
            desempenho={data.desempenho || []}
            tarefas={data.tarefas || []}
            pessoas={data.pessoas || []}
            painel={data.painel || []}
            acompanhamentos={data.acompanhamentos || []}
            isAdmin={isAdmin}
            onVoltar={() => setClienteAberto(null)}
            onEditar={(c) => setCliModal(c)}
            onListarContasMeta={api.metaListarContas}
            onVincularConta={async (contaId) => {
              const atual = data.clientes.find((c) => c.id === clienteAberto.id);
              // desvincula quem tiver essa conta
              if (contaId) {
                const dono = data.clientes.find((c) => c.metaAdAccountId === contaId && c.id !== atual.id);
                if (dono) await api.upsertCliente({ ...dono, metaAdAccountId: null });
              }
              await api.upsertCliente({ ...atual, metaAdAccountId: contaId });
              recarregar();
            }}
            onSincronizarCliente={async () => { const r = await api.metaSincronizar(clienteAberto.id); recarregar(); return r; }}
            funil={data.funil || []}
            onSalvarFunil={salvarFunil}
            onBuscarInsights={api.metaInsights}
            onListarContasGoogle={api.googleListarContas}
            onVincularContaGoogle={async (contaId, mccId) => {
              const atual = data.clientes.find((c) => c.id === clienteAberto.id);
              if (contaId) {
                const dono = data.clientes.find((c) => c.googleAdCustomerId === contaId && c.id !== atual.id);
                if (dono) await api.upsertCliente({ ...dono, googleAdCustomerId: null, googleMccId: null });
              }
              await api.upsertCliente({ ...atual, googleAdCustomerId: contaId, googleMccId: mccId });
              recarregar();
            }}
            onSincronizarGoogle={async () => { const r = await api.googleSincronizar(clienteAberto.id); recarregar(); return r; }}
            onBuscarInsightsGoogle={api.googleInsights}
            onToast={showToast}
          />
        )}
        {view === "gestao" && (
          <GestaoClientes
            clientes={clientesFiltrados}
            gestById={gestById}
            isAdmin={isAdmin}
            onEditar={(c) => setCliModal(c)}
          />
        )}
        {view === "fluxo" && (
          <FluxoCaixa
            clientes={clientesFiltrados}
            recebiveis={data.recebiveis || []}
            onMarcarPago={marcarPago}
            onToast={showToast}
          />
        )}
                {view === "cadastros" && isAdmin && (
          <Cadastros
            data={{ ...data, registros: data.acompanhamentos }}
            onNovoCliente={() => setCliModal({ novo: true })}
            onEditarCliente={(c) => setCliModal(c)}
            onExcluirCliente={excluirCliente}
            onExcluirGestor={excluirGestor}
            onExcluirPessoa={excluirPessoa}
            onToggleAtivo={(id) => { const c = cliById[id]; if (c) toggleAtivo(c); }}
            onNovoGestor={() => setGestModal({ novo: true })}
            onEditarGestor={(g) => setGestModal(g)}
            onNovaPessoa={() => setPesModal({ novo: true })}
            onEditarPessoa={(p) => setPesModal(p)}
            gestById={gestById}
          />
        )}
        {view === "admin" && isAdmin && (
          <Admin perfis={data.perfis || []} meuId={user.id} onToast={showToast} onReload={recarregar} />
        )}
        {view === "obz" && (
          <OBZ
            despesas={data.despesas || []}
            clientes={clientesFiltrados}
            recebiveis={data.recebiveis || []}
            onSave={async (d) => { await api.upsertDespesa(d, user?.id); recarregar(); logAcao("obz", `Despesa ${d.id ? "editada" : "criada"}: ${d.nome}`); }}
            onDelete={async (id) => { await api.deleteDespesa(id); recarregar(); logAcao("obz", "Despesa excluída"); }}
            onToast={showToast}
          />
        )}

        {view === "registro-tarefas" && (
          <>
            <div className="page-head">
              <div><h1>Registro de Tarefas</h1><p>Todas as tarefas do sistema, com filtros e histórico completo.</p></div>
            </div>
            <div className="table-wrap">
              <table className="grid">
                <thead>
                  <tr><th style={{width:90}}>ID</th><th style={{width:90}}>Grupo</th><th>Título</th><th>Cliente</th><th>Responsável</th><th>Status</th><th>Execução</th><th>Entrega</th></tr>
                </thead>
                <tbody>
                  {(data.tarefas || []).filter((t) => idsAgencia.has(t.clienteId)).sort((a,b)=>(a.dataCriacao<b.dataCriacao?1:-1)).map((t) => (
                    <tr key={t.id}>
                      <td className="cell-num" style={{fontFamily:"monospace",fontSize:11}}>{t.id ? t.id.slice(0,8).toUpperCase() : "—"}</td>
                      <td><span className="pill">Tráfego</span></td>
                      <td className="cell-cliente">{t.titulo || t.acao || "—"}</td>
                      <td>{cliById[t.clienteId]?.nome || "—"}</td>
                      <td>{pesById[t.responsavelId]?.nome || "—"}</td>
                      <td><span className={"pill " + (t.etapa === "Feito" ? "done" : t.etapa === "Atrasada" || t.etapa === "Parado" ? "off" : "")}>{t.etapa}</span></td>
                      <td className="cell-num">{t.dataExecucao || "—"}</td>
                      <td className="cell-num">{t.dataEntrega || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {view === "logs" && isAdmin && (
          <Logs onToast={showToast} />
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
function TaxaQualBar({ pct }) {
  if (pct == null) {
    return <span className="ader-pct" style={{ color: "var(--ink-faint)" }}>— sem dados</span>;
  }
  return (
    <div className="ader" style={{ minWidth: 130 }}>
      <span className="ader-pct" style={{ color: corTaxa(pct) }}>{pct}%</span>
      <div className="ader-bar">
        <div className="ader-fill" style={{ width: `${Math.min(pct, 100)}%`, background: corTaxa(pct) }} />
      </div>
    </div>
  );
}

function Acompanhamento(props) {
  const { stats, registros, semana, respDoCliente, cliById, busca, setBusca,
    fGestor, setFGestor, fAder, setFAder, fDe, setFDe, fAte, setFAte,
    gestores, painelPorCliente, onAbrirCliente, onNovo, onEditar, onExcluir, onExportar } = props;

  // taxa de qualificação do cliente, vinda do Painel
  const taxaQualDoCliente = (clienteId) => {
    const p = painelPorCliente?.[clienteId];
    if (!p) return null;
    return calcTaxas({ captados: p.captados, qualificados: p.qualificados, fechados: p.fechados }).qualificacao;
  };

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
                <th>Data</th><th>Responsável</th><th>Cliente</th>
                <th>Taxa de Qualificação</th>
                <th>Acompanhamento</th><th></th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => {
                const pctQual = taxaQualDoCliente(r.clienteId);
                return (
                <tr key={r.id}>
                  <td className="cell-num">{fmtData(r.data)}</td>
                  <td>{respDoCliente(r.clienteId)}</td>
                  <td className="cell-cliente"><button className="link-cliente" onClick={() => onAbrirCliente && onAbrirCliente(cliById[r.clienteId])}>{cliById[r.clienteId]?.nome || "—"}</button></td>
                  <td><TaxaQualBar pct={pctQual} /></td>
                  <td className="cell-acomp">{r.acompanhamento || "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 2 }}>
                      <button className="iconbtn" onClick={() => onEditar(r)} aria-label="Editar"><Icon.Edit /></button>
                      <button className="iconbtn" onClick={() => onExcluir(r.id)} aria-label="Excluir"><Icon.Trash /></button>
                    </div>
                  </td>
                </tr>
              ); })}
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
function Cadastros({ data, onNovoCliente, onEditarCliente, onExcluirCliente, onToggleAtivo, onNovoGestor, onEditarGestor, onExcluirGestor, onNovaPessoa, onEditarPessoa, onExcluirPessoa, gestById }) {
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
                    {c.agencia && <><span className="pill pill-ag">{c.agencia}</span> · </>}{gestById[c.responsavelId]?.nome || "Sem gestor"}
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
                  <button className="iconbtn" onClick={() => onExcluirCliente(c.id)} aria-label="Excluir" title="Excluir cliente"><Icon.Trash /></button>
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
                    <button className="iconbtn" onClick={() => onExcluirGestor(g.id)} aria-label="Excluir" title="Excluir gestor"><Icon.Trash /></button>
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
                    <button className="iconbtn" onClick={() => onExcluirPessoa(p.id)} aria-label="Excluir" title="Excluir pessoa"><Icon.Trash /></button>
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
    // campos legados mantidos com padrão (colunas ainda existem no banco)
    criticidade: base.criticidade || "Normal",
    agencia: base.agencia || "Yield",
    tipoMeta: base.tipoMeta || "Faturamento",
    meta: base.meta ?? null,
    realizado: base.realizado ?? null,
    aderencia: base.aderencia || "Sem dados",
    acompanhamento: base.acompanhamento || "",
    criadoEm: base.criadoEm,
  }));
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const valido = f.clienteId && f.data;

  function submit() {
    if (!valido) return;
    onSave(f);
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
      </div>
      <div className="form-row">
        <label>Responsável</label>
        <input className="input" value={f.clienteId ? respDoCliente(f.clienteId) : "—"} disabled />
      </div>
      <div className="form-row">
        <label>Acompanhamento</label>
        <textarea className="input" rows={5} placeholder="Comentários do responsável…" value={f.acompanhamento} onChange={(e) => set("acompanhamento", e.target.value)} />
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
    nicho: base.nicho || "",
    objetivo: base.objetivo || "Lead",
    dataEntrada: base.dataEntrada || "",
    dataSaidaPrevista: base.dataSaidaPrevista || "",
    ticket: base.ticket ?? "",
    recorrencia: base.recorrencia || "Mensal",
    diaPagamento: base.diaPagamento ?? "",
    linkDrive: base.linkDrive || "",
    nps: base.nps ?? "",
    platGoogle: base.platGoogle ?? false,
    platMeta: base.platMeta ?? false,
    cpaMeta: base.cpaMeta ?? "",
    metaAdAccountId: base.metaAdAccountId || null,
    googleAdCustomerId: base.googleAdCustomerId || null,
    googleMccId: base.googleMccId || null,
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
      <div className="form-grid">
        <div className="form-row">
          <label>Nome do cliente</label>
          <input className="input" value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Pink Ninas" autoFocus />
        </div>
        <div className="form-row">
          <label>Nicho</label>
          <input className="input" value={f.nicho} onChange={(e) => set("nicho", e.target.value)} placeholder="Ex.: Moda, Advocacia" />
        </div>
      </div>

      <div className="form-row">
        <label>Objetivo do cliente</label>
        <select className="select" value={f.objetivo} onChange={(e) => set("objetivo", e.target.value)}>
          <option value="Lead">Lead (funil de leads e taxas)</option>
          <option value="Faturamento">Faturamento (vendas, VGV e ROAS)</option>
          <option value="Não metrificado">Resultado não metrificado (painel em branco)</option>
        </select>
      </div>
      <div className="form-row">
        <label>Agência</label>
        <select className="select" value={f.agencia} onChange={(e) => set("agencia", e.target.value)}>
          <option value="Yield">Yield</option>
          <option value="Mads">Mads</option>
        </select>
      </div>
      <div className="form-row">
        <label>Nível de criticidade</label>
        <select className="select" value={f.criticidade} onChange={(e) => set("criticidade", e.target.value)}>
          <option value="Baixo">Baixo</option>
          <option value="Normal">Normal</option>
          <option value="Alto">Alto</option>
          <option value="Crítico">Crítico</option>
        </select>
      </div>

      <div className="form-row">
        <label>Gestor responsável</label>
        <select className="select" value={f.responsavelId} onChange={(e) => set("responsavelId", e.target.value)}>
          {gestores.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
        </select>
      </div>

      <div className="modal-sec">Contrato</div>
      <div className="form-grid">
        <div className="form-row">
          <label>Data de entrada</label>
          <input type="date" className="input" value={f.dataEntrada} onChange={(e) => set("dataEntrada", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Saída prevista</label>
          <input type="date" className="input" value={f.dataSaidaPrevista} onChange={(e) => set("dataSaidaPrevista", e.target.value)} />
        </div>
      </div>

      <div className="form-grid form-grid-3">
        <div className="form-row">
          <label>Ticket (R$)</label>
          <input type="number" min="0" step="0.01" className="input" placeholder="Ex.: 2500,00"
            value={f.ticket} onChange={(e) => set("ticket", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Recorrência</label>
          <select className="select" value={f.recorrencia} onChange={(e) => set("recorrencia", e.target.value)}>
            <option value="Mensal">Mensal</option>
            <option value="Único">Pagamento único</option>
          </select>
        </div>
        <div className="form-row">
          <label>Dia do pagamento</label>
          <input type="number" min="1" max="31" className="input" placeholder="Ex.: 10"
            value={f.diaPagamento} onChange={(e) => set("diaPagamento", e.target.value)}
            disabled={f.recorrencia === "Único"} />
        </div>
      </div>

      <div className="modal-sec">Tráfego</div>
      <div className="form-grid form-grid-3">
        <div className="form-row">
          <label>Verba mensal (R$)</label>
          <input type="number" min="0" step="0.01" className="input" placeholder="Ex.: 10000,00"
            value={f.verbaMensal} onChange={(e) => set("verbaMensal", e.target.value)} />
        </div>
        <div className="form-row">
          <label>CPA alvo (R$)</label>
          <input type="number" min="0" step="0.01" className="input" placeholder="Ex.: 45,00"
            value={f.cpaMeta} onChange={(e) => set("cpaMeta", e.target.value)} />
        </div>
        <div className="form-row">
          <label>NPS (0 a 100)</label>
          <input type="number" min="0" max="100" className="input" placeholder="Ex.: 80"
            value={f.nps} onChange={(e) => set("nps", e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <label>Plataformas conectadas</label>
        <div style={{ display: "flex", gap: 18, paddingTop: 4 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 500, cursor: "pointer" }}>
            <input type="checkbox" checked={f.platGoogle} onChange={(e) => set("platGoogle", e.target.checked)} /> Google Ads
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 500, cursor: "pointer" }}>
            <input type="checkbox" checked={f.platMeta} onChange={(e) => set("platMeta", e.target.checked)} /> Meta Ads
          </label>
        </div>
      </div>
      <div className="form-row">
        <label>CPA histórico (R$) — referência antiga</label>
        <input type="number" min="0" step="0.01" className="input" placeholder="opcional"
          value={f.cpa} onChange={(e) => set("cpa", e.target.value)} />
      </div>

      <div className="form-row">
        <label>Link do Drive</label>
        <input className="input" value={f.linkDrive} onChange={(e) => set("linkDrive", e.target.value)}
          placeholder="https://drive.google.com/..." />
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
