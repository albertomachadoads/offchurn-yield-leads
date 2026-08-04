import { useMemo, useState } from "react";

/* ============================================================
   Nova Conversa — monta o número no padrão do WhatsApp.

   Celular BR:  55 + DDD + 9 + 8 dígitos  → 5511994579547
   Fixo BR:     55 + DDD + 8 dígitos      → 551134567890
   ============================================================ */

/* Normaliza o que o usuário digitou para o formato de envio */
export function montarNumero(bruto, brasileiro, fixo) {
  let d = String(bruto || "").replace(/\D/g, "");

  if (!brasileiro) return { numero: d, valido: d.length >= 8, aviso: null };

  // Remove o 55 inicial para trabalhar só com DDD + assinante
  if (d.startsWith("55") && d.length > 10) d = d.slice(2);

  const ddd = d.slice(0, 2);
  let assinante = d.slice(2);
  let aviso = null;

  if (fixo) {
    // Fixo não leva o 9. Se o usuário digitou, retiramos.
    if (assinante.length === 9 && assinante.startsWith("9")) {
      assinante = assinante.slice(1);
      aviso = "O 9 inicial foi removido por se tratar de telefone fixo.";
    }
  } else {
    // Celular precisa do 9. Se digitou só 8 dígitos, acrescentamos.
    if (assinante.length === 8) {
      assinante = "9" + assinante;
      aviso = "O 9 foi adicionado automaticamente.";
    }
  }

  const numero = "55" + ddd + assinante;
  const esperado = fixo ? 12 : 13; // 55 + 2 + 8  |  55 + 2 + 9
  return { numero, valido: numero.length === esperado, aviso, ddd, assinante };
}

/* Máscara visual: +55 (11) 99457-9547 */
export function formatarVisual(bruto, brasileiro, fixo) {
  let d = String(bruto || "").replace(/\D/g, "");
  if (!brasileiro) return d ? "+" + d : "";
  if (d.startsWith("55") && d.length > 10) d = d.slice(2);
  if (!d) return "";
  const ddd = d.slice(0, 2);
  const ass = d.slice(2);
  if (!ass) return `+55 (${ddd}`;
  const corte = fixo ? 4 : ass.length > 8 ? 5 : 4;
  const p1 = ass.slice(0, corte);
  const p2 = ass.slice(corte, corte + 4);
  return `+55 (${ddd}) ${p1}${p2 ? "-" + p2 : ""}`;
}

export default function NovaConversaModal({ onIniciar, onFechar }) {
  const [texto, setTexto] = useState("");
  const [brasileiro, setBrasileiro] = useState(true);
  const [fixo, setFixo] = useState(false);
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);

  const r = useMemo(() => montarNumero(texto, brasileiro, fixo), [texto, brasileiro, fixo]);
  const visual = useMemo(() => formatarVisual(texto, brasileiro, fixo), [texto, brasileiro, fixo]);
  const digitos = texto.replace(/\D/g, "").length;

  async function iniciar() {
    if (!r.valido || enviando) return;
    setEnviando(true);
    try { await onIniciar(r.numero, nome.trim()); }
    finally { setEnviando(false); }
  }

  return (
    <div className="nc-bd" onClick={onFechar}>
      <div className="nc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="nc-head">
          <div className="nc-ico">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          </div>
          <button className="nc-x" onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        <h3 className="nc-titulo">Nova mensagem</h3>
        <p className="nc-sub">Digite o número com DDD para iniciar uma conversa</p>

        <div className="nc-campo">
          <label>Número de telefone</label>
          <input className="nc-input" autoFocus inputMode="numeric" value={texto}
            onChange={(e) => setTexto(e.target.value)} placeholder="Ex: 11987654321"
            onKeyDown={(e) => { if (e.key === "Enter") iniciar(); }} />
          <span className="nc-dica">
            {brasileiro ? "O código do país (+55) será adicionado automaticamente." : "Digite o número completo com o código do país."}
          </span>
        </div>

        {digitos > 0 && (
          <div className={`nc-preview ${r.valido ? "ok" : ""}`}>
            <span className="nc-preview-l">Será enviado para</span>
            <span className="nc-preview-v">{visual || "—"}</span>
            {r.aviso && <span className="nc-preview-aviso">{r.aviso}</span>}
            {!r.valido && digitos >= 8 && (
              <span className="nc-preview-erro">
                {fixo ? "Um telefone fixo tem 10 dígitos com DDD." : "Um celular tem 11 dígitos com DDD."}
              </span>
            )}
          </div>
        )}

        <label className="nc-toggle">
          <div>
            <strong>Número brasileiro</strong>
            <small>Aplicar formatação (+55, DDD, 9)</small>
          </div>
          <input type="checkbox" checked={brasileiro} onChange={(e) => setBrasileiro(e.target.checked)} />
          <span className="nc-switch" />
        </label>

        {brasileiro && (
          <label className="nc-toggle">
            <div>
              <strong>Telefone fixo</strong>
              <small>Não adicionar o 9 na frente</small>
            </div>
            <input type="checkbox" checked={fixo} onChange={(e) => setFixo(e.target.checked)} />
            <span className="nc-switch" />
          </label>
        )}

        <div className="nc-campo" style={{ marginTop: 16 }}>
          <label>Nome do contato <span className="nc-op">opcional</span></label>
          <input className="nc-input" value={nome} onChange={(e) => setNome(e.target.value)}
            placeholder="Como aparecerá na lista de conversas" />
        </div>

        <div className="nc-acoes">
          <button className="nc-btn" onClick={onFechar}>Cancelar</button>
          <button className="nc-btn-primary" disabled={!r.valido || enviando} onClick={iniciar}>
            {enviando ? "Abrindo…" : "Iniciar conversa"}
          </button>
        </div>
      </div>
    </div>
  );
}
