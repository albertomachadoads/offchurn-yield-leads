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
  const r = await fetch(`${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/whatsapp-send`, {
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

function AudioPlayer({ src }) {
  const [tocando, setTocando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const [velocidade, setVelocidade] = useState(1);
  const audioRef = useRef(null);

  function togglePlay() {
    if (!audioRef.current) return;
    if (tocando) { audioRef.current.pause(); } else { audioRef.current.play(); }
    setTocando(!tocando);
  }

  function onTimeUpdate() {
    if (!audioRef.current) return;
    setProgresso(audioRef.current.duration ? (audioRef.current.currentTime / audioRef.current.duration) * 100 : 0);
  }

  function onLoaded() { if (audioRef.current) setDuracao(audioRef.current.duration || 0); }
  function onEnded() { setTocando(false); setProgresso(0); }
  function onSeek(e) {
    if (!audioRef.current || !audioRef.current.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * audioRef.current.duration;
  }
  function toggleSpeed() {
    const speeds = [1, 1.5, 2];
    const next = speeds[(speeds.indexOf(velocidade) + 1) % speeds.length];
    setVelocidade(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  const fmtDur = (s) => { if (!s || !isFinite(s)) return "0:00"; return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0"); };
  const tempoAtual = audioRef.current?.currentTime || 0;

  return (
    <div className="wa-audio-player">
      <audio ref={audioRef} src={src} preload="metadata" onTimeUpdate={onTimeUpdate} onLoadedMetadata={onLoaded} onEnded={onEnded} />
      <button className="wa-audio-play" onClick={togglePlay}>
        {tocando ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        )}
      </button>
      <div className="wa-audio-body">
        <div className="wa-audio-track" onClick={onSeek}>
          <div className="wa-audio-progress" style={{ width: progresso + "%" }}>
            <div className="wa-audio-thumb" />
          </div>
          <div className="wa-audio-wave" />
        </div>
        <div className="wa-audio-info">
          <span>{fmtDur(tocando ? tempoAtual : duracao)}</span>
        </div>
      </div>
      <button className="wa-audio-speed" onClick={toggleSpeed} title="Velocidade">{velocidade}x</button>
      <a href={src} download className="wa-audio-dl" title="Baixar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </a>
    </div>
  );
}

function MsgBolha({ msg }) {
  const isOut = msg.direcao === "out";
  const url = msg.midia_url;
  const hasMedia = url && url.startsWith("http");
  const t = msg.tipo || "text";
  const hideText = ["[Imagem]","[Áudio]","[Vídeo]","[Sticker]","[sticker]","[Documento]"].includes(msg.conteudo);
  return (
    <div className={`wa-bolha ${isOut ? "wa-out" : "wa-in"}`}>
      {t === "image" && hasMedia && <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="" className="wa-msg-img" loading="lazy" /></a>}
      {t === "image" && !hasMedia && <p className="wa-msg-text">📷 {msg.conteudo || "[Imagem]"}</p>}
      {t === "sticker" && hasMedia && <img src={url} alt="" className="wa-msg-sticker" loading="lazy" />}
      {t === "sticker" && !hasMedia && <p className="wa-msg-text">🏷️ [Sticker]</p>}
      {(t === "audio" || t === "ptt") && hasMedia && <AudioPlayer src={url} />}
      {(t === "audio" || t === "ptt") && !hasMedia && <p className="wa-msg-text">🎵 [Áudio]</p>}
      {t === "video" && hasMedia && <video controls src={url} className="wa-msg-video" preload="none" />}
      {t === "video" && !hasMedia && <p className="wa-msg-text">🎬 [Vídeo]</p>}
      {t === "document" && hasMedia && <a href={url} target="_blank" rel="noopener noreferrer" className="wa-msg-doc"><span className="wa-doc-icon">📄</span><div><strong>{msg.nome_arquivo || "Documento"}</strong><small>Baixar</small></div></a>}
      {t === "document" && !hasMedia && <p className="wa-msg-text">📄 {msg.conteudo || "[Documento]"}</p>}
      {t === "contact" && <p className="wa-msg-text">👤 {msg.conteudo}</p>}
      {t === "location" && <p className="wa-msg-text">📍 {msg.conteudo}</p>}
      {t === "text" && msg.conteudo && <p className="wa-msg-text">{msg.conteudo}</p>}
      {!["image","sticker","audio","ptt","video","document","contact","location","text"].includes(t) && msg.conteudo && <p className="wa-msg-text">{msg.conteudo}</p>}
      {hasMedia && (t === "image" || t === "video") && msg.conteudo && !hideText && <p className="wa-msg-caption">{msg.conteudo}</p>}
      <span className="wa-hora">
        {msg._enviando && <span className="wa-sending">⏳</span>}
        {msg._erro && <span className="wa-error" title="Falha no envio">⚠️</span>}
        {fmtHora(msg.criado_em)}
      </span>
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
    try {
      const result = await api.crmLeadSave({ nome: f.nome, whatsapp: f.whatsapp, email: f.email || null, funilId: f.funilId, etapaId: pe?.id, valor: 0, tags: "[]", camposCustom: "{}" });
      const leadId = result?.id;
      const num = f.whatsapp.replace(/\D/g, "");
      if (leadId && num) {
        await supabase.from("wa_conversas").update({ lead_id: leadId }).eq("numero", num);
        if (num.length > 8) {
          await supabase.from("wa_conversas").update({ lead_id: leadId }).ilike("numero", `%${num.slice(-8)}%`);
        }
      }
      onToast("Lead criado e vinculado!");
      onClose();
    } catch (e) { onToast("Erro: " + e.message); } finally { setSalvando(false); }
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

export default function WhatsAppChat({ isAdmin, onToast, onVerLead, instanciasPermitidas }) {
  const perms = instanciasPermitidas || [];
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

  // Abrir conversa por número (vindo do CRM)
  useEffect(() => {
    if (window.__waAbrirNumero && conversas.length > 0) {
      const num = window.__waAbrirNumero.replace(/\D/g, "");
      const conv = conversas.find((c) => c.numero.includes(num.slice(-8)));
      if (conv) { setConvAberta(conv); window.__waAbrirNumero = null; }
    }
  }, [conversas]);

  async function loadInst() {
    const { data } = await supabase.from("wa_instancias").select("*").eq("ativo", true);
    let filtered = data || [];
    // Se não é admin e tem permissões configuradas, filtrar
    if (!isAdmin && perms.length > 0) {
      filtered = filtered.filter((i) => perms.includes(i.id));
    }
    setInstancias(filtered);
    if (filtered.length > 0 && !instAtiva) setInstAtiva(filtered[0]);
  }
  useEffect(() => { loadInst(); }, []);

  const loadConvs = useCallback(async () => { if (!instAtiva) return; const { data } = await supabase.from("wa_conversas").select("*").eq("instancia_id", instAtiva.id).order("ultima_msg_em", { ascending: false }); setConversas(data || []); }, [instAtiva?.id]);
  useEffect(() => { loadConvs(); }, [loadConvs]);
  useEffect(() => { if (!instAtiva) return; const c = supabase.channel("wc" + instAtiva.id).on("postgres_changes", { event: "*", schema: "public", table: "wa_conversas" }, loadConvs).subscribe(); return () => supabase.removeChannel(c); }, [instAtiva?.id]);

  const loadMsgs = useCallback(async () => { if (!convAberta) return; const { data } = await supabase.from("wa_mensagens").select("*").eq("conversa_id", convAberta.id).order("criado_em", { ascending: true }); setMensagens(data || []); setTimeout(() => { chatRef.current && (chatRef.current.scrollTop = chatRef.current.scrollHeight); }, 80); supabase.from("wa_conversas").update({ nao_lidas: 0 }).eq("id", convAberta.id); }, [convAberta?.id]);
  useEffect(() => { loadMsgs(); }, [loadMsgs]);
  useEffect(() => { if (!convAberta) return; const c = supabase.channel("wm" + convAberta.id).on("postgres_changes", { event: "INSERT", schema: "public", table: "wa_mensagens", filter: `conversa_id=eq.${convAberta.id}` }, loadMsgs).subscribe(); return () => supabase.removeChannel(c); }, [convAberta?.id]);

  async function enviarTexto() {
    if (!texto.trim() || !convAberta || !instAtiva || enviando) return;
    const msg = texto.trim();
    setTexto("");
    // Otimista: mostrar imediatamente no chat
    const tempId = "temp_" + Date.now();
    setMensagens((prev) => [...prev, { id: tempId, direcao: "out", tipo: "text", conteudo: msg, criado_em: new Date().toISOString(), _enviando: true }]);
    setTimeout(() => { chatRef.current && (chatRef.current.scrollTop = chatRef.current.scrollHeight); }, 30);
    // Enviar em background
    try { await enviarAPI({ instanciaId: instAtiva.id, numero: convAberta.numero, tipo: "text", conteudo: msg }); }
    catch (e) { onToast("Erro: " + e.message); setMensagens((prev) => prev.map((m) => m.id === tempId ? { ...m, _erro: true, _enviando: false } : m)); return; }
    // Atualizar com dados reais do banco
    loadMsgs();
  }

  function abrirUpload(tipo, accept) { setFileTipo(tipo); setFileAccept(accept); setShowAttach(false); setTimeout(() => fileRef.current?.click(), 50); }
  async function onFile(e) {
    const f = e.target.files?.[0]; if (!f || !convAberta || !instAtiva) return;
    if (f.size > 16 * 1024 * 1024) { onToast("Máx. 16MB"); return; }
    const localUrl = URL.createObjectURL(f);
    const tempId = "temp_" + Date.now();
    // Otimista: mostrar preview imediato
    setMensagens((prev) => [...prev, { id: tempId, direcao: "out", tipo: fileTipo, conteudo: "", midia_url: localUrl, nome_arquivo: f.name, criado_em: new Date().toISOString(), _enviando: true }]);
    setTimeout(() => { chatRef.current && (chatRef.current.scrollTop = chatRef.current.scrollHeight); }, 30);
    try {
      const b64 = await fileToBase64(f);
      await enviarAPI({ instanciaId: instAtiva.id, numero: convAberta.numero, tipo: fileTipo, fileBase64: b64, conteudo: "", nomeArquivo: f.name });
    } catch (err) {
      onToast("Erro: " + err.message);
      setMensagens((prev) => prev.map((m) => m.id === tempId ? { ...m, _erro: true, _enviando: false } : m));
      e.target.value = ""; return;
    }
    e.target.value = "";
    loadMsgs();
  }

  async function iniciarGrav() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recRef.current = new MediaRecorder(stream); chunksRef.current = [];
      recRef.current.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recRef.current.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop()); clearInterval(timerRef.current); setTempoGrav(0);
        const blob = new Blob(chunksRef.current, { type: "audio/ogg" });
        const localUrl = URL.createObjectURL(blob);
        const tempId = "temp_" + Date.now();
        setMensagens((prev) => [...prev, { id: tempId, direcao: "out", tipo: "ptt", conteudo: "", midia_url: localUrl, criado_em: new Date().toISOString(), _enviando: true }]);
        setTimeout(() => { chatRef.current && (chatRef.current.scrollTop = chatRef.current.scrollHeight); }, 30);
        try { const b64 = await fileToBase64(blob); await enviarAPI({ instanciaId: instAtiva.id, numero: convAberta.numero, tipo: "ptt", fileBase64: b64, conteudo: "" }); } catch (err) { onToast("Erro: " + err.message); setMensagens((prev) => prev.map((m) => m.id === tempId ? { ...m, _erro: true, _enviando: false } : m)); return; }
        loadMsgs();
      };
      recRef.current.start(); setGravando(true); setTempoGrav(0);
      timerRef.current = setInterval(() => setTempoGrav((t) => t + 1), 1000);
    } catch { onToast("Sem acesso ao microfone"); }
  }
  function pararGrav() { if (recRef.current?.state === "recording") { recRef.current.stop(); setGravando(false); } }
  function cancelarGrav() { if (recRef.current?.state === "recording") { recRef.current.ondataavailable = null; recRef.current.onstop = () => {}; recRef.current.stop(); recRef.current.stream?.getTracks().forEach((t) => t.stop()); } clearInterval(timerRef.current); setGravando(false); setTempoGrav(0); }

  async function salvarInst(i) { try { await supabase.from("wa_instancias").upsert({ id: i.id || undefined, nome: i.nome, server_url: i.server_url, instancia: i.instancia, token: i.token, agencia: i.agencia, ativo: true }); setModalInst(null); loadInst(); onToast("Salvo"); } catch (e) { onToast("Erro: " + e.message); } }

  const filtradas = busca ? conversas.filter((c) => (c.nome || "").toLowerCase().includes(busca.toLowerCase()) || (c.numero || "").includes(busca.replace(/\D/g, ""))) : conversas;

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
          {convAberta.lead_id ? <button className="btn btn-sm btn-ghost wa-ver-crm" onClick={() => onVerLead && onVerLead(convAberta.lead_id)}>Ver no CRM ›</button> : <button className="btn btn-sm btn-primary" onClick={() => setModalLead({ numero: convAberta.numero, nome: convAberta.nome })}>+ Negociação</button>}
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
    {modalLead && <CriarLeadModal numero={modalLead.numero} nome={modalLead.nome} onClose={async () => {
        setModalLead(null);
        await loadConvs();
        // Recarregar conversa aberta para atualizar lead_id
        if (convAberta) {
          const { data: convAtualizada } = await supabase.from("wa_conversas").select("*").eq("id", convAberta.id).single();
          if (convAtualizada) setConvAberta(convAtualizada);
        }
      }} onToast={onToast} />}
    </>
  );
}
