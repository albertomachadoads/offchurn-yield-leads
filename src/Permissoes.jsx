import { useEffect, useState } from "react";
import { Icon, Modal } from "./components.jsx";
import { supabase } from "./supabaseClient.js";

/* ============================================================
   Gerenciamento de Permissões por Usuário.
   Admin define quais módulos e instâncias cada user pode ver.
   ============================================================ */

const MODULOS = [
  { id: "acompanhamento", nome: "Acompanhamento", grupo: "Principais" },
  { id: "follow", nome: "Follow de Ações", grupo: "Principais" },
  { id: "clientes", nome: "Clientes", grupo: "Principais" },
  { id: "crm", nome: "CRM (Kanban)", grupo: "Comercial" },
  { id: "crm-params", nome: "Parâmetros CRM", grupo: "Comercial" },
  { id: "crm-auto", nome: "Automações", grupo: "Comercial" },
  { id: "crm-analises", nome: "Análises CRM", grupo: "Comercial" },
  { id: "metas", nome: "Painel de Metas", grupo: "Comercial" },
  { id: "whatsapp", nome: "WhatsApp", grupo: "Comercial" },
  { id: "fluxo", nome: "Fluxo de Caixa", grupo: "Financeiro" },
  { id: "gestao", nome: "Gestão de Clientes", grupo: "Financeiro" },
  { id: "obz", nome: "OBZ", grupo: "Financeiro" },
  { id: "tarefas", nome: "Registro de Tarefas", grupo: "Operacional" },
  { id: "cadastros", nome: "Cadastros", grupo: "Admin" },
  { id: "admin", nome: "Administradores", grupo: "Admin" },
  { id: "logs", nome: "Logs", grupo: "Admin" },
];

const TODOS_IDS = MODULOS.map((m) => m.id);
const GRUPOS = [...new Set(MODULOS.map((m) => m.grupo))];

function PermModal({ pessoa, permissao, instancias, onSave, onClose }) {
  const [modulos, setModulos] = useState(permissao?.modulos || []);
  const [waInst, setWaInst] = useState(permissao?.wa_instancias || []);
  const [verTodos, setVerTodos] = useState(permissao?.ver_todos_clientes || false);

  function toggleMod(id) {
    setModulos((p) => p.includes(id) ? p.filter((m) => m !== id) : [...p, id]);
  }
  function toggleGrupo(grupo) {
    const ids = MODULOS.filter((m) => m.grupo === grupo).map((m) => m.id);
    const todosAtivos = ids.every((id) => modulos.includes(id));
    if (todosAtivos) setModulos((p) => p.filter((m) => !ids.includes(m)));
    else setModulos((p) => [...new Set([...p, ...ids])]);
  }
  function toggleWa(id) {
    setWaInst((p) => p.includes(id) ? p.filter((i) => i !== id) : [...p, id]);
  }
  function marcarTodos() { setModulos([...TODOS_IDS]); }
  function desmarcarTodos() { setModulos([]); }

  return (
    <Modal title={`Permissões — ${pessoa.nome}`} onClose={onClose} wide footer={
      <><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" onClick={() => onSave({ pessoaId: pessoa.id, modulos, wa_instancias: waInst, ver_todos_clientes: verTodos })}>Salvar permissões</button></>
    }>
      <div className="perm-section">
        <div className="perm-header">
          <h4>Módulos visíveis</h4>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm btn-ghost" onClick={marcarTodos}>Todos</button>
            <button className="btn btn-sm btn-ghost" onClick={desmarcarTodos}>Nenhum</button>
          </div>
        </div>
        {GRUPOS.map((g) => (
          <div key={g} className="perm-grupo">
            <label className="perm-grupo-label" onClick={() => toggleGrupo(g)}>
              <input type="checkbox" checked={MODULOS.filter((m) => m.grupo === g).every((m) => modulos.includes(m.id))} readOnly /> {g}
            </label>
            <div className="perm-checks">
              {MODULOS.filter((m) => m.grupo === g).map((m) => (
                <label key={m.id} className="perm-check">
                  <input type="checkbox" checked={modulos.includes(m.id)} onChange={() => toggleMod(m.id)} /> {m.nome}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="perm-section" style={{ marginTop: 16 }}>
        <h4>Instâncias de WhatsApp</h4>
        <p style={{ fontSize: 12, color: "var(--ink-faint)", margin: "4px 0 8px" }}>Selecione quais WhatsApps este usuário pode ver e usar.</p>
        {instancias.length === 0 ? <p style={{ fontSize: 12, color: "var(--ink-faint)" }}>Nenhuma instância cadastrada.</p> : (
          <div className="perm-checks">
            {instancias.map((inst) => (
              <label key={inst.id} className="perm-check">
                <input type="checkbox" checked={waInst.includes(inst.id)} onChange={() => toggleWa(inst.id)} /> {inst.nome} ({inst.instancia})
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="perm-section" style={{ marginTop: 16 }}>
        <label className="perm-check">
          <input type="checkbox" checked={verTodos} onChange={(e) => setVerTodos(e.target.checked)} />
          <strong>Ver todos os clientes</strong> (se desativado, vê apenas clientes atribuídos a ele)
        </label>
      </div>
    </Modal>
  );
}

export default function Permissoes({ pessoas, onToast }) {
  const [permissoes, setPermissoes] = useState([]);
  const [instancias, setInstancias] = useState([]);
  const [editando, setEditando] = useState(null);

  async function carregar() {
    const { data: p } = await supabase.from("permissoes_usuario").select("*");
    setPermissoes(p || []);
    const { data: i } = await supabase.from("wa_instancias").select("*").eq("ativo", true);
    setInstancias(i || []);
  }
  useEffect(() => { carregar(); }, []);

  async function salvar(data) {
    try {
      await supabase.from("permissoes_usuario").upsert({
        pessoa_id: data.pessoaId,
        modulos: data.modulos,
        wa_instancias: data.wa_instancias,
        ver_todos_clientes: data.ver_todos_clientes,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: "pessoa_id" });
      onToast("Permissões salvas"); setEditando(null); carregar();
    } catch (e) { onToast("Erro: " + e.message); }
  }

  const permMap = {};
  permissoes.forEach((p) => { permMap[p.pessoa_id] = p; });

  return (
    <>
      <div className="page-head">
        <div><h1>Permissões de Acesso</h1><p>Defina quais módulos e instâncias cada usuário pode acessar.</p></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(pessoas || []).map((p) => {
          const perm = permMap[p.id];
          const nMod = perm?.modulos?.length || 0;
          const nWa = perm?.wa_instancias?.length || 0;
          return (
            <div key={p.id} className="auto-list-item" onClick={() => setEditando(p)}>
              <div className="auto-list-icon" style={{ fontSize: 24 }}>👤</div>
              <div className="auto-list-info">
                <div className="auto-list-nome">{p.nome}</div>
                <div className="auto-list-meta">
                  {perm ? `${nMod} módulo${nMod !== 1 ? "s" : ""} · ${nWa} WhatsApp${nWa !== 1 ? "s" : ""}` : "Sem permissões configuradas (acesso total)"}
                  {perm?.ver_todos_clientes && " · Vê todos os clientes"}
                </div>
              </div>
              <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setEditando(p); }}>Configurar</button>
            </div>
          );
        })}
      </div>
      {editando && <PermModal pessoa={editando} permissao={permMap[editando.id]} instancias={instancias} onSave={salvar} onClose={() => setEditando(null)} />}
    </>
  );
}

export { MODULOS, TODOS_IDS };
