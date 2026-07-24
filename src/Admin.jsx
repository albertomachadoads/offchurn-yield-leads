import { useState } from "react";
import { adminCriarUsuario, atualizarPerfil, definirBloqueio, excluirPerfil } from "./auth";
import { Icon, Modal } from "./components.jsx";

export default function Admin({ perfis, meuId, onToast, onReload }) {
  const [modal, setModal] = useState(null);

  const admins = perfis.filter((p) => p.papel === "admin");
  const gestores = perfis.filter((p) => p.papel === "gestor");

  function LinhaUsuario({ p, papelLabel }) {
    const euMesmo = p.id === meuId;
    return (
      <div className="list-row" key={p.id}>
        <div>
          <div className="lr-name">
            {p.nome || "(sem nome)"}
            {p.bloqueado && <span className="pill off" style={{ marginLeft: 8 }}>Bloqueado</span>}
            {euMesmo && <span className="pill" style={{ marginLeft: 8 }}>Você</span>}
          </div>
          <div className="lr-meta">{papelLabel}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button className="btn btn-sm" onClick={() => mudarPapel(p, p.papel === "admin" ? "gestor" : "admin")} disabled={euMesmo} title={euMesmo ? "Você não pode alterar seu próprio papel" : ""}>
            {p.papel === "admin" ? "Tornar gestor" : "Tornar admin"}
          </button>
          <button className="btn btn-sm" onClick={() => alternarBloqueio(p)} disabled={euMesmo} title={euMesmo ? "Você não pode se bloquear" : ""}>
            <Icon.Ban /> {p.bloqueado ? "Desbloquear" : "Bloquear"}
          </button>
          <button className="btn btn-sm btn-danger" onClick={() => excluir(p)} disabled={euMesmo} title={euMesmo ? "Você não pode se excluir" : ""}>
            <Icon.Trash />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Administradores</h1>
          <p>Crie e gerencie os usuários do sistema. Apenas administradores acessam esta área.</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary" onClick={() => setModal({ novo: true })}>
            <Icon.Plus /> Novo usuário
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="cad-grid">
        <div className="card">
          <div className="card-head-row">
            <h2 className="section-title" style={{ margin: 0 }}>Administradores ({admins.length})</h2>
          </div>
          {admins.length === 0
            ? <div className="list-row"><div className="lr-meta">Nenhum admin.</div></div>
            : admins.map((p) => <LinhaUsuario key={p.id} p={p} papelLabel="Administrador" />)}
        </div>

        <div className="card">
          <div className="card-head-row">
            <h2 className="section-title" style={{ margin: 0 }}>Gestores ({gestores.length})</h2>
          </div>
          {gestores.length === 0
            ? <div className="list-row"><div className="lr-meta">Nenhum gestor.</div></div>
            : gestores.map((p) => <LinhaUsuario key={p.id} p={p} papelLabel="Gestor" />)}
        </div>
      </div>

      <div className="aviso-monday" style={{ marginTop: 20 }}>
        <span className="aviso-ico">i</span>
        <span>Bloquear impede o acesso sem apagar o usuário (dá para reverter). Excluir remove o acesso ao sistema de forma permanente. Você não pode alterar, bloquear ou excluir a si mesmo.</span>
      </div>

      {modal && (
        <UsuarioModal
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); onReload(); }}
          onToast={onToast}
        />
      )}
    </>
  );

  async function mudarPapel(p, novoPapel) {
    if (!confirm(`Alterar ${p.nome || "usuário"} para ${novoPapel}?`)) return;
    try {
      await atualizarPerfil(p.id, { papel: novoPapel });
      onToast("Papel atualizado");
      logAcao("admin", `Papel de ${p.nome} alterado para ${novoPapel}`);
      onReload();
    } catch (e) {
      onToast("Erro: " + (e.message || "falha ao atualizar"));
    }
  }

  async function alternarBloqueio(p) {
    const acao = p.bloqueado ? "desbloquear" : "bloquear";
    if (!confirm(`Deseja ${acao} ${p.nome || "este usuário"}?`)) return;
    try {
      await definirBloqueio(p.id, !p.bloqueado);
      onToast(p.bloqueado ? "Usuário desbloqueado" : "Usuário bloqueado");
      logAcao("admin", `${p.nome} ${p.bloqueado ? "desbloqueado" : "bloqueado"}`);
      onReload();
    } catch (e) {
      onToast("Erro: " + (e.message || "falha"));
    }
  }

  async function excluir(p) {
    if (!confirm(`Excluir ${p.nome || "este usuário"} permanentemente? Esta ação remove o acesso ao sistema.`)) return;
    try {
      await excluirPerfil(p.id);
      onToast("Usuário excluído");
      logAcao("admin", "Usuário excluído permanentemente");
      onReload();
    } catch (e) {
      onToast("Erro: " + (e.message || "falha"));
    }
  }
}

function UsuarioModal({ onClose, onSaved, onToast }) {
  const [f, setF] = useState({ nome: "", email: "", senha: "", papel: "gestor" });
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const valido = f.nome.trim() && f.email.trim() && f.senha.length >= 6;

  async function salvar() {
    if (!valido) return;
    setSalvando(true);
    try {
      await adminCriarUsuario({
        email: f.email.trim(), senha: f.senha, nome: f.nome.trim(), papel: f.papel,
      });
      onToast("Usuário criado");
      logAcao("admin", `Novo usuário criado: ${nome} (${email})`);
      onSaved();
    } catch (e) {
      onToast("Erro: " + traduz(e.message));
      setSalvando(false);
    }
  }

  return (
    <Modal
      title="Novo usuário"
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={salvar} disabled={!valido || salvando}>
          {salvando ? "Criando…" : "Criar usuário"}
        </button>
      </>}
    >
      <div className="form-row">
        <label>Nome</label>
        <input className="input" value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: João" autoFocus />
      </div>
      <div className="form-row">
        <label>E-mail (login)</label>
        <input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="joao@agencia.com" />
      </div>
      <div className="form-row">
        <label>Senha provisória (mín. 6 caracteres)</label>
        <input className="input" type="text" value={f.senha} onChange={(e) => set("senha", e.target.value)} placeholder="defina uma senha" />
      </div>
      <div className="form-row">
        <label>Papel</label>
        <select className="select" value={f.papel} onChange={(e) => set("papel", e.target.value)}>
          <option value="gestor">Gestor (registra acompanhamentos e tarefas)</option>
          <option value="admin">Administrador (gerencia tudo)</option>
        </select>
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
        Anote a senha e repasse à pessoa. Ela poderá usá-la para entrar imediatamente.
      </div>
    </Modal>
  );
}

function traduz(msg = "") {
  if (msg.includes("already registered")) return "Este e-mail já está cadastrado.";
  if (msg.includes("valid email")) return "E-mail inválido.";
  if (msg.includes("Password")) return "Senha muito curta (mínimo 6 caracteres).";
  return msg || "falha ao criar usuário";
}
