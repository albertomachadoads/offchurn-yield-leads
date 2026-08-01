import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient.js";

/* ============================================================
   Conectar WhatsApp — provisiona a instância e mostra o QR Code.
   ============================================================ */

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

async function provisionar(payload) {
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-provisionar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}`, apikey: ANON },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("O serviço de conexão ainda não está publicado no servidor. Peça ao administrador para publicar a função whatsapp-provisionar no Supabase.");
  }
  if (r.status === 404) throw new Error("O serviço de conexão não foi encontrado no servidor. A função whatsapp-provisionar precisa ser publicada no Supabase.");
  const d = await r.json().catch(() => ({}));
  if (!d.ok) throw new Error(d.error || `Falha na comunicação com o servidor (HTTP ${r.status}).`);
  return d;
}

function QrBox({ src }) {
  const url = src?.startsWith("data:") ? src : `data:image/png;base64,${src}`;
  return (
    <div className="wc-qr">
      <img src={url} alt="QR Code para conectar o WhatsApp" />
    </div>
  );
}

export default function WhatsAppConectar({ usuario, agencia, isAdmin, instanciaExistente, onFechar, onConectado, onToast }) {
  const [etapa, setEtapa] = useState("inicio"); // inicio | criando | qr | conectado | erro
  const [modo, setModo] = useState("qr");        // qr | codigo
  const [telefone, setTelefone] = useState("");
  const [nomeExib, setNomeExib] = useState("");
  const [inst, setInst] = useState(null);
  const [qr, setQr] = useState(null);
  const [paircode, setPaircode] = useState(null);
  const [erro, setErro] = useState("");
  const [segundos, setSegundos] = useState(0);
  const pollRef = useRef(null);
  const tempoRef = useRef(null);

  useEffect(() => () => { clearInterval(pollRef.current); clearInterval(tempoRef.current); }, []);

  async function iniciar() {
    setEtapa("criando"); setErro("");
    try {
      // Reconexão: a instância já existe, só pedir novo QR
      if (instanciaExistente) {
        setInst(instanciaExistente);
        const c = await provisionar({
          acao: "conectar", instanciaId: instanciaExistente.id,
          telefone: modo === "codigo" ? telefone : undefined,
        });
        setQr(c.qrcode); setPaircode(c.paircode);
        setEtapa("qr");
        iniciarPolling(instanciaExistente.id);
        return;
      }

      // 1. Cria a instância na UAZAPI e salva no sistema
      const criada = await provisionar({
        acao: "criar",
        nomeExibicao: nomeExib.trim() || `WhatsApp de ${usuario?.nome || "usuário"}`,
        usuarioId: usuario?.id, usuarioNome: usuario?.nome, agencia,
      });
      setInst(criada.instancia);

      // 2. Pede QR Code ou código de pareamento
      const conn = await provisionar({
        acao: "conectar", instanciaId: criada.instancia.id,
        telefone: modo === "codigo" ? telefone : undefined,
      });
      setQr(conn.qrcode); setPaircode(conn.paircode);
      setEtapa("qr");
      iniciarPolling(criada.instancia.id);
    } catch (e) { setErro(e.message); setEtapa("erro"); }
  }

  function iniciarPolling(id) {
    setSegundos(0);
    clearInterval(tempoRef.current);
    tempoRef.current = setInterval(() => setSegundos((s) => s + 1), 1000);
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const s = await provisionar({ acao: "status", instanciaId: id });
        if (s.qrcode && s.qrcode !== qr) setQr(s.qrcode);
        if (s.paircode) setPaircode(s.paircode);
        if (s.status === "connected") {
          clearInterval(pollRef.current); clearInterval(tempoRef.current);
          setEtapa("conectado");
          onToast && onToast("WhatsApp conectado!");
          onConectado && onConectado();
        }
      } catch { /* silencioso: segue tentando */ }
    }, 3000);
  }

  async function novoQr() {
    if (!inst) return;
    try {
      const conn = await provisionar({ acao: "conectar", instanciaId: inst.id, telefone: modo === "codigo" ? telefone : undefined });
      setQr(conn.qrcode); setPaircode(conn.paircode);
      iniciarPolling(inst.id);
    } catch (e) { setErro(e.message); }
  }

  async function cancelar() {
    clearInterval(pollRef.current); clearInterval(tempoRef.current);
    // Se criou a instância mas não conectou, remove o registro órfão
    if (inst && !instanciaExistente && etapa !== "conectado") {
      try { await supabase.from("wa_instancias").delete().eq("id", inst.id); } catch {}
    }
    onFechar();
  }

  const expirado = etapa === "qr" && modo === "qr" && segundos > 118;

  return (
    <div className="wc-bd" onClick={etapa === "criando" ? undefined : cancelar}>
      <div className="wc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wc-head">
          <div>
            <h3>{instanciaExistente ? "Reconectar WhatsApp" : "Conectar WhatsApp"}</h3>
            <p>{instanciaExistente ? instanciaExistente.nome : "Escaneie o código com o celular que vai atender"}</p>
          </div>
          {etapa !== "criando" && <button className="wc-x" onClick={cancelar} aria-label="Fechar">×</button>}
        </div>

        {/* ── Início ── */}
        {etapa === "inicio" && (
          <div className="wc-body">
            {!instanciaExistente && <div className="wc-campo">
              <label>Nome desta conexão <span className="wc-op">opcional</span></label>
              <input className="wc-input" value={nomeExib} onChange={(e) => setNomeExib(e.target.value)}
                placeholder={`WhatsApp de ${usuario?.nome?.split(" ")[0] || "usuário"}`} />
              <span className="wc-dica">Serve apenas para você identificar a conexão dentro do sistema.</span>
            </div>}

            <div className="wc-campo">
              <label>Como deseja conectar?</label>
              <div className="wc-opcoes">
                <button className={`wc-opcao ${modo === "qr" ? "on" : ""}`} onClick={() => setModo("qr")}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM19 19h2v2h-2z"/></svg>
                  <strong>QR Code</strong>
                  <small>Escaneie com a câmera</small>
                </button>
                <button className={`wc-opcao ${modo === "codigo" ? "on" : ""}`} onClick={() => setModo("codigo")}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                  <strong>Código</strong>
                  <small>Digite no aparelho</small>
                </button>
              </div>
            </div>

            {modo === "codigo" && (
              <div className="wc-campo">
                <label>Número do WhatsApp</label>
                <input className="wc-input" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="55 11 99999-9999" inputMode="numeric" />
                <span className="wc-dica">Com código do país e DDD. O código de pareamento aparecerá na próxima tela.</span>
              </div>
            )}

            <div className="wc-acoes">
              <button className="wc-btn" onClick={cancelar}>Cancelar</button>
              <button className="wc-btn-primary" disabled={modo === "codigo" && telefone.replace(/\D/g, "").length < 12} onClick={iniciar}>
                Gerar {modo === "qr" ? "QR Code" : "código"}
              </button>
            </div>
          </div>
        )}

        {/* ── Criando ── */}
        {etapa === "criando" && (
          <div className="wc-body wc-centro">
            <div className="wc-spinner" />
            <p className="wc-status-txt">Preparando sua conexão…</p>
            <span className="wc-dica">Isso leva alguns segundos.</span>
          </div>
        )}

        {/* ── QR / código ── */}
        {etapa === "qr" && (
          <div className="wc-body wc-centro">
            {modo === "qr" ? (<>
              {qr ? <QrBox src={qr} /> : <div className="wc-qr wc-qr-load"><div className="wc-spinner" /></div>}
              {expirado && (
                <div className="wc-expirado">
                  <p>O código expirou.</p>
                  <button className="wc-link" onClick={novoQr}>Gerar um novo</button>
                </div>
              )}
            </>) : (
              <div className="wc-paircode">
                <span className="wc-pair-l">Código de pareamento</span>
                <div className="wc-pair-v">{paircode || "······"}</div>
              </div>
            )}

            <ol className="wc-passos">
              <li>Abra o WhatsApp no celular</li>
              <li>Toque em <strong>Mais opções</strong> e depois em <strong>Aparelhos conectados</strong></li>
              <li>Toque em <strong>Conectar aparelho</strong></li>
              <li>{modo === "qr" ? "Aponte a câmera para este código" : "Escolha “Conectar com número de telefone” e digite o código acima"}</li>
            </ol>

            <div className="wc-aguardando">
              <span className="wc-pulse" />
              Aguardando a leitura… {segundos > 0 && `${segundos}s`}
            </div>
          </div>
        )}

        {/* ── Conectado ── */}
        {etapa === "conectado" && (
          <div className="wc-body wc-centro">
            <div className="wc-ok">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p className="wc-status-txt">WhatsApp conectado</p>
            <span className="wc-dica">As mensagens já começam a aparecer em Conversas.</span>
            <div className="wc-acoes wc-acoes-centro">
              <button className="wc-btn-primary" onClick={onFechar}>Concluir</button>
            </div>
          </div>
        )}

        {/* ── Erro ── */}
        {etapa === "erro" && (
          <div className="wc-body wc-centro">
            <div className="wc-erro-ico">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/><circle cx="12" cy="12" r="10"/></svg>
            </div>
            <p className="wc-status-txt">Não foi possível conectar</p>
            <span className="wc-erro-txt">{erro}</span>
            <div className="wc-acoes wc-acoes-centro">
              <button className="wc-btn" onClick={cancelar}>Fechar</button>
              <button className="wc-btn-primary" onClick={() => setEtapa("inicio")}>Tentar de novo</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
