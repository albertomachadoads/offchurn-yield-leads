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
    contextoIa: cliente.contextoIa || "",
    publicoAlvo: cliente.publicoAlvo || "",
    propostaValor: cliente.propostaValor || "",
    tomVoz: cliente.tomVoz || "",
    restricoesIa: cliente.restricoesIa || "",
  });
  const [abaCfg, setAbaCfg] = useState("metas");
  const [salvando, setSalvando] = useState(false);
  const s = (k, v) => setF((p) => ({ ...p, [k]: v }));

  async function salvar() {
    setSalvando(true);
    try {
      /* Envia o cliente inteiro com os campos alterados, para o
         upsert não zerar o que não aparece nesta tela. */
      const salvo = await onSalvar({
        ...cliente,
        responsavelId: f.responsavelId || null,
        nicho: f.nicho.trim() || null,
        objetivo: f.objetivo,
        verbaMensal: f.verbaMensal === "" ? null : Number(f.verbaMensal),
        cpaMeta: f.cpaMeta === "" ? null : Number(f.cpaMeta),
        cpa: f.cpa === "" ? null : Number(f.cpa),
        platMeta: f.platMeta,
        platGoogle: f.platGoogle,
        contextoIa: f.contextoIa.trim() || null,
        publicoAlvo: f.publicoAlvo.trim() || null,
        propostaValor: f.propostaValor.trim() || null,
        tomVoz: f.tomVoz.trim() || null,
        restricoesIa: f.restricoesIa.trim() || null,
      });
      /* Confere o que o banco devolveu. Se a coluna não existe,
         o Supabase ignora o campo em silêncio: o upsert passa,
         mas o valor não persiste — sem erro nenhum. */
      if (f.contextoIa.trim() && salvo && !salvo.contextoIa) {
        onToast("As colunas de contexto não existem no banco. Rode supabase_contexto_cliente.sql antes de preencher.");
        setSalvando(false);
        return;
      }
      onFechar();
    } catch (e) {
      const msg = String(e.message || "");
      /* Coluna ausente = o SQL do contexto ainda não foi rodado.
         Sem essa dica o usuário fica sem saber o que houve. */
      if (/contexto_ia|publico_alvo|proposta_valor|tom_voz|restricoes_ia|column/i.test(msg)) {
        onToast("Os campos de contexto ainda não existem no banco. Rode o SQL supabase_contexto_cliente.sql.");
      } else {
        onToast("Erro ao salvar: " + (msg || "falha desconhecida"));
      }
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
      <div className="em-abas">
        <button type="button" className={abaCfg === "metas" ? "on" : ""} onClick={() => setAbaCfg("metas")}>
          Metas e operação
        </button>
        <button type="button" className={abaCfg === "contexto" ? "on" : ""} onClick={() => setAbaCfg("contexto")}>
          Contexto para IA
          {!f.contextoIa && <span className="em-pendente" title="Ainda não preenchido" />}
        </button>
      </div>

      {abaCfg === "contexto" ? (
        <div className="em-ctx">
          <p className="em-ctx-intro">
            Tudo aqui é enviado aos agentes do Otimizador em cada conversa.
            Quanto mais específico, menos genérica a resposta.
          </p>

          <div className="form-row">
            <label>Sobre o negócio</label>
            <textarea className="input" rows={5} value={f.contextoIa}
              onChange={(e) => s("contextoIa", e.target.value)}
              placeholder={"O que o cliente vende, como opera, o que o diferencia da concorrência.\n\nEx.: Escritório de advocacia previdenciária em Salvador. Atende aposentadoria por tempo de contribuição e revisão de benefício. Consulta inicial gratuita, honorários só no êxito. Sócio fundador com 18 anos de atuação e presença em rádio local."} />
          </div>

          <div className="form-row">
            <label>Público-alvo</label>
            <textarea className="input" rows={3} value={f.publicoAlvo}
              onChange={(e) => s("publicoAlvo", e.target.value)}
              placeholder={"Quem compra: idade, região, situação, dores e objeções mais comuns.\n\nEx.: Homens e mulheres de 55 a 68 anos, interior da Bahia, baixa familiaridade com internet. Já tentaram pelo INSS e foram negados. Desconfiam de advogado que cobra adiantado."} />
          </div>

          <div className="form-grid2">
            <div className="form-row">
              <label>Proposta de valor</label>
              <textarea className="input" rows={3} value={f.propostaValor}
                onChange={(e) => s("propostaValor", e.target.value)}
                placeholder="A promessa central da oferta e a prova que a sustenta." />
            </div>
            <div className="form-row">
              <label>Tom de voz</label>
              <textarea className="input" rows={3} value={f.tomVoz}
                onChange={(e) => s("tomVoz", e.target.value)}
                placeholder="Como a marca fala. Ex.: acolhedor e direto, sem juridiquês, tratamento por você." />
            </div>
          </div>

          <div className="form-row">
            <label>Restrições</label>
            <textarea className="input" rows={3} value={f.restricoesIa}
              onChange={(e) => s("restricoesIa", e.target.value)}
              placeholder={"O que NÃO pode ser dito ou prometido.\n\nEx.: proibido garantir resultado ou prazo de decisão judicial (regra da OAB). Não citar valores de benefício. Não usar a palavra 'grátis' para os honorários."} />
            <span className="form-dica">
              Limites legais, do setor ou da marca. Os agentes respeitam o que estiver aqui.
            </span>
          </div>
        </div>
      ) : (<>

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
      </>)}
    </Modal>
  );
}
