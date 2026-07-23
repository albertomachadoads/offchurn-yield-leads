import { useMemo, useState } from "react";
import { fmtMoeda, fmtData } from "./utils";
import { Icon } from "./components.jsx";
import { Avatar } from "./Clientes.jsx";
import MetricasMeta from "./MetricasMeta.jsx";
import FunilCliente from "./FunilCliente.jsx";
import {
  projecaoVerba, projecaoCPA, corVerba, corCPA,
  tempoDeCasa, faixaNPS, competencia,
} from "./projecao";
import { calcTaxas, corTaxa } from "./taxas";

function Info({ label, valor, cor }) {
  return (
    <div className="info-item">
      <span className="info-label">{label}</span>
      <span className="info-valor" style={cor ? { color: cor } : undefined}>{valor ?? "—"}</span>
    </div>
  );
}

export default function ClienteDetalhe({
  cliente, gestById, desempenho, tarefas, pessoas, painel, acompanhamentos, onVoltar, onEditar, isAdmin,
  onListarContasMeta, onVincularConta, onSincronizarCliente, onBuscarInsights, funil, onSalvarFunil, onToast,
}) {
  const comp = competencia();
  const [contasMeta, setContasMeta] = useState(null); // null = ainda não buscou
  const [buscandoContas, setBuscandoContas] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);

  async function carregarContas() {
    setBuscandoContas(true);
    try {
      const lista = await onListarContasMeta();
      setContasMeta(lista);
    } catch (e) {
      onToast("Erro ao buscar contas: " + (e.message || "falha"));
      setContasMeta([]);
    } finally {
      setBuscandoContas(false);
    }
  }

  async function vincular(contaId) {
    try {
      await onVincularConta(contaId || null);
      onToast(contaId ? "Conta vinculada" : "Vínculo removido");
    } catch (e) {
      onToast("Erro: " + (e.message || "falha"));
    }
  }

  async function sincronizar() {
    setSincronizando(true);
    try {
      const r = await onSincronizarCliente();
      const item = (r?.resultados || [])[0];
      if (item?.ok) {
        onToast(`Sincronizado: ${fmtMoeda(item.gasto)} gastos, ${item.leads} resultados`);
      } else {
        onToast("Falha: " + (item?.erro || "sem retorno da Meta"));
      }
    } catch (e) {
      onToast("Erro na sincronização: " + (e.message || "falha"));
    } finally {
      setSincronizando(false);
    }
  }
  const desemp = useMemo(
    () => (desempenho || []).find((d) => d.clienteId === cliente.id && d.competencia === comp),
    [desempenho, cliente.id, comp]
  );

  const pv = projecaoVerba(cliente.verbaMensal, desemp?.gasto);
  const pc = projecaoCPA(cliente.cpaMeta, desemp?.gasto, desemp?.leads, 10, desemp?.cpaReal);
  const nps = faixaNPS(cliente.nps);
  const tempo = tempoDeCasa(cliente.dataEntrada);

  const pesById = useMemo(() => Object.fromEntries((pessoas || []).map((p) => [p.id, p])), [pessoas]);

  const tarefasCliente = useMemo(
    () => (tarefas || [])
      .filter((t) => t.clienteId === cliente.id)
      .sort((a, b) => ((b.dataCriacao || b.data) < (a.dataCriacao || a.data) ? -1 : 1)),
    [tarefas, cliente.id]
  );

  const registroPainel = useMemo(
    () => (painel || []).find((p) => p.clienteId === cliente.id),
    [painel, cliente.id]
  );
  const taxas = registroPainel ? calcTaxas(registroPainel) : null;

  const acompCliente = useMemo(
    () => (acompanhamentos || [])
      .filter((a) => a.clienteId === cliente.id)
      .sort((a, b) => (a.data < b.data ? 1 : -1)),
    [acompanhamentos, cliente.id]
  );

  const abertas = tarefasCliente.filter((t) => t.etapa !== "Concluída" && t.etapa !== "Cancelada").length;

  // aba ativa da página do cliente
  const [aba, setAba] = useState("dashboard");

  // tarefas atrasadas: etapa "Atrasada" OU prazo vencido sem conclusão
  const hojeISO = (() => { const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const atrasadas = tarefasCliente.filter((t) => {
    if (t.etapa === "Concluída" || t.etapa === "Cancelada") return false;
    if (t.etapa === "Atrasada") return true;
    return t.prazo && String(t.prazo).split("T")[0] < hojeISO;
  });

  return (
    <>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button className="btn btn-sm btn-ghost" onClick={onVoltar}>‹ Voltar</button>
          <Avatar nome={cliente.nome} size={52} />
          <div>
            <h1 style={{ margin: 0 }}>{cliente.nome}</h1>
            <p style={{ margin: 0 }}>
              {cliente.nicho || "sem nicho"}
              {tempo && <> · na agência há {tempo}</>}
              {!cliente.ativo && <> · <span className="pill off">Inativo</span></>}
            </p>
          </div>
        </div>
        <div className="head-actions">
          {cliente.linkDrive && (
            <a className="btn" href={cliente.linkDrive} target="_blank" rel="noopener noreferrer">
              <Icon.Folder /> Drive do cliente
            </a>
          )}
          {isAdmin && <button className="btn btn-primary" onClick={() => onEditar(cliente)}><Icon.Edit /> Editar cadastro</button>}
        </div>
      </div>

      {atrasadas.length > 0 && (
        <div className="alerta-atraso">
          <span className="alerta-ico">!</span>
          <span>
            <strong>{atrasadas.length} tarefa{atrasadas.length > 1 ? "s" : ""} atrasada{atrasadas.length > 1 ? "s" : ""}</strong> para este cliente.
          </span>
          <button className="btn btn-sm" onClick={() => setAba("tarefas")}>Ver tarefas</button>
        </div>
      )}

      {/* indicadores do mês */}
      <div className="tiles">
        <div className="tile">
          <div className="label">Verba do mês</div>
          <div className="value" style={{ fontSize: 20, color: pv ? corVerba(pv.status) : "inherit" }}>
            {pv ? fmtMoeda(pv.gasto) : "—"}
          </div>
          <div className="hint">{pv ? `de ${fmtMoeda(pv.verba)} · esperado ${fmtMoeda(pv.esperado)}` : "verba não definida"}</div>
        </div>
        <div className="tile">
          <div className="label">CPA do mês</div>
          <div className="value" style={{ fontSize: 20, color: pc && pc.cpaReal != null ? corCPA(pc.status) : "inherit" }}>
            {pc && pc.cpaReal != null ? fmtMoeda(pc.cpaReal) : "—"}
          </div>
          <div className="hint">{pc ? `alvo ${fmtMoeda(pc.alvo)}` : "CPA alvo não definido"}</div>
        </div>
        <div className="tile">
          <div className="label">NPS</div>
          <div className="value" style={{ color: nps.cor }}>{cliente.nps ?? "—"}</div>
          <div className="hint">{nps.label}</div>
        </div>
        <div className="tile">
          <div className="label">Tarefas abertas</div>
          <div className="value">{abertas}</div>
          <div className="hint">de {tarefasCliente.length} no total</div>
        </div>
      </div>

      {/* abas da página do cliente */}
      <div className="det-abas">
        <button className={aba === "dashboard" ? "on" : ""} onClick={() => setAba("dashboard")}>Dashboard</button>
        <button className={aba === "tarefas" ? "on" : ""} onClick={() => setAba("tarefas")}>
          Tarefas {atrasadas.length > 0 && <span className="aba-alerta">{atrasadas.length}</span>}
        </button>
        {isAdmin && (
          <button className={aba === "cadastro" ? "on" : ""} onClick={() => setAba("cadastro")}>Dados de cadastro</button>
        )}
      </div>

      {aba === "dashboard" && (<>
      {/* integração Meta deste cliente */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h3 className="dash-title" style={{ margin: 0 }}>Integração Meta</h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-soft)" }}>
              {cliente.metaAdAccountId
                ? <>Conta vinculada: <strong>{cliente.metaAdAccountId}</strong></>
                : "Nenhuma conta de anúncio vinculada a este cliente."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {contasMeta === null ? (
              <button className="btn btn-sm" onClick={carregarContas} disabled={buscandoContas}>
                {buscandoContas ? "Buscando…" : (cliente.metaAdAccountId ? "Trocar conta" : "Conectar conta")}
              </button>
            ) : (
              <select
                className="select" style={{ maxWidth: 260 }}
                value={cliente.metaAdAccountId || ""}
                onChange={(e) => vincular(e.target.value)}
              >
                <option value="">— sem vínculo —</option>
                {contasMeta.map((ct) => (
                  <option key={ct.id} value={ct.id}>{ct.nome} ({ct.id})</option>
                ))}
              </select>
            )}
            <button className="btn btn-sm btn-primary" onClick={sincronizar}
              disabled={sincronizando || !cliente.metaAdAccountId}
              title={!cliente.metaAdAccountId ? "Vincule uma conta primeiro" : ""}>
              {sincronizando ? "Sincronizando…" : "↻ Sincronizar dados"}
            </button>
          </div>
        </div>

      </div>

      <MetricasMeta cliente={cliente} onBuscar={onBuscarInsights} onToast={onToast} />

      <FunilCliente cliente={cliente} funil={funil} onSalvar={onSalvarFunil} onToast={onToast} />

      {/* Dashboards: funis por plataforma, visão mensal */}
      <DashboardsFunil cliente={cliente} funil={funil} />

      {/* últimos acompanhamentos */}
      <h3 className="dash-title" style={{ marginTop: 22 }}>Últimos acompanhamentos</h3>
      {acompCliente.length === 0 ? (
        <div className="card"><div className="empty"><p>Nenhum acompanhamento registrado.</p></div></div>
      ) : (
        <div className="card acomp-scroll">
          {acompCliente.map((a) => (
            <div className="list-row" key={a.id}>
              <div>
                <div className="lr-meta">{fmtData(a.data)}</div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 3 }}>{a.acompanhamento || "—"}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      </>)}

      {aba === "cadastro" && isAdmin && (
        <div className="card card-pad">
          <h3 className="dash-title">Dados de cadastro</h3>
          <div className="info-grid">
            <Info label="Gestor responsável" valor={gestById?.[cliente.responsavelId]?.nome} />
            <Info label="Nicho" valor={cliente.nicho} />
            <Info label="Objetivo" valor={cliente.objetivo} />
            <Info label="Entrada" valor={cliente.dataEntrada ? fmtData(cliente.dataEntrada) : null} />
            <Info label="Saída prevista" valor={cliente.dataSaidaPrevista ? fmtData(cliente.dataSaidaPrevista) : null} />
            <Info label="Ticket" valor={cliente.ticket ? fmtMoeda(cliente.ticket) : null} />
            <Info label="Recorrência" valor={cliente.ticket ? (cliente.recorrencia === "Único" ? "Pagamento único" : `Mensal · dia ${cliente.diaPagamento || "?"}`) : null} />
            <Info label="Verba mensal" valor={cliente.verbaMensal ? fmtMoeda(cliente.verbaMensal) : null} />
            <Info label="CPA alvo" valor={cliente.cpaMeta ? fmtMoeda(cliente.cpaMeta) : null} />
            <Info label="Plataformas" valor={[cliente.platGoogle && "Google", cliente.platMeta && "Meta"].filter(Boolean).join(" · ") || null} />
            <Info label="Conta Meta vinculada" valor={cliente.metaAdAccountId} />
          </div>
        </div>
      )}

      {aba === "tarefas" && (<>
      <h3 className="dash-title" style={{ marginTop: 4 }}>Tarefas ({tarefasCliente.length})</h3>
      {tarefasCliente.length === 0 ? (
        <div className="card"><div className="empty"><p>Nenhuma tarefa criada para este cliente.</p></div></div>
      ) : (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr><th>Criação</th><th>Ação</th><th>Responsável</th><th>Etapa</th><th>Prazo</th><th>Conclusão</th></tr>
            </thead>
            <tbody>
              {tarefasCliente.map((t) => (
                <tr key={t.id}>
                  <td className="cell-num">{fmtData(t.dataCriacao || t.data)}</td>
                  <td className="cell-acomp">{t.acao || "—"}</td>
                  <td>{pesById[t.responsavelId]?.nome || "—"}</td>
                  <td><span className="etapa-badge" style={{ "--c": "var(--green)" }}><span className="dot" /> {t.etapa}</span></td>
                  <td className="cell-num">{t.prazo ? fmtData(t.prazo) : "—"}</td>
                  <td className="cell-num">{t.dataConclusao ? fmtData(t.dataConclusao) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>)}
    </>
  );
}


/* ============================================================
   Dashboards — gráfico de funil por plataforma, visão mensal.
   Usa os dados salvos no Painel de Qualificação (funil_mensal).
   ============================================================ */
function GraficoFunil({ titulo, classe, captados, qualificados, vendidos }) {
  const max = Math.max(1, Number(captados) || 0);
  const etapas = [
    { rotulo: "Total de leads", valor: Number(captados) || 0 },
    { rotulo: "Qualificados", valor: Number(qualificados) || 0 },
    { rotulo: "Fechados", valor: Number(vendidos) || 0 },
  ];
  const t = calcTaxas({ captados, qualificados, fechados: vendidos });
  const vazio = etapas.every((e) => e.valor === 0);
  return (
    <div className="funilg">
      <div className={`funil-plat ${classe}`}>{titulo}</div>
      {vazio ? (
        <div className="proj-vazia" style={{ marginTop: 10 }}>Sem lançamentos neste mês.</div>
      ) : (
        <>
          <div className="funilg-barras">
            {etapas.map((e, i) => (
              <div className="funilg-linha" key={e.rotulo}>
                <span className="funilg-rotulo">{e.rotulo}</span>
                <div className="funilg-trilha">
                  <div className={`funilg-barra n${i}`} style={{ width: `${Math.max((e.valor / max) * 100, e.valor > 0 ? 6 : 0)}%` }}>
                    <span>{e.valor.toLocaleString("pt-BR")}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="funil-taxas" style={{ marginTop: 10 }}>
            <span>Qualificação: <strong style={{ color: corTaxa(t.qualificacao) }}>{t.qualificacao != null ? `${t.qualificacao}%` : "—"}</strong></span>
            <span>Fechamento: <strong style={{ color: corTaxa(t.fechamento) }}>{t.fechamento != null ? `${t.fechamento}%` : "—"}</strong></span>
            <span>Conversão: <strong style={{ color: corTaxa(t.conversao) }}>{t.conversao != null ? `${t.conversao}%` : "—"}</strong></span>
          </div>
        </>
      )}
    </div>
  );
}

function DashboardsFunil({ cliente, funil }) {
  const compAtual = (() => { const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
  const [comp, setComp] = useState(compAtual);

  if ((cliente.objetivo || "Lead") !== "Lead") return null; // funil de leads só para objetivo Lead

  const daComp = (plat) =>
    (funil || []).find((f) => f.clienteId === cliente.id && f.competencia === comp && f.plataforma === plat) || {};

  const meta = daComp("Meta");
  const google = daComp("Google");

  return (
    <div className="card card-pad" style={{ marginBottom: 20 }}>
      <div className="mm-head">
        <h3 className="dash-title" style={{ margin: 0 }}>Dashboards</h3>
        <input type="month" className="input" style={{ width: "auto" }} value={comp} onChange={(e) => setComp(e.target.value)} />
      </div>
      <div className="funil-grid">
        <GraficoFunil titulo="Meta" classe="plat-meta"
          captados={meta.captados} qualificados={meta.qualificados} vendidos={meta.vendidos} />
        <GraficoFunil titulo="Google" classe="plat-google"
          captados={google.captados} qualificados={google.qualificados} vendidos={google.vendidos} />
      </div>
    </div>
  );
}
