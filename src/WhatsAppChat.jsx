import { useEffect, useRef, useState, useCallback } from "react";
import { Icon, Modal } from "./components.jsx";
import { supabase } from "./supabaseClient.js";
import * as api from "./api.js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const fmtHora = (d) => { if (!d) return ""; const x = new Date(d); return `${String(x.getHours()).padStart(2,"0")}:${String(x.getMinutes()).padStart(2,"0")}`; };
const fmtData = (d) => { if (!d) return ""; const x = new Date(d); return `${String(x.getDate()).padStart(2,"0")}/${String(x.getMonth()+1).padStart(2,"0")}`; };
const fmtTimer = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

async function enviarAPI(p) {
  const sess = await supabase.auth.getSession();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send`, {
    method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sess.data.session?.access_token}` },
    body: JSON.stringify(p),
  });
  const d = await r.json(); if (!d.ok) throw new Error(d.error || "Falha"); return d;
}
function fileToBase64(f) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error("Erro")); r.readAsDataURL(f); }); }

function Avatar({ nome, foto }) {
  if (foto) return <img src={foto} alt="" className="wa-avatar" />;
  return <div className="wa-avatar wa-avatar-default"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" opacity="0.3"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/></svg></div>;
}

function MsgBolha({ msg }) {
  const isOut = msg.direcao === "out";
  const hasMedia = msg.midia_url && msg.midia_url.startsWith("http");
  return (
    <div className={`wa-bolha ${isOut ? "wa-out" : "wa-in"}`}>
      {msg.tipo === "image" && hasMedia && <a href={msg.midia_url} target="_blank" rel="noopener noreferrer"><img src={msg.midia_url} alt="" className="wa-msg-img" loading="lazy" /></a>}
      {msg.tipo === "sticker" && hasMedia && <img src={msg.midia_url} alt="" className="wa-msg-sticker" loading="lazy" />}
      {(msg.tipo === "audio" || msg.tipo === "ptt") && hasMedia && <div className="wa-msg-audio"><audio controls src={msg.midia_url} preload="none" /></div>}
      {msg.tipo === "video" && hasMedia && <video controls src={msg.midia_url} className="wa-msg-video" preload="none" />}
      {msg.tipo === "document" && hasMedia && <a href={msg.midia_url} target="_blank" rel="noopener noreferrer" className="wa-msg-doc"><span className="wa-doc-icon">📄</span><div><strong>{msg.nome_arquivo || "Documento"}</strong><small>Baixar</small></div></a>}
      {msg.conteudo && !["[Imagem]","[Áudio]","[Vídeo]","[sticker]","[Sticker]"].includes(msg.conteudo) && <p className="wa-msg-text">{msg.conteudo}</p>}
      <span className="wa-hora">{fmtHora(msg.criado_em)}</span>
    </div>
  );
}

function InstanciaModal({ base, onSave, onClose }) {
  const [f, setF] = useState({ nome: base?.nome || "", server_url: base?.server_url || "https://madsoffchurn.uazapi.com", instancia: base?.instancia || "", token: base?.token || "", agencia: base?.agencia || "Yield" });
  const s = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal title={base?.id ? "Editar instância" : "Nova instância"} onClose={onClose} footer={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={!f.nome || !f.instancia || !f.token} onClick={() => onSave({ ...base, ...f })}>Salvar</button></>}>
      <div className="form-row"><label>Nome</label><input className="input" value={f.nome} onChange={(e) => s("nome", e.target.value)} autoFocus /></div>
      <div className="form-grid"><div className="form-row"><label>Server URL</label><input className="input" value={f.server_url} onChange={(e) => s("server_url", e.target.value)} /></div><div className="form-row"><label>Agência</label><select className="select" value={f.agencia} onChange={(e) => s("agencia", e.target.value)}><option>Yield</option><option>Mads</option></select></div></div>
      <div className="form-grid"><div className="form-row"><label>ID instância</label><input className="input" value={f.instancia} onChange={(e) => s("instancia", e.target.value)} /></div><div className="form-row"><label>Token</label><input className="input" value={f.token} onChange={(e) => s("token", e.target.value)} /></div></div>
    </Modal>
  );
}

function CriarLeadModal({ numero, nome, onClose, onToast }) {
  const [crm, setCrm] = useState(null);
  const [f, setF] = useState({ nome: nome || "", whatsapp: numero || "", email: "", funilId: "" });
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { api.fetchCRM().then(setCrm).catch(() => {}); }, []);
  const funis = crm?.funis || [];
  const pe = f.funilId ? (crm?.etapas || []).filter((e) => e.funilId === f.funilId).sort((a, b) => a.ordem - b.ordem)[0] : null;
  async function salvar() {
    if (!f.nome.trim() || !f.funilId) return; setSalvando(true);
    try { await api.crmLeadSave({ nome: f.nome, whatsapp: f.whatsapp, email: f.email || null, funilId: f.funilId, etapaId: pe?.id, valor: 0, tags: "[]", camposCustom: "{}" }); onToast("Lead criado!"); onClose(); } catch (e) { onToast("Erro: " + e.message); } finally { setSalvando(false); }
  }
  return (
    <Modal title="Nova negociação" onClose={onClose} footer={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={!f.nome || !f.funilId || salvando} onClick={salvar}>{salvando ? "Criando…" : "Criar lead"}</button></>}>
      <div className="form-row"><label>Nome *</label><input className="input" value={f.nome} onChange={(e) => setF((p) => ({ ...p, nome: e.target.value }))} autoFocus /></div>
      <div className="form-grid"><div className="form-row"><label>WhatsApp</label><input className="input" value={f.whatsapp} readOnly style={{ opacity: 0.6 }} /></div><div className="form-row"><label>Email (opc.)</label><input className="input" value={f.email} onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))} /></div></div>
      <div className="form-row"><label>Funil *</label><select className="select" value={f.funilId} onChange={(e) => setF((p) => ({ ...p, funilId: e.target.value }))}><option value="">Selecione</option>{funis.map((fn) => <option key={fn.id} value={fn.id}>{fn.nome}</option>)}</select></div>
      {pe && <p style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 6 }}>Etapa: <strong>{pe.nome}</strong></p>}
    </Modal>
  );
}

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
  const [gravando, setGravando] = useState(false);
  const [tempoGrav, setTempoGrav] = useState(0);
  const [showAttach, setShowAttach] = useState(false);
  const chatRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileRef = useRef(null);
  const [fileTipo, setFileTipo] = useState("document");
  const [fileAccept, setFileAccept] = useState("*/*");

  async function loadInst() { const { data } = await supabase.from("wa_instancias").select("*").eq("ativo", true); setInstancias(data || []); if (data?.length > 0 && !instAtiva) setInstAtiva(data[0]); }
  useEffect(() => { loadInst(); }, []);

  const loadConvs = useCallback(async () => { if (!instAtiva) return; const { data } = await supabase.from("wa_conversas").select("*").eq("instancia_id", instAtiva.id).order("ultima_msg_em", { ascending: false }); setConversas(data || []); }, [instAtiva?.id]);
  useEffect(() => { loadConvs(); }, [loadConvs]);
  useEffect(() => { if (!instAtiva) return; const c = supabase.channel("wc" + instAtiva.id).on("postgres_changes", { event: "*", schema: "public", table: "wa_conversas" }, loadConvs).subscribe(); return () => supabase.removeChannel(c); }, [instAtiva?.id]);

  const loadMsgs = useCallback(async () => { if (!convAberta) return; const { data } = await supabase.from("wa_mensagens").select("*").eq("conversa_id", convAberta.id).order("criado_em", { ascending: true }); setMensagens(data || []); setTimeout(() => { chatRef.current && (chatRef.current.scrollTop = chatRef.current.scrollHeight); }, 80); supabase.from("wa_conversas").update({ nao_lidas: 0 }).eq("id", convAberta.id); }, [convAberta?.id]);
  useEffect(() => { loadMsgs(); }, [loadMsgs]);
  useEffect(() => { if (!convAberta) return; const c = supabase.channel("wm" + convAberta.id).on("postgres_changes", { event: "INSERT", schema: "public", table: "wa_mensagens", filter: `conversa_id=eq.${convAberta.id}` }, loadMsgs).subscribe(); return () => supabase.removeChannel(c); }, [convAberta?.id]);

  async function enviarTexto() {
    if (!texto.trim() || !convAberta || !instAtiva || enviando) return;
    setEnviando(true);
    try { await enviarAPI({ instanciaId: instAtiva.id, numero: convAberta.numero, tipo: "text", conteudo: texto.trim() }); setTexto(""); } catch (e) { onToast("Erro: " + e.message); } finally { setEnviando(false); }
  }

  function abrirUpload(tipo, accept) { setFileTipo(tipo); setFileAccept(accept); setShowAttach(false); setTimeout(() => fileRef.current?.click(), 50); }
  async function onFile(e) {
    const f = e.target.files?.[0]; if (!f || !convAberta || !instAtiva) return;
    if (f.size > 16 * 1024 * 1024) { onToast("Máx. 16MB"); return; }
    setEnviando(true);
    try { const b64 = await fileToBase64(f); await enviarAPI({ instanciaId: instAtiva.id, numero: convAberta.numero, tipo: fileTipo, fileBase64: b64, conteudo: "", nomeArquivo: f.name }); onToast("Enviado!"); } catch (err) { onToast("Erro: " + err.message); } finally { setEnviando(false); e.target.value = ""; }
  }

  async function iniciarGrav() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recRef.current = new MediaRecorder(stream); chunksRef.current = [];
      recRef.current.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recRef.current.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop()); clearInterval(timerRef.current); setTempoGrav(0);
        const blob = new Blob(chunksRef.current, { type: "audio/ogg" });
        setEnviando(true);
        try { const b64 = await fileToBase64(blob); await enviarAPI({ instanciaId: instAtiva.id, numero: convAberta.numero, tipo: "ptt", fileBase64: b64, conteudo: "" }); } catch (err) { onToast("Erro: " + err.message); } finally { setEnviando(false); }
      };
      recRef.current.start(); setGravando(true); setTempoGrav(0);
      timerRef.current = setInterval(() => setTempoGrav((t) => t + 1), 1000);
    } catch { onToast("Sem acesso ao microfone"); }
  }
  function pararGrav() { if (recRef.current?.state === "recording") { recRef.current.stop(); setGravando(false); } }
  function cancelarGrav() { if (recRef.current?.state === "recording") { recRef.current.ondataavailable = null; recRef.current.onstop = () => {}; recRef.current.stop(); recRef.current.stream?.getTracks().forEach((t) => t.stop()); } clearInterval(timerRef.current); setGravando(false); setTempoGrav(0); }

  async function salvarInst(i) { try { await supabase.from("wa_instancias").upsert({ id: i.id || undefined, nome: i.nome, server_url: i.server_url, instancia: i.instancia, token: i.token, agencia: i.agencia, ativo: true }); setModalInst(null); loadInst(); onToast("Salvo"); } catch (e) { onToast("Erro: " + e.message); } }

  const filtradas = busca ? conversas.filter((c) => (c.nome || c.numero || "").toLowerCase().includes(busca.toLowerCase())) : conversas;

  if (viewInst) return (
    <><div className="page-head"><div><h1>Instâncias WhatsApp</h1></div><div className="head-actions"><button className="btn btn-sm btn-ghost" onClick={() => setViewInst(false)}>‹ Voltar</button><button className="btn btn-sm btn-primary" onClick={() => setModalInst({})}><Icon.Plus /> Nova</button></div></div>
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{instancias.length === 0 && <div className="empty"><p>Nenhuma instância.</p></div>}{instancias.map((i) => (<div key={i.id} className="auto-list-item"><div className="auto-list-icon">📱</div><div className="auto-list-info"><div className="auto-list-nome">{i.nome}</div><div className="auto-list-meta">{i.instancia} · {i.agencia}</div></div><div style={{ display: "flex", gap: 6 }}><button className="btn btn-sm" onClick={() => setModalInst(i)}>Editar</button><button className="iconbtn" onClick={async () => { if (!confirm("Excluir?")) return; await supabase.from("wa_instancias").delete().eq("id", i.id); loadInst(); }}><Icon.Trash /></button></div></div>))}</div>
    {modalInst && <InstanciaModal base={modalInst} onSave={salvarInst} onClose={() => setModalInst(null)} />}</>
  );

  return (
    <><div className="page-head"><div><h1>WhatsApp</h1><p>{conversas.length} conversa{conversas.length !== 1 ? "s" : ""}</p></div><div className="head-actions">
      <select className="select" style={{ width: "auto", minWidth: 160 }} value={instAtiva?.id || ""} onChange={(e) => { setInstAtiva(instancias.find((i) => i.id === e.target.value)); setConvAberta(null); }}>{instancias.length === 0 && <option value="">Nenhuma</option>}{instancias.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}</select>
      {isAdmin && <button className="btn btn-sm" onClick={() => setViewInst(true)}>⚙ Instâncias</button>}
    </div></div>
    <div className="wa-layout">
      <div className="wa-sidebar">
        <div className="wa-search"><input className="input" placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
        <div className="wa-conv-list">{filtradas.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: "var(--ink-faint)", fontSize: 13 }}>{instancias.length === 0 ? "Configure uma instância." : "Nenhuma conversa."}</div> : filtradas.map((c) => (
          <div key={c.id} className={`wa-conv-item ${convAberta?.id === c.id ? "wa-conv-ativa" : ""}`} onClick={() => setConvAberta(c)}>
            <Avatar nome={c.nome} foto={c.foto_url} />
            <div className="wa-conv-info"><div className="wa-conv-nome">{c.nome || c.numero}{!c.lead_id && <span className="wa-new-badge">🆕</span>}</div><div className="wa-conv-ultima">{c.ultima_msg || "…"}</div></div>
            <div className="wa-conv-meta"><div className="wa-conv-hora">{fmtData(c.ultima_msg_em)} {fmtHora(c.ultima_msg_em)}</div>{c.nao_lidas > 0 && <div className="wa-badge">{c.nao_lidas}</div>}</div>
          </div>
        ))}</div>
      </div>
      <div className="wa-chat">{!convAberta ? <div className="wa-chat-empty"><div style={{ fontSize: 48, opacity: 0.15 }}>💬</div><p>Selecione uma conversa</p></div> : (<>
        <div className="wa-chat-header">
          <button className="iconbtn wa-back-btn" onClick={() => setConvAberta(null)}>‹</button>
          <Avatar nome={convAberta.nome} foto={convAberta.foto_url} />
          <div className="wa-chat-header-info"><div className="wa-chat-header-nome">{convAberta.nome || convAberta.numero}</div><div className="wa-chat-header-num">{convAberta.numero}</div></div>
          {convAberta.lead_id ? <a href="#" className="btn btn-sm btn-ghost" onClick={(e) => { e.preventDefault(); onToast("Abra o CRM para ver o lead"); }}>Ver no CRM</a> : <button className="btn btn-sm btn-primary" onClick={() => setModalLead({ numero: convAberta.numero, nome: convAberta.nome })}>+ Negociação</button>}
        </div>
        <div className="wa-messages" ref={chatRef}>{mensagens.map((m) => <MsgBolha key={m.id} msg={m} />)}</div>
        <div className="wa-input-bar">
          {gravando ? (
            <div className="wa-rec-bar">
              <button className="iconbtn wa-rec-cancel" onClick={cancelarGrav} title="Cancelar">✕</button>
              <div className="wa-rec-pulse" /><span className="wa-rec-timer">{fmtTimer(tempoGrav)}</span>
              <button className="btn btn-primary wa-send-btn" onClick={pararGrav} title="Enviar áudio">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>
              </button>
            </div>
          ) : (<>
            <div style={{ position: "relative" }}>
              <button className="iconbtn wa-attach-btn" onClick={() => setShowAttach(!showAttach)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
              </button>
              {showAttach && <div className="wa-attach-popup"><button onClick={() => abrirUpload("image","image/*")}><span>🖼️</span> Foto</button><button onClick={() => abrirUpload("document",".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip")}><span>📄</span> Documento</button><button onClick={() => abrirUpload("video","video/*")}><span>🎬</span> Vídeo</button><button onClick={() => abrirUpload("audio","audio/*")}><span>🎵</span> Áudio</button></div>}
            </div>
            <input ref={fileRef} type="file" accept={fileAccept} onChange={onFile} style={{ display: "none" }} />
            <input className="input wa-input" placeholder="Mensagem…" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarTexto(); } }} disabled={enviando} />
            {texto.trim() ? (
              <button className="btn btn-primary wa-send-btn" onClick={enviarTexto} disabled={enviando}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg></button>
            ) : (
              <button className="wa-mic-btn" onClick={iniciarGrav} disabled={enviando}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg></button>
            )}
          </>)}
        </div>
      </>)}</div>
    </div>
    {modalLead && <CriarLeadModal numero={modalLead.numero} nome={modalLead.nome} onClose={() => { setModalLead(null); loadConvs(); }} onToast={onToast} />}
    </>
  );
}
