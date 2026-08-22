import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { Modal } from "./components.jsx";

/* ============================================================
   Otimizador — três agentes de IA por cliente.

   O prompt de cada agente vive no banco e só o administrador
   principal edita. A chave da API fica na Edge Function.
   ============================================================ */

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const LIMITE_ANEXO = 8 * 1024 * 1024;   // 8 MB por arquivo

async function chamar(payload) {
  const sess = await supabase.auth.getSession();
  const token = sess.data.session?.access_token;
  if (!token) throw new Error("Sua sessão expirou. Entre no sistema novamente.");
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/functions/v1/ia-otimizador`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("O serviço de IA ainda não foi publicado no servidor.");
  }
  const d = await r.json().catch(() => ({}));
  if (!d.ok) throw new Error(d.erro || `Falha na comunicação (HTTP ${r.status})`);
  return d;
}

const ICONES = {
  especialista: <path d="M12 2a7 7 0 00-4 12.7V17a2 2 0 002 2h4a2 2 0 002-2v-2.3A7 7 0 0012 2zM9 21h6" />,
  gestor: <><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></>,
  copy: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></>,
};

/* Converte arquivo em base64 para enviar à API */
function lerArquivo(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(new Error("Não foi possível ler o arquivo"));
    r.readAsDataURL(file);
  });
}

/* ---------- Configuração de prompts (só o master) ---------- */
function ConfigAgentes({ agentes, modos, usuario, onFechar, onToast, onSalvo }) {
  const [sel, setSel] = useState(agentes[0]?.id || "");
  const [selModo, setSelModo] = useState("");
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  const agente = agentes.find((a) => a.id === sel);
  const modosDo = modos.filter((m) => m.agente_id === sel);
  const modo = modosDo.find((m) => m.id === selModo);

  useEffect(() => {
    setTexto(modo ? (modo.prompt_base || "") : (agente?.prompt_base || ""));
  }, [sel, selModo, agente, modo]);

  async function salvar() {
    setSalvando(true);
    try {
      await chamar({
        acao: "salvar_prompt",
        emailUsuario: usuario?.email,
        agenteId: sel,
        modoId: selModo || null,
        promptBase: texto,
      });
      onToast("Prompt salvo");
      onSalvo();
    } catch (e) { onToast("Erro: " + e.message); }
    finally { setSalvando(false); }
  }

  return (
    <Modal title="Configuração dos agentes" onClose={onFechar} wide footer={
      <>
        <button className="btn btn-ghost" onClick={onFechar}>Fechar</button>
        <button className="btn btn-primary" disabled={salvando} onClick={salvar}>
          {salvando ? "Salvando…" : "Salvar prompt"}
        </button>
      </>
    }>
      <div className="ot-cfg">
        <div className="ot-cfg-abas">
          {agentes.map((a) => (
            <button key={a.id} className={`ot-cfg-aba ${sel === a.id ? "on" : ""}`}
              onClick={() => { setSel(a.id); setSelModo(""); }}>{a.nome}</button>
          ))}
        </div>

        {modosDo.length > 0 && (
          <div className="ot-cfg-modos">
            <button className={`ot-cfg-modo ${!selModo ? "on" : ""}`} onClick={() => setSelModo("")}>
              Instrução geral
            </button>
            {modosDo.map((m) => (
              <button key={m.id} className={`ot-cfg-modo ${selModo === m.id ? "on" : ""}`}
                onClick={() => setSelModo(m.id)}>{m.nome}</button>
            ))}
          </div>
        )}

        <p className="ot-cfg-dica">
          {selModo
            ? `Instrução específica de “${modo?.nome}”. Ela é somada à instrução geral do agente.`
            : "Instrução base do agente. Vale para todas as tarefas dele."}
        </p>

        <textarea className="ot-cfg-texto" value={texto} onChange={(e) => setTexto(e.target.value)}
          rows={18} spellCheck={false} placeholder="Descreva como o agente deve se comportar…" />

        <span className="ot-cfg-contagem">{texto.length} caracteres</span>
      </div>
    </Modal>
  );
}

/* ================= OTIMIZADOR ================= */
export default function Otimizador({ cliente, usuario, isMaster, onToast }) {
  const [cfg, setCfg] = useState(null);
  const [erroCfg, setErroCfg] = useState("");
  const [agente, setAgente] = useState("especialista");
  const [modo, setModo] = useState("");
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState("");
  const [anexos, setAnexos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [modalCfg, setModalCfg] = useState(false);
  const fimRef = useRef(null);
  const arquivoRef = useRef(null);

  useEffect(() => {
    chamar({ acao: "config" })
      .then(setCfg)
      .catch((e) => setErroCfg(e.message));
  }, []);

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensagens, enviando]);

  const agentes = cfg?.agentes || [];
  const modosDo = useMemo(
    () => (cfg?.modos || []).filter((m) => m.agente_id === agente),
    [cfg, agente]
  );
  const agenteAtual = agentes.find((a) => a.id === agente);

  // Ao trocar de agente, limpa a conversa: contextos diferentes não se misturam
  useEffect(() => { setMensagens([]); setModo(modosDo[0]?.id || ""); }, [agente]); // eslint-disable-line

  async function anexar(e) {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    for (const f of files) {
      if (f.size > LIMITE_ANEXO) { onToast(`${f.name} passa de 8 MB`); continue; }
      const ok = f.type.startsWith("image/") || f.type === "application/pdf";
      if (!ok) { onToast("Aceito apenas imagens e PDF"); continue; }
      try {
        const dados = await lerArquivo(f);
        setAnexos((p) => [...p, { nome: f.name, tipo: f.type, tamanho: f.size, dados }]);
      } catch { onToast(`Falha ao ler ${f.name}`); }
    }
  }

  async function enviar() {
    if ((!texto.trim() && anexos.length === 0) || enviando) return;
    const minha = {
      papel: "user",
      conteudo: texto.trim(),
      anexos: anexos.map((a) => ({ nome: a.nome, tipo: a.tipo })),
    };
    const historico = mensagens.map((m) => ({ papel: m.papel, conteudo: m.conteudo }));
    setMensagens((p) => [...p, minha]);
    const enviarAnexos = anexos;
    setTexto(""); setAnexos([]); setEnviando(true);

    try {
      const r = await chamar({
        acao: "conversar",
        agenteId: agente,
        modoId: modo || null,
        clienteId: cliente.id,
        mensagem: minha.conteudo,
        historico,
        anexos: enviarAnexos,
      });
      setMensagens((p) => [...p, { papel: "assistant", conteudo: r.resposta }]);
    } catch (e) {
      setMensagens((p) => [...p, { papel: "erro", conteudo: e.message }]);
    } finally { setEnviando(false); }
  }

  if (erroCfg) {
    return (
      <div className="ot-aviso">
        <strong>Otimizador indisponível</strong>
        <p>{erroCfg}</p>
        <p className="ot-aviso-dica">
          Publique a função <code>ia-otimizador</code> no Supabase e rode o SQL do módulo.
        </p>
      </div>
    );
  }
  if (!cfg) return <div className="ot-carregando">Carregando agentes…</div>;

  return (
    <div className="ot">
      {/* Agentes */}
      <div className="ot-topo">
        <div className="ot-agentes">
          {agentes.map((a) => (
            <button key={a.id} className={`ot-agente ${agente === a.id ? "on" : ""}`} onClick={() => setAgente(a.id)}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {ICONES[a.id] || ICONES.especialista}
              </svg>
              <div>
                <strong>{a.nome}</strong>
                <small>{a.descricao}</small>
              </div>
            </button>
          ))}
        </div>
        {isMaster && (
          <button className="ot-cfg-btn" onClick={() => setModalCfg(true)} title="Configurar prompts dos agentes">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9v0a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            Configurar
          </button>
        )}
      </div>

      {/* Modos do agente */}
      {modosDo.length > 0 && (
        <div className="ot-modos">
          {modosDo.map((m) => (
            <button key={m.id} className={`ot-modo ${modo === m.id ? "on" : ""}`}
              onClick={() => setModo(m.id)} title={m.descricao}>{m.nome}</button>
          ))}
        </div>
      )}

      {!cliente.contextoIa && (
        <div className="ot-aviso-ctx">
          Contexto do negócio não preenchido. Abra <strong>Editar metas → Contexto para IA</strong> e
          descreva o cliente — sem isso os agentes respondem de forma genérica.
        </div>
      )}

      {!cfg.chaveConfigurada && (
        <div className="ot-aviso-topo">
          A chave da API de IA não está configurada. Cadastre <code>ANTHROPIC_API_KEY</code> nos
          secrets da função <code>ia-otimizador</code> para começar a usar.
        </div>
      )}

      {/* Conversa */}
      <div className="ot-conversa">
        {mensagens.length === 0 ? (
          <div className="ot-inicio">
            <div className="ot-inicio-ico">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                {ICONES[agente] || ICONES.especialista}
              </svg>
            </div>
            <h3>{agenteAtual?.nome}</h3>
            <p>{agenteAtual?.descricao}</p>
            <span className="ot-inicio-ctx">
              {cliente.contextoIa
                ? <>Este agente conhece o contexto de <strong>{cliente.nome}</strong> — negócio, público,
                    tom de voz e restrições, além dos dados de verba e desempenho.</>
                : <>Este agente conhece os dados de <strong>{cliente.nome}</strong>, mas o contexto do
                    negócio ainda não foi preenchido. As respostas ficam mais precisas com ele.</>}
            </span>
          </div>
        ) : mensagens.map((m, i) => (
          <div key={i} className={`ot-msg ot-msg-${m.papel}`}>
            {m.papel !== "user" && (
              <span className="ot-msg-autor">{m.papel === "erro" ? "Erro" : agenteAtual?.nome}</span>
            )}
            <div className="ot-msg-txt">{m.conteudo}</div>
            {m.anexos?.length > 0 && (
              <div className="ot-msg-anexos">
                {m.anexos.map((a, k) => <span key={k} className="ot-anexo-tag">{a.nome}</span>)}
              </div>
            )}
          </div>
        ))}
        {enviando && (
          <div className="ot-msg ot-msg-assistant">
            <span className="ot-msg-autor">{agenteAtual?.nome}</span>
            <div className="ot-pensando"><i /><i /><i /></div>
          </div>
        )}
        <div ref={fimRef} />
      </div>

      {/* Entrada */}
      {anexos.length > 0 && (
        <div className="ot-anexos">
          {anexos.map((a, i) => (
            <span key={i} className="ot-anexo">
              {a.tipo.startsWith("image/") ? "🖼" : "📄"} {a.nome}
              <button onClick={() => setAnexos((p) => p.filter((_, k) => k !== i))} aria-label="Remover">×</button>
            </span>
          ))}
        </div>
      )}

      <div className="ot-entrada">
        <button className="ot-clipe" onClick={() => arquivoRef.current?.click()} title="Anexar imagem ou PDF">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
        </button>
        <input ref={arquivoRef} type="file" multiple accept="image/*,application/pdf"
          style={{ display: "none" }} onChange={anexar} />
        <textarea className="ot-campo" value={texto} rows={1}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          placeholder={`Pergunte ao ${agenteAtual?.nome || "agente"}…  (Enter envia, Shift+Enter quebra linha)`} />
        <button className="ot-enviar" disabled={enviando || (!texto.trim() && anexos.length === 0)} onClick={enviar}>
          {enviando ? "…" : "Enviar"}
        </button>
      </div>

      {modalCfg && (
        <ConfigAgentes agentes={agentes} modos={cfg.modos} usuario={usuario} onToast={onToast}
          onFechar={() => setModalCfg(false)}
          onSalvo={() => chamar({ acao: "config" }).then(setCfg)} />
      )}
    </div>
  );
}
