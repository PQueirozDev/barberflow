# Ambiente configurado

## Estado atual — 08/10/2026

Produção: https://zekro.vercel.app, projeto Vercel `zekro`. As quatro migrações incrementais de 08/10 foram aplicadas com autorização e os oito checks de prontidão passaram. Google login foi confirmado pelo responsável e sua conta recebeu ADMIN. SMTP e templates estão configurados; entrega real na caixa de entrada ainda exige homologação. Pix direto está configurado, mas recebimento e aprovação de um pagamento real ainda não foram homologados.

Em 09/10/2026 UTC, a API de backups retornou lista vazia e PITR desabilitado. O snapshot privado existente cobre recuperação das migrações; não substitui backup completo de banco, Auth e objetos do Storage. Não foi contratado serviço pago. Consulte [registro de implantação](DEPLOYMENT_20261008.md).

## Histórico — 19/09/2026 e auditoria inicial

Os registros abaixo descrevem verificações anteriores à implantação atual.

## Auditoria local em 08/10/2026

As informações remotas abaixo são o registro de 19/09, não uma nova verificação
da infraestrutura. A migração incremental `202610080001_security_stability.sql`
foi validada somente em PGlite/PostgreSQL nativo descartáveis. Não foi aplicada
ao Supabase, e nenhum deploy, credencial, plano ou região foi alterado.
SMTP permanece pendente; [templates e configuração manual](SMTP.md) estão
preparados. Consulte [aplicação e rollback](MIGRATION_SECURITY.md).

- Projeto Supabase: `barberflow`, referência `wklasgsubtkpieshsfxc`, organização Barberflow, plano gratuito.
- Região do banco: West US (Oregon), escolhida na criação do projeto. O fuso dos agendamentos é configurado por barbearia, independentemente da região do servidor.
- As migrações `202609170001_platform.sql` e `202609170002_management.sql` foram aplicadas pelo SQL Editor em transações. Não reaplique esses arquivos neste banco: eles não são idempotentes e não foram registrados pelo Supabase CLI.
- Verificação no banco: 13 tabelas públicas, todas com RLS habilitada.
- Bucket `barbershops` criado com políticas de upload por associação à barbearia e leitura pública de imagens.
- Credenciais locais guardadas em `.env.local`, ignorado pelo Git e excluído do upload pela `.vercelignore`. Na Vercel, as quatro variáveis da aplicação foram configuradas para produção; `SUPABASE_SERVICE_ROLE_KEY` foi cadastrada como Secret.
- Site URL: `https://barberflow-pqueirozdev.vercel.app`. Os callbacks `/auth/callback` e `/auth/callback?next=/redefinir-senha` estão autorizados nas origens de produção e local.

## Verificado no projeto real

`tests/live.mjs` passou para autenticação de conta temporária confirmada, trigger de perfil, login HTTP com cookies, onboarding, rotas do dashboard, página pública, disponibilidade, reserva, rejeição de conflito, cancelamento e upload/leitura de imagem. Todos os dados temporários foram removidos.

O teste real identificou e permitiu corrigir a rejeição de horários ISO com offset retornados pelo Supabase, tanto na reserva quanto na validação de remarcação. O caso está coberto nos testes de domínio.

## Pendências externas

- SMTP personalizado não configurado. Confirmação de cadastro e recuperação de senha por email ainda precisam ser validadas com o provedor do responsável pelo projeto. Não houve envio de emails durante os testes.
- A conta e os dados reais da barbearia devem ser cadastrados pelo responsável. Nenhum usuário de teste foi mantido, e nenhuma senha de usuário foi definida para ele.

## Produção na Vercel

- Site: https://barberflow-pqueirozdev.vercel.app
- Projeto: `pqueirozdev/barberflow`, plano Hobby.
- Painel: https://vercel.com/pqueirozdev/barberflow
- Deploy inicial: `dpl_4Css3w9hr1QdtCmzUZZNZDsK7Znn`.
- `NEXT_PUBLIC_APP_URL` de produção usa o endereço acima. A variável local continua apontando para localhost.
- O teste `tests/live.mjs` passou contra o site publicado: login, cookies SSR, onboarding, dashboard, página pública, disponibilidade, reserva, conflito, cancelamento e imagens. As fixtures foram removidas.
- Os quatro testes de navegador passaram contra produção em desktop e celular.
- Publicações futuras: `npx vercel@59.23.2 deploy --prod --yes`, a partir deste diretório vinculado. Não executar `vercel env pull` sobre `.env.local` sem preservar a configuração local.
