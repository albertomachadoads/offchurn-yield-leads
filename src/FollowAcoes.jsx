import { useMemo, useState } from "react";
import { ETAPAS, ETAPA_KEYS } from "./store";
import { fmtData, hoje } from "./utils";
import { Icon, Modal } from "./components.jsx";

const corEtapa = (etapa) => ETAPAS.find((e) => e.key === etapa)?.cor || "var(--ink-faint)";

// dias entre duas datas ISO (yyyy-mm-dd)
function diasEntre(de, ate) {
  if (!de || !ate) return null;
  const limpa = (v) => String(v).split("T")[0];
  const d1 = new Date(limpa(de) + "T00:00:00");
  const d2 = new Date(limpa(ate) + "T00:00:00");
  if (isNaN(d1) || isNaN(d2)) return null;
  return Math.round((d2 - d1) / 86400000);
}

// info de tempo de resolução e prazo de uma tarefa
function infoTempo(t) {
  const criacao = t.dataCriacao || t.data;
  const dias = diasEntre(criacao, t.dataConclusao); // null se não concluída
  let prazoStatus = null; // "no_prazo" | "atrasou" | "pendente"
  if (t.prazo) {
    if (t.dataConclusao) {
      prazoStatus = t.dataConclusao <= t.prazo ? "no_prazo" : "atrasou";
    } else {
      prazoStatus = hoje() <= t.prazo ? "pendente" : "atrasou";
    }
  }
  return { dias, prazoStatus };
}

/* ====== Gráfico de barras horizontais ====== */
function BarrasHorizontais({ dados, cor = "var(--green)" }) {
  const max = Math.max(1, ...dados.map((d) => d.valor));
  if (dados.length === 0) return <div className="dash-empty">Sem dados para exibir.</div>;
  return (
    <div className="barh-list">
      {dados.map((d) => (
        <div className="barh-row" key={d.label}>
          <div className="barh-label" title={d.label}>{d.label}</div>
          <div className="barh-track">
            <div className="barh-fill" style={{ width: `${(d.valor / max) * 100}%`, background: d.cor || cor }} />
          </div>
          <div className="barh-val">{d.valor}</div>
        </div>
      ))}
    </div>
  );
}

/* ====== Gráfico de barras verticais (tarefas criadas por dia) ====== */
function BarrasVerticais({ dados }) {
  const max = Math.max(1, ...dados.map((d) => d.valor));
  if (dados.length === 0) return <div className="dash-empty">Sem tarefas cadastradas.</div>;
  return (
    <div className="barv-wrap">
      {dados.map((d) => (
        <div className="barv-col" key={d.label}>
          <div className="barv-bar-area">
            <span className="barv-num">{d.valor}</span>
            <div className="barv-bar" style={{ height: `${(d.valor / max) * 100}%` }} />
          </div>
          <div className="barv-label">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ====== Badge de etapa ====== */
function EtapaBadge({ etapa }) {
  return (
    <span className="etapa-badge" style={{ "--c": corEtapa(etapa) }}>
      <span className="dot" /> {etapa}
    </span>
  );
}

export default function FollowAcoes({ tarefas, clientes, pessoas, onSave, onDelete, onToast, isAdmin }) {
  const [modal, setModal] = useState(null);
  const [fCriador, setFCriador] = useState("todos");
  const [fResp, setFResp] = useState("todos");
  const [fCliente, setFCliente] = useState("todos");
  const [fEtapa, setFEtapa] = useState("todas");
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");

  const cliById = useMemo(() => Object.fromEntries(clientes.map((c) => [c.id, c])), [clientes]);
  const pesById = useMemo(() => Object.fromEntries(pessoas.map((p) => [p.id, p])), [pessoas]);
  const nomePes = (id) => pesById[id]?.nome || "—";
  const nomeCli = (id) => cliById[id]?.nome || "—";

  const filtradas = useMemo(() => {
    return tarefas
      .filter((t) => fCriador === "todos" || t.criadaPorId === fCriador)
      .filter((t) => fResp === "todos" || t.responsavelId === fResp)
      .filter((t) => fCliente === "todos" || t.clienteId === fCliente)
      .filter((t) => fEtapa === "todas" || t.etapa === fEtapa)
      .filter((t) => (!fDe || t.data >= fDe) && (!fAte || t.data <= fAte))
      .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : (b.criadoEm || 0) - (a.criadoEm || 0)));
  }, [tarefas, fCriador, fResp, fCliente, fEtapa, fDe, fAte]);

  // ---- métricas ----
  const total = filtradas.length;
  const cont = (etapa) => filtradas.filter((t) => t.etapa === etapa).length;
  const concluidas = cont("Concluída");
  const atrasadas = cont("Atrasada");
  const canceladas = cont("Cancelada");
  const emAberto = total - concluidas - canceladas;

  // tempo médio de resolução (entre criação e conclusão), só das concluídas com ambas as datas
  const temposResolucao = filtradas
    .map((t) => diasEntre(t.dataCriacao || t.data, t.dataConclusao))
    .filter((d) => d != null && d >= 0);
  const tempoMedio = temposResolucao.length
    ? Math.round(temposResolucao.reduce((a, b) => a + b, 0) / temposResolucao.length)
    : null;
  // quantas furaram o prazo
  const furaramPrazo = filtradas.filter((t) => infoTempo(t).prazoStatus === "atrasou").length;

  const porEtapa = ETAPAS.map((e) => ({ label: e.key, valor: cont(e.key), cor: e.cor }));

  const agrupar = (campoId) => {
    const m = {};
    filtradas.forEach((t) => { const n = nomePes(t[campoId]); m[n] = (m[n] || 0) + 1; });
    return Object.entries(m).map(([label, valor]) => ({ label, valor })).sort((a, b) => b.valor - a.valor);
  };
  const porResponsavel = useMemo(() => agrupar("responsavelId"), [filtradas]);
  const porCriador = useMemo(() => agrupar("criadaPorId"), [filtradas]);

  const porCliente = useMemo(() => {
    const m = {};
    filtradas.forEach((t) => { const n = nomeCli(t.clienteId); m[n] = (m[n] || 0) + 1; });
    return Object.entries(m).map(([label, valor]) => ({ label, valor })).sort((a, b) => b.valor - a.valor);
  }, [filtradas]);

  const criadasPorData = useMemo(() => {
    const m = {};
    filtradas.forEach((t) => { m[t.data] = (m[t.data] || 0) + 1; });
    return Object.entries(m).sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([data, valor]) => ({ label: fmtData(data).slice(0, 5), valor }));
  }, [filtradas]);

  const filtrosAtivos = fCriador !== "todos" || fResp !== "todos" || fCliente !== "todos" || fEtapa !== "todas" || fDe || fAte;

  function excluir(id) {
    if (!confirm("Excluir esta tarefa do histórico?")) return;
    onDelete(id);
    onToast("Tarefa removida");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Follow de Ações</h1>
          <p>Registre cada tarefa criada nas reuniões e acompanhe o andamento das ações.</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary" onClick={() => setModal({ novo: true })}>
            <Icon.Plus /> Nova tarefa
          </button>
        </div>
      </div>

      {/* aviso fixo Monday */}
      <div className="aviso-monday">
        <span className="aviso-ico">!</span>
        <span>Toda tarefa criada precisa ser adicionada ao Monday no quadro do cliente.</span>
      </div>

      {/* filtros */}
      <div className="toolbar">
        <div className="field">
          <label>Criada por</label>
          <select className="select" value={fCriador} onChange={(e) => setFCriador(e.target.value)}>
            <option value="todos">Todos</option>
            {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Responsável</label>
          <select className="select" value={fResp} onChange={(e) => setFResp(e.target.value)}>
            <option value="todos">Todos</option>
            {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Cliente</label>
          <select className="select" value={fCliente} onChange={(e) => setFCliente(e.target.value)}>
            <option value="todos">Todos</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Etapa</label>
          <select className="select" value={fEtapa} onChange={(e) => setFEtapa(e.target.value)}>
            <option value="todas">Todas</option>
            {ETAPA_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div className="field">
          <label>De</label>
          <input type="date" className="input" value={fDe} onChange={(e) => setFDe(e.target.value)} />
        </div>
        <div className="field">
          <label>Até</label>
          <input type="date" className="input" value={fAte} onChange={(e) => setFAte(e.target.value)} />
        </div>
        {filtrosAtivos && (
          <div className="field"><label>&nbsp;</label>
            <button className="btn btn-ghost" onClick={() => { setFCriador("todos"); setFResp("todos"); setFCliente("todos"); setFEtapa("todas"); setFDe(""); setFAte(""); }}>Limpar filtros</button>
          </div>
        )}
      </div>

      {/* tiles de resumo */}
      <div className="tiles tiles-6">
        <div className="tile"><div className="label">Tarefas</div><div className="value">{total}</div><div className="hint">no período</div></div>
        <div className="tile"><div className="label">Em aberto</div><div className="value">{emAberto}</div><div className="hint">não finalizadas</div></div>
        <div className="tile"><div className="label">Concluídas</div><div className="value">{concluidas}</div><div className="hint">finalizadas</div></div>
        <div className="tile"><div className="label">Tempo médio</div><div className="value">{tempoMedio != null ? tempoMedio : "—"}</div><div className="hint">{tempoMedio != null ? "dias p/ resolver" : "sem conclusões"}</div></div>
        <div className="tile"><div className="label">Fora do prazo</div><div className="value" style={{ color: furaramPrazo > 0 ? "var(--red)" : "inherit" }}>{furaramPrazo}</div><div className="hint">furaram o prazo</div></div>
        <div className="tile"><div className="label">Canceladas</div><div className="value">{canceladas}</div><div className="hint">descartadas</div></div>
      </div>

      {/* dashboards */}
      <div className="dash-grid">
        <div className="card card-pad dash-span2">
          <h3 className="dash-title">Volume de tarefas por etapa</h3>
          <BarrasHorizontais dados={porEtapa} />
        </div>
        <div className="card card-pad">
          <h3 className="dash-title">Tarefas criadas por dia</h3>
          <BarrasVerticais dados={criadasPorData} />
        </div>
        <div className="card card-pad">
          <h3 className="dash-title">Tarefas por responsável</h3>
          <BarrasHorizontais dados={porResponsavel} cor="var(--green-deep)" />
        </div>
        <div className="card card-pad">
          <h3 className="dash-title">Tarefas criadas por pessoa</h3>
          <BarrasHorizontais dados={porCriador} cor="var(--green)" />
        </div>
        <div className="card card-pad">
          <h3 className="dash-title">Tarefas por cliente</h3>
          <BarrasHorizontais dados={porCliente} cor="var(--green-dark)" />
        </div>
      </div>

      {/* tabela de tarefas */}
      <h3 className="dash-title" style={{ marginTop: 24 }}>Tarefas cadastradas</h3>
      {filtradas.length === 0 ? (
        <div className="card"><div className="empty">
          <h3>Nenhuma tarefa no período</h3>
          <p>Cadastre uma tarefa para alimentar os dashboards acima.</p>
          <button className="btn btn-primary" onClick={() => setModal({ novo: true })}><Icon.Plus /> Nova tarefa</button>
        </div></div>
      ) : (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Criação</th><th>Criada por</th><th>Responsável</th><th>Cliente</th>
                <th>Ação</th><th>Etapa</th><th>Prazo</th><th>Conclusão</th><th>Tempo</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((t) => {
                const { dias, prazoStatus } = infoTempo(t);
                return (
                <tr key={t.id}>
                  <td className="cell-num">{fmtData(t.dataCriacao || t.data)}</td>
                  <td>{nomePes(t.criadaPorId)}</td>
                  <td>{nomePes(t.responsavelId)}</td>
                  <td className="cell-cliente">{nomeCli(t.clienteId)}</td>
                  <td className="cell-acomp">{t.acao || "—"}</td>
                  <td><EtapaBadge etapa={t.etapa} /></td>
                  <td className="cell-num">
                    {t.prazo
                      ? <span className={prazoStatus === "atrasou" ? "prazo-furado" : ""}>{fmtData(t.prazo)}</span>
                      : "—"}
                  </td>
                  <td className="cell-num">{t.dataConclusao ? fmtData(t.dataConclusao) : "—"}</td>
                  <td className="cell-num">
                    {dias != null
                      ? <span className="tempo-badge">{dias} {dias === 1 ? "dia" : "dias"}</span>
                      : (prazoStatus === "atrasou" ? <span className="prazo-furado">em atraso</span> : "—")}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 2 }}>
                      <button className="iconbtn" onClick={() => setModal(t)} aria-label="Editar"><Icon.Edit /></button>
                      <button className="iconbtn" onClick={() => excluir(t.id)} aria-label="Excluir"><Icon.Trash /></button>
                    </div>
                  </td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <TarefaModal
          base={modal} clientes={clientes} pessoas={pessoas} isAdmin={isAdmin}
          onClose={() => setModal(null)}
          onSave={(t) => { onSave(t); setModal(null); onToast(modal.novo ? "Tarefa cadastrada" : "Tarefa atualizada"); }}
        />
      )}
    </>
  );
}

/* ====== Modal de cadastro de tarefa ====== */
function TarefaModal({ base, clientes, pessoas, onClose, onSave, isAdmin }) {
  const [f, setF] = useState(() => ({
    id: base.id || null,
    // "data" mantém compatibilidade; dataCriacao é a data real de criação
    data: base.data || hoje(),
    dataCriacao: base.dataCriacao || base.data || hoje(),
    prazo: base.prazo || "",
    dataConclusao: base.dataConclusao || "",
    criadaPorId: base.criadaPorId || pessoas[0]?.id || "",
    responsavelId: base.responsavelId || pessoas[0]?.id || "",
    clienteId: base.clienteId || clientes[0]?.id || "",
    acao: base.acao || "",
    etapa: base.etapa || "A executar",
    criadoEm: base.criadoEm,
  }));

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  // Ao mudar a etapa: se virar "Concluída" e não houver data de conclusão, preenche com hoje.
  // Se sair de "Concluída", limpa a data de conclusão.
  const mudarEtapa = (novaEtapa) => {
    setF((s) => {
      let dataConclusao = s.dataConclusao;
      if (novaEtapa === "Concluída" && !dataConclusao) dataConclusao = hoje();
      if (novaEtapa !== "Concluída") dataConclusao = "";
      return { ...s, etapa: novaEtapa, dataConclusao };
    });
  };

  const valido = f.dataCriacao && f.criadaPorId && f.responsavelId && f.clienteId && f.acao.trim();

  function salvar() {
    if (!valido) return;
    // mantém "data" sincronizada com a data de criação (usada nos filtros/dashboards)
    onSave({ ...f, data: f.dataCriacao, acao: f.acao.trim() });
  }

  return (
    <Modal
      title={base.novo ? "Nova tarefa" : "Editar tarefa"}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={salvar} disabled={!valido}>Salvar tarefa</button>
      </>}
    >
      <div className="aviso-monday aviso-modal">
        <span className="aviso-ico">!</span>
        <span>Lembre-se de adicionar esta tarefa ao Monday, no quadro do cliente.</span>
      </div>

      <div className="form-grid">
        <div className="form-row">
          <label>Cliente</label>
          <select className="select" value={f.clienteId} onChange={(e) => set("clienteId", e.target.value)}>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Etapa</label>
          <select className="select" value={f.etapa} onChange={(e) => mudarEtapa(e.target.value)}>
            {ETAPA_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Criada por</label>
          <select className="select" value={f.criadaPorId} onChange={(e) => set("criadaPorId", e.target.value)}>
            {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Responsável</label>
          <select className="select" value={f.responsavelId} onChange={(e) => set("responsavelId", e.target.value)}>
            {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
      </div>

      <div className="form-row">
        <label>Ação a ser executada</label>
        <textarea className="input" rows={3} placeholder="Descreva a tarefa…" value={f.acao} onChange={(e) => set("acao", e.target.value)} />
      </div>

      <div className="form-grid form-grid-3">
        <div className="form-row">
          <label>Data de criação {isAdmin ? "" : "(automática)"}</label>
          <input type="date" className="input" value={f.dataCriacao}
            disabled={!isAdmin}
            onChange={(e) => set("dataCriacao", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Prazo</label>
          <input type="date" className="input" value={f.prazo} onChange={(e) => set("prazo", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Data de conclusão</label>
          <input type="date" className="input" value={f.dataConclusao} onChange={(e) => set("dataConclusao", e.target.value)} />
        </div>
      </div>
      {!isAdmin && (
        <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
          A data de criação é registrada automaticamente. A data de conclusão é preenchida ao marcar a etapa como "Concluída".
        </div>
      )}
    </Modal>
  );
}
