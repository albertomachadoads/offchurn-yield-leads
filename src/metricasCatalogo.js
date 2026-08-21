/* ============================================================
   Catálogo de métricas do Meta Ads.

   Cada cliente escolhe quais métricas quer acompanhar, e os
   presets agrupam as combinações mais comuns por tipo de operação.

   campo        → nome usado no retorno da API
   rotulo       → texto exibido
   formato      → moeda | numero | percentual | decimal
   menorMelhor  → true para custos (queda é evolução positiva)
   grupo        → seção do catálogo
   ============================================================ */

export const GRUPOS = [
  { id: "investimento", nome: "Investimento e entrega" },
  { id: "engajamento", nome: "Engajamento e cliques" },
  { id: "mensagens", nome: "Conversas e mensagens" },
  { id: "ecommerce", nome: "E-commerce e vendas" },
  { id: "leads", nome: "Cadastros e leads" },
  { id: "video", nome: "Vídeo" },
  { id: "app", nome: "Aplicativo" },
];

export const CATALOGO = [
  /* ── Investimento e entrega ── */
  { campo: "gasto", rotulo: "Valor investido", formato: "moeda", menorMelhor: null, grupo: "investimento", api: "spend" },
  { campo: "alcance", rotulo: "Alcance", formato: "numero", menorMelhor: false, grupo: "investimento", api: "reach" },
  { campo: "impressoes", rotulo: "Impressões", formato: "numero", menorMelhor: false, grupo: "investimento", api: "impressions" },
  { campo: "cpm", rotulo: "CPM médio", formato: "moeda", menorMelhor: true, grupo: "investimento", api: "cpm",
    ajuda: "Custo por mil impressões" },
  { campo: "frequencia", rotulo: "Frequência", formato: "decimal", menorMelhor: true, grupo: "investimento", api: "frequency",
    ajuda: "Quantas vezes a mesma pessoa viu o anúncio" },

  /* ── Engajamento e cliques ── */
  { campo: "cliques", rotulo: "Cliques (todos)", formato: "numero", menorMelhor: false, grupo: "engajamento", api: "clicks" },
  { campo: "cliquesLink", rotulo: "Cliques no link", formato: "numero", menorMelhor: false, grupo: "engajamento", api: "inline_link_clicks" },
  { campo: "ctr", rotulo: "CTR (todos)", formato: "percentual", menorMelhor: false, grupo: "engajamento", api: "ctr" },
  { campo: "ctrLink", rotulo: "CTR (cliques no link)", formato: "percentual", menorMelhor: false, grupo: "engajamento", api: "inline_link_click_ctr" },
  { campo: "cpc", rotulo: "CPC médio", formato: "moeda", menorMelhor: true, grupo: "engajamento", api: "cpc" },
  { campo: "cpcLink", rotulo: "CPC no link", formato: "moeda", menorMelhor: true, grupo: "engajamento", api: "cost_per_inline_link_click" },
  { campo: "visualizacoesPagina", rotulo: "Visualizações de página", formato: "numero", menorMelhor: false, grupo: "engajamento", acao: "landing_page_view" },
  { campo: "custoVisualizacaoPagina", rotulo: "Custo por visualização de página", formato: "moeda", menorMelhor: true, grupo: "engajamento", custoDe: "landing_page_view" },
  { campo: "engajamentoPost", rotulo: "Engajamento com a publicação", formato: "numero", menorMelhor: false, grupo: "engajamento", acao: "post_engagement" },
  { campo: "curtidasPagina", rotulo: "Curtidas na página", formato: "numero", menorMelhor: false, grupo: "engajamento", acao: "like" },
  { campo: "comentarios", rotulo: "Comentários", formato: "numero", menorMelhor: false, grupo: "engajamento", acao: "comment" },
  { campo: "compartilhamentos", rotulo: "Compartilhamentos", formato: "numero", menorMelhor: false, grupo: "engajamento", acao: "post" },
  { campo: "salvamentos", rotulo: "Salvamentos", formato: "numero", menorMelhor: false, grupo: "engajamento", acao: "onsite_conversion.post_save" },

  /* ── Conversas e mensagens ── */
  { campo: "conversas", rotulo: "Conversas iniciadas", formato: "numero", menorMelhor: false, grupo: "mensagens", acao: "onsite_conversion.messaging_conversation_started_7d" },
  { campo: "custoConversa", rotulo: "Custo por conversa iniciada", formato: "moeda", menorMelhor: true, grupo: "mensagens", custoDe: "onsite_conversion.messaging_conversation_started_7d" },
  { campo: "respostasMensagem", rotulo: "Respostas em mensagens", formato: "numero", menorMelhor: false, grupo: "mensagens", acao: "onsite_conversion.total_messaging_connection" },
  { campo: "leadsMensagem", rotulo: "Leads por mensagem", formato: "numero", menorMelhor: false, grupo: "mensagens", acao: "onsite_conversion.lead_grouped" },
  { campo: "custoLeadMensagem", rotulo: "Custo por lead de mensagem", formato: "moeda", menorMelhor: true, grupo: "mensagens", custoDe: "onsite_conversion.lead_grouped" },

  /* ── E-commerce e vendas ── */
  { campo: "compras", rotulo: "Compras", formato: "numero", menorMelhor: false, grupo: "ecommerce", acao: "purchase" },
  { campo: "custoCompra", rotulo: "Custo por compra", formato: "moeda", menorMelhor: true, grupo: "ecommerce", custoDe: "purchase" },
  { campo: "valorCompras", rotulo: "Valor de conversão (receita)", formato: "moeda", menorMelhor: false, grupo: "ecommerce", valorDe: "purchase" },
  { campo: "roas", rotulo: "ROAS", formato: "decimal", menorMelhor: false, grupo: "ecommerce", calculado: "roas",
    ajuda: "Receita dividida pelo investimento" },
  { campo: "checkoutsIniciados", rotulo: "Checkouts iniciados", formato: "numero", menorMelhor: false, grupo: "ecommerce", acao: "initiate_checkout" },
  { campo: "custoCheckout", rotulo: "Custo por checkout iniciado", formato: "moeda", menorMelhor: true, grupo: "ecommerce", custoDe: "initiate_checkout" },
  { campo: "adicoesCarrinho", rotulo: "Adições ao carrinho", formato: "numero", menorMelhor: false, grupo: "ecommerce", acao: "add_to_cart" },
  { campo: "custoAdicaoCarrinho", rotulo: "Custo por adição ao carrinho", formato: "moeda", menorMelhor: true, grupo: "ecommerce", custoDe: "add_to_cart" },
  { campo: "visualizacoesConteudo", rotulo: "Visualizações de conteúdo", formato: "numero", menorMelhor: false, grupo: "ecommerce", acao: "view_content" },
  { campo: "adicoesPagamento", rotulo: "Dados de pagamento adicionados", formato: "numero", menorMelhor: false, grupo: "ecommerce", acao: "add_payment_info" },
  { campo: "taxaConversao", rotulo: "Taxa de conversão", formato: "percentual", menorMelhor: false, grupo: "ecommerce", calculado: "taxaConversao",
    ajuda: "Compras dividido por cliques no link" },
  { campo: "connectRate", rotulo: "Connect rate", formato: "percentual", menorMelhor: false, grupo: "ecommerce", calculado: "connectRate",
    ajuda: "Visualizações de página dividido por cliques no link" },
  { campo: "ticketMedio", rotulo: "Ticket médio", formato: "moeda", menorMelhor: false, grupo: "ecommerce", calculado: "ticketMedio" },

  /* ── Cadastros e leads ── */
  { campo: "leads", rotulo: "Cadastros (leads)", formato: "numero", menorMelhor: false, grupo: "leads", acao: "lead" },
  { campo: "custoLead", rotulo: "Custo por lead", formato: "moeda", menorMelhor: true, grupo: "leads", custoDe: "lead" },
  { campo: "leadsFormulario", rotulo: "Leads por formulário", formato: "numero", menorMelhor: false, grupo: "leads", acao: "onsite_conversion.lead_form" },
  { campo: "cadastrosCompletos", rotulo: "Cadastros completos", formato: "numero", menorMelhor: false, grupo: "leads", acao: "complete_registration" },
  { campo: "custoCadastro", rotulo: "Custo por cadastro", formato: "moeda", menorMelhor: true, grupo: "leads", custoDe: "complete_registration" },
  { campo: "agendamentos", rotulo: "Agendamentos marcados", formato: "numero", menorMelhor: false, grupo: "leads", acao: "schedule" },
  { campo: "custoAgendamento", rotulo: "Custo por agendamento", formato: "moeda", menorMelhor: true, grupo: "leads", custoDe: "schedule" },
  { campo: "contatos", rotulo: "Contatos", formato: "numero", menorMelhor: false, grupo: "leads", acao: "contact" },
  { campo: "custoContato", rotulo: "Custo por contato", formato: "moeda", menorMelhor: true, grupo: "leads", custoDe: "contact" },

  /* ── Vídeo ── */
  { campo: "video3s", rotulo: "Reproduções de 3 segundos", formato: "numero", menorMelhor: false, grupo: "video", acao: "video_view" },
  { campo: "custoVideo3s", rotulo: "Custo por reprodução de 3s", formato: "moeda", menorMelhor: true, grupo: "video", custoDe: "video_view" },
  { campo: "video25", rotulo: "Reproduções até 25%", formato: "numero", menorMelhor: false, grupo: "video", videoP: "p25" },
  { campo: "video50", rotulo: "Reproduções até 50%", formato: "numero", menorMelhor: false, grupo: "video", videoP: "p50" },
  { campo: "video75", rotulo: "Reproduções até 75%", formato: "numero", menorMelhor: false, grupo: "video", videoP: "p75" },
  { campo: "video100", rotulo: "Reproduções completas", formato: "numero", menorMelhor: false, grupo: "video", videoP: "p100" },
  { campo: "tempoMedioVideo", rotulo: "Tempo médio de reprodução", formato: "decimal", menorMelhor: false, grupo: "video", api: "video_avg_time_watched_actions",
    ajuda: "Em segundos" },
  { campo: "taxaRetencaoVideo", rotulo: "Taxa de retenção do vídeo", formato: "percentual", menorMelhor: false, grupo: "video", calculado: "retencaoVideo",
    ajuda: "Reproduções completas dividido por reproduções de 3s" },

  /* ── Aplicativo ── */
  { campo: "instalacoesApp", rotulo: "Instalações do aplicativo", formato: "numero", menorMelhor: false, grupo: "app", acao: "mobile_app_install" },
  { campo: "custoInstalacaoApp", rotulo: "Custo por instalação", formato: "moeda", menorMelhor: true, grupo: "app", custoDe: "mobile_app_install" },
  { campo: "comprasApp", rotulo: "Compras no aplicativo", formato: "numero", menorMelhor: false, grupo: "app", acao: "app_custom_event.fb_mobile_purchase" },
];

/* Busca rápida por campo */
export const POR_CAMPO = Object.fromEntries(CATALOGO.map((m) => [m.campo, m]));

/* ============================================================
   Presets: combinações prontas por tipo de operação.
   O usuário pode aplicar e depois ajustar à vontade.
   ============================================================ */
export const PRESETS = [
  {
    id: "mensagens",
    nome: "Tráfego para WhatsApp",
    descricao: "Clientes que captam por conversa no WhatsApp ou Direct",
    metricas: ["gasto", "alcance", "impressoes", "cpm", "cpc", "ctrLink", "frequencia",
               "cliquesLink", "conversas", "custoConversa"],
  },
  {
    id: "ecommerce",
    nome: "E-commerce",
    descricao: "Lojas com checkout e acompanhamento de receita",
    metricas: ["gasto", "alcance", "impressoes", "cpm", "cpc", "ctrLink", "frequencia",
               "cliquesLink", "visualizacoesPagina", "connectRate", "adicoesCarrinho",
               "checkoutsIniciados", "custoCheckout", "compras", "custoCompra",
               "valorCompras", "roas", "taxaConversao", "ticketMedio"],
  },
  {
    id: "leads",
    nome: "Captação de leads",
    descricao: "Formulários e cadastros em página",
    metricas: ["gasto", "alcance", "impressoes", "cpm", "cpc", "ctrLink", "frequencia",
               "cliquesLink", "visualizacoesPagina", "leads", "custoLead", "taxaConversao"],
  },
  {
    id: "agendamento",
    nome: "Agendamento e consultas",
    descricao: "Clínicas, consultórios e serviços com hora marcada",
    metricas: ["gasto", "alcance", "impressoes", "cpm", "ctrLink", "frequencia",
               "cliquesLink", "conversas", "custoConversa", "agendamentos", "custoAgendamento"],
  },
  {
    id: "reconhecimento",
    nome: "Reconhecimento de marca",
    descricao: "Campanhas de alcance, vídeo e engajamento",
    metricas: ["gasto", "alcance", "impressoes", "cpm", "frequencia", "engajamentoPost",
               "video3s", "video100", "taxaRetencaoVideo", "curtidasPagina"],
  },
  {
    id: "completo",
    nome: "Visão completa",
    descricao: "Todas as métricas principais, para diagnóstico",
    metricas: ["gasto", "alcance", "impressoes", "cpm", "cpc", "ctr", "ctrLink", "frequencia",
               "cliques", "cliquesLink", "visualizacoesPagina", "conversas", "custoConversa",
               "leads", "custoLead", "compras", "custoCompra", "valorCompras", "roas"],
  },
];

/* Usado quando o cliente ainda não escolheu nada */
export const PADRAO = PRESETS[0].metricas;

/* ============================================================
   Cálculo das métricas derivadas.
   ============================================================ */
export function calcularDerivadas(d) {
  const n = (v) => Number(v) || 0;
  const div = (a, b) => (n(b) > 0 ? n(a) / n(b) : null);

  return {
    ...d,
    roas: div(d.valorCompras, d.gasto),
    ticketMedio: div(d.valorCompras, d.compras),
    taxaConversao: d.cliquesLink > 0 ? (n(d.compras) / n(d.cliquesLink)) * 100 : null,
    connectRate: d.cliquesLink > 0 ? (n(d.visualizacoesPagina) / n(d.cliquesLink)) * 100 : null,
    retencaoVideo: d.video3s > 0 ? (n(d.video100) / n(d.video3s)) * 100 : null,
    taxaRetencaoVideo: d.video3s > 0 ? (n(d.video100) / n(d.video3s)) * 100 : null,
  };
}
