import { useEffect, useMemo, useState } from "react";
import { Icon, Modal } from "./components.jsx";
import { fmtMoeda } from "./utils";
import * as api from "./api.js";
import LeadPage from "./LeadPage.jsx";
import { logAcao } from "./logger.js";
import { executarAutomacoes } from "./autoEngine.js";

const fmtDataBR = (iso) => { if (!iso) return ""; const d = new Date(iso); const p = (n) => String(n).padStart(2, "0"); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`; };
const mascaraTel = (v) => { const n = v.replace(/\D/g, "").slice(0, 11); if (n.length <= 2) return `(${n}`; if (n.length <= 7) return `(${n.slice(0,2)}) ${n.slice(2)}`; return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`; };
const whatsLink = (num) => { if (!num) return null; const c = num.replace(/\D/g, ""); return `https://wa.me/${c.startsWith("55") ? c : "55" + c}`; };
const validarEmail = (e) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const WhatsIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#25d366" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
  </svg>
);

const FILTROS_DATA = [
  { id: "", l: "Todas as datas" },
  { id: "hoje", l: "Hoje" },
  { id: "7d", l: "Últimos 7 dias" },
  { id: "15d", l: "Últimos 15 dias" },
  { id: "30d", l: "Últimos 30 dias" },
  { id: "90d", l: "Últimos 90 dias" },
];
const dataLimite = (filtro) => {
  if (!filtro) return null;
  const d = new Date();
  if (filtro === "hoje") d.setHours(0,0,0,0);
  else if (filtro === "7d") d.setDate(d.getDate() - 7);
  else if (filtro === "15d") d.setDate(d.getDate() - 15);
  else if (filtro === "30d") d.setDate(d.getDate() - 30);
  else if (filtro === "90d") d.setDate(d.getDate() - 90);
  else return null;
  return d.toISOString();
};

/* ---- Avatar do lead ---- */
function LeadAvatar({ nome }) {
  return (
    <div className="lead-avatar">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#999" opacity="0.4"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/></svg>
    </div>
  );
}

/* ---- Modal novo lead ---- */
function LeadModal({ base, etapas, origens, produtos, pessoas, onSave, onClose }) {
  const [f, setF] = useState({
    id: base?.id || null, nome: base?.nome || "", email: base?.email || "", whatsapp: base?.whatsapp || "",
    valor: base?.valor ?? "", etapaId: base?.etapaId || (etapas[0]?.id || ""),
    responsavelId: base?.responsavelId || "", origemId: base?.origemId || "",
    produtoId: base?.produtoId || "", tags: base?.tags || "[]",
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const valido = f.nome.trim() && f.whatsapp.trim();
  let tagIds = []; try { tagIds = JSON.parse(f.tags); } catch {}

  function selectProduto(pid) {
    set("produtoId", pid);
    const prod = (produtos || []).find((p) => p.id === pid);
    if (prod) set("valor", prod.valor);
  }

  return (
    <Modal title={f.id ? "Editar lead" : "Novo lead"} onClose={onClose} footer={
      <><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" disabled={!valido} onClick={() => onSave(f)}>Salvar</button></>}>
      <div className="form-grid">
        <div className="form-row"><label>Nome *</label><input className="input" value={f.nome} onChange={(e) => set("nome", e.target.value)} autoFocus /></div>
        <div className="form-row"><label>WhatsApp *</label><input className="input" value={f.whatsapp} onChange={(e) => set("whatsapp", mascaraTel(e.target.value))} maxLength={16} placeholder="(11) 99999-9999" /></div>
      </div>
      <div className="form-grid">
        <div className="form-row"><label>Email</label><input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} style={f.email && !validarEmail(f.email) ? {borderColor:"var(--red)"} : {}} /></div>
        <div className="form-row"><label>Produto</label><select className="select" value={f.produtoId} onChange={(e) => selectProduto(e.target.value)}>
          <option value="">— sem produto —</option>
          {(produtos || []).map((p) => <option key={p.id} value={p.id}>{p.nome} ({fmtMoeda(p.valor)})</option>)}
        </select></div>
      </div>
      <div className="form-grid">
        <div className="form-row"><label>Valor (R$)</label><input className="input" type="number" min="0" step="0.01" value={f.valor} onChange={(e) => set("valor", e.target.value)} /></div>
        <div className="form-row"><label>Etapa</label><select className="select" value={f.etapaId} onChange={(e) => set("etapaId", e.target.value)}>
          {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select></div>
      </div>
      <div className="form-grid">
        <div className="form-row"><label>Responsável</label><select className="select" value={f.responsavelId} onChange={(e) => set("responsavelId", e.target.value)}>
          <option value="">— sem responsável —</option>{(pessoas || []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select></div>
        <div className="form-row"><label>Origem</label><select className="select" value={f.origemId} onChange={(e) => set("origemId", e.target.value)}>
          <option value="">— sem origem —</option>{(origens || []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select></div>
      </div>
    </Modal>
  );
}


function ModalPerda({ motivos, onConfirm, onClose }) {
  const [motivoId, setMotivoId] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const motivoSel = motivos.find((m) => m.id === motivoId);
  return (
    <Modal title="Motivo da perda" onClose={onClose} footer={
      <><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" style={{ background: "var(--red)" }} disabled={!motivoId || (motivoSel?.exigirJustificativa && !justificativa.trim())} onClick={() => onConfirm(motivoId, justificativa.trim())}>Confirmar perda</button></>
    }>
      <p style={{ fontSize: 13, marginBottom: 12 }}>Selecione o motivo pelo qual este lead foi perdido:</p>
      <div className="form-row"><label>Motivo *</label><select className="select" value={motivoId} onChange={(e) => setMotivoId(e.target.value)}>
        <option value="">— selecione o motivo —</option>
        {(motivos || []).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
      </select></div>
      {motivoSel?.exigirJustificativa && (
        <div className="form-row"><label>Justificativa *</label><textarea className="input" rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Explique o motivo em detalhes…" /></div>
      )}
    </Modal>
  );
}

/* ---- Principal ---- */
export default function CRM({ pessoas, onToast, userName, isAdmin, onIniciarOnboarding }) {
  const [crm, setCrm] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [funilId, setFunilId] = useState(null);
  const [modal, setModal] = useState(null);
  const [leadAberto, setLeadAberto] = useState(null);
  const [modalPerda, setModalPerda] = useState(null);
  const [modalOnboard, setModalOnboard] = useState(null); // lead para onboarding // leadId para marcar perda
  const [fData, setFData] = useState("");
  const [fResp, setFResp] = useState("");
  const [fTag, setFTag] = useState("");
  const [fProduto, setFProduto] = useState("");

  async function carregar() {
    try { const d = await api.fetchCRM(); setCrm(d); if (!funilId && d.funis.length > 0) setFunilId(d.funis[0].id); }
    catch (e) { onToast("Erro: " + e.message); } finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  if (carregando) return <div style={{ padding: 40, textAlign: "center" }}>Carregando CRM…</div>;
  if (!crm || crm.funis.length === 0) return <div className="empty" style={{ padding: 60 }}><h2>Nenhum funil</h2><p>Vá em Parâmetros de CRM.</p></div>;

  const funil = crm.funis.find((f) => f.id === funilId) || crm.funis[0];
  const etapas = (crm.etapas || []).filter((e) => e.funilId === funil.id).sort((a, b) => a.ordem - b.ordem);
  const tags = (crm.tags || []).filter((t) => t.funilId === funil.id);
  const origens = (crm.origens || []).filter((o) => o.funilId === funil.id);
  const produtos = (crm.produtos || []).filter((p) => p.funilId === funil.id && p.ativo);
  const tagMap = Object.fromEntries(tags.map((t) => [t.id, t]));
  const pesMap = Object.fromEntries((pessoas || []).map((p) => [p.id, p]));
  const prodMap = Object.fromEntries(produtos.map((p) => [p.id, p]));

  let leads = (crm.leads || []).filter((l) => l.funilId === funil.id);
  const limData = dataLimite(fData);
  if (limData) leads = leads.filter((l) => l.criadoEm >= limData);
  if (fResp) leads = leads.filter((l) => l.responsavelId === fResp);
  if (fTag) leads = leads.filter((l) => { try { return JSON.parse(l.tags || "[]").includes(fTag); } catch { return false; } });
  if (fProduto) leads = leads.filter((l) => l.produtoId === fProduto);

  const leadsPorEtapa = {}; etapas.forEach((e) => { leadsPorEtapa[e.id] = []; });
  leads.forEach((l) => { if (leadsPorEtapa[l.etapaId]) leadsPorEtapa[l.etapaId].push(l); });
  const temFiltro = fData || fResp || fTag || fProduto;

  if (leadAberto) {
    const la = leads.find((l) => l.id === leadAberto) || crm.leads.find((l) => l.id === leadAberto);
    if (la) return <LeadPage lead={la} etapas={etapas} tags={tags} origens={origens} produtos={produtos}
      campos={(crm.campos || []).filter((c) => c.funilId === funil.id)} produtos={produtos} crm={crm}
      motivos={(crm.motivos || []).filter((m) => m.funilId === funil.id)} pessoas={pessoas} atividades={crm.atividades || []}
      userName={userName} isAdmin={isAdmin} onIniciarOnboarding={onIniciarOnboarding} onVoltar={() => { setLeadAberto(null); carregar(); }}
      onSave={async (d) => { await api.crmLeadSave({ ...d, funilId: funil.id }); carregar(); }} onToast={onToast} />;
    setLeadAberto(null);
  }

  async function salvarLead(dados) {
    try {
      const saved = await api.crmLeadSave({ ...dados, funilId: funil.id }); setModal(null);
      logAcao("crm", `Lead ${dados.id ? "editado" : "criado"}: ${dados.nome}`);
      if (!dados.id) {
        // Lead novo: disparar automações de "lead_criado"
        const leadSalvo = { ...dados, ...saved, funilId: funil.id };
        await executarAutomacoes({ evento: "lead_criado", lead: leadSalvo, funilId: funil.id, crm, userName });
      }
      onToast("Lead salvo"); carregar();
    } catch (e) { onToast("Erro: " + e.message); }
  }
  async function moverLead(leadId, novaEtapaId) {
    const lead = leads.find((l) => l.id === leadId); if (!lead) return;
    const etapaDest = etapas.find((e) => e.id === novaEtapaId);
    // Se a etapa destino é "perdido", abrir modal de motivo
    if (etapaDest?.tipo === "perdido") {
      setModalPerda({ leadId, etapaId: novaEtapaId, leadNome: lead.nome });
      return;
    }
    try {
      const leadAnterior = { ...lead };
      await api.crmLeadSave({ ...lead, etapaId: novaEtapaId });
      logAcao("crm", `Lead "${lead.nome}" movido para "${etapaDest?.nome}"`);
      const leadAtualizado = { ...lead, etapaId: novaEtapaId };
      await executarAutomacoes({ evento: "mudanca_etapa", lead: leadAtualizado, leadAnterior, funilId: funil.id, crm, userName });
      carregar();
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function confirmarPerda(motivoId, justificativa) {
    const lead = leads.find((l) => l.id === modalPerda.leadId); if (!lead) return;
    const motivo = (crm.motivos||[]).find((m) => m.id === motivoId);
    try {
      await api.crmLeadSave({ ...lead, etapaId: modalPerda.etapaId, motivoPerdaId: motivoId || null, justificativaPerda: justificativa || null });
      await api.crmAtividadeSave({ leadId: lead.id, tipo: "sistema", descricao: `Lead perdido. Motivo: ${motivo?.nome || "Não informado"}${justificativa ? ". Justificativa: " + justificativa : ""}`, autorNome: userName });
      logAcao("crm", `PERDA: Lead "${lead.nome}" - Motivo: ${motivo?.nome || "?"}`);
      const leadAtualizado = { ...lead, etapaId: modalPerda.etapaId };
      await executarAutomacoes({ evento: "mudanca_etapa", lead: leadAtualizado, leadAnterior: lead, funilId: funil.id, crm, userName });
      await executarAutomacoes({ evento: "lead_perdido", lead: leadAtualizado, funilId: funil.id, crm, userName });
      setModalPerda(null); onToast("Lead marcado como perdido"); carregar();
    } catch (e) { onToast("Erro: " + e.message); }
  }
  async function excluirLead(id) {
    if (!confirm("Excluir este lead?")) return;
    const lead = leads.find((l) => l.id === id);
    try { await api.crmLeadDelete(id); logAcao("crm", `Lead excluído: ${lead?.nome || id}`); carregar(); }
    catch (e) { onToast("Erro: " + e.message); }
  }
  function exportarCSV() {
    const header = ["Nome","WhatsApp","Email","Etapa","Produto","Valor","Responsável","Tags","Origem","Criado em"];
    const rows = leads.map((l) => {
      const etapa = etapas.find((e) => e.id === l.etapaId); let tgN = ""; try { tgN = JSON.parse(l.tags||"[]").map((tid) => tagMap[tid]?.nome||"").filter(Boolean).join(", "); } catch {}
      return [l.nome, l.whatsapp||"", l.email||"", etapa?.nome||"", prodMap[l.produtoId]?.nome||"", l.valor, pesMap[l.responsavelId]?.nome||"", tgN, origens.find((o)=>o.id===l.origemId)?.nome||"", l.criadoEm?.split("T")[0]||""];
    });
    const csv = [header,...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `crm_${funil.nome.replace(/\s/g,"_")}.csv`; a.click();
    onToast("CSV exportado");
  }

  return (
    <>
      <div className="page-head">
        <div><h1>CRM</h1><p>{leads.length} lead{leads.length !== 1 ? "s" : ""}{temFiltro ? " (filtrado)" : ""}</p></div>
        <div className="head-actions">
          <select className="select" style={{ width: "auto" }} value={funilId||""} onChange={(e) => setFunilId(e.target.value)}>
            {crm.funis.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <button className="btn btn-sm btn-primary" onClick={() => setModal({ etapaId: etapas[0]?.id })}><Icon.Plus /> Criar lead</button>
          <button className="btn btn-sm" onClick={exportarCSV}>CSV</button>
        </div>
      </div>

      <div className="crm-filtros">
        <div className="crm-filtro"><label>Período</label><select className="select" value={fData} onChange={(e) => setFData(e.target.value)}>
          {FILTROS_DATA.map((f) => <option key={f.id} value={f.id}>{f.l}</option>)}
        </select></div>
        <div className="crm-filtro"><label>Responsável</label><select className="select" value={fResp} onChange={(e) => setFResp(e.target.value)}>
          <option value="">Todos</option>{(pessoas || []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select></div>
        {tags.length > 0 && <div className="crm-filtro"><label>Tag</label><select className="select" value={fTag} onChange={(e) => setFTag(e.target.value)}>
          <option value="">Todas</option>{tags.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select></div>}
        {produtos.length > 0 && <div className="crm-filtro"><label>Produto</label><select className="select" value={fProduto} onChange={(e) => setFProduto(e.target.value)}>
          <option value="">Todos</option>{produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select></div>}
        {temFiltro && <button className="btn btn-sm btn-ghost" style={{ alignSelf: "flex-end" }} onClick={() => { setFData(""); setFResp(""); setFTag(""); setFProduto(""); }}>Limpar</button>}
      </div>

      <div className="tiles" style={{ marginBottom: 16 }}>
        <div className="tile"><div className="label">Leads</div><div className="value">{leads.length}</div></div>
        <div className="tile"><div className="label">Valor total</div><div className="value">{fmtMoeda(leads.reduce((s, l) => s + (l.valor || 0), 0))}</div></div>
        <div className="tile"><div className="label">Ganhos</div><div className="value" style={{ color: "var(--green)" }}>{leads.filter((l) => etapas.find((e) => e.id === l.etapaId)?.tipo === "ganho").length}</div></div>
        <div className="tile"><div className="label">Perdidos</div><div className="value" style={{ color: "var(--red)" }}>{leads.filter((l) => etapas.find((e) => e.id === l.etapaId)?.tipo === "perdido").length}</div></div>
      </div>

      {etapas.length === 0 ? <div className="empty"><p>Sem etapas.</p></div> : (
        <div className="kanban-board">
          {etapas.map((etapa) => {
            const leadsCol = leadsPorEtapa[etapa.id] || [];
            const valorCol = leadsCol.reduce((s, l) => s + (l.valor || 0), 0);
            return (
              <div key={etapa.id} className="kanban-col" onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { const lid = e.dataTransfer.getData("leadId"); if (lid) moverLead(lid, etapa.id); }}>
                <div className="kanban-col-head" style={{ borderLeftColor: etapa.cor }}>
                  <span className="kanban-col-nome">{etapa.nome}</span>
                  <span className="kanban-col-meta">({leadsCol.length}) {valorCol > 0 ? fmtMoeda(valorCol) : ""}</span>
                </div>
                <div className="kanban-col-body">
                  {leadsCol.map((l) => {
                    let lTags = []; try { lTags = JSON.parse(l.tags || "[]"); } catch {}
                    return (
                      <div key={l.id} className="kanban-card" draggable onDragStart={(e) => e.dataTransfer.setData("leadId", l.id)}>

                        <div className="kc-row-top">
                          <LeadAvatar nome={l.nome} />
                          <div className="kc-info-col">
                            <div className="kc-nome" onClick={() => setLeadAberto(l.id)}>{l.nome}</div>
                            <div className="kc-icons-row">
                              {l.whatsapp && <a href={whatsLink(l.whatsapp)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="WhatsApp"><WhatsIcon size={15} /></a>}
                              {l.email && <span className="kc-email-ico" title={l.email}>✉</span>}
                              {l.responsavelId && pesMap[l.responsavelId] && <span className="kc-resp-inline">👤 {pesMap[l.responsavelId].nome}</span>}
                            </div>
                          </div>
                          <div className="kc-acoes">
                            <button className="iconbtn" onClick={() => setModal(l)} title="Editar"><Icon.Edit /></button>
                            <button className="iconbtn" onClick={() => excluirLead(l.id)} title="Excluir"><Icon.Trash /></button>
                          </div>
                        </div>
                        {lTags.length > 0 && <div className="kc-tags">{lTags.map((tid) => tagMap[tid] && <span key={tid} className="kc-tag" style={{ background: tagMap[tid].cor }}>{tagMap[tid].nome}</span>)}</div>}
                        <div className="kc-bottom"><span>{fmtDataBR(l.criadoEm)}</span>{l.valor > 0 && <span className="kc-valor-bottom">{fmtMoeda(l.valor)}{prodMap[l.produtoId] && <span className="kc-produto"> · {prodMap[l.produtoId].nome}</span>}</span>}</div>
                      </div>
                    );
                  })}
                  <button className="kanban-add" onClick={() => setModal({ etapaId: etapa.id })}><Icon.Plus /> Lead</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {modalOnboard && (
        <Modal title="🎉 Venda realizada!" onClose={() => setModalOnboard(null)} footer={
          <><button className="btn btn-ghost" onClick={() => setModalOnboard(null)}>Não, depois</button>
          <button className="btn btn-primary" onClick={() => { if (onIniciarOnboarding) onIniciarOnboarding(modalOnboard); setModalOnboard(null); }}>Sim, iniciar!</button></>
        }>
          <p style={{ fontSize: 14, textAlign: "center", margin: "10px 0 16px" }}>Deseja iniciar o processo de <strong>onboarding</strong> agora?</p>
          <p style={{ fontSize: 12, color: "var(--ink-faint)", textAlign: "center" }}>O lead será cadastrado como cliente e você será redirecionado para o módulo de Cadastro.</p>
        </Modal>
      )}
      {modalPerda && <ModalPerda motivos={(crm.motivos||[]).filter((m) => m.funilId === funil.id)} onConfirm={confirmarPerda} onClose={() => setModalPerda(null)} />}
      {modal && <LeadModal base={modal} etapas={etapas} origens={origens} produtos={produtos} pessoas={pessoas} onSave={salvarLead} onClose={() => setModal(null)} />}
    </>
  );
}
