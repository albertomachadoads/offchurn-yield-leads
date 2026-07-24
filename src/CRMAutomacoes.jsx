import { useEffect, useState, useRef, useCallback } from "react";
import { Icon, Modal } from "./components.jsx";
import * as api from "./api.js";

/* ============================================================
   Automações do CRM — builder visual com trigger → ações.
   Funciona como mapa mental: nó trigger conecta a nós de ação.
   ============================================================ */

const TRIGGERS = [
  { v: "lead_criado", l: "Lead criado", icon: "🆕", desc: "Quando um novo lead é criado no funil" },
  { v: "mudanca_etapa", l: "Mudança de etapa", icon: "➡️", desc: "Quando lead muda de etapa" },
  { v: "campo_alterado", l: "Campo personalizado alterado", icon: "✏️", desc: "Quando um campo personalizado é preenchido/alterado" },
  { v: "tag_adicionada", l: "Tag adicionada", icon: "🏷️", desc: "Quando uma tag é adicionada ao lead" },
  { v: "lead_ganho", l: "Lead ganho (venda)", icon: "🏆", desc: "Quando lead é marcado como ganho" },
  { v: "lead_perdido", l: "Lead perdido", icon: "❌", desc: "Quando lead é marcado como perdido" },
];

const ACOES = [
  { v: "adicionar_tag", l: "Adicionar tag", icon: "🏷️", desc: "Adiciona uma tag ao lead" },
  { v: "mudar_etapa", l: "Mudar etapa", icon: "➡️", desc: "Move o lead para outra etapa" },
  { v: "atribuir_usuario", l: "Atribuir usuário", icon: "👤", desc: "Define o responsável do lead" },
  { v: "atribuir_fonte", l: "Atribuir fonte", icon: "📍", desc: "Define a origem do lead" },
  { v: "atribuir_produto", l: "Atribuir produto", icon: "📦", desc: "Define o produto do lead" },
  { v: "campo_personalizado", l: "Preencher campo", icon: "✏️", desc: "Preenche um campo personalizado" },
  { v: "criar_anotacao", l: "Criar anotação", icon: "📝", desc: "Adiciona uma anotação automática" },
  { v: "criar_tarefa", l: "Criar tarefa", icon: "✅", desc: "Cria uma tarefa para o lead" },
  { v: "notificacao", l: "Enviar notificação", icon: "🔔", desc: "Notifica um usuário do sistema" },
];

/* ---- Nó visual ---- */
function Node({ node, isSelected, onSelect, onDrag }) {
  const ref = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  function onMouseDown(e) {
    if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    setDragging(true);
    const rect = ref.current.getBoundingClientRect();
    setOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    onSelect();
    e.preventDefault();
  }
  useEffect(() => {
    if (!dragging) return;
    function onMove(e) { onDrag(e.clientX - offset.x, e.clientY - offset.y); }
    function onUp() { setDragging(false); }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, offset]);

  const isTrigger = node.tipo === "trigger";
  return (
    <div ref={ref} className={`auto-node ${isTrigger ? "auto-trigger" : "auto-acao"} ${isSelected ? "auto-selected" : ""}`}
      style={{ left: node.x, top: node.y }} onMouseDown={onMouseDown}>
      <div className="auto-node-icon">{node.icon}</div>
      <div className="auto-node-label">{node.label}</div>
      {node.detail && <div className="auto-node-detail">{node.detail}</div>}
      <div className={`auto-node-dot ${isTrigger ? "auto-dot-out" : "auto-dot-in"}`} />
    </div>
  );
}

/* ---- Editor de automação ---- */
function AutomacaoEditor({ automacao, funil, crm, onSave, onToast, onVoltar }) {
  const [nome, setNome] = useState(automacao.nome || "Nova automação");
  const [ativo, setAtivo] = useState(automacao.ativo ?? true);
  const [triggerTipo, setTriggerTipo] = useState(automacao.triggerTipo || "lead_criado");
  const [triggerConfig, setTriggerConfig] = useState(() => { try { return JSON.parse(automacao.triggerConfig || "{}"); } catch { return {}; } });
  const [acoes, setAcoes] = useState(() => { try { return JSON.parse(automacao.acoes || "[]"); } catch { return []; } });
  const [posicoes, setPosicoes] = useState(() => { try { return JSON.parse(automacao.posicoes || "{}"); } catch { return {}; } });
  const [selectedNode, setSelectedNode] = useState(null);
  const [addingAcao, setAddingAcao] = useState(false);
  const canvasRef = useRef(null);

  const etapas = (crm.etapas || []).filter((e) => e.funilId === funil.id);
  const tags = (crm.tags || []).filter((t) => t.funilId === funil.id);
  const campos = (crm.campos || []).filter((c) => c.funilId === funil.id);
  const origens = (crm.origens || []).filter((o) => o.funilId === funil.id);
  const produtos = (crm.produtos || []).filter((p) => p.funilId === funil.id);
  const pessoas = crm.pessoas || [];
  const trig = TRIGGERS.find((t) => t.v === triggerTipo);

  // Posições dos nós
  const trigPos = posicoes.trigger || { x: 60, y: 120 };
  const getAcaoPos = (i) => posicoes[`acao_${i}`] || { x: 400, y: 80 + i * 130 };

  function moveNode(nodeId, absX, absY) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, absX - rect.left);
    const y = Math.max(0, absY - rect.top);
    setPosicoes((p) => ({ ...p, [nodeId]: { x, y } }));
  }

  function addAcao(tipo) {
    const def = ACOES.find((a) => a.v === tipo);
    setAcoes((p) => [...p, { tipo, config: {}, label: def?.l || tipo }]);
    setAddingAcao(false);
  }

  function updateAcaoConfig(idx, key, val) {
    setAcoes((p) => p.map((a, i) => i === idx ? { ...a, config: { ...a.config, [key]: val } } : a));
  }

  function removeAcao(idx) {
    setAcoes((p) => p.filter((_, i) => i !== idx));
  }

  async function salvar() {
    try {
      await api.crmAutomacaoSave({
        id: automacao.id || undefined, funilId: funil.id, nome, ativo,
        triggerTipo, triggerConfig: JSON.stringify(triggerConfig),
        acoes: JSON.stringify(acoes), posicoes: JSON.stringify(posicoes),
      });
      onToast("Automação salva"); onVoltar();
    } catch (e) { onToast("Erro: " + e.message); }
  }

  // Renderizar configuração do trigger
  function renderTriggerConfig() {
    if (triggerTipo === "mudanca_etapa") return (
      <div className="auto-cfg">
        <label>De etapa</label>
        <select className="select" value={triggerConfig.deEtapa || ""} onChange={(e) => setTriggerConfig((p) => ({ ...p, deEtapa: e.target.value }))}>
          <option value="">Qualquer</option>{etapas.map((e2) => <option key={e2.id} value={e2.id}>{e2.nome}</option>)}
        </select>
        <label>Para etapa</label>
        <select className="select" value={triggerConfig.paraEtapa || ""} onChange={(e) => setTriggerConfig((p) => ({ ...p, paraEtapa: e.target.value }))}>
          <option value="">Qualquer</option>{etapas.map((e2) => <option key={e2.id} value={e2.id}>{e2.nome}</option>)}
        </select>
      </div>
    );
    if (triggerTipo === "campo_alterado") return (
      <div className="auto-cfg">
        <label>Campo</label>
        <select className="select" value={triggerConfig.campoId || ""} onChange={(e) => setTriggerConfig((p) => ({ ...p, campoId: e.target.value }))}>
          <option value="">Selecione</option>{campos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <label>Valor igual a</label>
        <input className="input" value={triggerConfig.valorIgual || ""} onChange={(e) => setTriggerConfig((p) => ({ ...p, valorIgual: e.target.value }))} placeholder="Opcional" />
      </div>
    );
    if (triggerTipo === "tag_adicionada") return (
      <div className="auto-cfg">
        <label>Tag</label>
        <select className="select" value={triggerConfig.tagId || ""} onChange={(e) => setTriggerConfig((p) => ({ ...p, tagId: e.target.value }))}>
          <option value="">Qualquer</option>{tags.map((t2) => <option key={t2.id} value={t2.id}>{t2.nome}</option>)}
        </select>
      </div>
    );
    return null;
  }

  // Renderizar configuração de cada ação
  function renderAcaoConfig(acao, idx) {
    const c = acao.config || {};
    switch (acao.tipo) {
      case "adicionar_tag": return <select className="select" value={c.tagId||""} onChange={(e) => updateAcaoConfig(idx, "tagId", e.target.value)}><option value="">Selecione tag</option>{tags.map((t2) => <option key={t2.id} value={t2.id}>{t2.nome}</option>)}</select>;
      case "mudar_etapa": return <select className="select" value={c.etapaId||""} onChange={(e) => updateAcaoConfig(idx, "etapaId", e.target.value)}><option value="">Selecione etapa</option>{etapas.map((e2) => <option key={e2.id} value={e2.id}>{e2.nome}</option>)}</select>;
      case "atribuir_usuario": return <select className="select" value={c.pessoaId||""} onChange={(e) => updateAcaoConfig(idx, "pessoaId", e.target.value)}><option value="">Selecione</option>{pessoas.map((p2) => <option key={p2.id} value={p2.id}>{p2.nome}</option>)}</select>;
      case "atribuir_fonte": return <select className="select" value={c.origemId||""} onChange={(e) => updateAcaoConfig(idx, "origemId", e.target.value)}><option value="">Selecione</option>{origens.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</select>;
      case "atribuir_produto": return <select className="select" value={c.produtoId||""} onChange={(e) => updateAcaoConfig(idx, "produtoId", e.target.value)}><option value="">Selecione</option>{produtos.map((p2) => <option key={p2.id} value={p2.id}>{p2.nome}</option>)}</select>;
      case "campo_personalizado": return <><select className="select" value={c.campoId||""} onChange={(e) => updateAcaoConfig(idx, "campoId", e.target.value)}><option value="">Campo</option>{campos.map((c2) => <option key={c2.id} value={c2.id}>{c2.nome}</option>)}</select><input className="input" placeholder="Valor" value={c.valor||""} onChange={(e) => updateAcaoConfig(idx, "valor", e.target.value)} /></>;
      case "criar_anotacao": return <textarea className="input" rows={2} placeholder="Texto da anotação…" value={c.texto||""} onChange={(e) => updateAcaoConfig(idx, "texto", e.target.value)} />;
      case "criar_tarefa": return <input className="input" placeholder="Descrição da tarefa…" value={c.descricao||""} onChange={(e) => updateAcaoConfig(idx, "descricao", e.target.value)} />;
      case "notificacao": return <input className="input" placeholder="Mensagem da notificação…" value={c.mensagem||""} onChange={(e) => updateAcaoConfig(idx, "mensagem", e.target.value)} />;
      default: return null;
    }
  }

  return (
    <>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button className="btn btn-sm btn-ghost" onClick={onVoltar}>‹ Voltar</button>
          <div>
            <input className="input" style={{ fontSize: 18, fontWeight: 800, border: "none", padding: 0, background: "transparent", width: 300 }}
              value={nome} onChange={(e) => setNome(e.target.value)} />
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-faint)" }}>Funil: {funil.nome}</p>
          </div>
        </div>
        <div className="head-actions">
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativa
          </label>
          <button className="btn btn-primary btn-sm" onClick={salvar}>Salvar automação</button>
        </div>
      </div>

      <div className="auto-builder">
        {/* Painel lateral de configuração */}
        <div className="auto-sidebar">
          {/* Trigger */}
          <div className="auto-panel">
            <h4 className="auto-panel-title">⚡ Quando (trigger)</h4>
            <select className="select" value={triggerTipo} onChange={(e) => { setTriggerTipo(e.target.value); setTriggerConfig({}); }}>
              {TRIGGERS.map((t2) => <option key={t2.v} value={t2.v}>{t2.icon} {t2.l}</option>)}
            </select>
            <p style={{ fontSize: 11, color: "var(--ink-faint)", margin: "6px 0 0" }}>{trig?.desc}</p>
            {renderTriggerConfig()}
          </div>

          {/* Ações */}
          <div className="auto-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h4 className="auto-panel-title">🎯 Então (ações)</h4>
              <button className="btn btn-sm" onClick={() => setAddingAcao(true)}>+ Ação</button>
            </div>
            {acoes.length === 0 && <p style={{ fontSize: 12, color: "var(--ink-faint)" }}>Nenhuma ação configurada.</p>}
            {acoes.map((a, i) => {
              const def = ACOES.find((d) => d.v === a.tipo);
              return (
                <div key={i} className="auto-acao-item">
                  <div className="auto-acao-head">
                    <span>{def?.icon} {def?.l}</span>
                    <button className="iconbtn" onClick={() => removeAcao(i)}><Icon.Trash /></button>
                  </div>
                  <div className="auto-acao-cfg">{renderAcaoConfig(a, i)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Canvas visual */}
        <div className="auto-canvas" ref={canvasRef}>
          {/* Linhas SVG conectando trigger → ações */}
          <svg className="auto-lines">
            {acoes.map((_, i) => {
              const tp = trigPos;
              const ap = getAcaoPos(i);
              const x1 = tp.x + 200, y1 = tp.y + 40;
              const x2 = ap.x, y2 = ap.y + 40;
              const mx = (x1 + x2) / 2;
              return <path key={i} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                stroke="var(--green)" strokeWidth="2" fill="none" strokeDasharray="6 3" />;
            })}
          </svg>

          {/* Nó do trigger */}
          <Node node={{ tipo: "trigger", x: trigPos.x, y: trigPos.y, icon: trig?.icon || "⚡", label: trig?.l || "Trigger", detail: triggerConfig.valorIgual ? `= ${triggerConfig.valorIgual}` : "" }}
            isSelected={selectedNode === "trigger"} onSelect={() => setSelectedNode("trigger")}
            onDrag={(x, y) => moveNode("trigger", x, y)} />

          {/* Nós das ações */}
          {acoes.map((a, i) => {
            const def = ACOES.find((d) => d.v === a.tipo);
            const pos = getAcaoPos(i);
            const detail = a.config?.texto?.slice(0, 30) || a.config?.descricao?.slice(0, 30) || a.config?.mensagem?.slice(0, 30) || "";
            return (
              <Node key={i} node={{ tipo: "acao", x: pos.x, y: pos.y, icon: def?.icon || "🎯", label: def?.l || a.tipo, detail }}
                isSelected={selectedNode === `acao_${i}`} onSelect={() => setSelectedNode(`acao_${i}`)}
                onDrag={(x, y) => moveNode(`acao_${i}`, x, y)} />
            );
          })}

          {acoes.length === 0 && (
            <div style={{ position: "absolute", left: 400, top: 140, color: "var(--ink-faint)", fontSize: 13, pointerEvents: "none" }}>
              ← Adicione ações no painel à esquerda
            </div>
          )}
        </div>
      </div>

      {/* Modal de adicionar ação */}
      {addingAcao && (
        <Modal title="Adicionar ação" onClose={() => setAddingAcao(false)} footer={null}>
          <div className="auto-acoes-grid">
            {ACOES.map((a) => (
              <button key={a.v} className="auto-acao-pick" onClick={() => addAcao(a.v)}>
                <span className="auto-acao-pick-icon">{a.icon}</span>
                <span className="auto-acao-pick-label">{a.l}</span>
                <span className="auto-acao-pick-desc">{a.desc}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

/* ---- Lista de automações ---- */
export default function CRMAutomacoes({ onToast }) {
  const [crm, setCrm] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [funilId, setFunilId] = useState(null);
  const [editando, setEditando] = useState(null);

  async function carregar() {
    try { const d = await api.fetchCRM(); setCrm(d); if (!funilId && d.funis.length > 0) setFunilId(d.funis[0].id); }
    catch (e) { onToast("Erro: " + e.message); } finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  if (carregando) return <div style={{ padding: 40, textAlign: "center" }}>Carregando…</div>;
  if (!crm || crm.funis.length === 0) return <div className="empty"><p>Crie funis primeiro.</p></div>;

  const funil = crm.funis.find((f) => f.id === funilId) || crm.funis[0];
  const automacoes = (crm.automacoes || []).filter((a) => a.funilId === funil.id);

  if (editando) {
    return <AutomacaoEditor automacao={editando} funil={funil} crm={{ ...crm, pessoas: crm.pessoas || [] }}
      onSave={() => { setEditando(null); carregar(); }} onToast={onToast} onVoltar={() => { setEditando(null); carregar(); }} />;
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Automações</h1><p>Automatize ações no CRM com regras trigger → ação.</p></div>
        <div className="head-actions">
          <select className="select" style={{ width: "auto" }} value={funilId || ""} onChange={(e) => setFunilId(e.target.value)}>
            {crm.funis.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <button className="btn btn-sm btn-primary" onClick={() => setEditando({ funilId: funil.id })}><Icon.Plus /> Nova automação</button>
        </div>
      </div>

      {automacoes.length === 0 ? (
        <div className="empty" style={{ padding: 40 }}>
          <h3>Nenhuma automação</h3>
          <p>Crie automações para executar ações automaticamente quando eventos acontecem no CRM.</p>
        </div>
      ) : (
        <div className="auto-list">
          {automacoes.map((a) => {
            const trig = TRIGGERS.find((t) => t.v === a.triggerTipo);
            let numAcoes = 0; try { numAcoes = JSON.parse(a.acoes || "[]").length; } catch {}
            return (
              <div key={a.id} className="auto-list-item" onClick={() => setEditando(a)}>
                <div className="auto-list-icon">{trig?.icon || "⚡"}</div>
                <div className="auto-list-info">
                  <div className="auto-list-nome">{a.nome}</div>
                  <div className="auto-list-meta">{trig?.l || a.triggerTipo} → {numAcoes} ação{numAcoes !== 1 ? "ões" : ""}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className={`pill ${a.ativo ? "done" : "off"}`}>{a.ativo ? "Ativa" : "Inativa"}</span>
                  <button className="iconbtn" onClick={(e) => { e.stopPropagation(); if (confirm("Excluir?")) api.crmAutomacaoDelete(a.id).then(carregar); }}><Icon.Trash /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
