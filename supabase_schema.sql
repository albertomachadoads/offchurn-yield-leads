-- ============================================================
-- OffChurn Yield Leads — Schema do banco (Supabase / PostgreSQL)
-- Cole TODO este conteúdo no SQL Editor do Supabase e clique em RUN.
-- ============================================================

-- ---------- PERFIS DE USUÁRIO ----------
-- Cada usuário do Auth tem um perfil com papel (admin ou gestor) e nome.
create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  papel text not null default 'gestor' check (papel in ('admin','gestor')),
  criado_em timestamptz not null default now()
);

-- ---------- CLIENTES ----------
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  responsavel_id uuid,           -- referência a um gestor (perfis.id), opcional
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ---------- GESTORES (gestores de tráfego, para vincular a clientes) ----------
create table if not exists public.gestores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now()
);

-- ---------- EQUIPE (pessoas do Follow de Ações: criada por / responsável) ----------
create table if not exists public.pessoas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now()
);

-- ---------- ACOMPANHAMENTOS (a aba principal) ----------
create table if not exists public.acompanhamentos (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  cliente_id uuid references public.clientes(id) on delete set null,
  criticidade text not null default 'Normal',
  tipo_meta text not null default 'Faturamento',
  meta numeric,
  realizado numeric,
  aderencia text not null default 'Sem dados',
  acompanhamento text not null default '',
  autor_id uuid references auth.users(id) on delete set null,  -- quem registrou
  criado_em timestamptz not null default now()
);

-- ---------- TAREFAS (Follow de Ações) ----------
create table if not exists public.tarefas (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  criada_por_id uuid references public.pessoas(id) on delete set null,
  responsavel_id uuid references public.pessoas(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  acao text not null default '',
  etapa text not null default 'A executar',
  autor_id uuid references auth.users(id) on delete set null,  -- quem registrou
  criado_em timestamptz not null default now()
);

-- ============================================================
-- FUNÇÃO AUXILIAR: verifica se o usuário logado é admin
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and papel = 'admin'
  );
$$;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Regra geral: todo usuário autenticado LÊ tudo.
-- Cadastros (clientes, gestores, pessoas, perfis): só ADMIN escreve.
-- Acompanhamentos e tarefas: qualquer autenticado cria/edita.
-- ============================================================

alter table public.perfis          enable row level security;
alter table public.clientes        enable row level security;
alter table public.gestores        enable row level security;
alter table public.pessoas         enable row level security;
alter table public.acompanhamentos enable row level security;
alter table public.tarefas         enable row level security;

-- PERFIS: cada um lê todos os perfis (para mostrar nomes); só admin edita; cada um pode ler/editar o próprio nome
drop policy if exists perfis_select on public.perfis;
create policy perfis_select on public.perfis for select to authenticated using (true);
drop policy if exists perfis_admin_all on public.perfis;
create policy perfis_admin_all on public.perfis for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- CLIENTES
drop policy if exists clientes_select on public.clientes;
create policy clientes_select on public.clientes for select to authenticated using (true);
drop policy if exists clientes_admin_write on public.clientes;
create policy clientes_admin_write on public.clientes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- GESTORES
drop policy if exists gestores_select on public.gestores;
create policy gestores_select on public.gestores for select to authenticated using (true);
drop policy if exists gestores_admin_write on public.gestores;
create policy gestores_admin_write on public.gestores for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- PESSOAS (equipe)
drop policy if exists pessoas_select on public.pessoas;
create policy pessoas_select on public.pessoas for select to authenticated using (true);
drop policy if exists pessoas_admin_write on public.pessoas;
create policy pessoas_admin_write on public.pessoas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ACOMPANHAMENTOS: todos autenticados leem e escrevem
drop policy if exists acomp_select on public.acompanhamentos;
create policy acomp_select on public.acompanhamentos for select to authenticated using (true);
drop policy if exists acomp_write on public.acompanhamentos;
create policy acomp_write on public.acompanhamentos for all to authenticated
  using (true) with check (true);

-- TAREFAS: todos autenticados leem e escrevem
drop policy if exists tarefas_select on public.tarefas;
create policy tarefas_select on public.tarefas for select to authenticated using (true);
drop policy if exists tarefas_write on public.tarefas;
create policy tarefas_write on public.tarefas for all to authenticated
  using (true) with check (true);

-- ============================================================
-- TRIGGER: cria um perfil automaticamente quando um usuário é criado
-- O nome e o papel podem ser passados nos metadados do usuário.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, nome, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', ''),
    coalesce(new.raw_user_meta_data->>'papel', 'gestor')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- REALTIME: habilita sincronização em tempo real nas tabelas
-- ============================================================
alter publication supabase_realtime add table public.acompanhamentos;
alter publication supabase_realtime add table public.tarefas;
alter publication supabase_realtime add table public.clientes;
alter publication supabase_realtime add table public.gestores;
alter publication supabase_realtime add table public.pessoas;

-- ============================================================
-- DADOS INICIAIS (clientes, gestores e equipe da sua planilha)
-- Pode rodar uma vez. Seguro para repetir (não duplica por nome).
-- ============================================================
insert into public.gestores (nome)
select v from (values ('João'), ('Alberto')) as t(v)
where not exists (select 1 from public.gestores g where g.nome = t.v);

insert into public.pessoas (nome)
select v from (values ('João'),('Alberto'),('Habiel'),('Tiago'),('Marcelo'),('Bruna'),('Gabriele')) as t(v)
where not exists (select 1 from public.pessoas p where p.nome = t.v);

insert into public.clientes (nome, ativo)
select v, true from (values
  ('MDF na Web'),('Vaapty Amparo | Itapira'),('Pink Ninas'),('Brakiarias'),
  ('Sasa'),('RG Multimarcas'),('Bremenkamp'),
  ('L. Quintella Advogados Associados'),('Guilherme Garcia & Co')
) as t(v)
where not exists (select 1 from public.clientes c where c.nome = t.v);

-- ============================================================
-- FIM. Após rodar, crie seu primeiro ADMIN (instruções no README).
-- ============================================================
