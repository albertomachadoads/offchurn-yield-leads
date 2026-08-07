import React, { useEffect, useState } from "react";
import { Icon, Modal } from "./components.jsx";
import { supabase } from "./supabaseClient.js";
import { fmtMoeda } from "./utils";
import * as api from "./api.js";
import { logAcao } from "./logger.js";
import { executarAutomacoes } from "./autoEngine.js";

const fmtDH = (iso) => { if (!iso) return "—"; const d = new Date(iso); const p = (n) => String(n).padStart(2, "0"); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const whatsLink = (num) => { if (!num) return null; const c = num.replace(/\D/g, ""); return `https://wa.me/${c.startsWith("55") ? c : "55" + c}`; };
const mascaraTel = (v) => { const n = v.replace(/\D/g, "").slice(0, 11); if (n.length <= 2) return `(${n}`; if (n.length <= 7) return `(${n.slice(0,2)}) ${n.slice(2)}`; return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`; };

const WhatsIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#25d366" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    <path d="M9.49 10.07c.13-.28.49-.35.8-.08l.6.55c.18.16.18.43 0 .6l-.3.3c-.1.1-.1.26 0 .4a6.4 6.4 0 002.17 2.17c.14.1.3.1.4 0l.3-.3c.17-.18.44-.18.6 0l.55.6c.27.31.2.67-.08.8a2.5 2.5 0 01-2.64-.42 8 8 0 01-2.4-2.4 2.5 2.5 0 01-.42-2.64z" fill="#25d366" stroke="none" />
  </svg>
);

/* ---- Confetes ---- */
function dispararConfetes() {
  const ct = document.createElement("div");
  ct.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(ct);
  const cores = ["#22c55e","#f59e0b","#3b82f6","#ef4444","#8b5cf6","#ec4899","#14b8a6","#ffd700"];
  for (let i = 0; i < 120; i++) {
    const c = document.createElement("div"); const cor = cores[Math.floor(Math.random() * cores.length)];
    c.style.cssText = `position:absolute;top:-20px;left:${Math.random()*100}%;width:${6+Math.random()*8}px;height:${4+Math.random()*5}px;background:${cor};border-radius:2px;transform:rotate(${Math.random()*360}deg);animation:confetti-fall ${2+Math.random()*2}s ${Math.random()*0.8}s ease-out forwards;opacity:0.9`;
    ct.appendChild(c);
  }
  setTimeout(() => ct.remove(), 5000);
}

/* ---- Modais ---- */
function EditarContatoModal({ lead, onSave, onClose }) {
  const [f, setF] = useState({ nome: lead.nome || "", whatsapp: lead.whatsapp || "", email: lead.email || "", valor: lead.valor ?? "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <Modal title="Editar contato" onClose={onClose} footer={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" disabled={!f.nome.trim()||!f.whatsapp.trim()} onClick={() => onSave(f)}>Salvar</button></>}>
      <div className="form-row"><label>Nome *</label><input className="input" value={f.nome} onChange={(e) => set("nome", e.target.value)} autoFocus /></div>
      <div className="form-row"><label>WhatsApp *</label><input className="input" value={f.whatsapp} onChange={(e) => set("whatsapp", mascaraTel(e.target.value))} maxLength={16} /></div>
      <div className="form-row"><label>Email</label><input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
      <div className="form-row"><label>Valor (R$)</label><input className="input" type="number" min="0" step="0.01" value={f.valor} onChange={(e) => set("valor", e.target.value)} /></div>
    </Modal>
  );
}

function EditarOrigemModal({ lead, origens, onSave, onClose }) {
  const [origemId, setOrigemId] = useState(lead.origemId || "");
  return (
    <Modal title="Editar origem" onClose={onClose} footer={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" onClick={() => onSave(origemId)}>Salvar</button></>}>
      <div className="form-row"><label>Origem</label><select className="select" value={origemId} onChange={(e) => setOrigemId(e.target.value)}>
        <option value="">— sem origem —</option>{(origens || []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
      </select></div>
    </Modal>
  );
}

function NovaAtividadeModal({ tipo, pessoas, onSave, onClose }) {
  const labels = { ligacao: "📞 Ligação", email: "✉️ E-mail", tarefa: "✅ Tarefa" };
  const [desc, setDesc] = useState(""); const [dataPrev, setDataPrev] = useState(""); const [respId, setRespId] = useState("");
  return (
    <Modal title={`Nova ${labels[tipo] || tipo}`} onClose={onClose} footer={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" disabled={!desc.trim()} onClick={() => onSave({ desc, dataPrev, respId })}>Criar</button></>}>
      <div className="form-row"><label>Descrição *</label><textarea className="input" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} autoFocus placeholder="Descreva…" /></div>
      <div className="form-grid">
        <div className="form-row"><label>Data prevista</label><input className="input" type="datetime-local" value={dataPrev} onChange={(e) => setDataPrev(e.target.value)} /></div>
        <div className="form-row"><label>Responsável</label><select className="select" value={respId} onChange={(e) => setRespId(e.target.value)}>
          <option value="">— selecione —</option>{(pessoas || []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select></div>
      </div>
    </Modal>
  );
}

/* ---- Componente principal ---- */
export default function LeadPage({ lead, etapas, tags, origens, campos, produtos, pessoas, atividades, motivos, crm, onVoltar, onSave, onToast, userName, isAdmin, onIniciarOnboarding, onAbrirWhatsApp }) {
  const crm_motivos = motivos || [];
  const [showOnboard, setShowOnboard] = useState(false);
  const [editContato, setEditContato] = useState(false);
  const [editOrigem, setEditOrigem] = useState(false);
  const [modalPerdaLP, setModalPerdaLP] = useState(false);
  const [origemWa, setOrigemWa] = useState(null);

  // Dados do anúncio ficam na conversa do WhatsApp, não no lead
  useEffect(() => {
    if (!lead?.id) return;
    let vivo = true;
    supabase.from("wa_conversas")
      .select("ad_id, ad_titulo, ad_url, ad_app, origem_tipo, utm_source, utm_medium, utm_campaign, utm_term, utm_content")
      .eq("lead_id", lead.id).eq("origem_tipo", "meta_ads")
      .limit(1).maybeSingle()
      .then(({ data }) => { if (vivo && data) setOrigemWa(data); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [lead?.id]);
  const [modalAtiv, setModalAtiv] = useState(null);
  const [nota, setNota] = useState("");
  const [camposForm, setCamposForm] = useState(() => { try { return JSON.parse(lead.camposCustom || "{}"); } catch { return {}; } });
  const [atvsLocal, setAtvsLocal] = useState((atividades || []).filter((a) => a.leadId === lead.id).sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1)));

  const tagMap = Object.fromEntries((tags || []).map((t) => [t.id, t]));
  const pesMap = Object.fromEntries((pessoas || []).map((p) => [p.id, p]));
  const etapaAtual = etapas.find((e) => e.id === lead.etapaId);
  let leadTags = []; try { leadTags = JSON.parse(lead.tags || "[]"); } catch {}

  // campos não preenchidos
  const camposVazios = campos.filter((c) => !camposForm[c.id] || !String(camposForm[c.id]).trim());

  async function reg(tipo, descricao) {
    const atv = { leadId: lead.id, tipo, descricao, autorNome: userName };
    try { await api.crmAtividadeSave(atv); setAtvsLocal((p) => [{ ...atv, id: Date.now().toString(), criadoEm: new Date().toISOString() }, ...p]); } catch {}
  }

  async function confirmarPerdaLP(etapaId, motivoId, justificativa) {
    const nome = etapas.find((e) => e.id === etapaId)?.nome || "?";
    const motivo = (crm_motivos || []).find((m) => m.id === motivoId);
    try {
      await onSave({ ...lead, etapaId, motivoPerdaId: motivoId || null, justificativaPerda: justificativa || null });
      await reg("sistema", "Lead perdido. Motivo: " + (motivo?.nome || "Não informado") + (justificativa ? ". " + justificativa : ""));
      logAcao("crm", "PERDA: Lead " + lead.nome + " - " + (motivo?.nome || "?"));
      setModalPerdaLP(false); onToast("Lead marcado como perdido");
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function mudarEtapa(etapaId) {
    const nome = etapas.find((e) => e.id === etapaId)?.nome || "?";
    const tipo = etapas.find((e) => e.id === etapaId)?.tipo;
    // Se perdido, abrir modal de motivo antes de salvar
    if (tipo === "perdido") { setModalPerdaLP(etapaId); return; }
    try {
      await onSave({ ...lead, etapaId }); await reg("sistema", `Movido para "${nome}"`);
      const leadAtualizado = { ...lead, etapaId };
      try { await executarAutomacoes({ evento: "mudanca_etapa", lead: leadAtualizado, leadAnterior: lead, funilId: lead.funilId, crm, userName }); } catch {}
      if (tipo === "ganho") {
        dispararConfetes(); logAcao("crm", `VENDA: Lead "${lead.nome}"`); onToast("🎉 VENDA MARCADA! Parabéns!");
        try { await executarAutomacoes({ evento: "lead_ganho", lead: leadAtualizado, funilId: lead.funilId, crm, userName }); } catch {}
        setTimeout(() => setShowOnboard(true), 1500);
      } else onToast("Etapa atualizada");
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function salvarContato(dados) {
    const mudancas = [];
    if (dados.nome !== lead.nome) mudancas.push(`Nome: "${lead.nome}" → "${dados.nome}"`);
    if (dados.whatsapp !== lead.whatsapp) mudancas.push("WhatsApp atualizado");
    if (dados.email !== lead.email) mudancas.push("Email atualizado");
    if (Number(dados.valor) !== Number(lead.valor)) mudancas.push(`Valor: ${fmtMoeda(lead.valor||0)} → ${fmtMoeda(dados.valor)}`);
    try { await onSave({ ...lead, ...dados }); if (mudancas.length) await reg("sistema", `Contato editado: ${mudancas.join(", ")}`); logAcao("crm", "Lead contato editado: " + lead.nome); setEditContato(false); onToast("Contato atualizado"); } catch (e) { onToast("Erro: " + e.message); }
  }

  async function salvarOrigem(origemId) {
    const nome = origens.find((o) => o.id === origemId)?.nome || "nenhuma";
    try { await onSave({ ...lead, origemId: origemId || null }); await reg("sistema", `Origem alterada para "${nome}"`); setEditOrigem(false); onToast("Origem atualizada"); } catch (e) { onToast("Erro: " + e.message); }
  }

  async function toggleTag(tid) {
    const tagSet = new Set(leadTags);
    const adicionou = !tagSet.has(tid);
    adicionou ? tagSet.add(tid) : tagSet.delete(tid);
    const novas = [...tagSet]; const nome = tagMap[tid]?.nome || "?";
    try {
      const leadAtualizado = { ...lead, tags: JSON.stringify(novas) };
      await onSave(leadAtualizado);
      await reg("sistema", `Tag ${adicionou ? "adicionada" : "removida"}: "${nome}"`);
      if (adicionou) {
        try { await executarAutomacoes({ evento: "tag_adicionada", lead: leadAtualizado, leadAnterior: lead, funilId: lead.funilId, crm, userName }); } catch {}
      }
      onToast("Tags atualizadas");
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function salvarResponsavel(respId) {
    const nome = pesMap[respId]?.nome || "ninguém";
    try { await onSave({ ...lead, responsavelId: respId || null }); await reg("sistema", `Responsável alterado para ${nome}`); } catch (e) { onToast("Erro: " + e.message); }
  }

  async function salvarCamposPersonalizados() {
    try {
      const leadAtualizado = { ...lead, camposCustom: JSON.stringify(camposForm) };
      await onSave(leadAtualizado); await reg("sistema", "Campos personalizados atualizados");
      try { await executarAutomacoes({ evento: "campo_alterado", lead: leadAtualizado, leadAnterior: lead, funilId: lead.funilId, crm, userName }); } catch {}
      onToast("Campos salvos");
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function criarAtividade(tipo, dados) {
    const respNome = pesMap[dados.respId]?.nome || "";
    const desc = `${dados.desc}${dados.dataPrev ? ` · Prevista: ${fmtDH(dados.dataPrev)}` : ""}${respNome ? ` · Resp: ${respNome}` : ""}`;
    await reg(tipo, desc); setModalAtiv(null); onToast("Atividade criada");
  }

  async function concluirAtividade(atvId) {
    const atv = atvsLocal.find((a) => a.id === atvId); if (!atv) return;
    try {
      await supabase.from("crm_atividades").update({ status: "concluida" }).eq("id", atvId);
      await reg("sistema", `Tarefa concluída: "${atv.descricao.slice(0,50)}"`);
      setAtvsLocal((p) => p.map((a) => a.id === atvId ? { ...a, status: "concluida" } : a));
      onToast("Tarefa concluída!");
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function cancelarAtividade(atvId) {
    const atv = atvsLocal.find((a) => a.id === atvId); if (!atv) return;
    try {
      await supabase.from("crm_atividades").update({ status: "cancelada" }).eq("id", atvId);
      await reg("sistema", `Tarefa cancelada: "${atv.descricao.slice(0,50)}"`);
      setAtvsLocal((p) => p.map((a) => a.id === atvId ? { ...a, status: "cancelada" } : a));
      onToast("Tarefa cancelada");
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function addNota() {
    if (!nota.trim()) return; await reg("nota", nota); setNota(""); onToast("Anotação salva");
  }

  const ativTarefas = atvsLocal.filter((a) => ["ligacao", "email", "tarefa"].includes(a.tipo));
  const anotacoes = atvsLocal.filter((a) => a.tipo === "nota");
  const historico = atvsLocal.filter((a) => a.tipo === "sistema");

  const isAtrasada = (atv) => {
    const match = atv.descricao.match(/Prevista: (\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/);
    if (!match) return false;
    const [d, m, y, h, min] = match[1].split(/[\/\s:]/);
    return new Date(y, m - 1, d, h, min) < new Date();
  };

  return (
    <>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button className="btn btn-sm btn-ghost" onClick={onVoltar}>‹ Voltar</button>
          <div>
            <h1 style={{ margin: 0 }}>{lead.nome}</h1>
            <p style={{ margin: 0 }}>{etapaAtual && <span className="pill" style={{ background: etapaAtual.cor, color: "#fff", marginRight: 6 }}>{etapaAtual.nome}</span>} Criado em {fmtDH(lead.criadoEm)}</p>
          </div>
        </div>
        <div className="head-actions">
          {etapaAtual?.tipo !== "ganho" && <button className="btn btn-sm btn-primary" onClick={() => { const g = etapas.find((e) => e.tipo === "ganho"); if (g) mudarEtapa(g.id); else onToast("Configure etapa 'ganho'"); }}>★ Marcar venda</button>}
          {etapaAtual?.tipo !== "perdido" && <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => {
            const p2 = etapas.find((e) => e.tipo === "perdido");
            if (!p2) { onToast("Configure etapa 'perdido'"); return; }
            setModalPerdaLP(p2.id);
          }}>✕ Marcar perda</button>}
        </div>
      </div>

      {/* PIPELINE */}
      <div className="lead-pipeline">
        {etapas.map((et) => <button key={et.id} className={`lp-etapa ${et.id === lead.etapaId ? "lp-atual" : ""}`} style={{ "--ec": et.cor }} onClick={() => mudarEtapa(et.id)}>{et.nome}</button>)}
      </div>

      <div className="lead-layout">
        <div className="lead-sidebar">
          {/* Contato */}
          <div className="lead-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 className="lead-sec-title" style={{ margin: 0 }}>Contato</h3>
              <button className="iconbtn" onClick={() => setEditContato(true)}><Icon.Edit /></button>
            </div>
            <div className="lead-campo"><span className="lead-label">Nome</span><span className="lead-valor">{lead.nome}</span></div>
            <div className="lead-campo"><span className="lead-label">WhatsApp
                      {lead.whatsapp && <span style={{ marginLeft: 6, display: "inline-flex", gap: 4 }}>
                        <button className="iconbtn" title="Abrir conversa no sistema" onClick={() => onAbrirWhatsApp && onAbrirWhatsApp(lead.whatsapp)} style={{ padding: 2 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></svg>
                        </button>
                        <a href={"https://wa.me/" + lead.whatsapp.replace(/\D/g,"")} target="_blank" rel="noopener noreferrer" className="iconbtn" title="Abrir no WhatsApp Web" style={{ padding: 2 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                      </span>}
                    </span><span className="lead-valor">{lead.whatsapp || "—"}</span></div>
            <div className="lead-campo"><span className="lead-label">Email</span><span className="lead-valor">{lead.email || "—"}</span></div>
            <div className="lead-campo"><span className="lead-label">Valor</span><span className="lead-valor">{lead.valor > 0 ? fmtMoeda(lead.valor) : "—"}</span></div>
            {lead.motivoPerdaId && (
              <>
                <div className="lead-campo">
                  <span className="lead-label">Status</span>
                  <span className="lead-perdido-badge">Perdido</span>
                </div>
                <div className="lead-campo">
                  <span className="lead-label">Motivo da perda</span>
                  <span className="lead-valor">{crm_motivos.find((m) => m.id === lead.motivoPerdaId)?.nome || "Não informado"}</span>
                </div>
                {lead.justificativaPerda && (
                  <div className="lead-campo">
                    <span className="lead-label">Justificativa</span>
                    <span className="lead-valor">{lead.justificativaPerda}</span>
                  </div>
                )}
              </>
            )}
            {produtos && produtos.length > 0 && (
              <div className="lead-campo"><span className="lead-label">Produto</span>
                <select className="select" style={{ fontSize: 12 }} value={lead.produtoId || ""}
                  onChange={async (e) => {
                    const pid = e.target.value;
                    const prod = produtos.find((p) => p.id === pid);
                    try { await onSave({ ...lead, produtoId: pid || null, valor: prod ? prod.valor : lead.valor });
                      await reg("sistema", `Produto alterado para "${prod?.nome || "nenhum"}"`);
                      onToast("Produto atualizado");
                    } catch (err) { onToast("Erro: " + err.message); }
                  }}>
                  <option value="">— sem produto —</option>
                  {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome} ({fmtMoeda(p.valor)})</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Atribuição */}
          <div className="lead-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 className="lead-sec-title" style={{ margin: 0 }}>Atribuição</h3>
              <button className="iconbtn" onClick={() => setEditOrigem(true)}><Icon.Edit /></button>
            </div>
            <div className="lead-campo"><span className="lead-label">Responsável</span>
              <select className="select" style={{ fontSize: 12 }} value={lead.responsavelId || ""} onChange={(e) => salvarResponsavel(e.target.value)}>
                <option value="">— sem responsável —</option>{(pessoas || []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div className="lead-campo"><span className="lead-label">Origem</span><span className="lead-valor">{origens.find((o) => o.id === lead.origemId)?.nome || "—"}</span></div>
          </div>

          {/* Tags (editável) */}
          <div className="lead-section">
            <h3 className="lead-sec-title">Tags</h3>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {tags.map((t) => (
                <button key={t.id} onClick={() => toggleTag(t.id)} style={{ padding: "3px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, background: leadTags.includes(t.id) ? t.cor : "var(--gray-soft)", color: leadTags.includes(t.id) ? "#fff" : "var(--ink-faint)" }}>
                  {t.nome}
                </button>
              ))}
              {tags.length === 0 && <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>Nenhuma tag configurada neste funil</span>}
            </div>
          </div>

          {/* Trackeamento */}
          <div className="lead-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 className="lead-sec-title" style={{ margin: 0 }}>Trackeamento</h3>
              {(lead.utmCampaign || origemWa?.utm_campaign) && (
                <button className="trk-copiar" title="Copiar todas as UTMs"
                  onClick={() => {
                    const txt = [
                      `utm_campaign: ${lead.utmCampaign || origemWa?.utm_campaign || "—"}`,
                      `utm_medium: ${lead.utmMedium || origemWa?.utm_medium || "—"}`,
                      `utm_content: ${lead.utmContent || origemWa?.utm_content || "—"}`,
                      `utm_source: ${lead.utmSource || origemWa?.utm_source || "—"}`,
                      `utm_term: ${lead.utmTerm || origemWa?.utm_term || "—"}`,
                    ].join("\n");
                    navigator.clipboard?.writeText(txt)
                      .then(() => onToast("UTMs copiadas"))
                      .catch(() => onToast("Não foi possível copiar"));
                  }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                </button>
              )}
            </div>

            {[
              ["utm_campaign", lead.utmCampaign || origemWa?.utm_campaign],
              ["utm_medium", lead.utmMedium || origemWa?.utm_medium],
              ["utm_content", lead.utmContent || origemWa?.utm_content],
              ["utm_source", lead.utmSource || origemWa?.utm_source],
              ["utm_term", lead.utmTerm || origemWa?.utm_term],
            ].map(([chave, valor]) => (
              <div key={chave} className="trk-linha">
                <span className="trk-chave">{chave}:</span>
                <span className={`trk-valor ${valor ? "" : "vazio"}`} title={valor || ""}>{valor || "—"}</span>
              </div>
            ))}

            {origemWa && (
              <div className="trk-anuncio">
                <div className="trk-anuncio-top">
                  <span className="trk-canal">{origemWa.ad_app === "instagram" ? "Instagram" : origemWa.ad_app === "facebook" ? "Facebook" : "Meta Ads"}</span>
                  {origemWa.ad_url && (
                    <a href={origemWa.ad_url} target="_blank" rel="noopener noreferrer" className="trk-link" title="Abrir o post do anúncio">
                      ver anúncio
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                  )}
                </div>
                {origemWa.ad_titulo && <div className="trk-criativo">{origemWa.ad_titulo}</div>}
                {origemWa.ad_id && <div className="trk-adid">ID do anúncio: {origemWa.ad_id}</div>}
              </div>
            )}

            {!lead.utmSource && !lead.utmCampaign && !origemWa && (
              <p className="trk-nota">
                Sem dados de origem. Leads que chegam por anúncio Click-to-WhatsApp
                são marcados automaticamente.
              </p>
            )}
          </div>
        </div>

        {/* MAIN */}
        <div className="lead-main">
          {/* Alerta campos vazios */}
          {camposVazios.length > 0 && (
            <div className="campos-alerta">
              ⚠ {camposVazios.length} campo{camposVazios.length > 1 ? "s" : ""} personalizado{camposVazios.length > 1 ? "s" : ""} sem preenchimento
            </div>
          )}

          {/* Campos personalizados */}
          {campos.length > 0 && (
            <div className="card card-pad" style={{ marginBottom: 16 }}>
              <h3 className="lead-sec-title" style={{ marginBottom: 10 }}>Campos personalizados</h3>
              <div className="form-grid">
                {campos.map((c) => {
                  let alts = []; try { alts = JSON.parse(c.opcoes || "[]"); } catch {}
                  return (
                    <div key={c.id} className="lead-campo">
                      <span className="lead-label">{c.nome}{c.obrigatorio && " *"}</span>
                      {true ? (
                        c.tipo === "alternativas" && alts.length > 0 ? (
                          <select className="select" style={{ fontSize: 12, padding: "4px 8px" }} value={camposForm[c.id] || ""}
                            onChange={(e) => setCamposForm((p) => ({ ...p, [c.id]: e.target.value }))}>
                            <option value="">— selecione —</option>
                            {alts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                          </select>
                        ) : c.tipo === "numero" ? (
                          <input className="input" style={{ fontSize: 12, padding: "4px 8px" }} type="number" value={camposForm[c.id] || ""} placeholder="—"
                            onChange={(e) => setCamposForm((p) => ({ ...p, [c.id]: e.target.value }))} />
                        ) : (
                          <input className="input" style={{ fontSize: 12, padding: "4px 8px" }} value={camposForm[c.id] || ""} placeholder="—"
                            onChange={(e) => setCamposForm((p) => ({ ...p, [c.id]: e.target.value }))} />
                        )
                      ) : (
                        <span className="lead-valor">{
                          c.tipo === "alternativas" ? (alts.find((a) => a.id === camposForm[c.id])?.nome || camposForm[c.id] || "—")
                          : (camposForm[c.id] || "—")
                        }</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <button className="btn btn-sm btn-primary" style={{ marginTop: 10 }} onClick={salvarCamposPersonalizados}>Salvar campos</button>
            </div>
          )}

          {/* Nova atividade */}
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <h3 className="lead-sec-title" style={{ marginBottom: 10 }}>Atividades</h3>
            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
              <button className="btn btn-sm" onClick={() => setModalAtiv("ligacao")}>📞 Ligação</button>
              <button className="btn btn-sm" onClick={() => setModalAtiv("email")}>✉️ E-mail</button>
              <button className="btn btn-sm" onClick={() => setModalAtiv("tarefa")}>✅ Tarefa</button>
            </div>
            {ativTarefas.length === 0 ? <p style={{ fontSize: 12, color: "var(--ink-faint)" }}>Nenhuma atividade criada.</p> : (
              <div className="atv-lista">
                {ativTarefas.map((a) => {
                  const atrasada = isAtrasada(a) && a.status !== "concluida" && a.status !== "cancelada";
                  const concluida = a.status === "concluida";
                  const cancelada = a.status === "cancelada";
                  const pendente = !concluida && !cancelada;
                  const icons = { ligacao: "📞", email: "✉️", tarefa: "✅" };
                  const tipoLabel = a.tipo === "ligacao" ? "Ligação" : a.tipo === "email" ? "E-mail" : "Tarefa";
                  return (
                    <div key={a.id} className={`atv-card ${atrasada ? "atv-atrasada" : ""} ${concluida ? "atv-concluida" : ""} ${cancelada ? "atv-cancelada" : ""}`}>
                      <div className="atv-card-top">
                        <span>{icons[a.tipo] || "•"} <strong>{tipoLabel}</strong></span>
                        {a.dataPrevista && <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>Prevista: {a.dataPrevista.slice(0,10).split("-").reverse().join("/")}</span>}
                        {atrasada && <span className="atv-badge-atraso">ATRASADA</span>}
                        {concluida && <span className="atv-badge-ok">CONCLUÍDA</span>}
                        {cancelada && <span className="atv-badge-cancel">CANCELADA</span>}
                      </div>
                      <div className="atv-card-desc">{a.descricao}</div>
                      <div className="atv-card-meta">
                        {a.responsavelNome && <span>Resp: {a.responsavelNome} · </span>}
                        {a.autorNome} · {fmtDH(a.criadoEm)}
                      </div>
                      {pendente && (
                        <div className="atv-card-acoes">
                          <button className="btn btn-sm btn-primary" onClick={() => concluirAtividade(a.id)}>Concluir</button>
                          <button className="btn btn-sm btn-ghost" onClick={() => cancelarAtividade(a.id)}>Cancelar</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Anotações (chat) */}
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <h3 className="lead-sec-title" style={{ marginBottom: 10 }}>Anotações</h3>
            <div className="notas-chat">
              {anotacoes.length === 0 && <p style={{ fontSize: 12, color: "var(--ink-faint)", margin: "0 0 10px" }}>Nenhuma anotação.</p>}
              {anotacoes.map((a) => (
                <div key={a.id} className="nota-msg">
                  <div className="nota-autor">{a.autorNome || "Sistema"} · {fmtDH(a.criadoEm)}</div>
                  <div className="nota-texto">{a.descricao}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input className="input" style={{ flex: 1 }} placeholder="Escreva uma anotação…" value={nota} onChange={(e) => setNota(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNota(); } }} />
              <button className="btn btn-primary btn-sm" disabled={!nota.trim()} onClick={addNota}>Enviar</button>
            </div>
          </div>

          {/* Histórico */}
          <div className="card card-pad">
            <h3 className="lead-sec-title" style={{ marginBottom: 12 }}>Histórico completo</h3>
            {historico.length === 0 ? <p style={{ fontSize: 13, color: "var(--ink-faint)" }}>Nenhuma movimentação.</p> : (
              <div className="lead-timeline">
                {historico.map((a) => (
                  <div key={a.id} className="lt-item lt-sistema">
                    <div className="lt-icon">⚙️</div>
                    <div className="lt-content">
                      <div className="lt-desc">{a.descricao}</div>
                      <div className="lt-meta">{a.autorNome || "Sistema"} · {fmtDH(a.criadoEm)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showOnboard && (
        <Modal title="🎉 Venda realizada!" onClose={() => setShowOnboard(false)} footer={
          <><button className="btn btn-ghost" onClick={() => setShowOnboard(false)}>Não, depois</button>
          <button className="btn btn-primary" onClick={() => { if (onIniciarOnboarding) onIniciarOnboarding(lead); setShowOnboard(false); }}>Sim, iniciar!</button></>
        }>
          <p style={{ fontSize: 14, textAlign: "center", margin: "10px 0 16px" }}>Deseja iniciar o processo de <strong>onboarding</strong> agora?</p>
          <p style={{ fontSize: 12, color: "var(--ink-faint)", textAlign: "center" }}>O lead será cadastrado como cliente e você será redirecionado para o módulo de Cadastro.</p>
        </Modal>
      )}
      {editContato && <EditarContatoModal lead={lead} onSave={salvarContato} onClose={() => setEditContato(false)} />}
      {editOrigem && <EditarOrigemModal lead={lead} origens={origens} onSave={salvarOrigem} onClose={() => setEditOrigem(false)} />}
      {modalPerdaLP && (() => {
        const ModalPerdaLP = () => {
          const [mid, setMid] = React.useState("");
          const [just, setJust] = React.useState("");
          const mot = crm_motivos.find((m) => m.id === mid);
          return (
            <Modal title="Motivo da perda" onClose={() => setModalPerdaLP(false)} footer={
              <><button className="btn btn-ghost" onClick={() => setModalPerdaLP(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ background: "var(--red)" }} disabled={!mid || (mot?.exigirJustificativa && !just.trim())} onClick={() => confirmarPerdaLP(modalPerdaLP, mid, just.trim())}>Confirmar perda</button></>
            }>
              <div className="form-row"><label>Motivo *</label><select className="select" value={mid} onChange={(e) => setMid(e.target.value)}>
                <option value="">— selecione —</option>
                {crm_motivos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select></div>
              {mot?.exigirJustificativa && <div className="form-row"><label>Justificativa *</label><textarea className="input" rows={3} value={just} onChange={(e) => setJust(e.target.value)} /></div>}
            </Modal>
          );
        };
        return <ModalPerdaLP />;
      })()}
      {modalAtiv && <NovaAtividadeModal tipo={modalAtiv} pessoas={pessoas} onSave={(d) => criarAtividade(modalAtiv, d)} onClose={() => setModalAtiv(null)} />}
    </>
  );
}
