# Preparação de publicação — 08/10/2026

## Configurações confirmadas

- Projeto Vercel renomeado para `zekro`, mantendo a conexão com o repositório Barberflow.
- Domínio `zekro.vercel.app` adicionado à produção, com configuração válida. Os aliases anteriores foram preservados.
- `NEXT_PUBLIC_APP_URL` de produção atualizado para `https://zekro.vercel.app`. Requer novo build de produção.
- Preview do commit `7f5f686` compilado na Vercel com status Ready: https://zekro-fvr2qtxar-pqueirozdev.vercel.app/.
- Página inicial e termos conferidos na prévia. Isso não comprova os fluxos autenticados nem representa publicação da versão nova em produção.

## Banco

O projeto Supabase usado pela produção é `wklasgsubtkpieshsfxc`. Estava pausado; sua retomada foi solicitada no plano gratuito, sem upgrade ou mudança de região. O usuário autorizou explicitamente as quatro migrações incrementais. A aplicação delas depende de o serviço concluir a restauração, da validação do schema e do backup.

O Supabase confirmou a conclusão da restauração. A consulta posterior encontrou zero barbearias, clientes, agendamentos, perfis, assinaturas e MANAGER, e uma constraint de exclusão na tabela de agendamentos. As tabelas da aplicação existem, com RLS habilitado.

Um snapshot dos objetos afetados foi exportado para `C:\Users\Pedro\Documents\Barberflow_Privado\Zekro_Migration_Recovery_20261008.csv`, com versão JSON no mesmo diretório. Ele contém definições de funções, policies, colunas, constraints, índices, triggers, grants e assinaturas existentes. É um snapshot de recuperação das migrações, não um backup completo de Auth e dos arquivos do Storage. Não foi incluído no Git.

`npx tsx scripts/verify-migration-recovery.mts <caminho-privado-do-JSON>` executou a recuperação das 15 funções em um PostgreSQL local isolado, comparou os corpos das funções e as 33 policies com as migrações históricas e aplicou as quatro migrações novas sobre as definições arquivadas. A verificação passou. Nenhuma credencial de produção é usada por esse script.

Após o download, a ferramenta de controle do navegador deixou de iniciar. O usuário autenticou o Supabase CLI na conta correta; a Vercel CLI já estava autenticada. O projeto foi confirmado como `ACTIVE_HEALTHY`.

As quatro migrações incrementais foram aplicadas em produção, uma por vez, pelo comando oficial `supabase db query --linked --project-ref wklasgsubtkpieshsfxc --file <arquivo>`, após a autorização explícita do usuário. Nenhuma migração antiga foi reaplicada. Não foi usado `db push`.

As oito verificações de `supabase/checks/launch-readiness.sql` passaram em produção: RLS nas tabelas existentes, EXCLUDE GiST, RPCs de autorização, RPC de reserva privada, rate limiting privado, triggers de teste, RLS do Pix e aceite dos termos. A consulta não cria usuários/reservas nem lê registros pessoais.

O Site URL do Supabase Auth foi atualizado para `https://zekro.vercel.app`. A allowlist inclui os novos callbacks de login e recuperação e preserva todos os callbacks anteriores encontrados no servidor. `supabase/config.toml` declara somente essas URLs. O diff foi revisado antes de `config push`; o CLI confirmou duas propriedades atualizadas e quinze propriedades não declaradas preservadas, sem envio de segredos. O SMTP existente está habilitado e não teve suas credenciais modificadas; a entrega real de emails ainda precisa ser homologada.

Depois, os assuntos e o conteúdo HTML dos templates de confirmação e recuperação Zekro foram aplicados pelo CLI: quatro propriedades atualizadas. Uma verificação posterior confirmou que o Auth remoto corresponde aos campos declarados, sem novas alterações nem envio de segredos. O config declara as URLs e esses dois templates.

## Publicação confirmada

A branch testada foi incorporada à `main` por fast-forward e enviada ao GitHub. O deploy de produção `dpl_5VBSca2c33tHwJpu69uy8yjhGrTQ`, commit `592f3e3`, ficou Ready. O build da Vercel executou compilação, lint e validação de tipos. O domínio https://zekro.vercel.app respondeu com a marca Zekro, preço de R$ 49,90 e teste de sete dias.

Verificações HTTP em produção: `/`, `/login`, `/cadastro`, `/termos`, `/privacidade`, `/contato` e `/icon.svg` responderam 200; `/dashboard` e `/admin/pix` sem sessão redirecionaram ao login; disponibilidade sem parâmetros respondeu 400. Nenhuma reserva, conta ou transação financeira foi criada.

Na primeira verificação, `/auth/google` apontou para o Supabase correto, mas o provedor ainda estava desabilitado. O usuário posteriormente criou e configurou o cliente OAuth diretamente no Google Cloud/Supabase, sem enviar o Client Secret ao agente.

A verificação posterior recebeu redirecionamento 302 para `accounts.google.com`, com Client ID configurado, callback Supabase correto e escopos `openid`, `email` e `profile`. O usuário confirmou que completou o login. O banco confirmou uma identidade Google com email verificado e perfil criado para a conta do responsável. O agente não simulou esse login completo nem extraiu credenciais.

O usuário forneceu recebedor Pix e identificação/contato do operador. As cinco variáveis foram configuradas apenas na Vercel, sem gravar os valores no repositório. O nome no BR Code foi abreviado para atender o limite de 25 caracteres; a página de contato usa a identificação completa. O deploy `dpl_HrfxEHNzYNSrtgKwxi34GBeVKd1e`, commit `fa6328f`, ficou Ready e incorporou essa configuração. A página de contato respondeu 200 e exibiu identificação, email e link de suporte corretos. Não houve pagamento ou confirmação bancária de teste.

## Administração

Após confirmação de login, o usuário autorizou habilitar sua conta como ADMIN. Antes da alteração, a conta foi identificada unicamente por email confirmado, identidade Google e perfil existente. Uma única conta foi promovida; a leitura posterior confirmou o papel ADMIN. Nenhuma outra associação ou conta foi alterada. O administrador usa `/admin` e `/admin/pix` para gerenciar a plataforma e conferir créditos reais antes de liberar acesso.

## Validação e limites

### Complemento — 09/10/2026 UTC

Corrigidos os assuntos do script manual SMTP, que ainda mencionavam Barberflow, e adicionada regressão para manter consistência com a configuração declarativa e os links dos templates. Arquitetura e ambiente foram atualizados para refletir teste de sete dias, Pix manual e produção Zekro. Nenhuma credencial foi alterada.

Verificação readonly de backups: lista vazia e PITR desabilitado. Checklist da planilha privada atualizado. Docker não está disponível neste ambiente Windows para o fluxo de dump do CLI; não foi produzido nem declarado um backup completo. Não contratar backup pago sem autorização. A homologação do recebimento bancário, entrega de SMTP e restauração completa permanece aberta.

Revalidação local: 61 testes unitários/SQL e 20 E2E passaram; lint, build e typecheck aprovados. Typecheck foi repetido após o build: a tentativa concorrente falhou porque o build recriava `.next/types`, sem falha de código remanescente.

- Typecheck e lint passaram novamente após adicionar o verificador de recuperação.
- Verificador local: 15 funções recuperadas, 33 policies compatíveis e quatro migrações aplicadas sobre o snapshot; oito checks de prontidão passaram localmente.
- Os oito checks também passaram na produção autorizada.
- Build de produção da Vercel passou com lint e validação de tipos.
- A entrega de aplicação anterior passou em `npm test` (60) e `npm run test:e2e` (20, desktop/celular), conforme PIX_GOOGLE_LEGAL.md. O início OAuth também foi verificado no servidor real; o login completo foi confirmado pelo usuário.
- Entrega de SMTP, QR no aplicativo bancário, recebimento/conferência de Pix e uploads reais ainda precisam de homologação. Nenhuma transferência foi realizada pelo agente.
- O snapshot arquiva os objetos afetados pelas migrações e não substitui backup completo de desastre. Planilha privada e snapshots permanecem fora do Git.

## Ordem de publicação

1. Confirmar a saúde do Supabase, o schema existente e backup recuperável.
2. Aplicar e validar as quatro migrações novas, em ordem. Não reaplicar as migrações históricas nem usar `db push` sem reconciliar o histórico.
3. Atualizar os redirects do Auth, preservando links antigos ainda em trânsito.
4. Publicar o código testado com um build de **produção**. Não promover diretamente uma prévia compilada sem as variáveis de produção.
5. Verificar o domínio público, páginas legais e autenticação.

Pix real, identificação/contato do operador, Google OAuth e SMTP dependem de configuração fornecida pelo responsável. Não inventar valores nem contratar serviços.
