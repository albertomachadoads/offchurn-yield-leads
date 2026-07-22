import { useState } from "react";
import { signIn } from "./auth";

export default function Login({ aviso }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar(e) {
    e?.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      await signIn(email.trim(), senha);
      // o listener de sessão no App cuida do redirecionamento
    } catch (err) {
      setErro(traduzErro(err?.message));
      setCarregando(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <span className="mark">O</span>
          <div>
            <div className="login-name">OffChurn Yield Leads</div>
            <div className="login-sub">Acesso restrito</div>
          </div>
        </div>

        <form onSubmit={entrar} className="login-form">
          <div className="form-row">
            <label>E-mail</label>
            <input className="input" type="email" value={email} autoComplete="username"
              onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" autoFocus />
          </div>
          <div className="form-row">
            <label>Senha</label>
            <input className="input" type="password" value={senha} autoComplete="current-password"
              onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" />
          </div>

          {aviso && <div className="login-erro">{aviso}</div>}
          {erro && <div className="login-erro">{erro}</div>}

          <button className="btn btn-primary login-btn" type="submit" disabled={carregando || !email || !senha}>
            {carregando ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <div className="login-foot">
          Não tem acesso? Solicite a um administrador.
        </div>
      </div>
    </div>
  );
}

function traduzErro(msg = "") {
  if (msg.includes("Invalid login")) return "E-mail ou senha incorretos.";
  if (msg.includes("Email not confirmed")) return "E-mail ainda não confirmado.";
  if (msg.toLowerCase().includes("network")) return "Falha de conexão. Verifique sua internet.";
  return msg || "Não foi possível entrar. Tente novamente.";
}
