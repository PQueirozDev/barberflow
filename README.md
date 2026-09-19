# Barberflow

SaaS de agendamento com Next.js, React, TypeScript e Supabase (Auth, PostgreSQL e Storage).

Site publicado: https://barberflow-pqueirozdev.vercel.app. Consulte [o estado do ambiente](docs/ENVIRONMENT.md) para configuração e pendências de email/autenticação.

## Executar

1. Instale Node.js 22 ou superior e execute `npm ci`.
2. Crie um projeto Supabase. Execute no SQL Editor, nesta ordem, uma vez por ambiente:
   - `supabase/migrations/202609170001_platform.sql`
   - `supabase/migrations/202609170002_management.sql`
3. Copie `.env.example` para `.env.local` e substitua os valores:
   - `NEXT_PUBLIC_SUPABASE_URL`: URL do projeto.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: chave pública anon.
   - `SUPABASE_SERVICE_ROLE_KEY`: chave service_role, exclusiva do servidor, necessária para reservas e rate limiting.
   - `NEXT_PUBLIC_APP_URL`: origem da aplicação, inicialmente `http://localhost:3000`.
4. Em Supabase Authentication, configure Site URL com a origem e autorize os redirects `http://localhost:3000/auth/callback` e `http://localhost:3000/auth/callback?next=/redefinir-senha`. Adicione também os equivalentes de produção.
5. Configure o envio de emails no Supabase para confirmação e recuperação de senha.
6. Execute `npm run dev` e abra `http://localhost:3000`.

Sem Supabase, a página inicial e `/demonstracao` apresentam a interface. Contas e reservas reais exigem configuração. A demonstração usa dados ilustrativos.

## Primeiro uso

Crie uma conta em `/cadastro`, confirme o email e conclua `/onboarding`. O assistente cria a barbearia, o primeiro serviço, o primeiro barbeiro e os horários. No dashboard, gerencie profissionais, serviços, horários, bloqueios, clientes, reservas e sua página pública. Vincule serviços aos novos profissionais e configure sua disponibilidade.

A página pública fica em `/<slug>`; `/b/<slug>` preserva links antigos. Clientes reservam sem criar conta. O banco valida duração, fuso horário e conflitos. FREE permite até 50 reservas por mês.

Para habilitar um administrador, um responsável pelo banco deve executar no SQL Editor após criar a conta:

```sql
update public.profiles set role = 'ADMIN' where id = '<UUID do usuário em Authentication>';
```

O painel `/admin` gerencia suspensão e plano. Não há checkout nem cobrança automática nesta versão. WhatsApp usa links para envio manual.

## Validação

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Os testes de banco usam PostgreSQL embarcado (PGlite) e simulação dos schemas Auth e Storage. Cobrem isolamento, permissões, disponibilidade, bloqueios e conflitos. Auth, emails e uploads ainda devem ser validados em um Supabase real. Os testes de navegador verificam navegação pública em desktop e celular, usando o build de produção.

Se o Chrome já estiver instalado, é possível dispensar o download do Chromium. No PowerShell, execute `$env:PLAYWRIGHT_CHANNEL='chrome'` antes de `npm run test:e2e`.

Para executar os testes de navegador contra produção, defina também `$env:PLAYWRIGHT_BASE_URL='https://barberflow-pqueirozdev.vercel.app'`. Isso dispensa o servidor local.

Para testar a integração real, inicie a aplicação em outra janela com `npm start` e execute no PowerShell:

```powershell
$env:RUN_LIVE_TESTS='1'
node --env-file=.env.local tests/live.mjs
```

Esse teste cria uma conta temporária já confirmada, uma barbearia, uma reserva e uma imagem no projeto configurado. Verifica login HTTP, cookies, onboarding, páginas autenticadas, disponibilidade, conflito de reservas, cancelamento e Storage. Remove os próprios dados ao terminar, inclusive quando uma verificação falha. Não envia emails; entrega de confirmação e recuperação deve ser validada separadamente com um provedor SMTP configurado.

Para produção, configure as mesmas variáveis na hospedagem, ajuste a origem e redirects, aplique as migrações e execute `npm run build` e `npm start`. Na Vercel, o rate limit usa o IP da plataforma; fora dela, o limite é compartilhado e a identificação de IP deve ser adaptada ao proxy confiável da hospedagem.

`prisma/` e `docker-compose.yml` são legados e não participam da aplicação atual. Não execute o seed antigo: use cadastro e onboarding. Consulte [a arquitetura](docs/ARCHITECTURE.md).
