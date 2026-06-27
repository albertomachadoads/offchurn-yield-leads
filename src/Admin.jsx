import { useState } from "react";
import { adminCriarUsuario, atualizarPerfil } from "./auth";
import { Icon, Modal } from "./components.jsx";

export default function Admin({ perfis, onToast, onReload }) {
  const [modal, setModal] = useState(null);

  const admins = perfis.filter((p) => p.papel === "admin");
  const gestores = perfis.filter((p) => p.papel === "gestor");

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
            : admins.map((p) => (
              <div className="list-row" key={p.id}>
                <div>
                  <div className="lr-name">{p.nome || "(sem nome)"}</div>
                  <div className="lr-meta">Administrador</div>
                </div>
                <button className="btn btn-sm" onClick={() => mudarPapel(p, "gestor")}>Tornar gestor</button>
              </div>
            ))}
        </div>

        <div className="card">
          <div className="card-head-row">
            <h2 className="section-title" style={{ margin: 0 }}>Gestores ({gestores.length})</h2>
          </div>
          {gestores.length === 0
            ? <div className="list-row"><div className="lr-meta">Nenhum gestor.</div></div>
            : gestores.map((p) => (
              <div className="list-row" key={p.id}>
                <div>
                  <div className="lr-name">{p.nome || "(sem nome)"}</div>
                  <div className="lr-meta">Gestor</div>
                </div>
                <button className="btn btn-sm" onClick={() => mudarPapel(p, "admin")}>Tornar admin</button>
              </div>
            ))}
        </div>
      </div>

      <div className="aviso-monday" style={{ marginTop: 20 }}>
        <span className="aviso-ico">i</span>
        <span>Ao criar um usuário, informe o e-mail e a senha. A pessoa usa esses dados para entrar. Você pode alterar o papel (admin/gestor) a qualquer momento.</span>
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
      onReload();
    } catch (e) {
      onToast("Erro: " + (e.message || "falha ao atualizar"));
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
