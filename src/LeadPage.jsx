import { useEffect, useState, useRef } from "react";
import { Icon, Modal } from "./components.jsx";
import { fmtMoeda } from "./utils";
import * as api from "./api.js";

/* ============================================================
   Página do Lead — contato editável, campos personalizados,
   atividades com data/responsável, anotações, histórico
   completo e confetes na venda.
   ============================================================ */

const fmtDH = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const whatsLink = (num) => {
  if (!num) return null;
  const c = num.replace(/\D/g, "");
  return `https://wa.me/${c.startsWith("55") ? c : "55" + c}`;
};
const mascaraTel = (v) => {
  const n = v.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 2) return `(${n}`;
  if (n.length <= 7) return `(${n.slice(0,2)}) ${n.slice(2)}`;
  return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
};

/* ---- Confetes ---- */
function dispararConfetes() {
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(container);
  const cores = ["#22c55e","#f59e0b","#3b82f6","#ef4444","#8b5cf6","#ec4899","#14b8a6","#ffd700"];
  for (let i = 0; i < 120; i++) {
    const c = document.createElement("div");
    const cor = cores[Math.floor(Math.random() * cores.length)];
    const x = Math.random() * 100;
    const delay = Math.random() * 0.8;
    const dur = 2 + Math.random() * 2;
    const size = 6 + Math.random() * 8;
    const rot = Math.random() * 360;
    c.style.cssText = `position:absolute;top:-20px;left:${x}%;width:${size}px;height:${size * 0.6}px;background:${cor};border-radius:2px;transform:rotate(${rot}deg);animation:confetti-fall ${dur}s ${delay}s ease-out forwards;opacity:0.9`;
    container.appendChild(c);
  }
  setTimeout(() => container.remove(), 5000);
}

/* ---- Modal de edição de contato ---- */
function EditarContatoModal({ lead, onSave, onClose }) {
  const [nome, setNome] = useState(lead.nome || "");
  const [whatsapp, setWhatsapp] = useState(lead.whatsapp || "");
  const [email, setEmail] = useState(lead.email || "");
  const [valor, setValor] = useState(lead.valor ?? "");
  return (
    <Modal title="Editar dados de contato" onClose={onClose} footer={
      <><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" disabled={!nome.trim() || !whatsapp.trim()} onClick={() => {
        onSave({ nome, whatsapp, email, valor: Number(valor) || 0 });
      }}>Salvar</button></>
    }>
      <div className="form-row"><label>Nome *</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></div>
      <div className="form-row"><label>WhatsApp *</label><input className="input" value={whatsapp} onChange={(e) => setWhatsapp(mascaraTel(e.target.value))} maxLength={16} /></div>
      <div className="form-row"><label>Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="form-row"><label>Valor (R$)</label><input className="input" type="number" min="0" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
    </Modal>
  );
}

/* ---- Modal de nova atividade (ligação/email/tarefa) ---- */
function NovaAtividadeModal({ tipo, pessoas, onSave, onClose }) {
  const labels = { ligacao: "Ligação", email: "E-mail", tarefa: "Tarefa" };
  const [desc, setDesc] = useState("");
  const [dataPrevista, setDataPrevista] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  return (
    <Modal title={`Nova ${labels[tipo] || tipo}`} onClose={onClose} footer={
      <><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" disabled={!desc.trim()} onClick={() => onSave({ desc, dataPrevista, responsavelId })}>Criar</button></>
    }>
      <div className="form-row"><label>Descrição *</label><textarea className="input" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} autoFocus placeholder="Descreva a atividade…" /></div>
      <div className="form-grid">
        <div className="form-row"><label>Data prevista</label><input className="input" type="datetime-local" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} /></div>
        <div className="form-row"><label>Responsável</label><select className="select" value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
          <option value="">— selecione —</option>
          {(pessoas || []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select></div>
      </div>
    </Modal>
  );
}

/* ---- Componente principal ---- */
export default function LeadPage({ lead, etapas, tags, origens, campos, pessoas, atividades, onVoltar, onSave, onToast, userName, isAdmin }) {
  const [editContato, setEditContato] = useState(false);
  const [modalAtiv, setModalAtiv] = useState(null); // "ligacao"|"email"|"tarefa"
  const [nota, setNota] = useState("");
  const [atvsLocal, setAtvsLocal] = useState(
    (atividades || []).filter((a) => a.leadId === lead.id).sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))
  );

  const tagMap = Object.fromEntries((tags || []).map((t) => [t.id, t]));
  const pesMap = Object.fromEntries((pessoas || []).map((p) => [p.id, p]));
  const etapaAtual = etapas.find((e) => e.id === lead.etapaId);

  let leadTags = []; try { leadTags = JSON.parse(lead.tags || "[]"); } catch {}
  let camposCustom = {}; try { camposCustom = JSON.parse(lead.camposCustom || "{}"); } catch {}

  async function registrar(tipo, descricao, extra) {
    const atv = { leadId: lead.id, tipo, descricao, autorNome: userName, ...(extra || {}) };
    try {
      await api.crmAtividadeSave(atv);
      setAtvsLocal((prev) => [{ ...atv, id: Date.now().toString(), criadoEm: new Date().toISOString() }, ...prev]);
    } catch {}
  }

  async function mudarEtapa(etapaId) {
    const nomeEtapa = etapas.find((e) => e.id === etapaId)?.nome || "?";
    const tipo = etapas.find((e) => e.id === etapaId)?.tipo;
    try {
      await onSave({ ...lead, etapaId });
      await registrar("sistema", `Movido para "${nomeEtapa}"`);
      if (tipo === "ganho") { dispararConfetes(); onToast("🎉 VENDA MARCADA! Parabéns!"); }
      else if (tipo === "perdido") { onToast("Lead marcado como perdido"); }
      else { onToast("Etapa atualizada"); }
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function salvarContato(dados) {
    const mudancas = [];
    if (dados.nome !== lead.nome) mudancas.push(`Nome: "${lead.nome}" → "${dados.nome}"`);
    if (dados.whatsapp !== lead.whatsapp) mudancas.push("WhatsApp atualizado");
    if (dados.email !== lead.email) mudancas.push("Email atualizado");
    if (dados.valor !== lead.valor) mudancas.push(`Valor: ${fmtMoeda(lead.valor || 0)} → ${fmtMoeda(dados.valor)}`);
    try {
      await onSave({ ...lead, ...dados });
      if (mudancas.length > 0) await registrar("sistema", `Dados editados: ${mudancas.join(", ")}`);
      setEditContato(false); onToast("Dados atualizados");
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function salvarCampoCustom(campoId, valor) {
    const novosCampos = { ...camposCustom, [campoId]: valor };
    const nomeCampo = campos.find((c) => c.id === campoId)?.nome || campoId;
    try {
      await onSave({ ...lead, camposCustom: JSON.stringify(novosCampos) });
      await registrar("sistema", `Campo "${nomeCampo}" atualizado`);
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function salvarResponsavel(respId) {
    const nomeResp = pesMap[respId]?.nome || "ninguém";
    try {
      await onSave({ ...lead, responsavelId: respId || null });
      await registrar("sistema", `Responsável alterado para ${nomeResp}`);
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function criarAtividade(tipo, dados) {
    const respNome = pesMap[dados.responsavelId]?.nome || "";
    const desc = `${dados.desc}${dados.dataPrevista ? ` · Prevista: ${fmtDH(dados.dataPrevista)}` : ""}${respNome ? ` · Resp: ${respNome}` : ""}`;
    await registrar(tipo, desc);
    setModalAtiv(null);
    onToast("Atividade criada");
  }

  async function addNota() {
    if (!nota.trim()) return;
    await registrar("nota", nota);
    setNota("");
    onToast("Anotação salva");
  }

  return (
    <>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button className="btn btn-sm btn-ghost" onClick={onVoltar}>‹ Voltar</button>
          <div>
            <h1 style={{ margin: 0 }}>{lead.nome}</h1>
            <p style={{ margin: 0 }}>
              {etapaAtual && <span className="pill" style={{ background: etapaAtual.cor, color: "#fff", marginRight: 6 }}>{etapaAtual.nome}</span>}
              Criado em {fmtDH(lead.criadoEm)}
            </p>
          </div>
        </div>
        <div className="head-actions">
          {etapaAtual?.tipo !== "ganho" && (
            <button className="btn btn-sm btn-primary" onClick={() => {
              const g = etapas.find((e) => e.tipo === "ganho");
              if (g) mudarEtapa(g.id); else onToast("Configure uma etapa 'Lead ganho' nos Parâmetros");
            }}>★ Marcar venda</button>
          )}
          {etapaAtual?.tipo !== "perdido" && (
            <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => {
              const p = etapas.find((e) => e.tipo === "perdido");
              if (p) mudarEtapa(p.id); else onToast("Configure uma etapa 'Lead perdido' nos Parâmetros");
            }}>✕ Marcar perda</button>
          )}
        </div>
      </div>

      {/* PIPELINE */}
      <div className="lead-pipeline">
        {etapas.map((et) => (
          <button key={et.id} className={`lp-etapa ${et.id === lead.etapaId ? "lp-atual" : ""} ${et.tipo === "ganho" ? "lp-ganho" : et.tipo === "perdido" ? "lp-perdido" : ""}`}
            style={{ "--ec": et.cor }} onClick={() => mudarEtapa(et.id)}>
            {et.nome}
          </button>
        ))}
      </div>

      <div className="lead-layout">
        {/* SIDEBAR */}
        <div className="lead-sidebar">
          {/* Contato */}
          <div className="lead-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 className="lead-sec-title" style={{ margin: 0 }}>Contato</h3>
              <button className="iconbtn" onClick={() => setEditContato(true)} title="Editar"><Icon.Edit /></button>
            </div>
            <div className="lead-campo"><span className="lead-label">Nome</span><span className="lead-valor">{lead.nome}</span></div>
            <div className="lead-campo">
              <span className="lead-label">WhatsApp</span>
              <span className="lead-valor">
                {lead.whatsapp ? <a href={whatsLink(lead.whatsapp)} target="_blank" rel="noopener noreferrer" className="kc-whats"
                  style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                  {lead.whatsapp}</a> : "—"}
              </span>
            </div>
            <div className="lead-campo"><span className="lead-label">Email</span><span className="lead-valor">{lead.email || "—"}</span></div>
            <div className="lead-campo"><span className="lead-label">Valor</span><span className="lead-valor">{lead.valor > 0 ? fmtMoeda(lead.valor) : "—"}</span></div>
          </div>

          {/* Atribuição */}
          <div className="lead-section">
            <h3 className="lead-sec-title">Atribuição</h3>
            <div className="lead-campo">
              <span className="lead-label">Responsável</span>
              <select className="select" style={{ fontSize: 12 }} value={lead.responsavelId || ""}
                onChange={(e) => salvarResponsavel(e.target.value)}>
                <option value="">— sem responsável —</option>
                {(pessoas || []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div className="lead-campo"><span className="lead-label">Origem</span><span className="lead-valor">{origens.find((o) => o.id === lead.origemId)?.nome || "—"}</span></div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="lead-section">
              <h3 className="lead-sec-title">Tags</h3>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {leadTags.map((tid) => tagMap[tid] && <span key={tid} className="kc-tag" style={{ background: tagMap[tid].cor }}>{tagMap[tid].nome}</span>)}
                {leadTags.length === 0 && <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>Sem tags</span>}
              </div>
            </div>
          )}

          {/* UTMs */}
          {(lead.utmSource || lead.utmMedium || lead.utmCampaign) && (
            <div className="lead-section">
              <h3 className="lead-sec-title">UTMs</h3>
              {lead.utmSource && <div className="lead-campo"><span className="lead-label">Source</span><span className="lead-valor">{lead.utmSource}</span></div>}
              {lead.utmMedium && <div className="lead-campo"><span className="lead-label">Medium</span><span className="lead-valor">{lead.utmMedium}</span></div>}
              {lead.utmCampaign && <div className="lead-campo"><span className="lead-label">Campaign</span><span className="lead-valor">{lead.utmCampaign}</span></div>}
            </div>
          )}
        </div>

        {/* MAIN */}
        <div className="lead-main">
          {/* Campos personalizados (só admin edita) */}
          {campos.length > 0 && (
            <div className="card card-pad" style={{ marginBottom: 16 }}>
              <h3 className="lead-sec-title" style={{ marginBottom: 10 }}>Campos personalizados</h3>
              <div className="form-grid">
                {campos.map((c) => (
                  <div key={c.id} className="lead-campo">
                    <span className="lead-label">{c.nome}{c.obrigatorio && " *"}</span>
                    {isAdmin ? (
                      <input className="input" style={{ fontSize: 12, padding: "4px 8px" }}
                        defaultValue={camposCustom[c.id] || ""} placeholder="—"
                        onBlur={(e) => salvarCampoCustom(c.id, e.target.value)} />
                    ) : (
                      <span className="lead-valor">{camposCustom[c.id] || "—"}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nova atividade */}
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <h3 className="lead-sec-title" style={{ marginBottom: 10 }}>Nova atividade</h3>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button className="btn btn-sm" onClick={() => setModalAtiv("ligacao")}>📞 Ligação</button>
              <button className="btn btn-sm" onClick={() => setModalAtiv("email")}>✉️ E-mail</button>
              <button className="btn btn-sm" onClick={() => setModalAtiv("tarefa")}>✅ Tarefa</button>
            </div>
          </div>

          {/* Anotações */}
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <h3 className="lead-sec-title" style={{ marginBottom: 10 }}>Anotações</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <textarea className="input" rows={2} style={{ flex: 1 }} placeholder="Escreva um comentário sobre este lead…"
                value={nota} onChange={(e) => setNota(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addNota(); } }} />
              <button className="btn btn-primary btn-sm" style={{ alignSelf: "flex-end" }}
                disabled={!nota.trim()} onClick={addNota}>Enviar</button>
            </div>
          </div>

          {/* Histórico */}
          <div className="card card-pad">
            <h3 className="lead-sec-title" style={{ marginBottom: 12 }}>Histórico completo</h3>
            {atvsLocal.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ink-faint)" }}>Nenhuma atividade registrada.</p>
            ) : (
              <div className="lead-timeline">
                {atvsLocal.map((a) => {
                  const icons = { nota: "📝", ligacao: "📞", email: "✉️", reuniao: "📅", tarefa: "✅", sistema: "⚙️" };
                  return (
                    <div key={a.id} className={`lt-item ${a.tipo === "sistema" ? "lt-sistema" : ""}`}>
                      <div className="lt-icon">{icons[a.tipo] || "•"}</div>
                      <div className="lt-content">
                        <div className="lt-desc">{a.descricao}</div>
                        <div className="lt-meta">{a.autorNome || "Sistema"} · {fmtDH(a.criadoEm)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {editContato && <EditarContatoModal lead={lead} onSave={salvarContato} onClose={() => setEditContato(false)} />}
      {modalAtiv && <NovaAtividadeModal tipo={modalAtiv} pessoas={pessoas} onSave={(d) => criarAtividade(modalAtiv, d)} onClose={() => setModalAtiv(null)} />}
    </>
  );
}
