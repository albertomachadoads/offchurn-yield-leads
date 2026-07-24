import * as api from "./api.js";

/* ============================================================
   Motor de Execução de Automações do CRM.
   Verifica automações ativas e executa ações quando triggers
   são ativados por eventos no CRM.
   ============================================================ */

export async function executarAutomacoes({ evento, lead, leadAnterior, funilId, crm, userName }) {
  if (!crm?.automacoes || !funilId) return;

  const automacoes = crm.automacoes.filter((a) => a.ativo && a.funilId === funilId);
  if (automacoes.length === 0) return;

  for (const auto of automacoes) {
    let triggerConfig = {};
    try { triggerConfig = JSON.parse(auto.triggerConfig || "{}"); } catch {}

    // Verificar se o trigger bate com o evento
    if (!matchTrigger(auto.triggerTipo, triggerConfig, evento, lead, leadAnterior)) continue;

    // Executar todas as ações
    let acoes = [];
    try { acoes = JSON.parse(auto.acoes || "[]"); } catch {}

    for (const acao of acoes) {
      try {
        await executarAcao(acao, lead, crm, userName, auto.nome);
      } catch (e) {
        console.error(`[Automação "${auto.nome}"] Erro na ação ${acao.tipo}:`, e);
      }
    }
  }
}

function matchTrigger(tipo, config, evento, lead, leadAnterior) {
  switch (tipo) {
    case "lead_criado":
      return evento === "lead_criado";

    case "mudanca_etapa":
      if (evento !== "mudanca_etapa") return false;
      if (config.deEtapa && leadAnterior?.etapaId !== config.deEtapa) return false;
      if (config.paraEtapa && lead.etapaId !== config.paraEtapa) return false;
      return true;

    case "campo_alterado":
      if (evento !== "campo_alterado") return false;
      if (config.campoId) {
        let camposNovos = {}, camposAntigos = {};
        try { camposNovos = JSON.parse(lead.camposCustom || "{}"); } catch {}
        try { camposAntigos = JSON.parse(leadAnterior?.camposCustom || "{}"); } catch {}
        if (camposNovos[config.campoId] === camposAntigos[config.campoId]) return false;
        if (config.valorIgual && camposNovos[config.campoId] !== config.valorIgual) return false;
      }
      return true;

    case "tag_adicionada":
      if (evento !== "tag_adicionada") return false;
      if (config.tagId) {
        let tagsNovas = [], tagsAntigas = [];
        try { tagsNovas = JSON.parse(lead.tags || "[]"); } catch {}
        try { tagsAntigas = JSON.parse(leadAnterior?.tags || "[]"); } catch {}
        if (!tagsNovas.includes(config.tagId) || tagsAntigas.includes(config.tagId)) return false;
      }
      return true;

    case "lead_ganho":
      return evento === "lead_ganho";

    case "lead_perdido":
      return evento === "lead_perdido";

    default:
      return false;
  }
}

async function executarAcao(acao, lead, crm, userName, nomeAuto) {
  const config = acao.config || {};
  const prefix = `[Auto: ${nomeAuto}]`;

  switch (acao.tipo) {
    case "adicionar_tag": {
      if (!config.tagId) return;
      let tags = []; try { tags = JSON.parse(lead.tags || "[]"); } catch {}
      if (!tags.includes(config.tagId)) {
        tags.push(config.tagId);
        await api.crmLeadSave({ ...lead, tags: JSON.stringify(tags) });
      }
      break;
    }

    case "mudar_etapa": {
      if (!config.etapaId) return;
      await api.crmLeadSave({ ...lead, etapaId: config.etapaId });
      break;
    }

    case "atribuir_usuario": {
      if (!config.pessoaId) return;
      await api.crmLeadSave({ ...lead, responsavelId: config.pessoaId });
      break;
    }

    case "atribuir_fonte": {
      if (!config.origemId) return;
      await api.crmLeadSave({ ...lead, origemId: config.origemId });
      break;
    }

    case "atribuir_produto": {
      if (!config.produtoId) return;
      const prod = (crm.produtos || []).find((p) => p.id === config.produtoId);
      await api.crmLeadSave({ ...lead, produtoId: config.produtoId, valor: prod?.valor || lead.valor });
      break;
    }

    case "campo_personalizado": {
      if (!config.campoId) return;
      let campos = {}; try { campos = JSON.parse(lead.camposCustom || "{}"); } catch {}
      campos[config.campoId] = config.valor || "";
      await api.crmLeadSave({ ...lead, camposCustom: JSON.stringify(campos) });
      break;
    }

    case "criar_anotacao": {
      if (!config.texto) return;
      await api.crmAtividadeSave({
        leadId: lead.id, tipo: "nota",
        descricao: `${prefix} ${config.texto}`,
        autorNome: "Automação",
      });
      break;
    }

    case "criar_tarefa": {
      if (!config.descricao) return;
      await api.crmAtividadeSave({
        leadId: lead.id, tipo: "tarefa",
        descricao: `${prefix} ${config.descricao}`,
        autorNome: "Automação",
      });
      break;
    }

    case "notificacao": {
      // Por agora, registra como atividade de sistema (futuro: push notification)
      await api.crmAtividadeSave({
        leadId: lead.id, tipo: "sistema",
        descricao: `${prefix} 🔔 ${config.mensagem || "Notificação"}`,
        autorNome: "Automação",
      });
      break;
    }
  }
}
