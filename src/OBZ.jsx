import { useMemo, useState } from "react";
import { fmtMoeda } from "./utils";
import { Icon, Modal } from "./components.jsx";

/* ============================================================
   OBZ — Orçamento Base Zero
   Centros de custo, despesas com scores, dashboards financeiros.
   ============================================================ */

const CENTROS = [
  { id: "operacao", nome: "Operação", desc: "Gestores de tráfego, designers, copywriters, analistas" },
  { id: "comercial", nome: "Comercial", desc: "SDR, closer, comissão, CRM, prospecção" },
  { id: "marketing", nome: "Marketing", desc: "Tráfego da agência, conteúdo, eventos, produção" },
  { id: "tecnologia", nome: "Tecnologia", desc: "Reportei, Tintim, Canva, ClickUp, automações, IA" },
  { id: "administrativo", nome: "Administrativo", desc: "Contabilidade, jurídico, banco, escritório" },
  { id: "gestao", nome: "Gestão", desc: "Pró-labore, consultorias, treinamentos" },
  { id: "impostos", nome: "Impostos", desc: "Simples Nacional, taxas e encargos" },
  { id: "reserva", nome: "Reserva", desc: "Caixa, férias, rescisões, inadimplência" },
  { id: "crescimento", nome: "Projetos de crescimento", desc: "Novas contratações, produtos digitais, expansão" },
];

const TIPOS = ["Fixa", "Variável", "Pontual", "Investimento"];
const RECORRENCIAS = ["Mensal", "Semanal", "Quinzenal", "Trimestral", "Anual", "Única"];

const corScore = (v) => v <= 2 ? "var(--green)" : v <= 3 ? "var(--amber, #e6a817)" : "var(--red)";
const dots = (v, max = 5) => Array.from({ length: max }, (_, i) => (
  <span key={i} style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%",
    background: i < v ? corScore(v) : "var(--gray-soft)", marginRight: 2 }} />
));

function ScoreCell({ valor }) {
  return <td className="cell-num">{dots(valor)}</td>;
}

/* ---- Modal de despesa ---- */
function DespesaModal({ base, onSave, onClose }) {
  const [f, setF] = useState(() => ({
    id: base?.id || null,
    nome: base?.nome || "",
    centroCusto: base?.centroCusto || CENTROS[0].id,
    fornecedor: base?.fornecedor || "",
    tipo: base?.tipo || TIPOS[0],
    valor: base?.valor ?? "",
    recorrencia: base?.recorrencia || "Mensal",
    criticidade: base?.criticidade ?? 3,
    impactoReceita: base?.impactoReceita ?? 3,
    riscoCorte: base?.riscoCorte ?? 3,
    dataPagamento: base?.dataPagamento || "",
    responsavel: base?.responsavel || "",
    observacao: base?.observacao || "",
    ativo: base?.ativo ?? true,
  }));
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const valido = f.nome.trim() && f.fornecedor.trim() && Number(f.valor) > 0;
  return (
    <Modal title={f.id ? "Editar despesa" : "Nova despesa"} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => valido && onSave(f)} disabled={!valido}>Salvar</button>
      </>}>
      <div className="form-grid">
        <div className="form-row">
          <label>Nome da despesa *</label>
          <input className="input" value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Canva Pro" autoFocus />
        </div>
        <div className="form-row">
          <label>Centro de custo *</label>
          <select className="select" value={f.centroCusto} onChange={(e) => set("centroCusto", e.target.value)}>
            {CENTROS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      </div>
      <div className="form-grid">
        <div className="form-row">
          <label>Fornecedor *</label>
          <input className="input" value={f.fornecedor} onChange={(e) => set("fornecedor", e.target.value)} placeholder="Ex.: Canva Inc." />
        </div>
        <div className="form-row">
          <label>Tipo</label>
          <select className="select" value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="form-grid">
        <div className="form-row">
          <label>Valor (R$) *</label>
          <input className="input" type="number" min="0" step="0.01" value={f.valor} onChange={(e) => set("valor", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Recorrência</label>
          <select className="select" value={f.recorrencia} onChange={(e) => set("recorrencia", e.target.value)}>
            {RECORRENCIAS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
      <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div className="form-row">
          <label>Criticidade (1-5)</label>
          <input className="input" type="number" min="1" max="5" value={f.criticidade} onChange={(e) => set("criticidade", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Impacto em receita (1-5)</label>
          <input className="input" type="number" min="1" max="5" value={f.impactoReceita} onChange={(e) => set("impactoReceita", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Risco de corte (1-5)</label>
          <input className="input" type="number" min="1" max="5" value={f.riscoCorte} onChange={(e) => set("riscoCorte", e.target.value)} />
        </div>
      </div>
      <div className="form-grid">
        <div className="form-row">
          <label>Data de pagamento</label>
          <input className="input" type="date" value={f.dataPagamento} onChange={(e) => set("dataPagamento", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Responsável</label>
          <input className="input" value={f.responsavel} onChange={(e) => set("responsavel", e.target.value)} placeholder="Quem aprova/paga" />
        </div>
      </div>
      <div className="form-row">
        <label>Observação</label>
        <textarea className="input" rows={2} value={f.observacao} onChange={(e) => set("observacao", e.target.value)} />
      </div>
    </Modal>
  );
}

/* ---- Entradas (receita dos clientes) ---- */
function SecaoEntradas({ clientes, recebiveis }) {
  const comp = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; })();
  const ativos = clientes.filter((c) => c.ativo && c.ticket > 0);
  const recMap = Object.fromEntries((recebiveis || []).map((r) => [`${r.clienteId}_${r.competencia}`, r]));

  let previsto = 0, recebido = 0, pendente = 0, inadimplentes = 0;
  const linhas = ativos.map((c) => {
    const val = Number(c.ticket) || 0;
    previsto += val;
    const rec = recMap[`${c.id}_${comp}`];
    const pago = rec?.recebido || false;
    if (pago) recebido += val; else pendente += val;
    const hoje = new Date();
    const dia = c.diaPagamento || 10;
    const venceu = hoje.getDate() > dia && !pago;
    if (venceu) inadimplentes++;
    return { ...c, valor: val, pago, venceu };
  }).sort((a, b) => (a.pago === b.pago ? 0 : a.pago ? 1 : -1));

  return (
    <div className="card card-pad" style={{ marginTop: 20 }}>
      <h3 className="dash-title" style={{ margin: "0 0 12px" }}>Entradas — {comp}</h3>
      <div className="tiles" style={{ marginBottom: 14 }}>
        <div className="tile"><div className="label">Previsto</div><div className="value">{fmtMoeda(previsto)}</div><div className="hint">{ativos.length} clientes</div></div>
        <div className="tile"><div className="label">Recebido</div><div className="value" style={{ color: "var(--green)" }}>{fmtMoeda(recebido)}</div></div>
        <div className="tile"><div className="label">Pendente</div><div className="value" style={{ color: pendente > 0 ? "var(--amber, #e6a817)" : "inherit" }}>{fmtMoeda(pendente)}</div></div>
        <div className="tile"><div className="label">Inadimplentes</div><div className="value" style={{ color: inadimplentes > 0 ? "var(--red)" : "inherit" }}>{inadimplentes}</div></div>
      </div>
      <div className="table-wrap">
        <table className="grid">
          <thead><tr><th>Cliente</th><th>Valor</th><th>Dia pgto</th><th>Status</th></tr></thead>
          <tbody>
            {linhas.map((c) => (
              <tr key={c.id}>
                <td className="cell-cliente">{c.nome}</td>
                <td className="cell-num">{fmtMoeda(c.valor)}</td>
                <td className="cell-num">Dia {c.diaPagamento || "?"}</td>
                <td>
                  {c.pago ? <span className="pill done">Recebido</span>
                    : c.venceu ? <span className="pill off">Inadimplente</span>
                    : <span className="pill">Pendente</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---- Componente principal ---- */
export default function OBZ({ despesas, clientes, recebiveis, onSave, onDelete, onToast }) {
  const [modal, setModal] = useState(null);
  const [filtro, setFiltro] = useState("todos");

  const porCentro = useMemo(() => {
    const m = {};
    CENTROS.forEach((c) => { m[c.id] = { ...c, total: 0, qtd: 0, items: [] }; });
    (despesas || []).filter((d) => d.ativo).forEach((d) => {
      const cc = m[d.centroCusto] || m[CENTROS[0].id];
      cc.total += d.valor; cc.qtd++; cc.items.push(d);
    });
    return m;
  }, [despesas]);

  const totalGeral = Object.values(porCentro).reduce((s, c) => s + c.total, 0);

  const filtradas = useMemo(() => {
    const lista = (despesas || []).filter((d) => d.ativo);
    if (filtro === "todos") return lista;
    return lista.filter((d) => d.centroCusto === filtro);
  }, [despesas, filtro]);

  async function salvar(d) {
    try { await onSave(d); setModal(null); onToast("Despesa salva"); }
    catch (e) { onToast("Erro: " + (e.message || "falha")); }
  }
  async function excluir(id) {
    if (!confirm("Excluir esta despesa?")) return;
    try { await onDelete(id); onToast("Despesa excluída"); }
    catch (e) { onToast("Erro: " + (e.message || "falha")); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>OBZ — Orçamento Base Zero</h1>
          <p>Gestão financeira da agência. Cada real gasto precisa ser justificado.</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setModal({ novo: true })}>
            <Icon.Plus /> Nova despesa
          </button>
        </div>
      </div>

      {/* Dashboard por centro de custo */}
      <div className="obz-grid">
        {CENTROS.map((c) => {
          const cc = porCentro[c.id];
          const pct = totalGeral > 0 ? (cc.total / totalGeral * 100) : 0;
          return (
            <div key={c.id} className={`obz-card ${filtro === c.id ? "obz-ativo" : ""}`}
              onClick={() => setFiltro(filtro === c.id ? "todos" : c.id)} style={{ cursor: "pointer" }}>
              <div className="obz-card-nome">{c.nome}</div>
              <div className="obz-card-valor">{fmtMoeda(cc.total)}</div>
              <div className="obz-card-pct">{pct.toFixed(1)}% do total</div>
              <div className="obz-card-barra">
                <div style={{ width: `${Math.min(pct, 100)}%`, background: "var(--green)", height: "100%", borderRadius: 3 }} />
              </div>
              <div className="obz-card-desc">{c.desc}</div>
              <div className="obz-card-qtd">{cc.qtd} despesa{cc.qtd !== 1 ? "s" : ""}</div>
            </div>
          );
        })}
      </div>

      {/* Resumo */}
      <div className="tiles" style={{ marginTop: 20 }}>
        <div className="tile"><div className="label">Total de saídas</div><div className="value">{fmtMoeda(totalGeral)}</div><div className="hint">{filtradas.length} despesas ativas</div></div>
        <div className="tile"><div className="label">Maior centro</div><div className="value" style={{ fontSize: 16 }}>{Object.values(porCentro).sort((a, b) => b.total - a.total)[0]?.nome || "—"}</div></div>
        <div className="tile"><div className="label">Criticidade média</div><div className="value">{filtradas.length > 0 ? (filtradas.reduce((s, d) => s + d.criticidade, 0) / filtradas.length).toFixed(1) : "—"}</div></div>
        <div className="tile"><div className="label">Risco de corte médio</div><div className="value">{filtradas.length > 0 ? (filtradas.reduce((s, d) => s + d.riscoCorte, 0) / filtradas.length).toFixed(1) : "—"}</div></div>
      </div>

      {/* Tabela de despesas */}
      <div className="card card-pad" style={{ marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 className="dash-title" style={{ margin: 0 }}>
            {filtro === "todos" ? "Todas as despesas" : `Despesas — ${CENTROS.find((c) => c.id === filtro)?.nome}`}
          </h3>
          {filtro !== "todos" && <button className="btn btn-sm btn-ghost" onClick={() => setFiltro("todos")}>Ver todas</button>}
        </div>
        {filtradas.length === 0 ? (
          <div className="empty"><p>Nenhuma despesa {filtro !== "todos" ? "neste centro de custo" : "cadastrada"}.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th>Nome</th><th>Centro</th><th>Fornecedor</th><th>Tipo</th><th>Valor</th>
                  <th>Recorr.</th><th>Crit.</th><th>Impacto</th><th>Risco</th><th>Pgto</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.sort((a, b) => b.valor - a.valor).map((d) => (
                  <tr key={d.id}>
                    <td className="cell-cliente">{d.nome}</td>
                    <td><span className="pill">{CENTROS.find((c) => c.id === d.centroCusto)?.nome || d.centroCusto}</span></td>
                    <td>{d.fornecedor}</td>
                    <td>{d.tipo}</td>
                    <td className="cell-num" style={{ fontWeight: 700 }}>{fmtMoeda(d.valor)}</td>
                    <td>{d.recorrencia}</td>
                    <ScoreCell valor={d.criticidade} />
                    <ScoreCell valor={d.impactoReceita} />
                    <ScoreCell valor={d.riscoCorte} />
                    <td className="cell-num">{d.dataPagamento || "—"}</td>
                    <td>
                      <button className="iconbtn" onClick={() => setModal(d)} aria-label="Editar"><Icon.Edit /></button>
                      <button className="iconbtn" onClick={() => excluir(d.id)} aria-label="Excluir"><Icon.Trash /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Entradas */}
      <SecaoEntradas clientes={clientes} recebiveis={recebiveis} />

      {modal && <DespesaModal base={modal} onSave={salvar} onClose={() => setModal(null)} />}
    </>
  );
}
