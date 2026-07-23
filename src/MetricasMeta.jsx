import { useEffect, useState } from "react";
import { fmtMoeda } from "./utils";

/* ============================================================
   Métricas da Meta — período flexível + comparação com o
   período anterior de mesma duração + tabela de campanhas.
   ============================================================ */

const fmtNum = (v) =>
  v == null ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const fmtDec = (v, casas = 2) =>
  v == null ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const fmtPct = (v) => (v == null ? "—" : `${fmtDec(v)}%`);

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const diasAtras = (n) => {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const inicioMes = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

/* Definição das métricas exibidas.
   menorMelhor: quando cair é evolução positiva (custos). */
const METRICAS = [
  { chave: "gasto", rotulo: "Valor investido", fmt: fmtMoeda, menorMelhor: null },
  { chave: "alcance", rotulo: "Alcance", fmt: fmtNum, menorMelhor: false },
  { chave: "impressoes", rotulo: "Impressões", fmt: fmtNum, menorMelhor: false },
  { chave: "cpm", rotulo: "CPM médio", fmt: fmtMoeda, menorMelhor: true },
  { chave: "cpc", rotulo: "CPC médio", fmt: fmtMoeda, menorMelhor: true },
  { chave: "ctrLink", rotulo: "CTR (cliques no link)", fmt: fmtPct, menorMelhor: false },
  { chave: "frequencia", rotulo: "Frequência", fmt: (v) => fmtDec(v), menorMelhor: true },
  { chave: "cliquesLink", rotulo: "Cliques no link", fmt: fmtNum, menorMelhor: false },
  { chave: "visualizacoesPagina", rotulo: "Visualizações de página", fmt: fmtNum, menorMelhor: false },
  { chave: "conversas", rotulo: "Conversas iniciadas", fmt: fmtNum, menorMelhor: false },
  { chave: "custoConversa", rotulo: "Custo por conversa", fmt: fmtMoeda, menorMelhor: true },
];

/** Variação % entre atual e anterior; null quando não dá para comparar. */
export function variacaoPct(atual, anterior) {
  if (atual == null || anterior == null || Number(anterior) === 0) return null;
  return ((Number(atual) - Number(anterior)) / Number(anterior)) * 100;
}

/** Cor da variação conforme a direção boa da métrica. */
export function corVariacao(pct, menorMelhor) {
  if (pct == null || menorMelhor == null) return "var(--ink-faint)";
  const melhorou = menorMelhor ? pct < 0 : pct > 0;
  if (Math.abs(pct) < 0.005) return "var(--ink-faint)";
  return melhorou ? "var(--green)" : "var(--red)";
}

function CardMetrica({ def, atual, anterior }) {
  const v = atual?.[def.chave];
  const vAnt = anterior?.[def.chave];
  const pct = variacaoPct(v, vAnt);
  const cor = corVariacao(pct, def.menorMelhor);
  return (
    <div className="mm-card">
      <div className="mm-rotulo">{def.rotulo}</div>
      <div className="mm-valor">{def.fmt(v)}</div>
      <div className="mm-comp">
        {pct != null ? (
          <span className="mm-var" style={{ color: cor }}>
            {pct > 0 ? "▲" : pct < 0 ? "▼" : "•"} {fmtDec(Math.abs(pct), 2)}%
          </span>
        ) : (
          <span className="mm-var" style={{ color: "var(--ink-faint)" }}>—</span>
        )}
        <span className="mm-ant">{def.fmt(vAnt)} no período anterior</span>
      </div>
    </div>
  );
}

const PRESETS = [
  { id: "7d", rotulo: "7 dias", calc: () => ({ since: diasAtras(6), until: hojeISO() }) },
  { id: "14d", rotulo: "14 dias", calc: () => ({ since: diasAtras(13), until: hojeISO() }) },
  { id: "30d", rotulo: "30 dias", calc: () => ({ since: diasAtras(29), until: hojeISO() }) },
  { id: "mes", rotulo: "Este mês", calc: () => ({ since: inicioMes(), until: hojeISO() }) },
];

export default function MetricasMeta({ cliente, onBuscar, onToast }) {
  const [preset, setPreset] = useState("7d");
  const [de, setDe] = useState(diasAtras(6));
  const [ate, setAte] = useState(hojeISO());
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function buscar(since, until) {
    if (!cliente.metaAdAccountId) return;
    setCarregando(true); setErro("");
    try {
      const r = await onBuscar(cliente.id, since, until);
      setDados(r);
    } catch (e) {
      setErro(e.message || "Falha ao buscar métricas na Meta");
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }

  // carrega automaticamente ao abrir (últimos 7 dias)
  useEffect(() => {
    if (cliente.metaAdAccountId) buscar(de, ate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente.id, cliente.metaAdAccountId]);

  function aplicarPreset(p) {
    setPreset(p.id);
    const { since, until } = p.calc();
    setDe(since); setAte(until);
    buscar(since, until);
  }

  function aplicarPersonalizado() {
    if (!de || !ate) return;
    if (de > ate) { onToast("A data inicial não pode ser depois da final"); return; }
    setPreset("custom");
    buscar(de, ate);
  }

  if (!cliente.metaAdAccountId) {
    return (
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <h3 className="dash-title" style={{ margin: 0 }}>Métricas da Meta</h3>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-soft)" }}>
          Vincule uma conta de anúncio (no card acima) para ver as métricas das campanhas aqui.
        </p>
      </div>
    );
  }

  const fmtDataBR = (iso) => iso ? iso.split("-").reverse().join("/") : "";

  return (
    <div className="card card-pad" style={{ marginBottom: 20 }}>
      <div className="mm-head">
        <h3 className="dash-title" style={{ margin: 0 }}>Métricas da Meta</h3>
        <div className="mm-filtros">
          {PRESETS.map((p) => (
            <button key={p.id} className={`btn btn-sm ${preset === p.id ? "btn-primary" : ""}`} onClick={() => aplicarPreset(p)}>
              {p.rotulo}
            </button>
          ))}
          <div className="mm-datas">
            <input type="date" className="input" value={de} onChange={(e) => setDe(e.target.value)} />
            <span>até</span>
            <input type="date" className="input" value={ate} onChange={(e) => setAte(e.target.value)} />
            <button className="btn btn-sm" onClick={aplicarPersonalizado}>Aplicar</button>
          </div>
        </div>
      </div>

      {dados?.periodoAnterior && (
        <p className="mm-legenda">
          Comparando com o período anterior de mesma duração
          ({fmtDataBR(dados.periodoAnterior.since)} a {fmtDataBR(dados.periodoAnterior.until)}).
          Verde = evolução positiva; vermelho = negativa.
        </p>
      )}

      {erro && <div className="login-erro" style={{ marginTop: 10 }}>{erro}</div>}
      {carregando && <div className="mm-carregando">Buscando métricas na Meta…</div>}

      {!carregando && dados && (
        <>
          <div className="mm-grid">
            {METRICAS.map((def) => (
              <CardMetrica key={def.chave} def={def} atual={dados.atual} anterior={dados.anterior} />
            ))}
          </div>

          <h4 className="mm-sub">Campanhas no período</h4>
          {(dados.campanhas || []).length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-faint)" }}>Nenhuma campanha com dados neste período.</p>
          ) : (
            <div className="table-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th>Campanha</th><th>Resultados</th><th>Custo/resultado</th><th>Investido</th>
                    <th>CTR link</th><th>CPC</th><th>CPM</th><th>Alcance</th><th>Impressões</th><th>Freq.</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.campanhas.map((c, i) => (
                    <tr key={i}>
                      <td className="cell-cliente">{c.campanha}</td>
                      <td className="cell-num">{fmtNum(c.resultados)}</td>
                      <td className="cell-num">{c.custoResultado != null ? fmtMoeda(c.custoResultado) : "—"}</td>
                      <td className="cell-num">{fmtMoeda(c.gasto)}</td>
                      <td className="cell-num">{fmtPct(c.ctrLink)}</td>
                      <td className="cell-num">{c.cpc != null ? fmtMoeda(c.cpc) : "—"}</td>
                      <td className="cell-num">{c.cpm != null ? fmtMoeda(c.cpm) : "—"}</td>
                      <td className="cell-num">{fmtNum(c.alcance)}</td>
                      <td className="cell-num">{fmtNum(c.impressoes)}</td>
                      <td className="cell-num">{fmtDec(c.frequencia)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
