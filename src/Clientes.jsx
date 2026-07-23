import { useMemo, useState } from "react";
import { fmtMoeda } from "./utils";
import { Icon } from "./components.jsx";
import {
  projecaoVerba, projecaoCPA, corVerba, corCPA,
  iniciais, corAvatar, competencia, tempoDeCasa, faixaNPS,
} from "./projecao";

/* ===== Avatar com iniciais ===== */
export function Avatar({ nome, size = 44 }) {
  return (
    <div className="cli-avatar" style={{
      width: size, height: size, background: corAvatar(nome),
      fontSize: size * 0.36,
    }}>
      {iniciais(nome)}
    </div>
  );
}

/* ===== Ícones das plataformas ===== */
function Plataformas({ cliente }) {
  const nenhuma = !cliente.platGoogle && !cliente.platMeta;
  return (
    <div className="cli-plats">
      {cliente.platGoogle && (
        <span className="plat plat-google" title="Google Ads">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.2-5.5 4.2-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.9 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12S6.8 21.5 12 21.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"/></svg>
          Google
        </span>
      )}
      {cliente.platMeta && (
        <span className="plat plat-meta" title="Meta Ads">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 6c-2.4 0-4 2.4-5.5 5-1.5-2.6-3.1-5-5.5-5C3.6 6 2 8.9 2 12.3 2 15.4 3.4 18 6.1 18c2 0 3.3-1.4 4.8-3.9l1-1.7c.2-.3.3-.6.5-.9.2.3.4.6.5.9l1 1.7c1.5 2.5 2.8 3.9 4.8 3.9 2.7 0 4.1-2.6 4.1-5.7C22.8 8.9 21.2 6 17.5 6zM7.6 15.7c-1.3 0-2.1-1.6-2.1-3.4 0-2 .9-3.5 2.2-3.5 1.1 0 2 .9 3.3 3-1.3 2.4-2.2 3.9-3.4 3.9zm8.8 0c-1.2 0-2.1-1.5-3.4-3.9 1.3-2.1 2.2-3 3.3-3 1.3 0 2.2 1.5 2.2 3.5 0 1.8-.8 3.4-2.1 3.4z"/></svg>
          Meta
        </span>
      )}
      {nenhuma && <span className="plat plat-off">Sem plataforma</span>}
    </div>
  );
}

/* ===== Barra de projeção ===== */
function BarraProjecao({ titulo, valorTexto, alvoTexto, pct, pctMarca, cor, legenda }) {
  return (
    <div className="proj-bloco">
      <div className="proj-topo">
        <span className="proj-titulo">{titulo}</span>
        <span className="proj-valor" style={{ color: cor }}>{valorTexto}</span>
      </div>
      <div className="proj-trilha">
        <div className="proj-preenchida" style={{ width: `${Math.min(pct, 100)}%`, background: cor }} />
        {pctMarca != null && (
          <div className="proj-marca" style={{ left: `${Math.min(pctMarca, 100)}%` }} title="Esperado até hoje" />
        )}
      </div>
      <div className="proj-legenda">
        <span>{alvoTexto}</span>
        {legenda && <span style={{ color: cor, fontWeight: 600 }}>{legenda}</span>}
      </div>
    </div>
  );
}

/* ===== Card de um cliente ===== */
function CardCliente({ cliente, desemp, onAbrir }) {
  const pv = projecaoVerba(cliente.verbaMensal, desemp?.gasto, new Date());
  const pc = projecaoCPA(cliente.cpaMeta, desemp?.gasto, desemp?.leads);
  const nps = faixaNPS(cliente.nps);

  return (
    <div className="cli-card" onClick={() => onAbrir(cliente)} role="button" tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onAbrir(cliente)}>
      <div className="cli-head">
        <Avatar nome={cliente.nome} />
        <div className="cli-ident">
          <div className="cli-nome">{cliente.nome}</div>
          <Plataformas cliente={cliente} />
        </div>
        {cliente.nps != null && (
          <div className="cli-nps" title={`NPS: ${nps.label}`}>
            <span style={{ color: nps.cor }}>{cliente.nps}</span>
            <small>NPS</small>
          </div>
        )}
      </div>

      <div className="cli-projs">
        {pv ? (
          <BarraProjecao
            titulo="Verba do mês"
            valorTexto={fmtMoeda(pv.gasto)}
            alvoTexto={`de ${fmtMoeda(pv.verba)} · esperado hoje ${fmtMoeda(pv.esperado)}`}
            pct={pv.pctVerba}
            pctMarca={pv.pctEsperado}
            cor={corVerba(pv.status)}
            legenda={pv.desvioPct > 0 ? `+${pv.desvioPct}%` : `${pv.desvioPct}%`}
          />
        ) : (
          <div className="proj-vazia">Verba mensal não definida no cadastro</div>
        )}

        {pc ? (
          pc.status === "sem_dados" ? (
            <div className="proj-vazia">CPA: sem leads lançados neste mês</div>
          ) : (
            <BarraProjecao
              titulo="CPA do mês"
              valorTexto={fmtMoeda(pc.cpaReal)}
              alvoTexto={`alvo ${fmtMoeda(pc.alvo)} · ${desemp?.leads || 0} leads`}
              pct={pc.pct}
              pctMarca={100}
              cor={corCPA(pc.status)}
              legenda={pc.desvioPct > 0 ? `+${pc.desvioPct}%` : `${pc.desvioPct}%`}
            />
          )
        ) : (
          <div className="proj-vazia">CPA alvo não definido no cadastro</div>
        )}
      </div>

      <div className="cli-rodape">
        <span>{cliente.nicho || "sem nicho"}</span>
        <span className="cli-abrir">Ver cliente ›</span>
      </div>
    </div>
  );
}

/* ===== Módulo principal ===== */
export default function Clientes({ clientes, desempenho, onAbrir, onLancar, onToast }) {
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(null);
  const comp = competencia();

  const desempPorCliente = useMemo(() => {
    const m = {};
    (desempenho || []).filter((d) => d.competencia === comp).forEach((d) => { m[d.clienteId] = d; });
    return m;
  }, [desempenho, comp]);

  const lista = useMemo(() => (clientes || [])
    .filter((c) => c.ativo)
    .filter((c) => !busca.trim() || (c.nome || "").toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || "")), [clientes, busca]);

  // resumo: quantos estão estourando a verba
  const estourando = lista.filter((c) => {
    const p = projecaoVerba(c.verbaMensal, desempPorCliente[c.id]?.gasto);
    return p?.status === "acima";
  }).length;
  const cpaCaro = lista.filter((c) => {
    const d = desempPorCliente[c.id];
    const p = projecaoCPA(c.cpaMeta, d?.gasto, d?.leads);
    return p?.status === "acima";
  }).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Clientes</h1>
          <p>Acompanhamento de verba e CPA do mês corrente. Clique num cliente para ver a ficha completa.</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary" onClick={() => setModal({ novo: true })}>
            <Icon.Plus /> Lançar gasto / leads
          </button>
        </div>
      </div>

      <div className="tiles">
        <div className="tile"><div className="label">Clientes ativos</div><div className="value">{lista.length}</div><div className="hint">na carteira</div></div>
        <div className="tile"><div className="label">Verba estourando</div><div className="value" style={{ color: estourando ? "var(--red)" : "inherit" }}>{estourando}</div><div className="hint">acima do ritmo</div></div>
        <div className="tile"><div className="label">CPA acima do alvo</div><div className="value" style={{ color: cpaCaro ? "var(--red)" : "inherit" }}>{cpaCaro}</div><div className="hint">custo caro</div></div>
        <div className="tile"><div className="label">Sem lançamento</div><div className="value">{lista.filter((c) => !desempPorCliente[c.id]).length}</div><div className="hint">neste mês</div></div>
      </div>

      <div className="toolbar">
        <div className="search">
          <Icon.Search />
          <input className="input" placeholder="Buscar cliente…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="card"><div className="empty">
          <h3>Nenhum cliente ativo</h3>
          <p>Ative clientes na aba Cadastros para acompanhá-los aqui.</p>
        </div></div>
      ) : (
        <div className="cli-grid">
          {lista.map((c) => (
            <CardCliente key={c.id} cliente={c} desemp={desempPorCliente[c.id]} onAbrir={onAbrir} />
          ))}
        </div>
      )}

      {modal && (
        <LancamentoModal
          clientes={lista}
          desempPorCliente={desempPorCliente}
          competencia={comp}
          onClose={() => setModal(null)}
          onSalvar={async (d) => { await onLancar(d); onToast("Lançamento salvo"); setModal(null); }}
        />
      )}
    </>
  );
}

/* ===== Modal para lançar gasto e leads do mês ===== */
function LancamentoModal({ clientes, desempPorCliente, competencia, onClose, onSalvar }) {
  const [clienteId, setClienteId] = useState(clientes[0]?.id || "");
  const atual = desempPorCliente[clienteId];
  const [gasto, setGasto] = useState(atual?.gasto ?? "");
  const [leads, setLeads] = useState(atual?.leads ?? "");
  const [salvando, setSalvando] = useState(false);

  function trocarCliente(id) {
    setClienteId(id);
    const d = desempPorCliente[id];
    setGasto(d?.gasto ?? "");
    setLeads(d?.leads ?? "");
  }

  async function salvar() {
    setSalvando(true);
    try {
      await onSalvar({ clienteId, competencia, gasto, leads });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>Lançar gasto e leads do mês</h3>
          <button className="iconbtn" onClick={onClose} aria-label="Fechar"><Icon.X /></button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label>Cliente</label>
            <select className="select" value={clienteId} onChange={(e) => trocarCliente(e.target.value)}>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label>Gasto no mês (R$)</label>
              <input type="number" min="0" step="0.01" className="input" value={gasto}
                onChange={(e) => setGasto(e.target.value)} placeholder="0,00" />
            </div>
            <div className="form-row">
              <label>Leads no mês</label>
              <input type="number" min="0" className="input" value={leads}
                onChange={(e) => setLeads(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
            Referente a {competencia}. Estes números alimentam as barras de verba e CPA.
            Quando a integração com Meta/Google estiver ativa, eles serão preenchidos automaticamente.
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={!clienteId || salvando}>
            {salvando ? "Salvando…" : "Salvar lançamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
