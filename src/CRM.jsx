import { useEffect, useMemo, useState } from "react";
import { Icon, Modal } from "./components.jsx";
import { fmtMoeda } from "./utils";
import * as api from "./api.js";
import LeadPage from "./LeadPage.jsx";

/* ============================================================
   CRM — Kanban com filtros, cards detalhados e WhatsApp.
   ============================================================ */


const mascaraTel = (v) => {
  const n = v.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 2) return `(${n}`;
  if (n.length <= 7) return `(${n.slice(0,2)}) ${n.slice(2)}`;
  return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
};

const validarEmail = (e) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const fmtDataBR = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const diasAtras = (iso) => {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d;
};

const whatsLink = (num) => {
  if (!num) return null;
  const clean = num.replace(/\D/g, "");
  return `https://wa.me/${clean.startsWith("55") ? clean : "55" + clean}`;
};

/* ---- Modal de criação/edição de lead ---- */
function LeadModal({ base, etapas, tags, origens, pessoas, onSave, onClose }) {
  const [f, setF] = useState({
    id: base?.id || null,
    nome: base?.nome || "",
    email: base?.email || "",
    whatsapp: base?.whatsapp || "",
    valor: base?.valor ?? "",
    etapaId: base?.etapaId || (etapas[0]?.id || ""),
    responsavelId: base?.responsavelId || "",
    origemId: base?.origemId || "",
    tags: base?.tags || "[]",
    utmSource: base?.utmSource || "",
    utmMedium: base?.utmMedium || "",
    utmCampaign: base?.utmCampaign || "",
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const valido = f.nome.trim() && f.whatsapp.trim();

  let tagIds = [];
  try { tagIds = JSON.parse(f.tags); } catch {}

  function toggleTag(tid) {
    const s = new Set(tagIds);
    s.has(tid) ? s.delete(tid) : s.add(tid);
    set("tags", JSON.stringify([...s]));
  }

  return (
    <Modal title={f.id ? "Editar lead" : "Novo lead"} onClose={onClose} footer={
      <><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" disabled={!valido} onClick={() => onSave(f)}>Salvar</button></>
    }>
      <div className="form-grid">
        <div className="form-row"><label>Nome *</label><input className="input" value={f.nome} onChange={(e) => set("nome", e.target.value)} autoFocus placeholder="Nome do lead" /></div>
        <div className="form-row"><label>WhatsApp *</label><input className="input" value={f.whatsapp} onChange={(e) => set("whatsapp", mascaraTel(e.target.value))} placeholder="(11) 99999-9999" maxLength={16} /></div>
      </div>
      <div className="form-grid">
        <div className="form-row"><label>Email</label><input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="email@exemplo.com" style={f.email && !validarEmail(f.email) ? {borderColor:"var(--red)"} : {}} />{f.email && !validarEmail(f.email) && <span style={{fontSize:10,color:"var(--red)"}}>Email inválido</span>}</div>
        <div className="form-row"><label>Valor (R$)</label><input className="input" type="number" min="0" step="0.01" value={f.valor} onChange={(e) => set("valor", e.target.value)} /></div>
      </div>
      <div className="form-grid">
        <div className="form-row"><label>Etapa</label><select className="select" value={f.etapaId} onChange={(e) => set("etapaId", e.target.value)}>
          {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select></div>
        <div className="form-row"><label>Responsável</label><select className="select" value={f.responsavelId} onChange={(e) => set("responsavelId", e.target.value)}>
          <option value="">— sem responsável —</option>
          {(pessoas || []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select></div>
      </div>
      <div className="form-grid">
        <div className="form-row"><label>Origem</label><select className="select" value={f.origemId} onChange={(e) => set("origemId", e.target.value)}>
          <option value="">— sem origem —</option>
          {(origens || []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select></div>
      </div>
      {tags.length > 0 && (
        <div className="form-row">
          <label>Tags</label>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {tags.map((t) => (
              <button key={t.id} onClick={() => toggleTag(t.id)}
                style={{ padding: "3px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
                  background: tagIds.includes(t.id) ? t.cor : "var(--gray-soft)", color: tagIds.includes(t.id) ? "#fff" : "var(--ink-faint)" }}>
                {t.nome}
              </button>
            ))}
          </div>
        </div>
      )}
      <details style={{ marginTop: 10 }}>
        <summary style={{ fontSize: 12, color: "var(--ink-faint)", cursor: "pointer" }}>UTMs (opcional)</summary>
        <div className="form-grid" style={{ marginTop: 8 }}>
          <div className="form-row"><label>Source</label><input className="input" value={f.utmSource} onChange={(e) => set("utmSource", e.target.value)} /></div>
          <div className="form-row"><label>Medium</label><input className="input" value={f.utmMedium} onChange={(e) => set("utmMedium", e.target.value)} /></div>
          <div className="form-row"><label>Campaign</label><input className="input" value={f.utmCampaign} onChange={(e) => set("utmCampaign", e.target.value)} /></div>
        </div>
      </details>
    </Modal>
  );
}

/* ---- Componente principal ---- */
export default function CRM({ pessoas, onToast, userName, isAdmin }) {
  const [crm, setCrm] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [funilId, setFunilId] = useState(null);
  const [modal, setModal] = useState(null);
  const [leadAberto, setLeadAberto] = useState(null);

  // filtros
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");
  const [fResp, setFResp] = useState("");
  const [fTag, setFTag] = useState("");
  const [fOrigem, setFOrigem] = useState("");

  async function carregar() {
    try {
      const d = await api.fetchCRM();
      setCrm(d);
      if (!funilId && d.funis.length > 0) setFunilId(d.funis[0].id);
    } catch (e) { onToast("Erro: " + e.message); }
    finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  if (carregando) return <div style={{ padding: 40, textAlign: "center" }}>Carregando CRM…</div>;
  if (!crm || crm.funis.length === 0) return (
    <div className="empty" style={{ padding: 60 }}><h2>Nenhum funil criado</h2><p>Vá em <strong>Parâmetros de CRM</strong> e crie seu primeiro funil com etapas.</p></div>
  );

  const funil = crm.funis.find((f) => f.id === funilId) || crm.funis[0];
  const etapas = (crm.etapas || []).filter((e) => e.funilId === funil.id).sort((a, b) => a.ordem - b.ordem);
  const tags = (crm.tags || []).filter((t) => t.funilId === funil.id);
  const origens = (crm.origens || []).filter((o) => o.funilId === funil.id);
  const tagMap = Object.fromEntries(tags.map((t) => [t.id, t]));
  const pesMap = Object.fromEntries((pessoas || []).map((p) => [p.id, p]));
  const origemMap = Object.fromEntries(origens.map((o) => [o.id, o]));

  // filtrar leads
  let leads = (crm.leads || []).filter((l) => l.funilId === funil.id);
  if (fDe) leads = leads.filter((l) => (l.criadoEm || "").slice(0, 10) >= fDe);
  if (fAte) leads = leads.filter((l) => (l.criadoEm || "").slice(0, 10) <= fAte);
  if (fResp) leads = leads.filter((l) => l.responsavelId === fResp);
  if (fTag) leads = leads.filter((l) => { try { return JSON.parse(l.tags || "[]").includes(fTag); } catch { return false; } });
  if (fOrigem) leads = leads.filter((l) => l.origemId === fOrigem);

  const leadsPorEtapa = {};
  etapas.forEach((e) => { leadsPorEtapa[e.id] = []; });
  leads.forEach((l) => { if (leadsPorEtapa[l.etapaId]) leadsPorEtapa[l.etapaId].push(l); });

  async function salvarLead(dados) {
    try {
      await api.crmLeadSave({ ...dados, funilId: funil.id });
      setModal(null); onToast("Lead salvo"); carregar();
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function moverLead(leadId, novaEtapaId) {
    const lead = leads.find((l) => l.id === leadId); if (!lead) return;
    try { await api.crmLeadSave({ ...lead, etapaId: novaEtapaId }); carregar(); }
    catch (e) { onToast("Erro: " + e.message); }
  }

  async function excluirLead(id) {
    if (!confirm("Excluir este lead?")) return;
    try { await api.crmLeadDelete(id); carregar(); } catch (e) { onToast("Erro: " + e.message); }
  }

  function exportarCSV() {
    const header = ["Nome", "WhatsApp", "Email", "Etapa", "Valor", "Responsável", "Tags", "Origem", "UTM Source", "UTM Campaign", "Criado em"];
    const rows = leads.map((l) => {
      const etapa = etapas.find((e) => e.id === l.etapaId);
      let tgNomes = ""; try { tgNomes = JSON.parse(l.tags || "[]").map((tid) => tagMap[tid]?.nome || "").filter(Boolean).join(", "); } catch {}
      return [l.nome, l.whatsapp || "", l.email || "", etapa?.nome || "", l.valor, pesMap[l.responsavelId]?.nome || "", tgNomes, origemMap[l.origemId]?.nome || "", l.utmSource || "", l.utmCampaign || "", l.criadoEm?.split("T")[0] || ""];
    });
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `crm_${funil.nome.replace(/\s/g, "_")}.csv`; a.click();
    onToast("CSV exportado");
  }

  const temFiltro = fDe || fAte || fResp || fTag || fOrigem;


  if (leadAberto) {
    const leadAtual = leads.find((l) => l.id === leadAberto) || crm.leads.find((l) => l.id === leadAberto);
    if (leadAtual) {
      return (
        <LeadPage
          lead={leadAtual} etapas={etapas} tags={tags} origens={origens}
          campos={(crm.campos || []).filter((c) => c.funilId === funil.id)}
          pessoas={pessoas} atividades={crm.atividades || []}
          userName={userName}
          isAdmin={isAdmin}
          onVoltar={() => { setLeadAberto(null); carregar(); }}
          onSave={async (d) => { await api.crmLeadSave({ ...d, funilId: funil.id }); carregar(); }}
          onToast={onToast}
        />
      );
    }
    setLeadAberto(null);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>CRM</h1>
          <p>{leads.length} lead{leads.length !== 1 ? "s" : ""} no funil "{funil.nome}"{temFiltro ? " (filtrado)" : ""}</p>
        </div>
        <div className="head-actions">
          <select className="select" style={{ width: "auto" }} value={funilId || ""} onChange={(e) => setFunilId(e.target.value)}>
            {crm.funis.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <button className="btn btn-sm btn-primary" onClick={() => setModal({ etapaId: etapas[0]?.id })}><Icon.Plus /> Criar lead</button>
          <button className="btn btn-sm" onClick={exportarCSV}>Exportar CSV</button>
        </div>
      </div>

      {/* FILTROS */}
      <div className="crm-filtros">
        <div className="crm-filtro">
          <label>De</label>
          <input type="date" className="input" value={fDe} onChange={(e) => setFDe(e.target.value)} />
        </div>
        <div className="crm-filtro">
          <label>Até</label>
          <input type="date" className="input" value={fAte} onChange={(e) => setFAte(e.target.value)} />
        </div>
        <div className="crm-filtro">
          <label>Responsável</label>
          <select className="select" value={fResp} onChange={(e) => setFResp(e.target.value)}>
            <option value="">Todos</option>
            {(pessoas || []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        {tags.length > 0 && (
          <div className="crm-filtro">
            <label>Tag</label>
            <select className="select" value={fTag} onChange={(e) => setFTag(e.target.value)}>
              <option value="">Todas</option>
              {tags.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
        )}
        {origens.length > 0 && (
          <div className="crm-filtro">
            <label>Origem</label>
            <select className="select" value={fOrigem} onChange={(e) => setFOrigem(e.target.value)}>
              <option value="">Todas</option>
              {origens.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
        )}
        {temFiltro && <button className="btn btn-sm btn-ghost" onClick={() => { setFDe(""); setFAte(""); setFResp(""); setFTag(""); setFOrigem(""); }}>Limpar filtros</button>}
      </div>

      {/* TILES */}
      <div className="tiles" style={{ marginBottom: 16 }}>
        <div className="tile"><div className="label">Total de leads</div><div className="value">{leads.length}</div></div>
        <div className="tile"><div className="label">Valor total</div><div className="value">{fmtMoeda(leads.reduce((s, l) => s + (l.valor || 0), 0))}</div></div>
        <div className="tile"><div className="label">Ganhos</div><div className="value" style={{ color: "var(--green)" }}>
          {leads.filter((l) => etapas.find((e) => e.id === l.etapaId)?.tipo === "ganho").length}
        </div></div>
        <div className="tile"><div className="label">Perdidos</div><div className="value" style={{ color: "var(--red)" }}>
          {leads.filter((l) => etapas.find((e) => e.id === l.etapaId)?.tipo === "perdido").length}
        </div></div>
      </div>

      {/* KANBAN */}
      {etapas.length === 0 ? (
        <div className="empty"><p>Sem etapas. Vá em Parâmetros de CRM para criá-las.</p></div>
      ) : (
        <div className="kanban-board">
          {etapas.map((etapa) => {
            const leadsCol = leadsPorEtapa[etapa.id] || [];
            const valorCol = leadsCol.reduce((s, l) => s + (l.valor || 0), 0);
            return (
              <div key={etapa.id} className="kanban-col"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { const lid = e.dataTransfer.getData("leadId"); if (lid) moverLead(lid, etapa.id); }}>
                <div className="kanban-col-head" style={{ borderLeftColor: etapa.cor }}>
                  <span className="kanban-col-nome">{etapa.nome}</span>
                  <span className="kanban-col-meta">({leadsCol.length}) {valorCol > 0 ? fmtMoeda(valorCol) : ""}</span>
                </div>
                <div className="kanban-col-body">
                  {leadsCol.map((l) => {
                    let leadTags = []; try { leadTags = JSON.parse(l.tags || "[]"); } catch {}
                    const dias = diasAtras(l.criadoEm);
                    const wl = whatsLink(l.whatsapp);
                    return (
                      <div key={l.id} className="kanban-card" draggable
                        onDragStart={(e) => e.dataTransfer.setData("leadId", l.id)}>
                        <div className="kc-top">
                          <span className="kc-data">{fmtDataBR(l.criadoEm)}{dias != null && dias > 0 ? ` · ${dias}d` : ""}</span>
                          <div className="kc-acoes">
                            <button className="iconbtn" onClick={() => setModal(l)} title="Editar"><Icon.Edit /></button>
                            <button className="iconbtn" onClick={() => excluirLead(l.id)} title="Excluir"><Icon.Trash /></button>
                          </div>
                        </div>
                        <div className="kc-nome" onClick={() => setLeadAberto(l.id)} style={{cursor:"pointer"}}>{l.nome}</div>
                        <div className="kc-icons">
                          {l.whatsapp && (
                            <a href={wl} target="_blank" rel="noopener noreferrer" className="kc-whats-icon" title="WhatsApp" onClick={(e) => e.stopPropagation()}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                            </a>
                          )}
                          {l.email && <span className="kc-email-icon" title={l.email}>✉</span>}
                        </div>
                        {l.valor > 0 && <div className="kc-valor">{fmtMoeda(l.valor)}</div>}
                        {leadTags.length > 0 && (
                          <div className="kc-tags">
                            {leadTags.map((tid) => tagMap[tid] && (
                              <span key={tid} className="kc-tag" style={{ background: tagMap[tid].cor }}>{tagMap[tid].nome}</span>
                            ))}
                          </div>
                        )}
                        {l.responsavelId && pesMap[l.responsavelId] && (
                          <div className="kc-resp">👤 {pesMap[l.responsavelId].nome}</div>
                        )}
                      </div>
                    );
                  })}
                  <button className="kanban-add" onClick={() => setModal({ etapaId: etapa.id })}>
                    <Icon.Plus /> Lead
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <LeadModal base={modal} etapas={etapas} tags={tags} origens={origens} pessoas={pessoas}
          onSave={salvarLead} onClose={() => setModal(null)} />
      )}
    </>
  );
}
