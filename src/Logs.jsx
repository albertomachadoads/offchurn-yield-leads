import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { Icon } from "./components.jsx";

/* ============================================================
   Módulo de Logs — visível apenas para administradores.
   Exibe registros em tempo real, com filtro e destaque de erros.
   ============================================================ */

const TIPOS = [
  { key: "todos", label: "Todos" },
  { key: "erro", label: "Erros", cor: "var(--red)" },
  { key: "aviso", label: "Avisos", cor: "var(--amber)" },
  { key: "info", label: "Info", cor: "var(--green)" },
  { key: "acao", label: "Ações", cor: "var(--green-deep)" },
];

const corTipo = (tipo) => TIPOS.find((t) => t.key === tipo)?.cor || "var(--ink-faint)";

const fmtHora = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export default function Logs({ onToast }) {
  const [logs, setLogs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [expandido, setExpandido] = useState(null);
  const [limpando, setLimpando] = useState(false);

  // carregar logs iniciais (últimos 200)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(200);
      if (!error && data) setLogs(data);
      setCarregando(false);
    })();

    // realtime: novos logs aparecem instantaneamente
    const ch = supabase
      .channel("logs-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "logs" }, (payload) => {
        setLogs((prev) => [payload.new, ...prev].slice(0, 500));
      })
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, []);

  const filtrados = useMemo(() => {
    return logs
      .filter((l) => filtro === "todos" || l.tipo === filtro)
      .filter((l) => {
        if (!busca.trim()) return true;
        const q = busca.toLowerCase();
        return (l.mensagem || "").toLowerCase().includes(q)
          || (l.origem || "").toLowerCase().includes(q)
          || (l.usuario_nome || "").toLowerCase().includes(q)
          || (l.detalhes || "").toLowerCase().includes(q);
      });
  }, [logs, filtro, busca]);

  const contadores = useMemo(() => {
    const c = { erro: 0, aviso: 0, info: 0, acao: 0 };
    logs.forEach((l) => { if (c[l.tipo] !== undefined) c[l.tipo]++; });
    return c;
  }, [logs]);

  async function limparLogs() {
    if (!confirm("Limpar todos os logs? Esta ação é irreversível.")) return;
    setLimpando(true);
    try {
      const { error } = await supabase.from("logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      setLogs([]);
      onToast("Logs limpos");
    } catch (e) {
      onToast("Erro ao limpar: " + (e.message || "falha"));
    } finally {
      setLimpando(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Logs do sistema</h1>
          <p>Registro em tempo real de erros, avisos e ações. Apenas administradores veem esta área.</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-sm" onClick={limparLogs} disabled={limpando}>
            {limpando ? "Limpando…" : "Limpar logs"}
          </button>
        </div>
      </div>

      {/* contadores */}
      <div className="tiles">
        <div className="tile">
          <div className="label">Erros</div>
          <div className="value" style={{ color: contadores.erro > 0 ? "var(--red)" : "inherit" }}>{contadores.erro}</div>
          <div className="hint">requerem atenção</div>
        </div>
        <div className="tile">
          <div className="label">Avisos</div>
          <div className="value" style={{ color: contadores.aviso > 0 ? "var(--amber)" : "inherit" }}>{contadores.aviso}</div>
          <div className="hint">monitorar</div>
        </div>
        <div className="tile">
          <div className="label">Info</div>
          <div className="value">{contadores.info}</div>
          <div className="hint">informativos</div>
        </div>
        <div className="tile">
          <div className="label">Ações</div>
          <div className="value">{contadores.acao}</div>
          <div className="hint">realizadas</div>
        </div>
      </div>

      {/* filtros */}
      <div className="toolbar">
        <div className="search">
          <Icon.Search />
          <input className="input" placeholder="Buscar em logs…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="log-filtros">
          {TIPOS.map((t) => (
            <button key={t.key}
              className={`btn btn-sm ${filtro === t.key ? "btn-primary" : ""}`}
              onClick={() => setFiltro(t.key)}>
              {t.label} {t.key !== "todos" && contadores[t.key] > 0 && <span className="log-badge">{contadores[t.key]}</span>}
            </button>
          ))}
        </div>
      </div>

      {carregando && <div style={{ padding: 30, textAlign: "center", color: "var(--ink-faint)" }}>Carregando logs…</div>}

      {!carregando && filtrados.length === 0 && (
        <div className="card"><div className="empty">
          <h3>Nenhum log encontrado</h3>
          <p>{filtro !== "todos" ? "Ajuste o filtro ou a busca." : "O sistema ainda não registrou eventos."}</p>
        </div></div>
      )}

      {!carregando && filtrados.length > 0 && (
        <div className="table-wrap">
          <table className="grid log-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>Tipo</th>
                <th style={{ width: 110 }}>Quando</th>
                <th style={{ width: 100 }}>Origem</th>
                <th>Mensagem</th>
                <th style={{ width: 110 }}>Usuário</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((l) => (
                <tr key={l.id}
                  className={`log-row log-${l.tipo} ${expandido === l.id ? "log-aberto" : ""}`}
                  onClick={() => setExpandido(expandido === l.id ? null : l.id)}
                  style={{ cursor: l.detalhes ? "pointer" : "default" }}>
                  <td>
                    <span className="log-tipo-badge" style={{ background: corTipo(l.tipo) }}>
                      {l.tipo === "erro" ? "✕" : l.tipo === "aviso" ? "!" : l.tipo === "acao" ? "→" : "•"}
                    </span>
                  </td>
                  <td className="cell-num log-hora">{fmtHora(l.criado_em)}</td>
                  <td><span className="log-origem">{l.origem || "—"}</span></td>
                  <td className="log-msg">
                    <div>{l.mensagem}</div>
                    {expandido === l.id && l.detalhes && (
                      <pre className="log-detalhes">{l.detalhes}</pre>
                    )}
                  </td>
                  <td className="log-user">{l.usuario_nome || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
