import { useEffect, useMemo, useRef, useState } from "react";

/* ============================================================
   Seletor de conta de anúncios com busca.

   Um <select> comum obriga a rolar dezenas de contas. Aqui a
   busca casa por nome e por número, ignorando acentos e o
   prefixo "act_" — porque ninguém digita isso.
   ============================================================ */

const semAcento = (s) =>
  String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/* O ID vem como "act_123456789"; a busca deve achar por "123456" */
const soDigitos = (s) => String(s || "").replace(/\D/g, "");

export default function SeletorConta({
  contas, valor, onSelecionar, onFechar,
  rotulo = "Selecione a conta de anúncios", plataforma = "meta",
}) {
  const [busca, setBusca] = useState("");
  const [destaque, setDestaque] = useState(0);
  const campoRef = useRef(null);
  const listaRef = useRef(null);

  useEffect(() => { campoRef.current?.focus(); }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim();
    if (!q) return contas || [];
    const qn = soDigitos(q);
    const qt = semAcento(q);
    return (contas || []).filter((c) => {
      const nome = semAcento(c.nome);
      const id = soDigitos(c.id);
      const moeda = semAcento(c.moeda);
      return nome.includes(qt) || (qn && id.includes(qn)) || moeda.includes(qt);
    });
  }, [contas, busca]);

  useEffect(() => { setDestaque(0); }, [busca]);

  // Mantém o item destacado visível ao navegar pelo teclado
  useEffect(() => {
    const el = listaRef.current?.querySelector(`[data-i="${destaque}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [destaque]);

  function teclado(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setDestaque((d) => Math.min(d + 1, filtradas.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setDestaque((d) => Math.max(d - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const c = filtradas[destaque]; if (c) onSelecionar(c.id); }
    else if (e.key === "Escape") { e.preventDefault(); onFechar(); }
  }

  /* Destaca o trecho que casou com a busca */
  function realce(texto, q) {
    if (!q.trim()) return texto;
    const alvo = semAcento(texto);
    const chave = semAcento(q.trim());
    const i = alvo.indexOf(chave);
    if (i < 0) return texto;
    return (<>
      {texto.slice(0, i)}
      <mark>{texto.slice(i, i + chave.length)}</mark>
      {texto.slice(i + chave.length)}
    </>);
  }

  return (
    <div className="sc-bd" onClick={onFechar}>
      <div className="sc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sc-head">
          <div>
            <h3>{rotulo}</h3>
            <span className="sc-sub">
              {contas?.length || 0} conta{(contas?.length || 0) !== 1 ? "s" : ""} disponíve{(contas?.length || 0) !== 1 ? "is" : "l"}
            </span>
          </div>
          <button className="sc-x" onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        <div className="sc-busca">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input ref={campoRef} value={busca} onChange={(e) => setBusca(e.target.value)}
            onKeyDown={teclado} placeholder="Buscar por nome ou número da conta…" />
          {busca && <button className="sc-limpar" onClick={() => setBusca("")} aria-label="Limpar">×</button>}
        </div>

        <div className="sc-lista" ref={listaRef}>
          {filtradas.length === 0 ? (
            <p className="sc-vazio">
              Nenhuma conta encontrada para “{busca}”.
              <br />Tente parte do nome ou os números do ID.
            </p>
          ) : filtradas.map((c, i) => {
            const atual = c.id === valor;
            return (
              <button key={c.id} data-i={i}
                className={`sc-item ${i === destaque ? "on" : ""} ${atual ? "atual" : ""}`}
                onMouseEnter={() => setDestaque(i)}
                onClick={() => onSelecionar(c.id)}>
                <div className="sc-item-info">
                  <div className="sc-item-nome">{realce(c.nome || "Sem nome", busca)}</div>
                  <div className="sc-item-meta">
                    <span className="sc-id">{realce(String(c.id), busca)}</span>
                    {c.moeda && <span> · {c.moeda}</span>}
                    {c.status != null && c.status !== 1 && <span className="sc-inativa"> · conta inativa</span>}
                  </div>
                </div>
                {atual && <span className="sc-atual-tag">vinculada</span>}
              </button>
            );
          })}
        </div>

        <div className="sc-rodape">
          <span className="sc-dica">↑↓ navegar · Enter selecionar · Esc fechar</span>
          {valor && (
            <button className="sc-desvincular" onClick={() => onSelecionar("")}>
              Desvincular conta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
