import { useEffect, useMemo, useState } from "react";
import { Icon, Modal } from "./components.jsx";
import { fmtMoeda } from "./utils";
import * as api from "./api.js";

/* ============================================================
   Página do Lead — inspirada no RD Station.
   Pipeline clicável, dados de contato, campos personalizados,
   tarefas, anotações e histórico.
   ============================================================ */

const fmtDataHora = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const whatsLink = (num) => {
  if (!num) return null;
  const clean = num.replace(/\D/g, "");
  return `https://wa.me/${clean.startsWith("55") ? clean : "55" + clean}`;
};

const TIPO_ATIVIDADE = [
  { v: "nota", l: "Anotação", icon: "📝" },
  { v: "ligacao", l: "Ligação", icon: "📞" },
  { v: "email", l: "E-mail", icon: "✉️" },
  { v: "reuniao", l: "Reunião", icon: "📅" },
  { v: "tarefa", l: "Tarefa", icon: "✅" },
  { v: "sistema", l: "Sistema", icon: "⚙️" },
];

export default function LeadPage({ lead, etapas, tags, origens, campos, pessoas, atividades, onVoltar, onSave, onToast, userName }) {
  const [editando, setEditando] = useState(null); // campo sendo editado
  const [novaAtividade, setNovaAtividade] = useState("");
  const [tipoAtividade, setTipoAtividade] = useState("nota");
  const [atividadesLocal, setAtividadesLocal] = useState(
    (atividades || []).filter((a) => a.leadId === lead.id).sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))
  );

  const tagMap = Object.fromEntries((tags || []).map((t) => [t.id, t]));
  const pesMap = Object.fromEntries((pessoas || []).map((p) => [p.id, p]));
  const origemMap = Object.fromEntries((origens || []).map((o) => [o.id, o]));
  const etapaAtual = etapas.find((e) => e.id === lead.etapaId);

  let leadTags = [];
  try { leadTags = JSON.parse(lead.tags || "[]"); } catch {}
  let camposCustom = {};
  try { camposCustom = JSON.parse(lead.camposCustom || "{}"); } catch {}

  async function mudarEtapa(etapaId) {
    try {
      await onSave({ ...lead, etapaId });
      await api.crmAtividadeSave({
        leadId: lead.id, tipo: "sistema",
        descricao: `Movido para "${etapas.find((e) => e.id === etapaId)?.nome || "?"}"`,
        autorNome: userName,
      });
      onToast("Etapa atualizada");
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function salvarCampo(campo, valor) {
    const novosCampos = { ...camposCustom, [campo]: valor };
    try { await onSave({ ...lead, camposCustom: JSON.stringify(novosCampos) }); }
    catch (e) { onToast("Erro: " + e.message); }
    setEditando(null);
  }

  async function addAtividade() {
    if (!novaAtividade.trim()) return;
    try {
      await api.crmAtividadeSave({
        leadId: lead.id, tipo: tipoAtividade, descricao: novaAtividade, autorNome: userName,
      });
      setAtividadesLocal((prev) => [{
        id: Date.now().toString(), leadId: lead.id, tipo: tipoAtividade,
        descricao: novaAtividade, autorNome: userName, criadoEm: new Date().toISOString(),
      }, ...prev]);
      setNovaAtividade("");
      onToast("Atividade registrada");
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function salvarDado(campo, valor) {
    try { await onSave({ ...lead, [campo]: valor }); onToast("Salvo"); }
    catch (e) { onToast("Erro: " + e.message); }
  }

  return (
    <>
      {/* HEADER */}
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button className="btn btn-sm btn-ghost" onClick={onVoltar}>‹ Voltar</button>
          <div>
            <h1 style={{ margin: 0 }}>{lead.nome}</h1>
            <p style={{ margin: 0 }}>
              {etapaAtual && <span className="pill" style={{ background: etapaAtual.cor, color: "#fff", marginRight: 6 }}>{etapaAtual.nome}</span>}
              Criado em {fmtDataHora(lead.criadoEm)}
            </p>
          </div>
        </div>
        <div className="head-actions">
          {etapaAtual?.tipo !== "ganho" && (
            <button className="btn btn-sm btn-primary" onClick={() => {
              const ganho = etapas.find((e) => e.tipo === "ganho");
              if (ganho) mudarEtapa(ganho.id); else onToast("Nenhuma etapa do tipo 'ganho' configurada");
            }}>★ Marcar venda</button>
          )}
          {etapaAtual?.tipo !== "perdido" && (
            <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => {
              const perdido = etapas.find((e) => e.tipo === "perdido");
              if (perdido) mudarEtapa(perdido.id); else onToast("Nenhuma etapa do tipo 'perdido' configurada");
            }}>✕ Marcar perda</button>
          )}
        </div>
      </div>

      {/* PIPELINE VISUAL */}
      <div className="lead-pipeline">
        {etapas.map((et) => (
          <button key={et.id}
            className={`lp-etapa ${et.id === lead.etapaId ? "lp-atual" : ""} ${et.tipo === "ganho" ? "lp-ganho" : et.tipo === "perdido" ? "lp-perdido" : ""}`}
            style={{ "--ec": et.cor }}
            onClick={() => mudarEtapa(et.id)}>
            {et.nome}
          </button>
        ))}
      </div>

      <div className="lead-layout">
        {/* COLUNA ESQUERDA — dados */}
        <div className="lead-sidebar">
          {/* Contato */}
          <div className="lead-section">
            <h3 className="lead-sec-title">Contato</h3>
            <div className="lead-campo">
              <span className="lead-label">Nome</span>
              <span className="lead-valor">{lead.nome}</span>
            </div>
            <div className="lead-campo">
              <span className="lead-label">WhatsApp</span>
              <span className="lead-valor">
                {lead.whatsapp ? (
                  <a href={whatsLink(lead.whatsapp)} target="_blank" rel="noopener noreferrer" className="kc-whats">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                    {lead.whatsapp}
                  </a>
                ) : "—"}
              </span>
            </div>
            <div className="lead-campo">
              <span className="lead-label">Email</span>
              <span className="lead-valor">{lead.email || "—"}</span>
            </div>
            <div className="lead-campo">
              <span className="lead-label">Valor</span>
              <span className="lead-valor">{lead.valor > 0 ? fmtMoeda(lead.valor) : "—"}</span>
            </div>
          </div>

          {/* Responsável e Origem */}
          <div className="lead-section">
            <h3 className="lead-sec-title">Atribuição</h3>
            <div className="lead-campo">
              <span className="lead-label">Responsável</span>
              <select className="select" style={{ fontSize: 12 }} value={lead.responsavelId || ""}
                onChange={(e) => salvarDado("responsavelId", e.target.value || null)}>
                <option value="">— sem responsável —</option>
                {(pessoas || []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div className="lead-campo">
              <span className="lead-label">Origem</span>
              <span className="lead-valor">{origemMap[lead.origemId]?.nome || "—"}</span>
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="lead-section">
              <h3 className="lead-sec-title">Tags</h3>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {leadTags.map((tid) => tagMap[tid] && (
                  <span key={tid} className="kc-tag" style={{ background: tagMap[tid].cor }}>{tagMap[tid].nome}</span>
                ))}
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
              {lead.utmTerm && <div className="lead-campo"><span className="lead-label">Term</span><span className="lead-valor">{lead.utmTerm}</span></div>}
              {lead.utmContent && <div className="lead-campo"><span className="lead-label">Content</span><span className="lead-valor">{lead.utmContent}</span></div>}
            </div>
          )}

          {/* Campos personalizados */}
          {campos.length > 0 && (
            <div className="lead-section">
              <h3 className="lead-sec-title">Campos personalizados</h3>
              {campos.map((c) => (
                <div key={c.id} className="lead-campo">
                  <span className="lead-label">{c.nome}{c.obrigatorio && " *"}</span>
                  <input className="input" style={{ fontSize: 12, padding: "4px 8px" }}
                    value={camposCustom[c.id] || ""} placeholder="—"
                    onChange={(e) => { camposCustom[c.id] = e.target.value; }}
                    onBlur={(e) => salvarCampo(c.id, e.target.value)} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* COLUNA DIREITA — atividades e histórico */}
        <div className="lead-main">
          {/* Adicionar atividade */}
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <h3 className="lead-sec-title" style={{ marginBottom: 10 }}>Nova atividade</h3>
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              {TIPO_ATIVIDADE.filter((t) => t.v !== "sistema").map((t) => (
                <button key={t.v}
                  className={`btn btn-sm ${tipoAtividade === t.v ? "btn-primary" : ""}`}
                  onClick={() => setTipoAtividade(t.v)}>
                  {t.icon} {t.l}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <textarea className="input" rows={2} style={{ flex: 1 }} placeholder="Escreva uma anotação, registre uma ligação..."
                value={novaAtividade} onChange={(e) => setNovaAtividade(e.target.value)} />
              <button className="btn btn-primary btn-sm" style={{ alignSelf: "flex-end" }}
                disabled={!novaAtividade.trim()} onClick={addAtividade}>Salvar</button>
            </div>
          </div>

          {/* Histórico */}
          <div className="card card-pad">
            <h3 className="lead-sec-title" style={{ marginBottom: 12 }}>Histórico</h3>
            {atividadesLocal.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ink-faint)" }}>Nenhuma atividade registrada.</p>
            ) : (
              <div className="lead-timeline">
                {atividadesLocal.map((a) => {
                  const tipo = TIPO_ATIVIDADE.find((t) => t.v === a.tipo) || TIPO_ATIVIDADE[0];
                  return (
                    <div key={a.id} className="lt-item">
                      <div className="lt-icon">{tipo.icon}</div>
                      <div className="lt-content">
                        <div className="lt-desc">{a.descricao}</div>
                        <div className="lt-meta">
                          {a.autorNome || "Sistema"} · {fmtDataHora(a.criadoEm)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
