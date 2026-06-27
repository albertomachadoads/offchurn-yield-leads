-- ============================================================
-- OffChurn Yield Leads — Atualização: datas nas tarefas
-- Cole no SQL Editor do Supabase e clique em RUN.
-- Seguro para rodar mesmo se já existir (usa IF NOT EXISTS).
-- ============================================================

-- data_criacao: quando a tarefa foi criada (preenchida automaticamente pelo app)
alter table public.tarefas
  add column if not exists data_criacao date;

-- prazo: data limite definida pelo usuário
alter table public.tarefas
  add column if not exists prazo date;

-- data_conclusao: quando a tarefa foi concluída
alter table public.tarefas
  add column if not exists data_conclusao date;

-- Para tarefas que já existem sem data_criacao, usa a data do registro (campo "data").
update public.tarefas
set data_criacao = data
where data_criacao is null;
