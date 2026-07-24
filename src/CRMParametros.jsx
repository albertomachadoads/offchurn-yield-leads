import { useEffect, useMemo, useState } from "react";
import { Icon, Modal } from "./components.jsx";
import * as api from "./api.js";

/* ============================================================
   Parâmetros de CRM — configuração de funis, etapas, tags,
   motivos de perda, campos personalizados e origens.
   ============================================================ */

const TIPO_ETAPA = [
  { v: "normal", l: "Normal", c: "#6b7280" },
  { v: "ganho", l: "Lead ganho ✓", c: "#22c55e" },
  { v: "perdido", l: "Lead perdido ✕", c: "#ef4444" },
];
const TIPO_CAMPO = ["texto", "numero", "select", "data", "url"];
const CORES_TAG = ["#22c55e","#3b82f6","#ef4444","#f59e0b","#8b5cf6","#ec4899","#14b8a6","#f97316","#6366f1","#64748b"];

function Pill({ cor, children }) {
  return <span style={{ background: cor || "#6b7280", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>{children}</span>;
}

/* ---- seção genérica de lista editável ---- */
function SecaoParam({ titulo, desc, items, onAdd, onEdit, onDel, renderItem, renderForm, novaLabel }) {
  const [modal, setModal] = useState(null);
  return (
    <div className="card card-pad param-secao">
      <div className="param-head">
        <div><h3 className="dash-title" style={{ margin: 0 }}>{titulo}</h3>{desc && <p className="param-desc">{desc}</p>}</div>
        <button className="btn btn-sm btn-primary" onClick={() => setModal({ novo: true })}><Icon.Plus /> {novaLabel || "Novo"}</button>
      </div>
      {items.length === 0 ? <p className="param-vazio">Nenhum item criado ainda.</p> : (
        <div className="param-lista">
          {items.map((it) => (
            <div key={it.id} className="param-item">
              {renderItem(it)}
              <div className="param-acoes">
                <button className="iconbtn" onClick={() => setModal(it)}><Icon.Edit /></button>
                <button className="iconbtn" onClick={() => { if (confirm("Excluir?")) onDel(it.id); }}><Icon.Trash /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {modal && (
        <Modal title={modal.novo ? novaLabel || "Novo" : "Editar"} onClose={() => setModal(null)}
          footer={null}>
          {renderForm(modal, async (dados) => {
            try {
              if (modal.novo) await onAdd(dados); else await onEdit({ ...dados, id: modal.id });
              setModal(null);
            } catch (e) { alert("Erro: " + (e.message || "falha")); }
          }, () => setModal(null))}
        </Modal>
      )}
    </div>
  );
}

/* ---- Formulário de Funil ---- */
function FormFunil({ base, onSave, onClose, etapas, onSaveEtapa, onDelEtapa }) {
  const [nome, setNome] = useState(base.nome || "");
  const [desc, setDesc] = useState(base.descricao || "");
  const [novaEtapa, setNovaEtapa] = useState("");
  const [tipoNova, setTipoNova] = useState("normal");
  const ets = (etapas || []).filter((e) => e.funilId === base.id).sort((a, b) => a.ordem - b.ordem);
  return (
    <div>
      <div className="form-row"><label>Nome do funil</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></div>
      <div className="form-row"><label>Descrição</label><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button className="btn btn-primary btn-sm" onClick={() => nome.trim() && onSave({ nome, descricao: desc })}>Salvar funil</button>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
      </div>
      {base.id && (
        <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <h4 style={{ margin: "0 0 8px", fontSize: 13 }}>Etapas deste funil</h4>
          {ets.map((et, i) => (
            <div key={et.id} className="param-item" style={{ padding: "6px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: et.cor, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{et.nome}</span>
                <Pill cor={TIPO_ETAPA.find((t) => t.v === et.tipo)?.c}>{TIPO_ETAPA.find((t) => t.v === et.tipo)?.l}</Pill>
              </div>
              <button className="iconbtn" onClick={() => { if (confirm("Excluir etapa?")) onDelEtapa(et.id); }}><Icon.Trash /></button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder="Nome da nova etapa" value={novaEtapa} onChange={(e) => setNovaEtapa(e.target.value)} />
            <select className="select" style={{ width: "auto" }} value={tipoNova} onChange={(e) => setTipoNova(e.target.value)}>
              {TIPO_ETAPA.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
            <button className="btn btn-sm" onClick={async () => {
              if (!novaEtapa.trim()) return;
              await onSaveEtapa({ funilId: base.id, nome: novaEtapa, tipo: tipoNova, ordem: ets.length, cor: TIPO_ETAPA.find((t) => t.v === tipoNova)?.c });
              setNovaEtapa(""); setTipoNova("normal");
            }}>Adicionar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CRMParametros({ onToast }) {
  const [crm, setCrm] = useState(null);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    try { setCrm(await api.fetchCRM()); } catch (e) { onToast("Erro: " + e.message); }
    finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  if (carregando) return <div style={{ padding: 40, textAlign: "center" }}>Carregando parâmetros…</div>;
  if (!crm) return <div className="empty"><p>Erro ao carregar CRM.</p></div>;

  const r = () => carregar(); // reload

  return (
    <>
      <div className="page-head">
        <div><h1>Parâmetros de CRM</h1><p>Configure funis, etapas, tags, motivos de perda, campos personalizados e origens.</p></div>
      </div>

      {/* FUNIS */}
      <SecaoParam titulo="Funis de Vendas" desc="Crie funis ilimitados com etapas personalizadas. Marque etapas como 'ganho' ou 'perdido' para os dashboards."
        items={crm.funis.sort((a, b) => a.ordem - b.ordem)} novaLabel="Novo funil"
        onAdd={async (d) => { await api.crmFunilSave(d); r(); }} onEdit={async (d) => { await api.crmFunilSave(d); r(); }}
        onDel={async (id) => { await api.crmFunilDelete(id); r(); }}
        renderItem={(f) => <div><strong>{f.nome}</strong>{f.descricao && <span className="param-desc"> — {f.descricao}</span>}<br/><span style={{ fontSize: 11, color: "var(--ink-faint)" }}>{crm.etapas.filter((e) => e.funilId === f.id).length} etapas</span></div>}
        renderForm={(base, onSave, onClose) => (
          <FormFunil base={base} onSave={onSave} onClose={onClose} etapas={crm.etapas}
            onSaveEtapa={async (e) => { await api.crmEtapaSave(e); r(); }}
            onDelEtapa={async (id) => { await api.crmEtapaDelete(id); r(); }} />
        )}
      />

      {/* TAGS */}
      <SecaoParam titulo="Tags" desc="Crie tags com cores para classificar leads." items={crm.tags} novaLabel="Nova tag"
        onAdd={async (d) => { await api.crmTagSave(d); r(); }} onEdit={async (d) => { await api.crmTagSave(d); r(); }}
        onDel={async (id) => { await api.crmTagDelete(id); r(); }}
        renderItem={(t) => <Pill cor={t.cor}>{t.nome}</Pill>}
        renderForm={(base, onSave, onClose) => {
          const [nome, setNome] = useState(base.nome || "");
          const [cor, setCor] = useState(base.cor || CORES_TAG[0]);
          return (<div>
            <div className="form-row"><label>Nome</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></div>
            <div className="form-row"><label>Cor</label><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {CORES_TAG.map((c) => <button key={c} onClick={() => setCor(c)} style={{ width: 28, height: 28, borderRadius: 6, background: c, border: cor === c ? "3px solid var(--ink)" : "2px solid transparent", cursor: "pointer" }} />)}
            </div></div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={() => nome.trim() && onSave({ nome, cor })}>Salvar</button>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
            </div>
          </div>);
        }}
      />

      {/* MOTIVOS DE PERDA */}
      <SecaoParam titulo="Motivos de Perda" desc="Ao marcar lead como perdido, o vendedor escolhe um motivo. Opcionalmente exija justificativa." items={crm.motivos} novaLabel="Novo motivo"
        onAdd={async (d) => { await api.crmMotivoSave(d); r(); }} onEdit={async (d) => { await api.crmMotivoSave(d); r(); }}
        onDel={async (id) => { await api.crmMotivoDelete(id); r(); }}
        renderItem={(m) => <div><strong>{m.nome}</strong>{m.exigirJustificativa && <span className="param-badge">Exige justificativa</span>}</div>}
        renderForm={(base, onSave, onClose) => {
          const [nome, setNome] = useState(base.nome || "");
          const [exigir, setExigir] = useState(base.exigirJustificativa || false);
          return (<div>
            <div className="form-row"><label>Motivo</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex.: Sem orçamento" /></div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={exigir} onChange={(e) => setExigir(e.target.checked)} /> Exigir justificativa por escrito
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={() => nome.trim() && onSave({ nome, exigirJustificativa: exigir })}>Salvar</button>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
            </div>
          </div>);
        }}
      />

      {/* CAMPOS PERSONALIZADOS */}
      <SecaoParam titulo="Campos Personalizados" desc="Crie campos extras para os leads (UTMs, perguntas ao vendedor, etc). Marque como obrigatório quando necessário." items={crm.campos.sort((a,b)=>a.ordem-b.ordem)} novaLabel="Novo campo"
        onAdd={async (d) => { await api.crmCampoSave(d); r(); }} onEdit={async (d) => { await api.crmCampoSave(d); r(); }}
        onDel={async (id) => { await api.crmCampoDelete(id); r(); }}
        renderItem={(c) => <div><strong>{c.nome}</strong> <span className="pill">{c.tipo}</span>{c.obrigatorio && <span className="param-badge">Obrigatório</span>}</div>}
        renderForm={(base, onSave, onClose) => {
          const [nome, setNome] = useState(base.nome || "");
          const [tipo, setTipo] = useState(base.tipo || "texto");
          const [obrig, setObrig] = useState(base.obrigatorio || false);
          const [opcoes, setOpcoes] = useState(base.opcoes || "");
          return (<div>
            <div className="form-row"><label>Nome do campo</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex.: Como conheceu a agência?" /></div>
            <div className="form-grid"><div className="form-row"><label>Tipo</label><select className="select" value={tipo} onChange={(e) => setTipo(e.target.value)}>{TIPO_CAMPO.map((t) => <option key={t}>{t}</option>)}</select></div></div>
            {tipo === "select" && <div className="form-row"><label>Opções (separadas por vírgula)</label><input className="input" value={opcoes} onChange={(e) => setOpcoes(e.target.value)} placeholder="Opção 1, Opção 2, Opção 3" /></div>}
            <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={obrig} onChange={(e) => setObrig(e.target.checked)} /> Campo obrigatório
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={() => nome.trim() && onSave({ nome, tipo, obrigatorio: obrig, opcoes: tipo === "select" ? opcoes : null })}>Salvar</button>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
            </div>
          </div>);
        }}
      />

      {/* ORIGENS E CAMPANHAS */}
      <SecaoParam titulo="Origens e Campanhas" desc="Fontes de onde os leads chegam. Usado para medir performance das campanhas." items={crm.origens} novaLabel="Nova origem"
        onAdd={async (d) => { await api.crmOrigemSave(d); r(); }} onEdit={async (d) => { await api.crmOrigemSave(d); r(); }}
        onDel={async (id) => { await api.crmOrigemDelete(id); r(); }}
        renderItem={(o) => <div><strong>{o.nome}</strong> <span className="pill">{o.tipo}</span></div>}
        renderForm={(base, onSave, onClose) => {
          const [nome, setNome] = useState(base.nome || "");
          const [tipo, setTipo] = useState(base.tipo || "campanha");
          return (<div>
            <div className="form-row"><label>Nome</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex.: Google Ads - Espelhos" /></div>
            <div className="form-row"><label>Tipo</label><select className="select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="campanha">Campanha</option><option value="organico">Orgânico</option><option value="indicacao">Indicação</option><option value="outro">Outro</option>
            </select></div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={() => nome.trim() && onSave({ nome, tipo })}>Salvar</button>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
            </div>
          </div>);
        }}
      />
    </>
  );
}
