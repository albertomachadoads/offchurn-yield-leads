import { useEffect, useRef, useState } from "react";
import { Icon, Modal } from "./components.jsx";
import { supabase } from "./supabaseClient.js";
import * as api from "./api.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const fmtHora = (iso) => { if (!iso) return ""; const d = new Date(iso); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };
const fmtData = (iso) => { if (!iso) return ""; const d = new Date(iso); return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`; };

/* ---- Enviar via Edge Function ---- */
async function enviarMsg({ instanciaId, numero, tipo, conteudo, midiaUrl, nomeArquivo, midiaMime }) {
  const sess = await supabase.auth.getSession();
  const token = sess.data.session?.access_token;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ instanciaId, numero, tipo, conteudo, midiaUrl, nomeArquivo, midiaMime }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Falha ao enviar");
  return data;
}

/* ---- Avatar ---- */
function Avatar({ nome, foto }) {
  if (foto) return <img src={foto} alt="" className="wa-avatar" />;
  return <div className="wa-avatar wa-avatar-default"><svg width="20" height="20" viewBox="0 0 24 24" fill="#999" opacity="0.5"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/></svg></div>;
}

/* ---- Bolha de mensagem ---- */
function MsgBolha({ msg }) {
  const isOut = msg.direcao === "out";
  return (
    <div className={`wa-bolha ${isOut ? "wa-out" : "wa-in"}`}>
      {msg.tipo === "image" && msg.midia_url && <img src={msg.midia_url} alt="" className="wa-msg-img" />}
      {(msg.tipo === "audio" || msg.tipo === "ptt") && msg.midia_url && <div className="wa-msg-audio"><audio controls src={msg.midia_url} preload="none" /></div>}
      {msg.tipo === "video" && msg.midia_url && <video controls src={msg.midia_url} className="wa-msg-video" preload="none" />}
      {msg.tipo === "document" && <a href={msg.midia_url} target="_blank" rel="noopener noreferrer" className="wa-msg-doc">📄 {msg.nome_arquivo || "Documento"}</a>}
      {msg.conteudo && !["[Imagem]","[Áudio]","[Vídeo]","[sticker]"].includes(msg.conteudo) && <p className="wa-msg-text">{msg.conteudo}</p>}
      <span className="wa-hora">{fmtHora(msg.criado_em)}</span>
    </div>
  );
}

/* ---- Modal criar instância ---- */
function InstanciaModal({ base, onSave, onClose }) {
  const [f, setF] = useState({
    nome: base?.nome || "", server_url: base?.server_url || "https://madsoffchurn.uazapi.com",
    instancia: base?.instancia || "", token: base?.token || "", agencia: base?.agencia || "Yield",
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal title={base?.id ? "Editar instância" : "Nova instância WhatsApp"} onClose={onClose} footer={
      <><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" disabled={!f.nome.trim() || !f.instancia.trim() || !f.token.trim()}
        onClick={() => onSave({ ...base, ...f })}>Salvar</button></>
    }>
      <div className="form-row"><label>Nome (ex: WhatsApp João)</label><input className="input" value={f.nome} onChange={(e) => set("nome", e.target.value)} autoFocus /></div>
      <div className="form-grid">
        <div className="form-row"><label>Server URL</label><input className="input" value={f.server_url} onChange={(e) => set("server_url", e.target.value)} /></div>
        <div className="form-row"><label>Agência</label><select className="select" value={f.agencia} onChange={(e) => set("agencia", e.target.value)}>
          <option>Yield</option><option>Mads</option>
        </select></div>
      </div>
      <div className="form-grid">
        <div className="form-row"><label>ID da instância</label><input className="input" value={f.instancia} onChange={(e) => set("instancia", e.target.value)} /></div>
        <div className="form-row"><label>Token</label><input className="input" value={f.token} onChange={(e) => set("token", e.target.value)} /></div>
      </div>
    </Modal>
  );
}

/* ---- Modal criar lead/negociação ---- */
function CriarLeadModal({ numero, nome, onClose, onToast }) {
  const [crm, setCrm] = useState(null);
  const [f, setF] = useState({ nome: nome || "", whatsapp: numero || "", email: "", funilId: "" });
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => { api.fetchCRM().then(setCrm).catch(() => {}); }, []);

  const funis = crm?.funis || [];
  const funilSel = funis.find((f2) => f2.id === f.funilId);
  const primeiraEtapa = funilSel ? (crm.etapas || []).filter((e) => e.funilId === funilSel.id).sort((a, b) => a.ordem - b.ordem)[0] : null;

  async function salvar() {
    if (!f.nome.trim() || !f.funilId) return;
    setSalvando(true);
    try {
      await api.crmLeadSave({
        nome: f.nome.trim(), whatsapp: f.whatsapp, email: f.email || null,
        funilId: f.funilId, etapaId: primeiraEtapa?.id, valor: 0, tags: "[]", camposCustom: "{}",
      });
      onToast("Lead criado no CRM!"); onClose();
    } catch (e) { onToast("Erro: " + e.message); }
    finally { setSalvando(false); }
  }

  return (
    <Modal title="Nova negociação" onClose={onClose} footer={
      <><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" disabled={!f.nome.trim() || !f.funilId || salvando} onClick={salvar}>
        {salvando ? "Criando..." : "Criar lead"}
      </button></>
    }>
      <div className="form-row"><label>Nome do lead *</label><input className="input" value={f.nome} onChange={(e) => set("nome", e.target.value)} autoFocus /></div>
      <div className="form-grid">
        <div className="form-row"><label>WhatsApp</label><input className="input" value={f.whatsapp} readOnly style={{ opacity: 0.7 }} /></div>
        <div className="form-row"><label>Email (opcional)</label><input className="input" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
      </div>
      <div className="form-row"><label>Funil *</label>
        <select className="select" value={f.funilId} onChange={(e) => set("funilId", e.target.value)}>
          <option value="">Selecione o funil</option>
          {funis.map((fn) => <option key={fn.id} value={fn.id}>{fn.nome}</option>)}
        </select>
      </div>
      {primeiraEtapa && <p style={{ fontSize: 12, color: "var(--ink-faint)", margin: "6px 0 0" }}>Entrará na etapa: <strong>{primeiraEtapa.nome}</strong></p>}
    </Modal>
  );
}

/* ---- Componente principal ---- */
export default function WhatsAppChat({ isAdmin, onToast }) {
  const [instancias, setInstancias] = useState([]);
  const [instAtiva, setInstAtiva] = useState(null);
  const [conversas, setConversas] = useState([]);
  const [convAberta, setConvAberta] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [busca, setBusca] = useState("");
  const [modalInst, setModalInst] = useState(null);
  const [viewInst, setViewInst] = useState(false);
  const [modalLead, setModalLead] = useState(null);
  const chatRef = useRef(null);

  async function carregarInstancias() {
    const { data } = await supabase.from("wa_instancias").select("*").eq("ativo", true);
    setInstancias(data || []);
    if (data?.length > 0 && !instAtiva) setInstAtiva(data[0]);
  }
  useEffect(() => { carregarInstancias(); }, []);

  async function carregarConversas() {
    if (!instAtiva) return;
    const { data } = await supabase.from("wa_conversas").select("*")
      .eq("instancia_id", instAtiva.id).order("ultima_msg_em", { ascending: false });
    setConversas(data || []);
  }
  useEffect(() => { if (instAtiva) carregarConversas(); }, [instAtiva?.id]);

  useEffect(() => {
    if (!instAtiva) return;
    const chan = supabase.channel("wa-conv-" + instAtiva.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_conversas" }, () => carregarConversas())
      .subscribe();
    return () => supabase.removeChannel(chan);
  }, [instAtiva?.id]);

  async function carregarMensagens() {
    if (!convAberta) return;
    const { data } = await supabase.from("wa_mensagens").select("*")
      .eq("conversa_id", convAberta.id).order("criado_em", { ascending: true });
    setMensagens(data || []);
    setTimeout(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, 100);
    supabase.from("wa_conversas").update({ nao_lidas: 0 }).eq("id", convAberta.id);
  }
  useEffect(() => { if (convAberta) carregarMensagens(); }, [convAberta?.id]);

  useEffect(() => {
    if (!convAberta) return;
    const chan = supabase.channel("wa-msg-" + convAberta.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wa_mensagens", filter: `conversa_id=eq.${convAberta.id}` }, () => carregarMensagens())
      .subscribe();
    return () => supabase.removeChannel(chan);
  }, [convAberta?.id]);

  async function enviar() {
    if (!texto.trim() || !convAberta || !instAtiva || enviando) return;
    setEnviando(true);
    try {
      await enviarMsg({ instanciaId: instAtiva.id, numero: convAberta.numero, tipo: "text", conteudo: texto.trim() });
      setTexto("");
      carregarMensagens(); carregarConversas();
    } catch (e) { onToast("Erro: " + e.message); }
    finally { setEnviando(false); }
  }

  async function enviarArquivo(tipo) {
    const url = prompt(tipo === "document" ? "Cole a URL do documento:" : tipo === "image" ? "Cole a URL da imagem:" : tipo === "audio" ? "Cole a URL do áudio:" : "Cole a URL do vídeo:");
    if (!url?.trim() || !convAberta || !instAtiva) return;
    setEnviando(true);
    try {
      await enviarMsg({ instanciaId: instAtiva.id, numero: convAberta.numero, tipo, midiaUrl: url.trim(), conteudo: "", nomeArquivo: tipo === "document" ? "documento" : "" });
      carregarMensagens(); carregarConversas(); onToast("Enviado!");
    } catch (e) { onToast("Erro: " + e.message); }
    finally { setEnviando(false); }
  }

  async function salvarInstancia(inst) {
    try {
      const { error } = await supabase.from("wa_instancias").upsert({
        id: inst.id || undefined, nome: inst.nome, server_url: inst.server_url,
        instancia: inst.instancia, token: inst.token, agencia: inst.agencia, ativo: true,
      });
      if (error) throw error;
      setModalInst(null); carregarInstancias(); onToast("Instância salva");
    } catch (e) { onToast("Erro: " + e.message); }
  }

  const convsFiltradas = busca ? conversas.filter((c) => (c.nome || c.numero || "").toLowerCase().includes(busca.toLowerCase())) : conversas;

  // View de gerenciamento
  if (viewInst) return (
    <>
      <div className="page-head">
        <div><h1>Instâncias WhatsApp</h1><p>WhatsApps conectados ao sistema</p></div>
        <div className="head-actions">
          <button className="btn btn-sm btn-ghost" onClick={() => setViewInst(false)}>‹ Voltar</button>
          <button className="btn btn-sm btn-primary" onClick={() => setModalInst({})}><Icon.Plus /> Nova instância</button>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {instancias.length === 0 && <div className="empty"><p>Nenhuma instância.</p></div>}
        {instancias.map((inst) => (
          <div key={inst.id} className="auto-list-item">
            <div className="auto-list-icon">📱</div>
            <div className="auto-list-info">
              <div className="auto-list-nome">{inst.nome}</div>
              <div className="auto-list-meta">{inst.instancia} · {inst.agencia}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-sm" onClick={() => setModalInst(inst)}>Editar</button>
              <button className="iconbtn" onClick={async () => {
                if (!confirm("Excluir?")) return;
                await supabase.from("wa_instancias").delete().eq("id", inst.id);
                carregarInstancias();
              }}><Icon.Trash /></button>
            </div>
          </div>
        ))}
      </div>
      {modalInst && <InstanciaModal base={modalInst} onSave={salvarInstancia} onClose={() => setModalInst(null)} />}
    </>
  );

  return (
    <>
      <div className="page-head">
        <div><h1>WhatsApp</h1><p>{conversas.length} conversa{conversas.length !== 1 ? "s" : ""}</p></div>
        <div className="head-actions">
          <select className="select" style={{ width: "auto", minWidth: 160 }} value={instAtiva?.id || ""} onChange={(e) => { setInstAtiva(instancias.find((i) => i.id === e.target.value)); setConvAberta(null); }}>
            {instancias.length === 0 && <option value="">Nenhuma instância</option>}
            {instancias.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
          </select>
          {isAdmin && <button className="btn btn-sm" onClick={() => setViewInst(true)}>⚙ Instâncias</button>}
        </div>
      </div>

      <div className="wa-layout">
        <div className="wa-sidebar">
          <div className="wa-search"><input className="input" placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
          <div className="wa-conv-list">
            {convsFiltradas.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--ink-faint)", fontSize: 13 }}>
                {instancias.length === 0 ? "Configure uma instância." : "Nenhuma conversa."}
              </div>
            ) : convsFiltradas.map((c) => (
              <div key={c.id} className={`wa-conv-item ${convAberta?.id === c.id ? "wa-conv-ativa" : ""}`} onClick={() => setConvAberta(c)}>
                <Avatar nome={c.nome} foto={c.foto_url} />
                <div className="wa-conv-info">
                  <div className="wa-conv-nome">
                    {c.nome || c.numero}
                    {!c.lead_id && <span className="wa-new-lead-badge" title="Novo lead">🆕</span>}
                  </div>
                  <div className="wa-conv-ultima">{c.ultima_msg || "…"}</div>
                </div>
                <div className="wa-conv-meta">
                  <div className="wa-conv-hora">{fmtData(c.ultima_msg_em)} {fmtHora(c.ultima_msg_em)}</div>
                  {c.nao_lidas > 0 && <div className="wa-badge">{c.nao_lidas}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="wa-chat">
          {!convAberta ? (
            <div className="wa-chat-empty"><div style={{ fontSize: 48, opacity: 0.2 }}>💬</div><p>Selecione uma conversa</p></div>
          ) : (
            <>
              <div className="wa-chat-header">
                <button className="iconbtn wa-back-btn" onClick={() => setConvAberta(null)}>‹</button>
                <Avatar nome={convAberta.nome} foto={convAberta.foto_url} />
                <div className="wa-chat-header-info">
                  <div className="wa-chat-header-nome">{convAberta.nome || convAberta.numero}</div>
                  <div className="wa-chat-header-num">{convAberta.numero}</div>
                </div>
                {!convAberta.lead_id && (
                  <button className="btn btn-sm btn-primary" onClick={() => setModalLead({ numero: convAberta.numero, nome: convAberta.nome })}>
                    + Negociação
                  </button>
                )}
                {convAberta.lead_id && <span className="pill done" style={{ fontSize: 10 }}>No CRM</span>}
              </div>

              <div className="wa-messages" ref={chatRef}>
                {mensagens.map((m) => <MsgBolha key={m.id} msg={m} />)}
              </div>

              <div className="wa-input-bar">
                <div className="wa-attach-menu">
                  <button className="iconbtn" title="Imagem" onClick={() => enviarArquivo("image")}>🖼️</button>
                  <button className="iconbtn" title="Documento" onClick={() => enviarArquivo("document")}>📄</button>
                  <button className="iconbtn" title="Áudio" onClick={() => enviarArquivo("audio")}>🎵</button>
                  <button className="iconbtn" title="Vídeo" onClick={() => enviarArquivo("video")}>🎬</button>
                </div>
                <input className="input wa-input" placeholder="Digite uma mensagem…" value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                  disabled={enviando} />
                <button className="btn btn-primary wa-send-btn" onClick={enviar} disabled={enviando || !texto.trim()}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {modalLead && <CriarLeadModal numero={modalLead.numero} nome={modalLead.nome} onClose={() => { setModalLead(null); carregarConversas(); }} onToast={onToast} />}
    </>
  );
}
