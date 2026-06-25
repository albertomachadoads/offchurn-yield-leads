import { pctAderencia } from "./utils";

// ---- ícones SVG inline ----
export const Icon = {
  Search: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
    </svg>
  ),
  Plus: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Download: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  ),
  X: (p) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  Check: (p) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" {...p}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  Edit: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  ),
  Trash: (p) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
};

export function AderenciaBadge({ value }) {
  const map = {
    Ok: "badge-ok",
    "Atenção": "badge-aten",
    Abaixo: "badge-abaixo",
    "Sem dados": "badge-sem",
  };
  return (
    <span className={`badge ${map[value] || "badge-sem"}`}>
      <span className="dot" /> {value}
    </span>
  );
}

export function AderenciaBar({ meta, realizado }) {
  const pct = pctAderencia(meta, realizado);
  if (pct == null) return <span className="ader-pct" style={{ color: "var(--ink-faint)" }}>—</span>;
  const cls = pct >= 90 ? "" : pct >= 60 ? "warn" : "bad";
  return (
    <div className="ader">
      <span className="ader-pct">{pct}%</span>
      <div className="ader-bar">
        <div className={`ader-fill ${cls}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children, footer }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="iconbtn" onClick={onClose} aria-label="Fechar"><Icon.X /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
