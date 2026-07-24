import { useEffect, useState } from "react";
import { Icon, Modal } from "./components.jsx";
import * as api from "./api.js";

/* ============================================================
   Parâmetros de CRM — funis, etapas, tags, motivos, campos, origens
   Cada formulário é um COMPONENTE separado (nunca hooks em callback).
   ============================================================ */

const TIPO_ETAPA = [
  { v: "normal", l: "Normal", c: "#6b7280" },
  { v: "ganho", l: "Lead ganho ✓", c: "#22c55e" },
  { v: "perdido", l: "Lead perdido ✕", c: "#ef4444" },
];
const TIPO_CAMPO = ["texto", "numero", "select", "data", "url"];
const CORES_TAG = ["#22c55e","#3b82f6","#ef4444","#f59e0b","#8b5cf6","#ec4899","#14b8a6","#f97316","#6366f1","#64748b"];

function Pill({ cor, children }) {
  return <span style={{ background: cor || "#6b7280", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, display: "inline-block" }}>{children}</span>;
}

/* ================================================================
   FUNIL + ETAPAS (tudo no mesmo modal)
   ================================================================ */
function FormFunil({ base, etapasIniciais, onSave, onClose, onToast }) {
  const [nome, setNome] = useState(base.nome || "");
  const [desc, setDesc] = useState(base.descricao || "");
  const [salvando, setSalvando] = useState(false);
  const [funilId, setFunilId] = useState(base.id || null);
  const [etapas, setEtapas] = useState(
    (etapasIniciais || []).filter((e) => e.funilId === base.id).sort((a, b) => a.ordem - b.ordem)
  );
  const [novaEtapa, setNovaEtapa] = useState("");
  const [tipoNova, setTipoNova] = useState("normal");

  async function salvarFunil() {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      const saved = await api.crmFunilSave({ id: funilId || undefined, nome, descricao: desc });
      setFunilId(saved.id);
      onToast("Funil salvo");
    } catch (e) { onToast("Erro: " + (e.message || "falha")); }
    finally { setSalvando(false); }
  }

  async function addEtapa() {
    if (!novaEtapa.trim() || !funilId) return;
    try {
      const saved = await api.crmEtapaSave({
        funilId, nome: novaEtapa, tipo: tipoNova, ordem: etapas.length,
        cor: TIPO_ETAPA.find((t) => t.v === tipoNova)?.c || "#6b7280",
      });
      setEtapas((prev) => [...prev, { id: saved.id, funilId, nome: novaEtapa, tipo: tipoNova, ordem: prev.length, cor: saved.cor }]);
      setNovaEtapa(""); setTipoNova("normal");
    } catch (e) { onToast("Erro: " + (e.message || "falha")); }
  }

  async function delEtapa(id) {
    if (!confirm("Excluir esta etapa?")) return;
    try {
      await api.crmEtapaDelete(id);
      setEtapas((prev) => prev.filter((e) => e.id !== id));
    } catch (e) { onToast("Erro: " + (e.message || "falha")); }
  }

  async function moverEtapa(idx, dir) {
    const novas = [...etapas];
    const troca = idx + dir;
    if (troca < 0 || troca >= novas.length) return;
    [novas[idx], novas[troca]] = [novas[troca], novas[idx]];
    novas.forEach((e, i) => { e.ordem = i; });
    setEtapas(novas);
    try {
      await Promise.all(novas.map((e) => api.crmEtapaSave({ id: e.id, funilId: e.funilId, nome: e.nome, tipo: e.tipo, ordem: e.ordem, cor: e.cor })));
    } catch (e) { onToast("Erro ao reordenar: " + e.message); }
  }

  async function mudarTipoEtapa(id, novoTipo) {
    const et = etapas.find((e) => e.id === id);
    if (!et) return;
    const cor = TIPO_ETAPA.find((t) => t.v === novoTipo)?.c || "#6b7280";
    try {
      await api.crmEtapaSave({ ...et, tipo: novoTipo, cor });
      setEtapas((prev) => prev.map((e) => e.id === id ? { ...e, tipo: novoTipo, cor } : e));
    } catch (e) { onToast("Erro: " + e.message); }
  }

  return (
    <Modal title={funilId ? "Editar funil" : "Novo funil"} onClose={onClose} footer={
      <button className="btn btn-ghost" onClick={onClose}>Fechar</button>
    }>
      <div className="form-row">
        <label>Nome do funil *</label>
        <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex.: Funil Comercial" />
      </div>
      <div className="form-row">
        <label>Descrição</label>
        <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Opcional" />
      </div>
      <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={salvarFunil} disabled={salvando || !nome.trim()}>
        {salvando ? "Salvando…" : (funilId ? "Atualizar funil" : "Criar funil")}
      </button>

      {funilId && (
        <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <h4 style={{ margin: "0 0 10px", fontSize: 13 }}>Etapas do funil ({etapas.length})</h4>
          {etapas.map((et, i) => (
            <div key={et.id} className="param-item" style={{ padding: "6px 10px", marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: et.cor, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{et.nome}</span>
                <select className="select" style={{ width: "auto", fontSize: 11, padding: "2px 6px" }}
                  value={et.tipo} onChange={(e) => mudarTipoEtapa(et.id, e.target.value)}>
                  {TIPO_ETAPA.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 2 }}>
                <button className="iconbtn" onClick={() => moverEtapa(i, -1)} disabled={i === 0} title="Subir">▲</button>
                <button className="iconbtn" onClick={() => moverEtapa(i, 1)} disabled={i === etapas.length - 1} title="Descer">▼</button>
                <button className="iconbtn" onClick={() => delEtapa(et.id)} title="Excluir"><Icon.Trash /></button>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder="Nova etapa…"
              value={novaEtapa} onChange={(e) => setNovaEtapa(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEtapa()} />
            <select className="select" style={{ width: "auto" }} value={tipoNova} onChange={(e) => setTipoNova(e.target.value)}>
              {TIPO_ETAPA.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
            <button className="btn btn-sm" onClick={addEtapa} disabled={!novaEtapa.trim()}>Adicionar</button>
          </div>
        </div>
      )}

      {!funilId && (
        <p style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 12 }}>
          Salve o funil primeiro para adicionar etapas.
        </p>
      )}
    </Modal>
  );
}

/* ================================================================
   FORMULÁRIOS DOS OUTROS PARÂMETROS (cada um é um componente)
   ================================================================ */
function FormTag({ base, onSave, onClose }) {
  const [nome, setNome] = useState(base.nome || "");
  const [cor, setCor] = useState(base.cor || CORES_TAG[0]);
  return (
    <Modal title={base.id ? "Editar tag" : "Nova tag"} onClose={onClose} footer={
      <><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" onClick={() => nome.trim() && onSave({ id: base.id, nome, cor })} disabled={!nome.trim()}>Salvar</button></>
    }>
      <div className="form-row"><label>Nome da tag</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></div>
      <div className="form-row"><label>Cor</label><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {CORES_TAG.map((c) => <button key={c} onClick={() => setCor(c)} style={{ width: 28, height: 28, borderRadius: 6, background: c, border: cor === c ? "3px solid var(--ink)" : "2px solid transparent", cursor: "pointer" }} />)}
      </div></div>
      <div style={{ marginTop: 8 }}>Preview: <Pill cor={cor}>{nome || "tag"}</Pill></div>
    </Modal>
  );
}

function FormMotivo({ base, onSave, onClose }) {
  const [nome, setNome] = useState(base.nome || "");
  const [exigir, setExigir] = useState(base.exigirJustificativa || false);
  return (
    <Modal title={base.id ? "Editar motivo" : "Novo motivo de perda"} onClose={onClose} footer={
      <><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" onClick={() => nome.trim() && onSave({ id: base.id, nome, exigirJustificativa: exigir })} disabled={!nome.trim()}>Salvar</button></>
    }>
      <div className="form-row"><label>Motivo</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex.: Sem orçamento" /></div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0", cursor: "pointer" }}>
        <input type="checkbox" checked={exigir} onChange={(e) => setExigir(e.target.checked)} /> Exigir justificativa por escrito
      </label>
    </Modal>
  );
}

function FormCampo({ base, onSave, onClose }) {
  const [nome, setNome] = useState(base.nome || "");
  const [tipo, setTipo] = useState(base.tipo || "texto");
  const [obrig, setObrig] = useState(base.obrigatorio || false);
  const [opcoes, setOpcoes] = useState(base.opcoes || "");
  return (
    <Modal title={base.id ? "Editar campo" : "Novo campo personalizado"} onClose={onClose} footer={
      <><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" onClick={() => nome.trim() && onSave({ id: base.id, nome, tipo, obrigatorio: obrig, opcoes: tipo === "select" ? opcoes : null })} disabled={!nome.trim()}>Salvar</button></>
    }>
      <div className="form-row"><label>Nome do campo</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex.: Como conheceu?" /></div>
      <div className="form-row"><label>Tipo</label><select className="select" value={tipo} onChange={(e) => setTipo(e.target.value)}>{TIPO_CAMPO.map((t) => <option key={t}>{t}</option>)}</select></div>
      {tipo === "select" && <div className="form-row"><label>Opções (vírgula)</label><input className="input" value={opcoes} onChange={(e) => setOpcoes(e.target.value)} placeholder="Opção 1, Opção 2" /></div>}
      <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0", cursor: "pointer" }}>
        <input type="checkbox" checked={obrig} onChange={(e) => setObrig(e.target.checked)} /> Campo obrigatório
      </label>
    </Modal>
  );
}

function FormOrigem({ base, onSave, onClose }) {
  const [nome, setNome] = useState(base.nome || "");
  const [tipo, setTipo] = useState(base.tipo || "campanha");
  return (
    <Modal title={base.id ? "Editar origem" : "Nova origem"} onClose={onClose} footer={
      <><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" onClick={() => nome.trim() && onSave({ id: base.id, nome, tipo })} disabled={!nome.trim()}>Salvar</button></>
    }>
      <div className="form-row"><label>Nome</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex.: Google Ads - Espelhos" /></div>
      <div className="form-row"><label>Tipo</label><select className="select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
        <option value="campanha">Campanha</option><option value="organico">Orgânico</option><option value="indicacao">Indicação</option><option value="outro">Outro</option>
      </select></div>
    </Modal>
  );
}

/* ================================================================
   COMPONENTE PRINCIPAL
   ================================================================ */
export default function CRMParametros({ onToast }) {
  const [crm, setCrm] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(null); // { tipo: "funil"|"tag"|..., data: {} }

  async function carregar() {
    try { setCrm(await api.fetchCRM()); } catch (e) { onToast("Erro: " + e.message); }
    finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  if (carregando) return <div style={{ padding: 40, textAlign: "center" }}>Carregando parâmetros…</div>;
  if (!crm) return <div className="empty"><p>Erro ao carregar CRM.</p></div>;

  const r = () => carregar();

  async function salvarEFechar(tipo, dados) {
    try {
      const fn = { tag: api.crmTagSave, motivo: api.crmMotivoSave, campo: api.crmCampoSave, origem: api.crmOrigemSave }[tipo];
      await fn(dados);
      setModal(null); onToast("Salvo"); r();
    } catch (e) { onToast("Erro: " + (e.message || "falha")); }
  }

  async function excluir(tipo, id) {
    if (!confirm("Excluir?")) return;
    const fn = { funil: api.crmFunilDelete, tag: api.crmTagDelete, motivo: api.crmMotivoDelete, campo: api.crmCampoDelete, origem: api.crmOrigemDelete }[tipo];
    try { await fn(id); onToast("Excluído"); r(); } catch (e) { onToast("Erro: " + e.message); }
  }

  function Secao({ titulo, desc, tipo, items, renderItem, novaLabel }) {
    return (
      <div className="card card-pad param-secao">
        <div className="param-head">
          <div><h3 className="dash-title" style={{ margin: 0 }}>{titulo}</h3>{desc && <p className="param-desc">{desc}</p>}</div>
          <button className="btn btn-sm btn-primary" onClick={() => setModal({ tipo, data: {} })}><Icon.Plus /> {novaLabel}</button>
        </div>
        {items.length === 0 ? <p className="param-vazio">Nenhum item criado.</p> : (
          <div className="param-lista">
            {items.map((it) => (
              <div key={it.id} className="param-item">
                {renderItem(it)}
                <div className="param-acoes">
                  <button className="iconbtn" onClick={() => setModal({ tipo, data: it })}><Icon.Edit /></button>
                  <button className="iconbtn" onClick={() => excluir(tipo, it.id)}><Icon.Trash /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Parâmetros de CRM</h1><p>Configure funis, etapas, tags, motivos de perda, campos e origens.</p></div>
      </div>

      <Secao titulo="Funis de Vendas" desc="Crie funis com etapas. Marque etapas como 'ganho' ou 'perdido' para dashboards." tipo="funil"
        items={crm.funis.sort((a, b) => a.ordem - b.ordem)} novaLabel="Novo funil"
        renderItem={(f) => (
          <div>
            <strong>{f.nome}</strong>{f.descricao && <span className="param-desc"> — {f.descricao}</span>}
            <br /><span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
              {crm.etapas.filter((e) => e.funilId === f.id).length} etapas
              {crm.etapas.filter((e) => e.funilId === f.id && e.tipo === "ganho").length > 0 && " · ✓ ganho"}
              {crm.etapas.filter((e) => e.funilId === f.id && e.tipo === "perdido").length > 0 && " · ✕ perdido"}
            </span>
          </div>
        )}
      />

      <Secao titulo="Tags" desc="Tags com cores para classificar leads." tipo="tag" items={crm.tags} novaLabel="Nova tag"
        renderItem={(t) => <Pill cor={t.cor}>{t.nome}</Pill>} />

      <Secao titulo="Motivos de Perda" desc="Ao perder lead, o vendedor escolhe um motivo." tipo="motivo" items={crm.motivos} novaLabel="Novo motivo"
        renderItem={(m) => <div><strong>{m.nome}</strong>{m.exigirJustificativa && <span className="param-badge">Exige justificativa</span>}</div>} />

      <Secao titulo="Campos Personalizados" desc="Campos extras nos leads (UTMs, perguntas). Marque como obrigatório." tipo="campo"
        items={crm.campos.sort((a, b) => a.ordem - b.ordem)} novaLabel="Novo campo"
        renderItem={(c) => <div><strong>{c.nome}</strong> <Pill cor="#6366f1">{c.tipo}</Pill>{c.obrigatorio && <span className="param-badge">Obrigatório</span>}</div>} />

      <Secao titulo="Origens e Campanhas" desc="Fontes de leads para medir performance." tipo="origem" items={crm.origens} novaLabel="Nova origem"
        renderItem={(o) => <div><strong>{o.nome}</strong> <Pill cor="#3b82f6">{o.tipo}</Pill></div>} />

      {/* MODAIS — cada tipo tem seu componente próprio (sem hooks em callback) */}
      {modal?.tipo === "funil" && (
        <FormFunil base={modal.data} etapasIniciais={crm.etapas} onToast={onToast}
          onSave={async () => { setModal(null); r(); }} onClose={() => { setModal(null); r(); }} />
      )}
      {modal?.tipo === "tag" && (
        <FormTag base={modal.data} onSave={(d) => salvarEFechar("tag", d)} onClose={() => setModal(null)} />
      )}
      {modal?.tipo === "motivo" && (
        <FormMotivo base={modal.data} onSave={(d) => salvarEFechar("motivo", d)} onClose={() => setModal(null)} />
      )}
      {modal?.tipo === "campo" && (
        <FormCampo base={modal.data} onSave={(d) => salvarEFechar("campo", d)} onClose={() => setModal(null)} />
      )}
      {modal?.tipo === "origem" && (
        <FormOrigem base={modal.data} onSave={(d) => salvarEFechar("origem", d)} onClose={() => setModal(null)} />
      )}
    </>
  );
}
