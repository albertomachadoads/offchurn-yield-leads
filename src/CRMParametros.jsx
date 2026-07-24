import { useEffect, useState } from "react";
import { Icon, Modal } from "./components.jsx";
import * as api from "./api.js";

/* ============================================================
   Parâmetros de CRM — centrado no FUNIL.
   Cada funil tem seus próprios: etapas, tags, motivos, campos, origens.
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

/* ---- Mini-form inline para adicionar itens ---- */
function AddInline({ placeholder, onAdd, extra }) {
  const [nome, setNome] = useState("");
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder={placeholder}
        value={nome} onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && nome.trim()) { onAdd(nome.trim()); setNome(""); } }} />
      {extra}
      <button className="btn btn-sm" disabled={!nome.trim()} onClick={() => { if (nome.trim()) { onAdd(nome.trim()); setNome(""); } }}>Adicionar</button>
    </div>
  );
}

/* ---- Lista editável genérica ---- */
function ParamList({ items, renderItem, onDel }) {
  if (items.length === 0) return <p style={{ fontSize: 12, color: "var(--ink-faint)", margin: "6px 0" }}>Nenhum item.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {items.map((it) => (
        <div key={it.id} className="param-item" style={{ padding: "5px 10px" }}>
          <div style={{ flex: 1 }}>{renderItem(it)}</div>
          <button className="iconbtn" onClick={() => { if (confirm("Excluir?")) onDel(it.id); }}><Icon.Trash /></button>
        </div>
      ))}
    </div>
  );
}

/* ================================================================
   EDITOR DE FUNIL (página inteira dedicada ao funil selecionado)
   ================================================================ */
function FunilEditor({ funil, crm, onToast, onVoltar }) {
  const [nome, setNome] = useState(funil.nome);
  const [desc, setDesc] = useState(funil.descricao || "");
  const [data, setData] = useState(crm);
  const fid = funil.id;

  async function reload() {
    try { setData(await api.fetchCRM()); } catch {}
  }

  const etapas = (data.etapas || []).filter((e) => e.funilId === fid).sort((a, b) => a.ordem - b.ordem);
  const tags = (data.tags || []).filter((t) => t.funilId === fid);
  const motivos = (data.motivos || []).filter((m) => m.funilId === fid);
  const campos = (data.campos || []).filter((c) => c.funilId === fid).sort((a, b) => a.ordem - b.ordem);
  const origens = (data.origens || []).filter((o) => o.funilId === fid);

  // ---- etapas ----
  const [novaEtapa, setNovaEtapa] = useState("");
  const [tipoNova, setTipoNova] = useState("normal");

  async function addEtapa() {
    if (!novaEtapa.trim()) return;
    try {
      await api.crmEtapaSave({ funilId: fid, nome: novaEtapa, tipo: tipoNova, ordem: etapas.length, cor: TIPO_ETAPA.find((t) => t.v === tipoNova)?.c });
      setNovaEtapa(""); setTipoNova("normal"); reload();
    } catch (e) { onToast("Erro: " + e.message); }
  }
  async function moverEtapa(idx, dir) {
    const novas = [...etapas];
    const troca = idx + dir;
    if (troca < 0 || troca >= novas.length) return;
    [novas[idx], novas[troca]] = [novas[troca], novas[idx]];
    novas.forEach((e, i) => { e.ordem = i; });
    try { await Promise.all(novas.map((e) => api.crmEtapaSave({ id: e.id, funilId: fid, nome: e.nome, tipo: e.tipo, ordem: e.ordem, cor: e.cor }))); reload(); }
    catch (e) { onToast("Erro: " + e.message); }
  }
  async function mudarTipo(id, tipo) {
    const et = etapas.find((e) => e.id === id); if (!et) return;
    try { await api.crmEtapaSave({ ...et, tipo, cor: TIPO_ETAPA.find((t) => t.v === tipo)?.c }); reload(); }
    catch (e) { onToast("Erro: " + e.message); }
  }

  // ---- tags ----
  const [novaCor, setNovaCor] = useState(CORES_TAG[0]);

  // ---- motivos ----
  const [exigirJust, setExigirJust] = useState(false);

  // ---- campos ----
  const [tipoCampo, setTipoCampo] = useState("texto");
  const [campoObrig, setCampoObrig] = useState(false);

  // ---- origens ----
  const [tipoOrigem, setTipoOrigem] = useState("campanha");

  return (
    <>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button className="btn btn-sm btn-ghost" onClick={onVoltar}>‹ Voltar</button>
          <div>
            <h1 style={{ margin: 0 }}>{nome}</h1>
            <p style={{ margin: 0 }}>Configuração completa deste funil</p>
          </div>
        </div>
      </div>

      {/* NOME DO FUNIL */}
      <div className="card card-pad param-secao">
        <h3 className="dash-title" style={{ margin: "0 0 8px" }}>Dados do funil</h3>
        <div className="form-grid">
          <div className="form-row"><label>Nome</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div className="form-row"><label>Descrição</label><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        </div>
        <button className="btn btn-sm btn-primary" style={{ marginTop: 8 }}
          onClick={async () => { try { await api.crmFunilSave({ id: fid, nome, descricao: desc }); onToast("Funil atualizado"); } catch (e) { onToast("Erro: " + e.message); } }}>
          Salvar alterações
        </button>
      </div>

      {/* ETAPAS */}
      <div className="card card-pad param-secao">
        <h3 className="dash-title" style={{ margin: "0 0 8px" }}>Etapas do funil ({etapas.length})</h3>
        <p className="param-desc">Arraste com ▲▼ para reordenar. Mude o tipo diretamente no select.</p>
        {etapas.map((et, i) => (
          <div key={et.id} className="param-item" style={{ padding: "6px 10px", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: et.cor, flexShrink: 0 }} />
              <strong style={{ fontSize: 13 }}>{et.nome}</strong>
              <select className="select" style={{ width: "auto", fontSize: 11, padding: "2px 6px" }}
                value={et.tipo} onChange={(e) => mudarTipo(et.id, e.target.value)}>
                {TIPO_ETAPA.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 2 }}>
              <button className="iconbtn" onClick={() => moverEtapa(i, -1)} disabled={i === 0}>▲</button>
              <button className="iconbtn" onClick={() => moverEtapa(i, 1)} disabled={i === etapas.length - 1}>▼</button>
              <button className="iconbtn" onClick={async () => { if (confirm("Excluir?")) { await api.crmEtapaDelete(et.id); reload(); } }}><Icon.Trash /></button>
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder="Nova etapa…"
            value={novaEtapa} onChange={(e) => setNovaEtapa(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEtapa()} />
          <select className="select" style={{ width: "auto" }} value={tipoNova} onChange={(e) => setTipoNova(e.target.value)}>
            {TIPO_ETAPA.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
          <button className="btn btn-sm" onClick={addEtapa} disabled={!novaEtapa.trim()}>Adicionar</button>
        </div>
      </div>

      {/* TAGS */}
      <div className="card card-pad param-secao">
        <h3 className="dash-title" style={{ margin: "0 0 8px" }}>Tags deste funil</h3>
        <ParamList items={tags} onDel={async (id) => { await api.crmTagDelete(id); reload(); }}
          renderItem={(t) => <Pill cor={t.cor}>{t.nome}</Pill>} />
        <div style={{ display: "flex", gap: 4, marginTop: 10, flexWrap: "wrap" }}>
          {CORES_TAG.map((c) => <button key={c} onClick={() => setNovaCor(c)}
            style={{ width: 22, height: 22, borderRadius: 4, background: c, border: novaCor === c ? "2px solid var(--ink)" : "2px solid transparent", cursor: "pointer" }} />)}
        </div>
        <AddInline placeholder="Nome da tag" onAdd={async (nome) => { try { await api.crmTagSave({ nome, cor: novaCor, funilId: fid }); reload(); } catch (e) { onToast("Erro: " + e.message); } }} />
      </div>

      {/* MOTIVOS DE PERDA */}
      <div className="card card-pad param-secao">
        <h3 className="dash-title" style={{ margin: "0 0 8px" }}>Motivos de perda</h3>
        <ParamList items={motivos} onDel={async (id) => { await api.crmMotivoDelete(id); reload(); }}
          renderItem={(m) => <div><strong>{m.nome}</strong>{m.exigirJustificativa && <span className="param-badge">Exige justificativa</span>}</div>} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, margin: "8px 0 0", cursor: "pointer" }}>
          <input type="checkbox" checked={exigirJust} onChange={(e) => setExigirJust(e.target.checked)} /> Exigir justificativa
        </label>
        <AddInline placeholder="Motivo de perda" onAdd={async (nome) => { try { await api.crmMotivoSave({ nome, exigirJustificativa: exigirJust, funilId: fid }); reload(); } catch (e) { onToast("Erro: " + e.message); } }} />
      </div>

      {/* CAMPOS PERSONALIZADOS */}
      <div className="card card-pad param-secao">
        <h3 className="dash-title" style={{ margin: "0 0 8px" }}>Campos personalizados</h3>
        <ParamList items={campos} onDel={async (id) => { await api.crmCampoDelete(id); reload(); }}
          renderItem={(c) => <div><strong>{c.nome}</strong> <Pill cor="#6366f1">{c.tipo}</Pill>{c.obrigatorio && <span className="param-badge">Obrigatório</span>}</div>} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
          <select className="select" style={{ width: "auto" }} value={tipoCampo} onChange={(e) => setTipoCampo(e.target.value)}>
            {TIPO_CAMPO.map((t) => <option key={t}>{t}</option>)}
          </select>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input type="checkbox" checked={campoObrig} onChange={(e) => setCampoObrig(e.target.checked)} /> Obrigatório
          </label>
        </div>
        <AddInline placeholder="Nome do campo" onAdd={async (nome) => { try { await api.crmCampoSave({ nome, tipo: tipoCampo, obrigatorio: campoObrig, funilId: fid }); reload(); } catch (e) { onToast("Erro: " + e.message); } }} />
      </div>

      {/* ORIGENS E CAMPANHAS */}
      <div className="card card-pad param-secao">
        <h3 className="dash-title" style={{ margin: "0 0 8px" }}>Origens e campanhas</h3>
        <ParamList items={origens} onDel={async (id) => { await api.crmOrigemDelete(id); reload(); }}
          renderItem={(o) => <div><strong>{o.nome}</strong> <Pill cor="#3b82f6">{o.tipo}</Pill></div>} />
        <div style={{ marginTop: 8 }}>
          <select className="select" style={{ width: "auto", marginBottom: 6 }} value={tipoOrigem} onChange={(e) => setTipoOrigem(e.target.value)}>
            <option value="campanha">Campanha</option><option value="organico">Orgânico</option><option value="indicacao">Indicação</option><option value="outro">Outro</option>
          </select>
        </div>
        <AddInline placeholder="Nome da origem" onAdd={async (nome) => { try { await api.crmOrigemSave({ nome, tipo: tipoOrigem, funilId: fid }); reload(); } catch (e) { onToast("Erro: " + e.message); } }} />
      </div>
    </>
  );
}

/* ================================================================
   PÁGINA PRINCIPAL — lista de funis
   ================================================================ */
export default function CRMParametros({ onToast }) {
  const [crm, setCrm] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [funilAberto, setFunilAberto] = useState(null);
  const [novoNome, setNovoNome] = useState("");

  async function carregar() {
    try { setCrm(await api.fetchCRM()); } catch (e) { onToast("Erro: " + e.message); }
    finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  if (carregando) return <div style={{ padding: 40, textAlign: "center" }}>Carregando…</div>;
  if (!crm) return <div className="empty"><p>Erro ao carregar.</p></div>;

  if (funilAberto) {
    const funil = crm.funis.find((f) => f.id === funilAberto);
    if (!funil) { setFunilAberto(null); return null; }
    return <FunilEditor funil={funil} crm={crm} onToast={onToast} onVoltar={() => { setFunilAberto(null); carregar(); }} />;
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Parâmetros de CRM</h1><p>Cada funil tem seus próprios parâmetros (etapas, tags, motivos, campos, origens).</p></div>
      </div>

      <div className="card card-pad">
        <h3 className="dash-title" style={{ margin: "0 0 12px" }}>Seus funis</h3>
        {crm.funis.length === 0 ? <p className="param-vazio">Nenhum funil criado ainda.</p> : (
          <div className="param-lista">
            {crm.funis.sort((a, b) => a.ordem - b.ordem).map((f) => {
              const ets = crm.etapas.filter((e) => e.funilId === f.id);
              const tgs = crm.tags.filter((t) => t.funilId === f.id);
              return (
                <div key={f.id} className="param-item" style={{ cursor: "pointer" }} onClick={() => setFunilAberto(f.id)}>
                  <div>
                    <strong style={{ fontSize: 15 }}>{f.nome}</strong>
                    {f.descricao && <span className="param-desc"> — {f.descricao}</span>}
                    <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2 }}>
                      {ets.length} etapas · {tgs.length} tags · Clique para configurar →
                    </div>
                  </div>
                  <div className="param-acoes">
                    <button className="iconbtn" onClick={(e) => { e.stopPropagation(); if (confirm("Excluir funil e tudo relacionado?")) { api.crmFunilDelete(f.id).then(carregar); } }}><Icon.Trash /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ display: "flex", gap: 6, marginTop: 14, alignItems: "center" }}>
          <input className="input" style={{ flex: 1, maxWidth: 300 }} placeholder="Nome do novo funil…"
            value={novoNome} onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && novoNome.trim()) { api.crmFunilSave({ nome: novoNome, ordem: crm.funis.length }).then(() => { setNovoNome(""); carregar(); }); } }} />
          <button className="btn btn-sm btn-primary" disabled={!novoNome.trim()}
            onClick={() => { api.crmFunilSave({ nome: novoNome, ordem: crm.funis.length }).then(() => { setNovoNome(""); carregar(); }); }}>
            <Icon.Plus /> Criar funil
          </button>
        </div>
      </div>
    </>
  );
}
