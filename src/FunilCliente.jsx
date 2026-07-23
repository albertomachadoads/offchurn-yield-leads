import { useMemo, useState } from "react";
import { fmtMoeda } from "./utils";
import { calcTaxas, corTaxa } from "./taxas";

/* ============================================================
   Painel de Qualificação — dentro da página do cliente.
   Preenchimento mês a mês, por plataforma (Meta / Google).
   O que aparece depende do OBJETIVO do cliente (cadastro):
     - Lead: captados, qualificados, vendidos + taxas
     - Faturamento: vendas, VGV, custo + ROAS
     - Não metrificado: painel em branco
   ============================================================ */

const PLATAFORMAS = ["Meta", "Google"];

const compAtualISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const rotuloComp = (comp) => {
  if (!comp) return "";
  const [y, m] = comp.split("-");
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${nomes[Number(m) - 1]}/${y}`;
};

const fmtNum = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR"));
const pctTxt = (v) => (v == null ? "—" : `${v}%`);

/** ROAS = VGV / custo (null sem custo). */
export function calcROAS(vgv, custo) {
  const v = Number(vgv) || 0, c = Number(custo) || 0;
  if (c <= 0) return null;
  return v / c;
}

function CampoNum({ label, valor, onChange, moeda }) {
  return (
    <div className="form-row">
      <label>{label}</label>
      <input
        type="number" min="0" step={moeda ? "0.01" : "1"} className="input input-num"
        style={{ width: "100%", textAlign: "left" }}
        value={valor} placeholder="0"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/* ---- coluna de uma plataforma (objetivo Lead) ---- */
function ColunaLead({ plataforma, dados, onSet }) {
  const taxas = calcTaxas({ captados: dados.captados, qualificados: dados.qualificados, fechados: dados.vendidos });
  return (
    <div className="funil-col">
      <div className={`funil-plat ${plataforma === "Meta" ? "plat-meta" : "plat-google"}`}>{plataforma}</div>
      <CampoNum label="Leads captados" valor={dados.captados} onChange={(v) => onSet("captados", v)} />
      <CampoNum label="Leads qualificados" valor={dados.qualificados} onChange={(v) => onSet("qualificados", v)} />
      <CampoNum label="Leads vendidos" valor={dados.vendidos} onChange={(v) => onSet("vendidos", v)} />
      <div className="funil-taxas">
        <span>Qualificação: <strong style={{ color: corTaxa(taxas.qualificacao) }}>{pctTxt(taxas.qualificacao)}</strong></span>
        <span>Fechamento: <strong style={{ color: corTaxa(taxas.fechamento) }}>{pctTxt(taxas.fechamento)}</strong></span>
        <span>Conversão: <strong style={{ color: corTaxa(taxas.conversao) }}>{pctTxt(taxas.conversao)}</strong></span>
      </div>
    </div>
  );
}

/* ---- coluna de uma plataforma (objetivo Faturamento) ---- */
function ColunaFaturamento({ plataforma, dados, onSet }) {
  const roas = calcROAS(dados.vgv, dados.custo);
  return (
    <div className="funil-col">
      <div className={`funil-plat ${plataforma === "Meta" ? "plat-meta" : "plat-google"}`}>{plataforma}</div>
      <CampoNum label="Quantidade de vendas" valor={dados.vendas} onChange={(v) => onSet("vendas", v)} />
      <CampoNum label="VGV das vendas (R$)" valor={dados.vgv} onChange={(v) => onSet("vgv", v)} moeda />
      <CampoNum label="Custo com anúncios (R$)" valor={dados.custo} onChange={(v) => onSet("custo", v)} moeda />
      <div className="funil-taxas">
        <span>ROAS: <strong style={{ color: roas == null ? "var(--ink-faint)" : roas >= 1 ? "var(--green)" : "var(--red)" }}>
          {roas == null ? "—" : `${roas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}x`}
        </strong></span>
        <span>Ticket médio: <strong>{dados.vendas > 0 ? fmtMoeda((Number(dados.vgv) || 0) / dados.vendas) : "—"}</strong></span>
      </div>
    </div>
  );
}

export default function FunilCliente({ cliente, funil, onSalvar, onToast }) {
  const objetivo = cliente.objetivo || "Lead";
  const [comp, setComp] = useState(compAtualISO());
  const [salvando, setSalvando] = useState(false);

  // linhas existentes deste cliente
  const doCliente = useMemo(
    () => (funil || []).filter((f) => f.clienteId === cliente.id),
    [funil, cliente.id]
  );

  const vazio = { captados: "", qualificados: "", vendidos: "", vendas: "", vgv: "", custo: "" };
  const [form, setForm] = useState(() => carregarComp(compAtualISO()));

  function carregarComp(c) {
    const out = {};
    PLATAFORMAS.forEach((p) => {
      const linha = (funil || []).find((f) => f.clienteId === cliente.id && f.competencia === c && f.plataforma === p);
      out[p] = linha
        ? { captados: linha.captados || "", qualificados: linha.qualificados || "", vendidos: linha.vendidos || "",
            vendas: linha.vendas || "", vgv: linha.vgv || "", custo: linha.custo || "" }
        : { ...vazio };
    });
    return out;
  }

  function mudarComp(c) {
    setComp(c);
    setForm(carregarComp(c));
  }

  const setCampo = (plat) => (campo, valor) =>
    setForm((s) => ({ ...s, [plat]: { ...s[plat], [campo]: valor } }));

  async function salvar() {
    setSalvando(true);
    try {
      for (const p of PLATAFORMAS) {
        await onSalvar({ clienteId: cliente.id, competencia: comp, plataforma: p, ...form[p] });
      }
      onToast(`Painel de ${rotuloComp(comp)} salvo`);
    } catch (e) {
      onToast("Erro ao salvar: " + (e.message || "falha"));
    } finally {
      setSalvando(false);
    }
  }

  // histórico mês a mês (soma das plataformas)
  const historico = useMemo(() => {
    const porComp = {};
    doCliente.forEach((f) => {
      const x = porComp[f.competencia] || { captados: 0, qualificados: 0, vendidos: 0, vendas: 0, vgv: 0, custo: 0 };
      x.captados += f.captados; x.qualificados += f.qualificados; x.vendidos += f.vendidos;
      x.vendas += f.vendas; x.vgv += f.vgv; x.custo += f.custo;
      porComp[f.competencia] = x;
    });
    return Object.entries(porComp)
      .map(([c, v]) => ({ competencia: c, ...v }))
      .sort((a, b) => (a.competencia < b.competencia ? 1 : -1));
  }, [doCliente]);

  if (objetivo === "Não metrificado") {
    return (
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <h3 className="dash-title" style={{ margin: 0 }}>Painel de Qualificação</h3>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--ink-faint)" }}>
          Este cliente está marcado como <strong>Resultado não metrificado</strong> no cadastro —
          o painel fica em branco. Se o objetivo mudar, ajuste no cadastro do cliente.
        </p>
      </div>
    );
  }

  const eLead = objetivo === "Lead";

  return (
    <div className="card card-pad" style={{ marginBottom: 20 }}>
      <div className="mm-head">
        <div>
          <h3 className="dash-title" style={{ margin: 0 }}>Painel de Qualificação</h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-soft)" }}>
            Objetivo do cliente: <strong>{objetivo}</strong> · preenchimento mês a mês, por plataforma.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="month" className="input" style={{ width: "auto" }} value={comp} onChange={(e) => mudarComp(e.target.value)} />
          <button className="btn btn-sm btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar mês"}
          </button>
        </div>
      </div>

      <div className="funil-grid">
        {PLATAFORMAS.map((p) =>
          eLead
            ? <ColunaLead key={p} plataforma={p} dados={form[p]} onSet={setCampo(p)} />
            : <ColunaFaturamento key={p} plataforma={p} dados={form[p]} onSet={setCampo(p)} />
        )}
      </div>

      {historico.length > 0 && (
        <>
          <h4 className="mm-sub">Histórico mês a mês (Meta + Google somados)</h4>
          <div className="table-wrap">
            <table className="grid">
              <thead>
                {eLead ? (
                  <tr><th>Mês</th><th>Captados</th><th>Qualificados</th><th>Vendidos</th><th>Qualificação</th><th>Fechamento</th><th>Conversão</th></tr>
                ) : (
                  <tr><th>Mês</th><th>Vendas</th><th>VGV</th><th>Custo anúncios</th><th>ROAS</th><th>Ticket médio</th></tr>
                )}
              </thead>
              <tbody>
                {historico.map((h) => {
                  if (eLead) {
                    const t = calcTaxas({ captados: h.captados, qualificados: h.qualificados, fechados: h.vendidos });
                    return (
                      <tr key={h.competencia}>
                        <td className="cell-num">{rotuloComp(h.competencia)}</td>
                        <td className="cell-num">{fmtNum(h.captados)}</td>
                        <td className="cell-num">{fmtNum(h.qualificados)}</td>
                        <td className="cell-num">{fmtNum(h.vendidos)}</td>
                        <td className="cell-num" style={{ color: corTaxa(t.qualificacao), fontWeight: 700 }}>{pctTxt(t.qualificacao)}</td>
                        <td className="cell-num" style={{ color: corTaxa(t.fechamento), fontWeight: 700 }}>{pctTxt(t.fechamento)}</td>
                        <td className="cell-num" style={{ color: corTaxa(t.conversao), fontWeight: 700 }}>{pctTxt(t.conversao)}</td>
                      </tr>
                    );
                  }
                  const roas = calcROAS(h.vgv, h.custo);
                  return (
                    <tr key={h.competencia}>
                      <td className="cell-num">{rotuloComp(h.competencia)}</td>
                      <td className="cell-num">{fmtNum(h.vendas)}</td>
                      <td className="cell-num">{fmtMoeda(h.vgv)}</td>
                      <td className="cell-num">{fmtMoeda(h.custo)}</td>
                      <td className="cell-num" style={{ fontWeight: 700, color: roas == null ? "inherit" : roas >= 1 ? "var(--green)" : "var(--red)" }}>
                        {roas == null ? "—" : `${roas.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}x`}
                      </td>
                      <td className="cell-num">{h.vendas > 0 ? fmtMoeda(h.vgv / h.vendas) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
