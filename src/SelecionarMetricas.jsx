import { useEffect, useMemo, useState } from "react";
import { Modal } from "./components.jsx";
import { supabase } from "./supabaseClient.js";
import { CATALOGO, GRUPOS, PRESETS, PADRAO } from "./metricasCatalogo.js";

/* ============================================================
   Seleção das métricas que o cliente acompanha.
   Presets aceleram; a marcação individual dá o ajuste fino.
   ============================================================ */

export default function SelecionarMetricas({ cliente, onSalvar, onFechar, onToast }) {
  const [sel, setSel] = useState(cliente.metricasMeta?.length ? cliente.metricasMeta : PADRAO);
  const [busca, setBusca] = useState("");
  const [salvas, setSalvas] = useState([]);
  const [salvandoView, setSalvandoView] = useState(false);
  const [nomeView, setNomeView] = useState("");

  useEffect(() => {
    supabase.from("metricas_visualizacoes").select("*").order("nome")
      .then(({ data }) => setSalvas(data || []));
  }, []);

  const alternar = (campo) =>
    setSel((p) => (p.includes(campo) ? p.filter((c) => c !== campo) : [...p, campo]));

  const aplicarPreset = (p) => { setSel([...p.metricas]); onToast(`Preset "${p.nome}" aplicado`); };

  const porGrupo = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtrado = q
      ? CATALOGO.filter((m) => m.rotulo.toLowerCase().includes(q) || (m.ajuda || "").toLowerCase().includes(q))
      : CATALOGO;
    return GRUPOS.map((g) => ({ ...g, metricas: filtrado.filter((m) => m.grupo === g.id) }))
      .filter((g) => g.metricas.length > 0);
  }, [busca]);

  const grupoTodoMarcado = (g) => g.metricas.every((m) => sel.includes(m.campo));
  const alternarGrupo = (g) => {
    const ids = g.metricas.map((m) => m.campo);
    setSel((p) => (grupoTodoMarcado(g) ? p.filter((c) => !ids.includes(c)) : [...new Set([...p, ...ids])]));
  };

  async function salvarVisualizacao() {
    if (!nomeView.trim()) return;
    try {
      const { data } = await supabase.from("metricas_visualizacoes")
        .insert({ nome: nomeView.trim(), metricas: sel, agencia: cliente.agencia || null })
        .select().single();
      setSalvas((p) => [...p, data].sort((a, b) => a.nome.localeCompare(b.nome)));
      setNomeView(""); setSalvandoView(false);
      onToast("Visualização salva");
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function excluirVisualizacao(id, nome) {
    if (!confirm(`Excluir a visualização "${nome}"?`)) return;
    await supabase.from("metricas_visualizacoes").delete().eq("id", id);
    setSalvas((p) => p.filter((v) => v.id !== id));
  }

  return (
    <Modal title={`Métricas — ${cliente.nome}`} onClose={onFechar} wide footer={
      <>
        <span className="mx-contador">{sel.length} {sel.length === 1 ? "métrica" : "métricas"}</span>
        <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
        <button className="btn btn-primary" disabled={sel.length === 0} onClick={() => onSalvar(sel)}>
          Salvar seleção
        </button>
      </>
    }>
      <div className="mx">
        {/* Presets */}
        <div className="mx-bloco">
          <h4>Começar por um modelo</h4>
          <div className="mx-presets">
            {PRESETS.map((p) => (
              <button key={p.id} className="mx-preset" onClick={() => aplicarPreset(p)}>
                <strong>{p.nome}</strong>
                <small>{p.descricao}</small>
                <span className="mx-preset-n">{p.metricas.length} métricas</span>
              </button>
            ))}
          </div>
        </div>

        {/* Visualizações salvas */}
        {salvas.length > 0 && (
          <div className="mx-bloco">
            <h4>Suas visualizações</h4>
            <div className="mx-salvas">
              {salvas.map((v) => (
                <div key={v.id} className="mx-salva">
                  <button className="mx-salva-btn" onClick={() => { setSel([...(v.metricas || [])]); onToast(`"${v.nome}" aplicada`); }}>
                    {v.nome}<span>{(v.metricas || []).length}</span>
                  </button>
                  <button className="mx-salva-x" title="Excluir" onClick={() => excluirVisualizacao(v.id, v.nome)}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Catálogo */}
        <div className="mx-bloco">
          <div className="mx-cat-head">
            <h4>Todas as métricas</h4>
            <input className="input mx-busca" placeholder="Buscar métrica…"
              value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>

          {porGrupo.length === 0 ? (
            <p className="mx-vazio">Nenhuma métrica encontrada para "{busca}".</p>
          ) : porGrupo.map((g) => (
            <div key={g.id} className="mx-grupo">
              <label className="mx-grupo-head" onClick={() => alternarGrupo(g)}>
                <input type="checkbox" checked={grupoTodoMarcado(g)} readOnly />
                {g.nome}
                <span className="mx-grupo-n">{g.metricas.filter((m) => sel.includes(m.campo)).length}/{g.metricas.length}</span>
              </label>
              <div className="mx-metricas">
                {g.metricas.map((m) => (
                  <label key={m.campo} className={`mx-metrica ${sel.includes(m.campo) ? "on" : ""}`}>
                    <input type="checkbox" checked={sel.includes(m.campo)} onChange={() => alternar(m.campo)} />
                    <span className="mx-metrica-txt">
                      {m.rotulo}
                      {m.ajuda && <small>{m.ajuda}</small>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Salvar como visualização */}
        <div className="mx-bloco mx-salvar">
          {salvandoView ? (
            <div className="mx-salvar-form">
              <input className="input" autoFocus placeholder="Nome da visualização (ex: Tráfego para clínicas)"
                value={nomeView} onChange={(e) => setNomeView(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") salvarVisualizacao(); }} />
              <button className="btn btn-sm btn-ghost" onClick={() => setSalvandoView(false)}>Cancelar</button>
              <button className="btn btn-sm btn-primary" disabled={!nomeView.trim()} onClick={salvarVisualizacao}>Salvar</button>
            </div>
          ) : (
            <button className="btn-txt" onClick={() => setSalvandoView(true)}>
              Salvar esta combinação como visualização reutilizável
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
