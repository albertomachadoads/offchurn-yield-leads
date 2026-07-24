import { useEffect, useMemo, useState } from "react";
import { Icon } from "./components.jsx";
import { fmtMoeda } from "./utils";
import * as api from "./api.js";

/* ============================================================
   CRM — Kanban de leads por funil.
   Seleciona o funil, vê etapas em colunas, leads como cards.
   ============================================================ */

export default function CRM({ onToast }) {
  const [crm, setCrm] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [funilId, setFunilId] = useState(null);

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
  if (!crm) return <div className="empty"><p>Erro ao carregar.</p></div>;
  if (crm.funis.length === 0) return (
    <div className="empty" style={{ padding: 60 }}>
      <h2>Nenhum funil criado</h2>
      <p>Vá em <strong>Parâmetros de CRM</strong> e crie seu primeiro funil com etapas.</p>
    </div>
  );

  const funil = crm.funis.find((f) => f.id === funilId) || crm.funis[0];
  const etapas = (crm.etapas || []).filter((e) => e.funilId === funil.id).sort((a, b) => a.ordem - b.ordem);
  const leads = (crm.leads || []).filter((l) => l.funilId === funil.id);

  const leadsPorEtapa = {};
  etapas.forEach((e) => { leadsPorEtapa[e.id] = []; });
  leads.forEach((l) => { if (leadsPorEtapa[l.etapaId]) leadsPorEtapa[l.etapaId].push(l); });

  const tags = (crm.tags || []).filter((t) => t.funilId === funil.id);
  const tagMap = Object.fromEntries(tags.map((t) => [t.id, t]));

  async function moverLead(leadId, novaEtapaId) {
    try {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return;
      await api.crmLeadSave({ ...lead, etapaId: novaEtapaId });
      carregar();
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function novoLead(etapaId) {
    const nome = prompt("Nome do lead:");
    if (!nome?.trim()) return;
    try {
      await api.crmLeadSave({ nome, funilId: funil.id, etapaId });
      onToast("Lead criado");
      carregar();
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function excluirLead(id) {
    if (!confirm("Excluir este lead?")) return;
    try { await api.crmLeadDelete(id); carregar(); } catch (e) { onToast("Erro: " + e.message); }
  }

  // exportar CSV
  function exportarCSV() {
    const header = ["Nome", "Email", "WhatsApp", "Etapa", "Valor", "Tags", "UTM Source", "UTM Campaign", "Criado em"];
    const rows = leads.map((l) => {
      const etapa = etapas.find((e) => e.id === l.etapaId);
      let tagNomes = "";
      try { tagNomes = JSON.parse(l.tags || "[]").map((tid) => tagMap[tid]?.nome || "").filter(Boolean).join(", "); } catch {}
      return [l.nome, l.email || "", l.whatsapp || "", etapa?.nome || "", l.valor, tagNomes, l.utmSource || "", l.utmCampaign || "", l.criadoEm?.split("T")[0] || ""];
    });
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `crm_${funil.nome.replace(/\s/g, "_")}.csv`; a.click();
    URL.revokeObjectURL(url);
    onToast("CSV exportado");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>CRM</h1>
          <p>{leads.length} lead{leads.length !== 1 ? "s" : ""} no funil "{funil.nome}"</p>
        </div>
        <div className="head-actions">
          <select className="select" style={{ width: "auto" }} value={funilId || ""} onChange={(e) => setFunilId(e.target.value)}>
            {crm.funis.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <button className="btn btn-sm" onClick={exportarCSV}>Exportar CSV</button>
        </div>
      </div>

      {/* Resumo */}
      <div className="tiles" style={{ marginBottom: 16 }}>
        <div className="tile"><div className="label">Total de leads</div><div className="value">{leads.length}</div></div>
        <div className="tile"><div className="label">Valor total</div><div className="value">{fmtMoeda(leads.reduce((s, l) => s + (l.valor || 0), 0))}</div></div>
        <div className="tile"><div className="label">Ganhos</div><div className="value" style={{ color: "var(--green)" }}>
          {leads.filter((l) => { const e = etapas.find((e) => e.id === l.etapaId); return e?.tipo === "ganho"; }).length}
        </div></div>
        <div className="tile"><div className="label">Perdidos</div><div className="value" style={{ color: "var(--red)" }}>
          {leads.filter((l) => { const e = etapas.find((e) => e.id === l.etapaId); return e?.tipo === "perdido"; }).length}
        </div></div>
      </div>

      {/* Kanban */}
      {etapas.length === 0 ? (
        <div className="empty"><p>Este funil não tem etapas. Vá em Parâmetros de CRM para adicioná-las.</p></div>
      ) : (
        <div className="kanban-board">
          {etapas.map((etapa) => {
            const leadsCol = leadsPorEtapa[etapa.id] || [];
            return (
              <div key={etapa.id} className="kanban-col"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { const lid = e.dataTransfer.getData("leadId"); if (lid) moverLead(lid, etapa.id); }}>
                <div className="kanban-col-head" style={{ borderLeftColor: etapa.cor }}>
                  <span className="kanban-col-nome">{etapa.nome}</span>
                  <span className="kanban-col-count">{leadsCol.length}</span>
                </div>
                <div className="kanban-col-body">
                  {leadsCol.map((l) => (
                    <div key={l.id} className="kanban-card" draggable
                      onDragStart={(e) => e.dataTransfer.setData("leadId", l.id)}>
                      <div className="kanban-card-nome">{l.nome}</div>
                      {l.valor > 0 && <div className="kanban-card-valor">{fmtMoeda(l.valor)}</div>}
                      {l.email && <div className="kanban-card-info">{l.email}</div>}
                      {l.whatsapp && <div className="kanban-card-info">{l.whatsapp}</div>}
                      <div className="kanban-card-acoes">
                        <button className="iconbtn" onClick={() => excluirLead(l.id)} title="Excluir"><Icon.Trash /></button>
                      </div>
                    </div>
                  ))}
                  <button className="kanban-add" onClick={() => novoLead(etapa.id)}>
                    <Icon.Plus /> Lead
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
