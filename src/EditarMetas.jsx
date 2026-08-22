import { useState } from "react";
import { Modal } from "./components.jsx";
import { fmtMoeda } from "./utils";

/* ============================================================
   Editar metas — campos operacionais do cliente.

   Deliberadamente NÃO expõe ticket, recorrência, dia de
   pagamento nem data de saída: esses são dados contratuais e
   ficam restritos ao módulo de Cadastros.
   ============================================================ */

const OBJETIVOS = ["Lead", "Faturamento", "Agendamento", "Vendas", "Reconhecimento"];

export default function EditarMetas({ cliente, gestores, contasMeta, onSalvar, onFechar, onToast }) {
  const [f, setF] = useState({
    responsavelId: cliente.responsavelId || "",
    nicho: cliente.nicho || "",
    objetivo: cliente.objetivo || "Lead",
    verbaMensal: cliente.verbaMensal ?? "",
    cpaMeta: cliente.cpaMeta ?? "",
    cpa: cliente.cpa ?? "",
    platMeta: !!cliente.platMeta,
    platGoogle: !!cliente.platGoogle,
  });
  const [salvando, setSalvando] = useState(false);
  const s = (k, v) => setF((p) => ({ ...p, [k]: v }));

  async function salvar() {
    setSalvando(true);
    try {
      /* Envia o cliente inteiro com os campos alterados, para o
         upsert não zerar o que não aparece nesta tela. */
      await onSalvar({
        ...cliente,
        responsavelId: f.responsavelId || null,
        nicho: f.nicho.trim() || null,
        objetivo: f.objetivo,
        verbaMensal: f.verbaMensal === "" ? null : Number(f.verbaMensal),
        cpaMeta: f.cpaMeta === "" ? null : Number(f.cpaMeta),
        cpa: f.cpa === "" ? null : Number(f.cpa),
        platMeta: f.platMeta,
        platGoogle: f.platGoogle,
      });
      onToast("Metas atualizadas");
      onFechar();
    } catch (e) {
      onToast("Erro: " + (e.message || "não foi possível salvar"));
    } finally { setSalvando(false); }
  }

  const contaMeta = (contasMeta || []).find((c) => c.id === cliente.metaAdAccountId);

  return (
    <Modal title={`Metas — ${cliente.nome}`} onClose={onFechar} footer={
      <>
        <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
        <button className="btn btn-primary" disabled={salvando} onClick={salvar}>
          {salvando ? "Salvando…" : "Salvar metas"}
        </button>
      </>
    }>
      <div className="form-grid2">
        <div className="form-row">
          <label>Gestor responsável</label>
          <select className="select" value={f.responsavelId} onChange={(e) => s("responsavelId", e.target.value)}>
            <option value="">— sem responsável —</option>
            {(gestores || []).map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Nicho</label>
          <input className="input" value={f.nicho} onChange={(e) => s("nicho", e.target.value)}
            placeholder="Ex.: Advocacia previdenciária" />
        </div>
      </div>

      <div className="form-row">
        <label>Objetivo da operação</label>
        <select className="select" value={f.objetivo} onChange={(e) => s("objetivo", e.target.value)}>
          {OBJETIVOS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <span className="form-dica">Define como o funil e as metas são calculados para este cliente.</span>
      </div>

      <div className="form-grid2">
        <div className="form-row">
          <label>Verba mensal (R$)</label>
          <input className="input" inputMode="decimal" value={f.verbaMensal}
            onChange={(e) => s("verbaMensal", e.target.value)} placeholder="0,00" />
          <span className="form-dica">Orçamento de mídia planejado para o mês.</span>
        </div>
        <div className="form-row">
          <label>CPA alvo (R$)</label>
          <input className="input" inputMode="decimal" value={f.cpaMeta}
            onChange={(e) => s("cpaMeta", e.target.value)} placeholder="0,00" />
          <span className="form-dica">Meta de custo por resultado.</span>
        </div>
      </div>

      <div className="form-row">
        <label>CPA histórico (R$)</label>
        <input className="input" inputMode="decimal" value={f.cpa}
          onChange={(e) => s("cpa", e.target.value)} placeholder="0,00" />
        <span className="form-dica">Referência de custo praticado antes da meta atual.</span>
      </div>

      <div className="form-row">
        <label>Plataformas ativas</label>
        <div className="em-plats">
          <label className={`em-plat ${f.platMeta ? "on" : ""}`}>
            <input type="checkbox" checked={f.platMeta} onChange={(e) => s("platMeta", e.target.checked)} />
            Meta Ads
          </label>
          <label className={`em-plat ${f.platGoogle ? "on" : ""}`}>
            <input type="checkbox" checked={f.platGoogle} onChange={(e) => s("platGoogle", e.target.checked)} />
            Google Ads
          </label>
        </div>
      </div>

      <div className="em-contas">
        <span className="em-contas-t">Contas vinculadas</span>
        <div className="em-conta">
          <span>Meta Ads</span>
          <strong>{contaMeta ? `${contaMeta.nome} (${cliente.metaAdAccountId})` : cliente.metaAdAccountId || "não vinculada"}</strong>
        </div>
        <div className="em-conta">
          <span>Google Ads</span>
          <strong>{cliente.googleAdCustomerId || "não vinculada"}</strong>
        </div>
        <span className="form-dica">
          O vínculo das contas é feito pelos botões “Conectar conta”, na aba Dashboard.
        </span>
      </div>
    </Modal>
  );
}
