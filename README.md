# OffChurn Yield Leads

Sistema de acompanhamento de clientes e ações da agência, com **login por usuário**,
**banco de dados online** e **sincronização em tempo real** (todos veem os mesmos dados).

## Recursos
- **Login e senha por usuário** (criados pelo administrador).
- **Acompanhamento**: visão planilhada com filtros (gestor, aderência, data) e relatório `.xlsx`.
- **Follow de Ações**: cadastro de tarefas (criada por, responsável, cliente, ação, etapa) + dashboards.
- **Clientes da semana**: seletor de foco semanal.
- **Cadastros** (só admin): clientes, gestores e equipe.
- **Administradores** (só admin): cria usuários e define papéis.
- **Tempo real**: alterações aparecem para todos automaticamente.

## Perfis
- **Administrador**: acesso total; gerencia cadastros e usuários.
- **Gestor**: vê tudo, registra acompanhamentos e tarefas; não edita cadastros.

---

# Configuração (passo a passo)

## 1. Criar o projeto no Supabase
1. Acesse https://supabase.com e crie uma conta (gratuita).
2. **New project** → dê um nome (ex: `offchurn`), defina uma senha de banco e a região mais próxima (ex: South America / São Paulo).
3. Aguarde ~2 minutos até o projeto subir.

## 2. Criar as tabelas (rodar o SQL)
1. No painel do Supabase, abra **SQL Editor** (menu lateral).
2. Clique em **New query**.
3. Abra o arquivo `supabase_schema.sql` (incluído neste projeto), copie **todo** o conteúdo e cole no editor.
4. Clique em **Run**. Deve aparecer "Success". Isso cria todas as tabelas, permissões, tempo real e os dados iniciais (clientes/gestores/equipe).

## 3. Pegar as chaves de conexão
1. No Supabase: **Settings** (engrenagem) → **API**.
2. Copie dois valores:
   - **Project URL** → vai em `VITE_SUPABASE_URL`
   - **anon public** (em Project API keys) → vai em `VITE_SUPABASE_ANON_KEY`

## 4. Configurar localmente (opcional, para testar no PC)
1. Copie o arquivo `.env.example` para `.env`.
2. Preencha com as duas chaves do passo 3.
3. Rode:
   ```bash
   npm install
   npm run dev
   ```

## 5. Configurar no Vercel
1. No projeto importado no Vercel: **Settings** → **Environment Variables**.
2. Adicione as duas variáveis:
   - `VITE_SUPABASE_URL` = (sua Project URL)
   - `VITE_SUPABASE_ANON_KEY` = (sua chave anon public)
3. Salve e faça um **Redeploy** (Deployments → ... → Redeploy) para as variáveis valerem.

## 6. Criar o PRIMEIRO administrador
Como só um admin pode criar usuários, o primeiro precisa ser criado à mão:

1. No Supabase: **Authentication** → **Users** → **Add user** → **Create new user**.
   - Informe um e-mail e uma senha. Marque "Auto Confirm User".
2. Depois, vá em **SQL Editor** e rode (troque pelo e-mail que você criou):
   ```sql
   update public.perfis
   set papel = 'admin', nome = 'Seu Nome'
   where id = (select id from auth.users where email = 'seu@email.com');
   ```
3. Pronto. Faça login no sistema com esse e-mail/senha. A partir daí, use a aba
   **Administradores** para criar os demais usuários pela própria interface.

> Observação sobre confirmação de e-mail: se ao criar usuários pela interface eles
> não conseguirem entrar, vá em **Authentication → Providers → Email** e desative
> "Confirm email" (assim a senha definida pelo admin já funciona na hora).

---

## Build de produção
```bash
npm run build      # gera /dist
npm run preview    # testa localmente
```

## Segurança
- As permissões são aplicadas no banco (Row Level Security), não só na tela: mesmo
  que alguém burle a interface, o banco recusa escrita de cadastros por não-admins.
- A chave `anon` é pública por natureza (vai no navegador) — quem protege os dados é o RLS.
- O arquivo `.env` está no `.gitignore` e nunca deve ser commitado.
