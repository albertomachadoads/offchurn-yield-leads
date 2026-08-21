import { useEffect, useState } from "react";
import MODULOS from "./modulos.js";
import { AGENCIAS, MODULOS_ATIVOS } from "./config.js";
import { adminCriarUsuario, atualizarPerfil, definirBloqueio, excluirPerfil } from "./auth";
import { Icon, Modal } from "./components.jsx";
import { supabase } from "./supabaseClient.js";

const TODOS_MODS = MODULOS.map((m) => m.id);
const GRUPOS = [...new Set(MODULOS.map((m) => m.grupo))];


function PermissoesTab({ pessoa, instancias, onToast }) {
  const [perm, setPerm] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("permissoes_usuario").select("*").eq("pessoa_id", pessoa.id).maybeSingle()
      .then(({ data }) => { setPerm(data || { modulos: [], wa_instancias: [], agencias: [], ver_todos_clientes: false }); setLoading(false); });
  }, [pessoa.id]);

  if (loading) return <p style={{ fontSize: 12, color: "var(--ink-faint)" }}>Carregando…</p>;

  const modulos = perm.modulos || [];
  const waInst = perm.wa_instancias || [];
  const agencias = perm.agencias || [];

  function toggleMod(id) { setPerm((p) => ({ ...p, modulos: modulos.includes(id) ? modulos.filter((m) => m !== id) : [...modulos, id] })); }
  function toggleGrupo(g) {
    const ids = MODULOS.filter((m) => m.grupo === g).map((m) => m.id);
    const all = ids.every((id) => modulos.includes(id));
    setPerm((p) => ({ ...p, modulos: all ? modulos.filter((m) => !ids.includes(m)) : [...new Set([...modulos, ...ids])] }));
  }
  function toggleWa(id) { setPerm((p) => ({ ...p, wa_instancias: waInst.includes(id) ? waInst.filter((i) => i !== id) : [...waInst, id] })); }
  function toggleAg(ag) { setPerm((p) => ({ ...p, agencias: agencias.includes(ag) ? agencias.filter((a) => a !== ag) : [...agencias, ag] })); }

  async function salvar() {
    try {
      await supabase.from("permissoes_usuario").upsert({
        pessoa_id: pessoa.id, modulos: perm.modulos, wa_instancias: perm.wa_instancias,
        agencias: perm.agencias || [], ver_todos_clientes: perm.ver_todos_clientes,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: "pessoa_id" });
      onToast("Permissões salvas!");
    } catch (e) { onToast("Erro: " + e.message); }
  }

  return (
    <div className="perm-tab">
      {/* Agências */}
      <div className="perm-section">
        <h4 style={{ fontSize: 13, fontWeight: 800, margin: "0 0 8px" }}>Agências visíveis</h4>
        <div className="perm-checks" style={{ paddingLeft: 0 }}>
          {AGENCIAS.map((ag) => (
            <label key={ag} className="perm-check"><input type="checkbox" checked={agencias.includes(ag)} onChange={() => toggleAg(ag)} /> {ag}</label>
          ))}
          <label className="perm-check"><input type="checkbox" checked={agencias.length === 0} onChange={() => setPerm((p) => ({ ...p, agencias: [] }))} /> Todas</label>
        </div>
      </div>

      {/* Módulos */}
      <div className="perm-section" style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0 }}>Módulos</h4>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-sm btn-ghost" onClick={() => setPerm((p) => ({ ...p, modulos: [...TODOS_MODS] }))}>Todos</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setPerm((p) => ({ ...p, modulos: [] }))}>Nenhum</button>
          </div>
        </div>
        {GRUPOS.map((g) => (
          <div key={g} className="perm-grupo">
            <label className="perm-grupo-label" onClick={() => toggleGrupo(g)}>
              <input type="checkbox" checked={MODULOS.filter((m) => m.grupo === g).every((m) => modulos.includes(m.id))} readOnly /> {g}
            </label>
            <div className="perm-checks">
              {MODULOS.filter((m) => m.grupo === g).map((m) => (
                <label key={m.id} className="perm-check"><input type="checkbox" checked={modulos.includes(m.id)} onChange={() => toggleMod(m.id)} /> {m.nome}</label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* WhatsApp */}
      <div className="perm-section" style={{ marginTop: 14 }}>
        <h4 style={{ fontSize: 13, fontWeight: 800, margin: "0 0 8px" }}>Instâncias de WhatsApp</h4>
        {instancias.length === 0 ? <p style={{ fontSize: 12, color: "var(--ink-faint)" }}>Nenhuma instância.</p> : (
          <div className="perm-checks" style={{ paddingLeft: 0 }}>
            {instancias.map((i) => <label key={i.id} className="perm-check"><input type="checkbox" checked={waInst.includes(i.id)} onChange={() => toggleWa(i.id)} /> {i.nome}</label>)}
          </div>
        )}
      </div>

      {/* Ver todos */}
      <div className="perm-section" style={{ marginTop: 14 }}>
        <label className="perm-check"><input type="checkbox" checked={perm.ver_todos_clientes} onChange={(e) => setPerm((p) => ({ ...p, ver_todos_clientes: e.target.checked }))} /> <strong>Ver todos os clientes</strong></label>
      </div>

      <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} onClick={salvar}>Salvar permissões</button>
    </div>
  );
}

export default function Admin({ perfis, meuId, onToast, onReload, isMaster }) {
  const [modal, setModal] = useState(null);
  const [abaAberta, setAbaAberta] = useState(null); // pessoa.id da aba de permissões aberta
  const [instancias, setInstancias] = useState([]);

  useEffect(() => { supabase.from("wa_instancias").select("*").eq("ativo", true).then(({ data }) => setInstancias(data || [])); }, []);

  async function mudarPapel(p, novoPapel) {
    // Conceder acesso de administrador é exclusivo do master
    if (!isMaster) { onToast("Apenas o administrador principal pode alterar papéis"); return; }
    if (novoPapel === "admin" && !confirm(
      `Tornar ${p.nome} administrador?\n\nEle passará a ver todos os módulos do sistema, ` +
      `exceto a gestão de usuários e os logs.`)) return;
    try { await atualizarPerfil(p.id, { papel: novoPapel }); onToast(`${p.nome} agora é ${novoPapel}`); onReload(); } catch (e) { onToast("Erro: " + e.message); }
  }
  async function alternarBloqueio(p) {
    try { await definirBloqueio(p.id, !p.bloqueado); onToast(p.bloqueado ? "Desbloqueado" : "Bloqueado"); onReload(); } catch (e) { onToast("Erro: " + e.message); }
  }
  async function excluir(p) {
    if (!confirm(`Excluir ${p.nome}?`)) return;
    try { await excluirPerfil(p.id); onToast("Excluído"); onReload(); } catch (e) { onToast("Erro: " + e.message); }
  }
  async function criarUsuario(dados) {
    try { await adminCriarUsuario(dados); onToast("Usuário criado"); setModal(null); onReload(); } catch (e) { onToast("Erro: " + e.message); }
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Administradores e Equipe</h1><p>Gerencie usuários, papéis e permissões.</p></div>
        <div className="head-actions">
          <button className="btn btn-sm btn-primary" onClick={() => setModal({})}><Icon.Plus /> Novo usuário</button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {perfis.map((p) => {
          const euMesmo = p.id === meuId;
          const master = isMaster && euMesmo;
          const abaOpen = abaAberta === p.id;
          return (
            <div key={p.id} className="card" style={{ overflow: "hidden" }}>
              <div className="admin-user-row">
                <div className="admin-user-avatar">{(p.nome || "?").charAt(0).toUpperCase()}</div>
                <div className="admin-user-info">
                  <div className="admin-user-nome">
                    {p.nome || "(sem nome)"}
                    {master && <span className="pill done" style={{ marginLeft: 6, fontSize: 9 }}>MASTER</span>}
                    {p.bloqueado && <span className="pill off" style={{ marginLeft: 6 }}>Bloqueado</span>}
                    {euMesmo && !master && <span className="pill" style={{ marginLeft: 6 }}>Você</span>}
                  </div>
                  <div className="admin-user-meta">{p.email} · {p.papel}</div>
                </div>
                <div className="admin-user-actions">
                  <button className="btn btn-sm" onClick={() => setAbaAberta(abaOpen ? null : p.id)}>
                    {abaOpen ? "Fechar" : "Permissões"}
                  </button>
                  {!master && (
                    <>
                      <button className="btn btn-sm" onClick={() => mudarPapel(p, p.papel === "admin" ? "gestor" : "admin")}
                        disabled={euMesmo || !isMaster} title={isMaster ? "" : "Apenas o administrador principal pode alterar papéis"}>
                        {p.papel === "admin" ? "→ Gestor" : "→ Admin"}
                      </button>
                      <button className="btn btn-sm" onClick={() => alternarBloqueio(p)} disabled={euMesmo}>
                        {p.bloqueado ? "Desbloquear" : "Bloquear"}
                      </button>
                      <button className="iconbtn" onClick={() => excluir(p)} disabled={euMesmo}><Icon.Trash /></button>
                    </>
                  )}
                </div>
              </div>
              {abaOpen && (
                <div className="admin-perm-panel">
                  <PermissoesTab pessoa={p} instancias={instancias} onToast={onToast} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modal && (
        <Modal title="Novo usuário" onClose={() => setModal(null)} footer={null}>
          <FormNovoUsuario onSubmit={criarUsuario} onClose={() => setModal(null)} isMaster={isMaster} />
        </Modal>
      )}
    </>
  );
}

function FormNovoUsuario({ onSubmit, onClose, isMaster }) {
  const [f, setF] = useState({ nome: "", email: "", senha: "", papel: "gestor" });
  const s = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <>
      <div className="form-row"><label>Nome</label><input className="input" value={f.nome} onChange={(e) => s("nome", e.target.value)} autoFocus /></div>
      <div className="form-row"><label>Email</label><input className="input" type="email" value={f.email} onChange={(e) => s("email", e.target.value)} /></div>
      <div className="form-row"><label>Senha</label><input className="input" type="password" value={f.senha} onChange={(e) => s("senha", e.target.value)} /></div>
      <div className="form-row"><label>Papel</label><select className="select" value={f.papel} onChange={(e) => s("papel", e.target.value)}><option value="gestor">Gestor</option>{isMaster && <option value="admin">Administrador</option>}</select>
        <span className="form-dica">Gestores só enxergam os módulos que você liberar nas permissões.</span></div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!f.nome || !f.email || !f.senha} onClick={() => onSubmit(f)}>Criar</button>
      </div>
    </>
  );
}
