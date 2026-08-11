import { useEffect, useMemo, useState } from "react";
import { Icon, Modal } from "./components.jsx";
import { supabase } from "./supabaseClient.js";
import * as api from "./api.js";

/* ============================================================
   Formulários — leads vindos dos formulários nativos do Meta.
   ============================================================ */

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");

async function chamar(payload) {
  const sess = await supabase.auth.getSession();
  const token = sess.data.session?.access_token;
  if (!token) throw new Error("Sua sessão expirou. Entre no sistema novamente.");
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/functions/v1/meta-forms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("O serviço de formulários ainda não foi publicado no servidor.");
  }
  const d = await r.json().catch(() => ({}));
  if (!d.ok) throw new Error(d.error || `Falha na comunicação (HTTP ${r.status})`);
  return d;
}

const SITUACOES = [
  { id: "novo", l: "Novo", tom: "info" },
  { id: "em_atendimento", l: "Em atendimento", tom: "avi" },
  { id: "convertido", l: "Convertido", tom: "ok" },
  { id: "descartado", l: "Descartado", tom: "neutro" },
];
const situacaoDe = (id) => SITUACOES.find((s) => s.id === id) || SITUACOES[0];

const fmtDH = (d) => {
  if (!d) return "—";
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()} ${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
};
const fmtTel = (t) => {
  const d = String(t || "").replace(/\D/g, "");
  if (d.length < 10) return t || "—";
  const n = d.startsWith("55") ? d.slice(2) : d;
  return `(${n.slice(0, 2)}) ${n.slice(2, n.length - 4)}-${n.slice(-4)}`;
};

/* ---------- Detalhe do lead ---------- */
function DetalheLead({ lead, onFechar, onConverter, onSituacao, convertendo }) {
  const campos = lead.campos || {};
  const chaves = Object.keys(campos);
  return (
    <Modal title={lead.nome || "Lead sem nome"} onClose={onFechar} wide footer={
      <>
        <button className="btn btn-ghost" onClick={onFechar}>Fechar</button>
        {!lead.lead_crm_id && (
          <button className="btn btn-primary" disabled={convertendo} onClick={() => onConverter(lead)}>
            {convertendo ? "Criando…" : "Criar negociação no CRM"}
          </button>
        )}
      </>
    }>
      <div className="fm-det">
        <div className="fm-det-bloco">
          <h4>Contato</h4>
          <div className="fm-linha"><span>Nome</span><strong>{lead.nome || "—"}</strong></div>
          <div className="fm-linha"><span>E-mail</span><strong>{lead.email || "—"}</strong></div>
          <div className="fm-linha"><span>Telefone</span><strong>{fmtTel(lead.telefone)}</strong></div>
          <div className="fm-linha"><span>Recebido em</span><strong>{fmtDH(lead.criado_em_meta)}</strong></div>
          <div className="fm-linha"><span>Formulário</span><strong>{lead.form_nome || "—"}</strong></div>
        </div>

        {chaves.length > 0 && (
          <div className="fm-det-bloco">
            <h4>Respostas do formulário</h4>
            {chaves.map((k) => (
              <div key={k} className="fm-linha">
                <span>{k.replace(/_/g, " ")}</span>
                <strong>{campos[k] || "—"}</strong>
              </div>
            ))}
          </div>
        )}

        <div className="fm-det-bloco">
          <h4>Trackeamento</h4>
          {[["utm_campaign", lead.utm_campaign], ["utm_medium", lead.utm_medium],
            ["utm_content", lead.utm_content], ["utm_source", lead.utm_source],
            ["utm_term", lead.utm_term]].map(([k, v]) => (
            <div key={k} className="fm-linha fm-mono">
              <span>{k}</span><strong className={v ? "" : "vazio"}>{v || "—"}</strong>
            </div>
          ))}
          {lead.ad_id && <div className="fm-linha fm-mono"><span>ID do anúncio</span><strong>{lead.ad_id}</strong></div>}
        </div>

        <div className="fm-det-bloco">
          <h4>Situação</h4>
          <div className="fm-situacoes">
            {SITUACOES.map((s) => (
              <button key={s.id} className={`fm-sit-btn ${lead.situacao === s.id ? "on tom-" + s.tom : ""}`}
                onClick={() => onSituacao(lead, s.id)}>{s.l}</button>
            ))}
          </div>
          {lead.lead_crm_id && <p className="fm-nota">Este lead já possui negociação no CRM.</p>}
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Gerenciar formulários ---------- */
function GerenciarForms({ cadastrados, onFechar, onSalvar, onToast }) {
  const [carregando, setCarregando] = useState(true);
  const [disponiveis, setDisponiveis] = useState([]);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    chamar({ acao: "formularios" })
      .then((d) => setDisponiveis(d.formularios || []))
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, []);

  const jaTem = new Set(cadastrados.map((f) => f.form_id));
  const lista = disponiveis.filter((f) =>
    !busca || (f.nome || "").toLowerCase().includes(busca.toLowerCase())
           || (f.pagina_nome || "").toLowerCase().includes(busca.toLowerCase()));

  return (
    <Modal title="Formulários disponíveis no Meta" onClose={onFechar} wide footer={
      <button className="btn btn-ghost" onClick={onFechar}>Fechar</button>
    }>
      {carregando ? (
        <p className="fm-vazio">Buscando formulários nas suas páginas…</p>
      ) : erro ? (
        <p className="fm-vazio">{erro}</p>
      ) : (<>
        <input className="input" placeholder="Buscar por formulário ou página…"
          value={busca} onChange={(e) => setBusca(e.target.value)} style={{ marginBottom: 14 }} />

        {lista.length === 0 ? (
          <p className="fm-vazio">
            Nenhum formulário encontrado nas suas páginas.
            Crie um formulário no Gerenciador de Anúncios e volte aqui.
          </p>
        ) : (
          <div className="fm-disp-lista">
            {lista.map((f) => (
              <div key={f.form_id} className="fm-disp">
                <div className="fm-disp-info">
                  <div className="fm-disp-nome">{f.nome}</div>
                  <div className="fm-disp-meta">
                    {f.pagina_nome}
                    {f.leads_no_meta != null && <span> · {f.leads_no_meta} leads no Meta</span>}
                    {f.situacao && <span> · {f.situacao === "ACTIVE" ? "ativo" : f.situacao.toLowerCase()}</span>}
                  </div>
                </div>
                {jaTem.has(f.form_id) ? (
                  <span className="fm-badge tom-ok">Cadastrado</span>
                ) : (
                  <button className="btn btn-sm btn-primary" onClick={() => onSalvar(f)}>Cadastrar</button>
                )}
              </div>
            ))}
          </div>
        )}
      </>)}
    </Modal>
  );
}

/* ================= MÓDULO ================= */
export default function Formularios({ onToast, pessoas, onVerLead }) {
  const [forms, setForms] = useState([]);
  const [leads, setLeads] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [modalGerenciar, setModalGerenciar] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const [convertendo, setConvertendo] = useState(false);

  const [fForm, setFForm] = useState("todos");
  const [fSituacao, setFSituacao] = useState("todas");
  const [busca, setBusca] = useState("");

  async function carregar() {
    try {
      const [f, l] = await Promise.all([
        supabase.from("meta_formularios").select("*").order("nome"),
        supabase.from("form_leads").select("*").order("criado_em_meta", { ascending: false }).limit(500),
      ]);
      setForms(f.data || []);
      setLeads(l.data || []);
    } catch (e) { onToast("Erro ao carregar: " + e.message); }
    finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  async function sincronizar() {
    setSincronizando(true);
    try {
      const d = await chamar({ acao: "sincronizar" });
      if (d.mensagem) onToast(d.mensagem);
      else onToast(`${d.leads_novos} lead(s) novo(s) · ${d.ja_existiam} já existiam`);
      await carregar();
    } catch (e) { onToast("Erro: " + e.message); }
    finally { setSincronizando(false); }
  }

  async function cadastrarForm(f) {
    try {
      await supabase.from("meta_formularios").upsert({
        form_id: f.form_id, nome: f.nome,
        pagina_id: f.pagina_id, pagina_nome: f.pagina_nome, ativo: true,
      }, { onConflict: "form_id" });
      onToast(`Formulário "${f.nome}" cadastrado`);
      carregar();
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function removerForm(formId, nome) {
    if (!confirm(`Parar de acompanhar "${nome}"?\n\nOs leads já recebidos continuam no sistema.`)) return;
    try {
      await supabase.from("meta_formularios").delete().eq("form_id", formId);
      onToast("Formulário removido");
      carregar();
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function mudarSituacao(lead, situacao) {
    try {
      await supabase.from("form_leads").update({ situacao }).eq("id", lead.id);
      setLeads((p) => p.map((l) => (l.id === lead.id ? { ...l, situacao } : l)));
      setDetalhe((d) => (d && d.id === lead.id ? { ...d, situacao } : d));
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function converter(lead) {
    setConvertendo(true);
    try {
      const crm = await api.fetchCRM();
      const funil = crm.funis?.[0];
      if (!funil) throw new Error("Crie um funil no CRM antes de converter leads.");
      const etapas = (crm.etapas || []).filter((e) => e.funilId === funil.id).sort((a, b) => a.ordem - b.ordem);

      const novo = await api.crmLeadSave({
        nome: lead.nome || lead.email || lead.telefone || "Lead do formulário",
        email: lead.email || null,
        whatsapp: lead.telefone || null,
        funilId: funil.id, etapaId: etapas[0]?.id,
        valor: 0, tags: "[]", camposCustom: JSON.stringify(lead.campos || {}),
        responsavelId: lead.responsavel_id || null,
        utmSource: lead.utm_source, utmMedium: lead.utm_medium,
        utmCampaign: lead.utm_campaign, utmTerm: lead.utm_term, utmContent: lead.utm_content,
      });

      await supabase.from("form_leads").update({ lead_crm_id: novo.id, situacao: "convertido" }).eq("id", lead.id);
      setLeads((p) => p.map((l) => (l.id === lead.id ? { ...l, lead_crm_id: novo.id, situacao: "convertido" } : l)));
      setDetalhe(null);
      onToast("Negociação criada no CRM");
    } catch (e) { onToast("Erro: " + e.message); }
    finally { setConvertendo(false); }
  }

  const filtrados = useMemo(() => {
    let r = leads;
    if (fForm !== "todos") r = r.filter((l) => l.form_id === fForm);
    if (fSituacao !== "todas") r = r.filter((l) => (l.situacao || "novo") === fSituacao);
    if (busca.trim()) {
      const q = busca.toLowerCase(); const qn = busca.replace(/\D/g, "");
      r = r.filter((l) =>
        (l.nome || "").toLowerCase().includes(q) ||
        (l.email || "").toLowerCase().includes(q) ||
        (l.utm_campaign || "").toLowerCase().includes(q) ||
        (qn && (l.telefone || "").includes(qn)));
    }
    return r;
  }, [leads, fForm, fSituacao, busca]);

  const contar = (sit) => leads.filter((l) => (l.situacao || "novo") === sit).length;
  const ultimaSync = forms.reduce((a, f) => (f.ultima_sync && (!a || f.ultima_sync > a) ? f.ultima_sync : a), null);

  if (carregando) return <div style={{ padding: 40, textAlign: "center" }}>Carregando formulários…</div>;

  return (
    <div className="fm">
      <div className="page-head">
        <div>
          <h1>Formulários</h1>
          <p>
            Leads dos formulários nativos do Meta
            {ultimaSync && <span className="fm-sync"> · sincronizado {fmtDH(ultimaSync)}</span>}
          </p>
        </div>
        <div className="head-actions">
          <button className="toolbar-btn" onClick={sincronizar} disabled={sincronizando}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            {sincronizando ? "Buscando…" : "Buscar leads"}
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => setModalGerenciar(true)}>
            <Icon.Plus /> Cadastrar formulário
          </button>
        </div>
      </div>

      {forms.length === 0 ? (
        <div className="fm-empty">
          <div className="fm-empty-ico">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>
          </div>
          <h3>Nenhum formulário cadastrado</h3>
          <p>Escolha quais formulários do Meta o comercial deve acompanhar. Os leads passam a aparecer aqui automaticamente.</p>
          <button className="btn btn-primary" onClick={() => setModalGerenciar(true)}>Cadastrar formulário</button>
        </div>
      ) : (<>
        {/* Formulários acompanhados */}
        <div className="fm-forms">
          {forms.map((f) => (
            <div key={f.form_id} className="fm-form-card">
              <div className="fm-form-info">
                <div className="fm-form-nome">{f.nome}</div>
                <div className="fm-form-meta">
                  {f.pagina_nome} · {leads.filter((l) => l.form_id === f.form_id).length} leads
                </div>
              </div>
              <button className="iconbtn" title="Parar de acompanhar" onClick={() => removerForm(f.form_id, f.nome)}>
                <Icon.Trash />
              </button>
            </div>
          ))}
        </div>

        {/* Situações */}
        <div className="fm-sits">
          <button className={`fm-sit ${fSituacao === "todas" ? "on" : ""}`} onClick={() => setFSituacao("todas")}>
            Todos<span>{leads.length}</span>
          </button>
          {SITUACOES.map((s) => (
            <button key={s.id} className={`fm-sit ${fSituacao === s.id ? "on tom-" + s.tom : ""}`} onClick={() => setFSituacao(s.id)}>
              {s.l}<span>{contar(s.id)}</span>
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="fm-filtros">
          <input className="input" placeholder="Buscar por nome, e-mail, telefone ou campanha…"
            value={busca} onChange={(e) => setBusca(e.target.value)} />
          <select className="select" style={{ width: "auto" }} value={fForm} onChange={(e) => setFForm(e.target.value)}>
            <option value="todos">Todos os formulários</option>
            {forms.map((f) => <option key={f.form_id} value={f.form_id}>{f.nome}</option>)}
          </select>
        </div>

        {/* Leads */}
        {filtrados.length === 0 ? (
          <div className="card card-pad">
            <p className="fm-vazio">
              {leads.length === 0
                ? "Nenhum lead recebido ainda. Clique em “Buscar leads” para trazer do Meta."
                : "Nenhum lead corresponde aos filtros."}
            </p>
          </div>
        ) : (
          <div className="fm-tabela-wrap">
            <table className="fm-tabela">
              <thead>
                <tr>
                  <th>Recebido</th><th>Nome</th><th>Contato</th>
                  <th>Campanha</th><th>Formulário</th><th>Situação</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((l) => {
                  const s = situacaoDe(l.situacao);
                  return (
                    <tr key={l.id} onClick={() => setDetalhe(l)}>
                      <td className="fm-data">{fmtDH(l.criado_em_meta)}</td>
                      <td className="fm-nome">{l.nome || <em>sem nome</em>}</td>
                      <td className="fm-contato">
                        {l.email && <span>{l.email}</span>}
                        {l.telefone && <span className="fm-tel">{fmtTel(l.telefone)}</span>}
                        {!l.email && !l.telefone && "—"}
                      </td>
                      <td className="fm-camp" title={l.utm_campaign || ""}>{l.utm_campaign || "—"}</td>
                      <td className="fm-camp">{l.form_nome || "—"}</td>
                      <td><span className={`fm-badge tom-${s.tom}`}>{s.l}</span></td>
                      <td className="fm-acao">
                        {l.lead_crm_id
                          ? <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); onVerLead && onVerLead(l.lead_crm_id); }}>Ver no CRM ›</button>
                          : <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); converter(l); }}>+ Negociação</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </>)}

      {modalGerenciar && (
        <GerenciarForms cadastrados={forms} onToast={onToast}
          onSalvar={(f) => { cadastrarForm(f); }}
          onFechar={() => setModalGerenciar(false)} />
      )}
      {detalhe && (
        <DetalheLead lead={detalhe} convertendo={convertendo}
          onFechar={() => setDetalhe(null)}
          onConverter={converter} onSituacao={mudarSituacao} />
      )}
    </div>
  );
}
