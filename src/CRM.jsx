import { useEffect, useMemo, useState } from "react";
import { Icon, Modal } from "./components.jsx";
import { fmtMoeda } from "./utils";
import * as api from "./api.js";
import { supabase } from "./supabaseClient.js";
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
export default function CRM({ pessoas, onToast, userName, isAdmin, onIniciarOnboarding , onAbrirWhatsApp}) {
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
  const [fOrigem, setFOrigem] = useState("");
  const [busca, setBusca] = useState("");
  const [menuAberto, setMenuAberto] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [dropCol, setDropCol] = useState(null);

  async function carregar() {
    try { const d = await api.fetchCRM(); setCrm(d); if (!funilId && d.funis.length > 0) setFunilId(d.funis[0].id); }
    catch (e) { onToast("Erro: " + e.message); } finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  // Abrir lead específico vindo do WhatsApp
  useEffect(() => {
    if (window.__abrirLeadId && crm?.leads) {
      const lead = crm.leads.find((l) => l.id === window.__abrirLeadId);
      if (lead) { setLeadAberto(lead.id); window.__abrirLeadId = null; }
    }
  }, [crm?.leads]);

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
  if (fOrigem) leads = leads.filter((l) => l.origemId === fOrigem);
  if (busca.trim()) {
    const q = busca.trim().toLowerCase();
    const qNum = q.replace(/\D/g, "");
    leads = leads.filter((l) => {
      let tgN = ""; try { tgN = JSON.parse(l.tags || "[]").map((t) => tagMap[t]?.nome || "").join(" "); } catch {}
      return (l.nome || "").toLowerCase().includes(q)
        || (l.email || "").toLowerCase().includes(q)
        || (qNum && (l.whatsapp || "").replace(/\D/g, "").includes(qNum))
        || (prodMap[l.produtoId]?.nome || "").toLowerCase().includes(q)
        || (pesMap[l.responsavelId]?.nome || "").toLowerCase().includes(q)
        || tgN.toLowerCase().includes(q);
    });
  }

  const leadsPorEtapa = {}; etapas.forEach((e) => { leadsPorEtapa[e.id] = []; });
  leads.forEach((l) => { if (leadsPorEtapa[l.etapaId]) leadsPorEtapa[l.etapaId].push(l); });
  const temFiltro = fData || fResp || fTag || fProduto || fOrigem;
  const limparFiltros = () => { setFData(""); setFResp(""); setFTag(""); setFProduto(""); setFOrigem(""); };

  // Indicadores compactos
  const tipoDe = (id) => etapas.find((e) => e.id === id)?.tipo;
  const lGanhos = leads.filter((l) => tipoDe(l.etapaId) === "ganho");
  const lPerdidos = leads.filter((l) => tipoDe(l.etapaId) === "perdido");
  const lAbertos = leads.filter((l) => !["ganho", "perdido"].includes(tipoDe(l.etapaId)));
  const vlAberto = lAbertos.reduce((s, l) => s + (l.valor || 0), 0);
  const convPct = leads.length ? (lGanhos.length / leads.length) * 100 : 0;
  const hojeStr = new Date().toISOString().slice(0, 10);
  const idsAbertos = new Set(lAbertos.map((l) => l.id));
  const atrasadas = (crm.atividades || []).filter((a) => ["tarefa", "ligacao", "email"].includes(a.tipo)
    && a.status !== "concluida" && a.status !== "cancelada"
    && a.dataPrevista && String(a.dataPrevista).slice(0, 10) < hojeStr && idsAbertos.has(a.leadId));

  if (leadAberto) {
    const la = leads.find((l) => l.id === leadAberto) || crm.leads.find((l) => l.id === leadAberto);
    if (la) return <LeadPage lead={la} etapas={etapas} tags={tags} origens={origens} produtos={produtos}
      campos={(crm.campos || []).filter((c) => c.funilId === funil.id)} produtos={produtos} crm={crm}
      motivos={(crm.motivos || []).filter((m) => m.funilId === funil.id)} pessoas={pessoas} atividades={crm.atividades || []}
      userName={userName} isAdmin={isAdmin} onIniciarOnboarding={onIniciarOnboarding} onAbrirWhatsApp={onAbrirWhatsApp} onVoltar={() => { setLeadAberto(null); carregar(); }}
      onSave={async (d) => { await api.crmLeadSave({ ...d, funilId: funil.id }); carregar(); }} onToast={onToast} />;
    setLeadAberto(null);
  }

  async function salvarLead(dados) {
    try {
      const isNovo = !dados.id;
      const result = await api.crmLeadSave({ ...dados, funilId: funil.id });
      setModal(null);
      logAcao("crm", `Lead ${isNovo ? "criado" : "editado"}: ${dados.nome}`);
      if (isNovo && result?.id) {
        const leadSalvo = { ...dados, id: result.id, funilId: funil.id };
        try { await executarAutomacoes({ evento: "lead_criado", lead: leadSalvo, funilId: funil.id, crm, userName }); } catch {}
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
      try { await executarAutomacoes({ evento: "mudanca_etapa", lead: leadAtualizado, leadAnterior, funilId: funil.id, crm, userName }); } catch {}
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
      try { await executarAutomacoes({ evento: "mudanca_etapa", lead: leadAtualizado, leadAnterior: lead, funilId: funil.id, crm, userName }); } catch {}
      try { await executarAutomacoes({ evento: "lead_perdido", lead: leadAtualizado, funilId: funil.id, crm, userName }); } catch {}
      setModalPerda(null); onToast("Lead marcado como perdido"); carregar();
    } catch (e) { onToast("Erro: " + e.message); }
  }
  async function excluirLead(id) {
    if (!confirm("Excluir este lead?")) return;
    const lead = leads.find((l) => l.id === id);
    try { await api.crmLeadDelete(id); logAcao("crm", `Lead excluído: ${lead?.nome || id}`); carregar(); }
    catch (e) { onToast("Erro: " + e.message); }
  }
  async function exportarCSV() {
    // As UTMs podem estar apenas na conversa do WhatsApp, quando o lead
    // ainda não foi sincronizado. Buscamos as duas fontes.
    const porTelefone = {};
    try {
      const { data: convs } = await supabase.from("wa_conversas")
        .select("numero, lead_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content, ad_id, ad_titulo, ad_app, origem_tipo");
      (convs || []).forEach((c) => {
        if (c.lead_id) porTelefone["id:" + c.lead_id] = c;
        if (c.numero) porTelefone["tel:" + c.numero.slice(-8)] = c;
      });
    } catch { /* segue sem os dados da conversa */ }

    const origemDe = (l) => {
      const porId = porTelefone["id:" + l.id];
      if (porId) return porId;
      const tel = (l.whatsapp || "").replace(/\D/g, "");
      return tel.length >= 8 ? porTelefone["tel:" + tel.slice(-8)] : null;
    };

    const header = [
      "Nome","WhatsApp","Email","Etapa","Tipo da etapa","Produto","Valor",
      "Responsável","Tags","Origem","Criado em","Atualizado em",
      "Motivo da perda","Justificativa da perda",
      "utm_campaign","utm_medium","utm_content","utm_source","utm_term",
      "Canal do anúncio","ID do anúncio","Criativo","Origem do contato",
    ];

    const rows = leads.map((l) => {
      const etapa = etapas.find((e) => e.id === l.etapaId);
      let tgN = "";
      try { tgN = JSON.parse(l.tags || "[]").map((tid) => tagMap[tid]?.nome || "").filter(Boolean).join(", "); } catch {}
      const wa = origemDe(l) || {};
      const motivo = (crm.motivos || []).find((m) => m.id === l.motivoPerdaId);

      return [
        l.nome, l.whatsapp || "", l.email || "",
        etapa?.nome || "", etapa?.tipo || "aberto",
        prodMap[l.produtoId]?.nome || "", l.valor,
        pesMap[l.responsavelId]?.nome || "", tgN,
        origens.find((o) => o.id === l.origemId)?.nome || "",
        l.criadoEm?.split("T")[0] || "",
        l.atualizadoEm?.split("T")[0] || "",
        motivo?.nome || "", l.justificativaPerda || "",
        // UTMs: o lead manda; a conversa serve de reserva
        l.utmCampaign || wa.utm_campaign || "",
        l.utmMedium   || wa.utm_medium   || "",
        l.utmContent  || wa.utm_content  || "",
        l.utmSource   || wa.utm_source   || "",
        l.utmTerm     || wa.utm_term     || "",
        wa.ad_app || "", wa.ad_id || "", wa.ad_titulo || "",
        wa.origem_tipo === "meta_ads" ? "Anúncio" : wa.origem_tipo === "organico" ? "Orgânico" : "",
      ];
    });

    // Ponto e vírgula: o Excel em português abre direto, sem assistente
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const hoje = new Date().toISOString().slice(0, 10);
    a.download = `crm_${funil.nome.replace(/\s/g, "_")}_${hoje}.csv`;
    a.click();
    onToast(`CSV exportado — ${rows.length} lead${rows.length !== 1 ? "s" : ""}`);
  }

  return (
    <>
      {/* ── Cabeçalho ── */}
      <div className="crm-head">
        <div className="crm-head-l">
          <h1 className="crm-h1">CRM</h1>
          <p className="crm-resumo">
            {lAbertos.length} {lAbertos.length === 1 ? "oportunidade aberta" : "oportunidades abertas"}
            {" · "}{lGanhos.length} {lGanhos.length === 1 ? "ganha" : "ganhas"}
            {" · "}{lPerdidos.length} {lPerdidos.length === 1 ? "perdida" : "perdidas"}
            {temFiltro || busca ? " (filtrado)" : ""}
          </p>
        </div>
        <div className="crm-head-r">
          <div className="crm-busca">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, telefone ou produto" />
            {busca && <button className="crm-busca-x" onClick={() => setBusca("")} title="Limpar busca">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>}
          </div>
          <select className="crm-sel" value={funilId || ""} onChange={(e) => setFunilId(e.target.value)}>
            {crm.funis.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <button className="crm-btn-ico" onClick={() => carregar()} title="Atualizar dados">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          </button>
          <button className="crm-btn-primary" onClick={() => setModal({ etapaId: etapas[0]?.id })}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Criar lead
          </button>
          <div className="crm-menu-wrap">
            <button className="crm-btn-ico" onClick={() => setMenuAberto((v) => !v)} title="Mais opções">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
            </button>
            {menuAberto && (<>
              <div className="crm-menu-bd" onClick={() => setMenuAberto(false)} />
              <div className="crm-menu">
                <button onClick={() => { exportarCSV(); setMenuAberto(false); }}>Exportar CSV</button>
                <button onClick={() => { setMenuAberto(false); onToast("Configure em Parâmetros de CRM"); }}>Configurar etapas</button>
                <button onClick={() => { setMenuAberto(false); onToast("Configure em Parâmetros de CRM"); }}>Configurar campos</button>
              </div>
            </>)}
          </div>
        </div>
      </div>

      {/* ── Indicadores ── */}
      <div className="crm-ind">
        <div className="crm-ind-i"><span className="crm-ind-n">{leads.length}</span><span className="crm-ind-l">Oportunidades</span></div>
        <div className="crm-ind-i"><span className="crm-ind-n">{fmtMoeda(vlAberto)}</span><span className="crm-ind-l">Pipeline aberto</span></div>
        <div className="crm-ind-i"><span className="crm-ind-n">{lGanhos.length}</span><span className="crm-ind-l">{lGanhos.length === 1 ? "Venda" : "Vendas"}</span></div>
        <div className="crm-ind-i"><span className="crm-ind-n">{convPct.toFixed(0)}%</span><span className="crm-ind-l">Conversão · {lGanhos.length} em {leads.length}</span></div>
        <div className="crm-ind-i"><span className={`crm-ind-n ${atrasadas.length > 0 ? "alerta" : ""}`}>{atrasadas.length}</span><span className="crm-ind-l">Tarefas atrasadas</span></div>
      </div>

      {/* ── Filtros ── */}
      <div className="crm-fbar">
        <select className="crm-fsel" value={fData} onChange={(e) => setFData(e.target.value)}>
          {FILTROS_DATA.map((f) => <option key={f.id} value={f.id}>{f.l}</option>)}
        </select>
        <select className="crm-fsel" value={fResp} onChange={(e) => setFResp(e.target.value)}>
          <option value="">Todos os responsáveis</option>
          {(pessoas || []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        {produtos.length > 0 && <select className="crm-fsel" value={fProduto} onChange={(e) => setFProduto(e.target.value)}>
          <option value="">Todos os produtos</option>
          {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>}
        {tags.length > 0 && <select className="crm-fsel" value={fTag} onChange={(e) => setFTag(e.target.value)}>
          <option value="">Todas as tags</option>
          {tags.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>}
        {origens.length > 0 && <select className="crm-fsel" value={fOrigem} onChange={(e) => setFOrigem(e.target.value)}>
          <option value="">Todas as origens</option>
          {origens.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>}
        {temFiltro && <button className="crm-flimpar" onClick={limparFiltros}>Limpar filtros</button>}
      </div>

      {/* Chips de filtros ativos */}
      {temFiltro && (
        <div className="crm-chips">
          {fData && <span className="crm-chip">Período: {FILTROS_DATA.find((f) => f.id === fData)?.l}<button onClick={() => setFData("")}>×</button></span>}
          {fResp && <span className="crm-chip">Responsável: {pesMap[fResp]?.nome}<button onClick={() => setFResp("")}>×</button></span>}
          {fProduto && <span className="crm-chip">Produto: {prodMap[fProduto]?.nome}<button onClick={() => setFProduto("")}>×</button></span>}
          {fTag && <span className="crm-chip">Tag: {tagMap[fTag]?.nome}<button onClick={() => setFTag("")}>×</button></span>}
          {fOrigem && <span className="crm-chip">Origem: {origens.find((o) => o.id === fOrigem)?.nome}<button onClick={() => setFOrigem("")}>×</button></span>}
        </div>
      )}

      {/* ── Pipeline ── */}
      {etapas.length === 0 ? <div className="empty"><p>Sem etapas.</p></div> : (
        <div className="kb">
          {etapas.map((etapa) => {
            const leadsCol = leadsPorEtapa[etapa.id] || [];
            const valorCol = leadsCol.reduce((s, l) => s + (l.valor || 0), 0);
            return (
              <div key={etapa.id} className={`kb-col ${dropCol === etapa.id ? "kb-col-drop" : ""}`}
                onDragOver={(e) => { e.preventDefault(); if (dropCol !== etapa.id) setDropCol(etapa.id); }}
                onDragLeave={() => setDropCol((c) => (c === etapa.id ? null : c))}
                onDrop={(e) => { const lid = e.dataTransfer.getData("leadId"); setDropCol(null); setDragId(null); if (lid) moverLead(lid, etapa.id); }}>
                <div className="kb-col-line" style={{ background: etapa.cor || "#667085" }} />
                <div className="kb-col-head">
                  <div className="kb-col-titulo">
                    <span className="kb-col-nome">{etapa.nome}</span>
                    <button className="kb-col-add" onClick={() => setModal({ etapaId: etapa.id })} title="Adicionar lead">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                  </div>
                  <div className="kb-col-meta">
                    {leadsCol.length} {leadsCol.length === 1 ? "oportunidade" : "oportunidades"} · {fmtMoeda(valorCol)}
                  </div>
                </div>
                <div className="kb-col-body">
                  {leadsCol.length === 0 ? (
                    <div className="kb-vazio">
                      <p>Nenhuma oportunidade nesta etapa</p>
                      <button onClick={() => setModal({ etapaId: etapa.id })}>+ Adicionar lead</button>
                    </div>
                  ) : leadsCol.map((l) => {
                    let lTags = []; try { lTags = JSON.parse(l.tags || "[]"); } catch {}
                    const tagsVis = lTags.map((t) => tagMap[t]).filter(Boolean);
                    const semNome = !l.nome || !l.nome.trim() || /^[\d\s()+-]+$/.test(l.nome);
                    const fone = (l.whatsapp || "").replace(/\D/g, "");
                    const foneOk = fone.length >= 10;
                    return (
                      <div key={l.id} className={`kb-card ${dragId === l.id ? "kb-card-drag" : ""}`} draggable
                        onDragStart={(e) => { e.dataTransfer.setData("leadId", l.id); setDragId(l.id); }}
                        onDragEnd={() => { setDragId(null); setDropCol(null); }}
                        onClick={() => setLeadAberto(l.id)}>
                        <div className="kb-card-top">
                          <div className="kb-card-nome" title={semNome ? "Lead sem nome" : l.nome}>
                            {semNome ? "Lead sem nome" : l.nome}
                          </div>
                          <div className="kb-card-acoes" onClick={(e) => e.stopPropagation()}>
                            {l.whatsapp && <button className="kb-ico" title="Abrir conversa no WhatsApp" onClick={() => onAbrirWhatsApp && onAbrirWhatsApp(l.whatsapp)}>
                              <WhatsIcon size={14} />
                            </button>}
                            <button className="kb-ico" title="Editar lead" onClick={() => setModal(l)}><Icon.Edit /></button>
                            <button className="kb-ico kb-ico-del" title="Excluir lead" onClick={() => excluirLead(l.id)}><Icon.Trash /></button>
                          </div>
                        </div>

                        {semNome && (
                          <div className="kb-card-sub">
                            {foneOk ? l.whatsapp : "Telefone não validado"}
                          </div>
                        )}

                        <div className="kb-card-linha">
                          {prodMap[l.produtoId] && <span className="kb-produto">{prodMap[l.produtoId].nome}</span>}
                          {prodMap[l.produtoId] && l.valor > 0 && <span className="kb-sep">·</span>}
                          {l.valor > 0 && <span className="kb-valor">{fmtMoeda(l.valor)}</span>}
                          {!prodMap[l.produtoId] && !l.valor && <span className="kb-vazio-txt">Sem valor definido</span>}
                        </div>

                        {tagsVis.length > 0 && (
                          <div className="kb-card-tags">
                            {tagsVis.slice(0, 2).map((t) => (
                              <span key={t.id} className="kb-tag" style={{ background: (t.cor || "#667085") + "1F", color: t.cor || "#667085" }}>{t.nome}</span>
                            ))}
                            {tagsVis.length > 2 && <span className="kb-tag kb-tag-mais">+{tagsVis.length - 2}</span>}
                          </div>
                        )}

                        <div className="kb-card-foot">
                          <span className="kb-resp">{pesMap[l.responsavelId]?.nome || "Sem responsável"}</span>
                          <span className="kb-data">Entrada: {fmtDataBR(l.criadoEm)}</span>
                        </div>
                      </div>
                    );
                  })}
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
