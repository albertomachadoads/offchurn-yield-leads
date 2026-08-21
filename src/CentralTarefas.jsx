import { useMemo, useState } from "react";
import { Modal } from "./components.jsx";
import { recortesTarefas, hojeISO } from "./tarefasCore.js";

/* ============================================================
   Central de Tarefas — ponto de entrada alternativo para o
   MESMO registro do módulo de Tarefas.

   Não há base paralela: onSalvar e onExcluir são as funções
   que o próprio módulo usa (api.upsertTarefa / api.deleteTarefa),
   recebidas por prop. Qualquer alteração aqui grava na tabela
   oficial e o recarregar() do App propaga para todos os blocos.
   ============================================================ */

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function rotuloDia(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(a, m - 1, d);
  return `${DIAS[dt.getDay()]} · ${String(d).padStart(2, "0")} ${MESES[m - 1]}`;
}
function rotuloPrazo(iso, hoje = hojeISO()) {
  if (!iso) return "sem prazo";
  if (iso === hoje) return "hoje";
  const dif = Math.round((new Date(iso) - new Date(hoje)) / 86400000);
  if (dif === 1) return "amanhã";
  if (dif === -1) return "ontem";
  if (dif < 0) return `${Math.abs(dif)} dias atrás`;
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/* ---------- Linha de tarefa ---------- */
function Linha({ t, pessoas, clientes, onConcluir, onAbrir, onReagendar, onExcluir }) {
  const [menu, setMenu] = useState(false);
  const resp = (pessoas || []).find((p) => p.id === t.responsavelId)?.nome;
  const cli = (clientes || []).find((c) => c.id === t.clienteId)?.nome;
  return (
    <div className={`tf-linha ${t.atrasada ? "tf-atrasada" : ""}`}>
      <span className={`tf-pri tf-p-${t.prioridade}`}>
        {t.prioridade === "critica" ? "CRÍTICA" : t.prioridade === "alta" ? "ALTA" : "MÉDIA"}
      </span>

      <div className="tf-corpo">
        <div className="tf-titulo">{t.titulo || t.acao || "Sem título"}</div>
        <div className="tf-meta">
          {cli && <span className="tf-cli">{cli}</span>}
          <span className={t.atrasada ? "tf-prazo-err" : "tf-prazo"}>{rotuloPrazo(t.quando)}</span>
          {resp && <span className="tf-resp">{resp}</span>}
        </div>
      </div>

      <span className={`tf-sit tf-s-${t.situacao === "Atrasada" ? "err" : t.situacao === "Em andamento" ? "inf" : "neu"}`}>
        {t.situacao}
      </span>

      <div className="tf-acoes">
        <button className="tf-btn tf-btn-ok" title="Concluir" onClick={() => onConcluir(t)}>✓</button>
        <button className="tf-btn" title="Abrir no módulo" onClick={() => onAbrir(t)}>→</button>
        <div className="tf-menu-wrap">
          <button className="tf-btn" title="Mais ações" onClick={() => setMenu((v) => !v)}>⋯</button>
          {menu && (
            <>
              <div className="tf-menu-fundo" onClick={() => setMenu(false)} />
              <div className="tf-menu">
                <button onClick={() => { setMenu(false); onAbrir(t); }}>Editar</button>
                <button onClick={() => { setMenu(false); onReagendar(t, 1); }}>Adiar 1 dia</button>
                <button onClick={() => { setMenu(false); onReagendar(t, 7); }}>Adiar 1 semana</button>
                <button className="tf-menu-err" onClick={() => { setMenu(false); onExcluir(t); }}>Excluir</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Modal de nova tarefa ---------- */
function NovaTarefa({ clientes, pessoas, usuario, onSalvar, onFechar }) {
  const [f, setF] = useState({
    titulo: "", clienteId: "", responsavelId: usuario?.id || "",
    prazo: hojeISO(), etapa: "A executar", acao: "",
  });
  const [salvando, setSalvando] = useState(false);
  const s = (k, v) => setF((p) => ({ ...p, [k]: v }));

  async function salvar() {
    if (!f.titulo.trim()) return;
    setSalvando(true);
    try {
      // Grava na tabela oficial: mesma função do módulo de Tarefas
      await onSalvar({
        titulo: f.titulo.trim(),
        acao: f.acao.trim() || f.titulo.trim(),
        clienteId: f.clienteId || null,
        responsavelId: f.responsavelId || null,
        prazo: f.prazo || null,
        data: f.prazo || hojeISO(),
        dataCriacao: hojeISO(),
        etapa: f.etapa,
      });
      onFechar();
    } finally { setSalvando(false); }
  }

  return (
    <Modal title="Nova tarefa" onClose={onFechar} footer={
      <>
        <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
        <button className="btn btn-primary" disabled={!f.titulo.trim() || salvando} onClick={salvar}>
          {salvando ? "Criando…" : "Criar tarefa"}
        </button>
      </>
    }>
      <div className="form-row">
        <label>Título da tarefa *</label>
        <input className="input" autoFocus value={f.titulo} onChange={(e) => s("titulo", e.target.value)}
          placeholder="Ex.: Revisar termos de pesquisa no Google Ads" />
      </div>
      <div className="form-grid2">
        <div className="form-row">
          <label>Cliente</label>
          <select className="select" value={f.clienteId} onChange={(e) => s("clienteId", e.target.value)}>
            <option value="">— sem cliente —</option>
            {(clientes || []).filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Responsável</label>
          <select className="select" value={f.responsavelId} onChange={(e) => s("responsavelId", e.target.value)}>
            <option value="">— sem responsável —</option>
            {(pessoas || []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
      </div>
      <div className="form-grid2">
        <div className="form-row">
          <label>Prazo</label>
          <input type="date" className="input" value={f.prazo} onChange={(e) => s("prazo", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Situação inicial</label>
          <select className="select" value={f.etapa} onChange={(e) => s("etapa", e.target.value)}>
            <option value="A executar">A executar</option>
            <option value="Em andamento">Em andamento</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <label>Descrição <span className="ct-nota">opcional</span></label>
        <textarea className="input" rows={3} value={f.acao} onChange={(e) => s("acao", e.target.value)}
          placeholder="Detalhes da execução" />
      </div>
      <p className="ct-nota">Esta tarefa será criada no módulo de Tarefas e aparecerá lá imediatamente.</p>
    </Modal>
  );
}

/* ================= CENTRAL ================= */
export default function CentralTarefas({
  tarefas, clientes, pessoas, usuario, scorePorCliente,
  onSalvar, onExcluir, onAbrirModulo, onToast,
}) {
  const [aba, setAba] = useState("hoje");
  const [modalNova, setModalNova] = useState(false);

  const R = useMemo(
    () => recortesTarefas(tarefas, { scorePorCliente: scorePorCliente || {} }),
    [tarefas, scorePorCliente]
  );

  // Abre em "Atrasadas" quando houver — é o que exige ação primeiro
  useMemo(() => { if (R.atrasadas.length > 0 && aba === "hoje" && R.deHoje.length === 0) setAba("atrasadas"); }, []);

  async function concluir(t) {
    try {
      await onSalvar({ ...t, etapa: "Concluída", dataConclusao: new Date().toISOString() });
      onToast("Tarefa concluída");
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function reagendar(t, dias) {
    try {
      const base = new Date(t.prazo || t.data || hojeISO());
      base.setDate(base.getDate() + dias);
      const novo = base.toISOString().slice(0, 10);
      await onSalvar({ ...t, prazo: novo, etapa: t.etapa === "Atrasada" ? "A executar" : t.etapa });
      onToast(`Reagendada para ${rotuloPrazo(novo)}`);
    } catch (e) { onToast("Erro: " + e.message); }
  }

  async function excluir(t) {
    if (!confirm(`Excluir a tarefa "${t.titulo || t.acao}"?\n\nEla será removida do módulo de Tarefas.`)) return;
    try { await onExcluir(t.id); onToast("Tarefa excluída"); }
    catch (e) { onToast("Erro: " + e.message); }
  }

  const abas = [
    { id: "atrasadas", l: "Atrasadas", n: R.atrasadas.length, tom: "err" },
    { id: "hoje", l: "Hoje", n: R.deHoje.length, tom: "avi" },
    { id: "semana", l: "Próxima semana", n: R.futuras.length, tom: "inf" },
  ];

  const props = { pessoas, clientes, onConcluir: concluir, onAbrir: onAbrirModulo, onReagendar: reagendar, onExcluir: excluir };

  return (
    <section className="ct-card">
      <div className="ct-card-h">
        <div>
          <h3>Tarefas</h3>
          <span className="ct-card-sub">mesmas tarefas do módulo — alterações refletem nos dois</span>
        </div>
        <button className="tf-nova" onClick={() => setModalNova(true)}>+ Nova tarefa</button>
      </div>

      <div className="tf-abas">
        {abas.map((a) => (
          <button key={a.id} className={`tf-aba ${aba === a.id ? "on tf-on-" + a.tom : ""}`} onClick={() => setAba(a.id)}>
            {a.l}<span className="tf-aba-n">{a.n}</span>
          </button>
        ))}
      </div>

      {aba === "atrasadas" && (
        R.atrasadas.length === 0
          ? <p className="ct-vazio">Nenhuma tarefa atrasada. Tudo em dia.</p>
          : <div className="tf-lista">{R.atrasadas.map((t) => <Linha key={t.id} t={t} {...props} />)}</div>
      )}

      {aba === "hoje" && (
        R.deHoje.length === 0
          ? <p className="ct-vazio">Nenhuma tarefa para hoje.</p>
          : <div className="tf-lista">{R.deHoje.map((t) => <Linha key={t.id} t={t} {...props} />)}</div>
      )}

      {aba === "semana" && (
        R.dias.length === 0
          ? <p className="ct-vazio">Nenhuma tarefa planejada para os próximos sete dias.</p>
          : (
            <div className="tf-semana">
              {R.dias.map((d) => (
                <div key={d.data}>
                  <div className="tf-dia">
                    <span>{rotuloDia(d.data)}</span>
                    <em>{d.tarefas.length} tarefa{d.tarefas.length > 1 ? "s" : ""}</em>
                  </div>
                  <div className="tf-lista">{d.tarefas.map((t) => <Linha key={t.id} t={t} {...props} />)}</div>
                </div>
              ))}
            </div>
          )
      )}

      {modalNova && (
        <NovaTarefa clientes={clientes} pessoas={pessoas} usuario={usuario}
          onFechar={() => setModalNova(false)}
          onSalvar={async (t) => { await onSalvar(t); onToast("Tarefa criada"); }} />
      )}
    </section>
  );
}
