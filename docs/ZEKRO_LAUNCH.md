# Zekro: identidade, teste e preparação para lançamento

O produto passa a se chamar Zekro. A oferta é Zekro Pro por **R$ 49,90/mês**, com **7 dias de teste**. Não há oferta gratuita permanente. O endereço pretendido é **https://zekro.vercel.app**; sua disponibilidade e vinculação na Vercel ainda não foram confirmadas.

## Banco e compatibilidade

Aplicar, somente depois de homologação e autorização de produção:

1. `202610080001_security_stability.sql` (documentada em MIGRATION_SECURITY.md).
2. `202610080002_trial.sql`.
3. `202610080003_manual_pix.sql`.
4. `202610080004_terms_acceptance.sql`.

A segunda migração concede sete dias a usuários FREE existentes a partir da aplicação. PRO existente mantém status e prazo. Novas barbearias recebem PRO/trialing com prazo de sete dias definido no banco. FREE permanece como valor histórico, mas não concede acesso a novas reservas. Não há alteração de dados pessoais nem remoção de tabelas.

Após expiração, novas reservas e remarcações/reativações são bloqueadas por trigger, inclusive em gravações diretas. Histórico, cancelamento, confirmação e conclusão de reservas existentes continuam acessíveis. Não basta alterar a interface para obter acesso. Membros não podem alterar a assinatura via RLS.

Para rollback em homologação, reverter o código junto com a migração: remover apenas os dois triggers novos e suas funções, restaurar os defaults anteriores da tabela. Não estender ou converter assinaturas em massa; exportar antes os registros afetados e restaurar apenas os registros identificados que não receberam alterações legítimas depois da migração. Na produção, preparar e revisar uma migração compensatória antes de executar. Nunca apagar agendamentos.

## Pendências reais de lançamento

- Configurar Pix direto e o recebedor real; homologar QR no banco e a confirmação manual em /admin/pix. Não haverá intermediário ou cobrança recorrente. Consulte docs/PIX_GOOGLE_LEGAL.md.
- Habilitar Google OAuth no Supabase/Google e configurar identidade/contato das páginas legais.
- Configurar SMTP e validar confirmação/recuperação em homologação (docs/SMTP.md).
- Confirmar disponibilidade do nome Zekro e do endereço Vercel. Vincular o endereço somente após autorização.
- Definir NEXT_PUBLIC_APP_URL=https://zekro.vercel.app na Vercel e atualizar Site URL/redirect allowlist no Supabase. Não substituir URLs antigas antes de validar links de recuperação/confirmacão em trânsito.
- Aplicar migrações em homologação, validar backup e obter autorização antes de produção.
- Rever políticas de privacidade, termos e suporte com os dados reais do responsável pelo serviço. Não inventar identidade jurídica ou garantias de serviço.

## Entrega e deploy

As mudanças são enviadas à branch `feat/zekro-security-trial`. Sua implantação automática está desabilitada em vercel.json para respeitar a instrução de não fazer deploy automático. Fazer merge e deploy só após resolver as pendências acima. A implementação atual é de Pix direto, com liberação administrativa após conferência bancária. Configuração real e homologação bancária ainda pendentes.

A planilha privada original continua fora do Git: `C:\Users\Pedro\Documents\Barberflow_Privado\Barberflow_Gerenciamento_Acessos.xlsx`. Atualizar os dados de plataforma apenas após confirmar a configuração real; nunca incluir credenciais.

## Validação executada em 08/10/2026

- npm run typecheck: aprovado.
- npm run lint: aprovado.
- npm test: 48 testes aprovados, incluindo migração de FREE legado, preservação de PRO e concorrência PostgreSQL nativa.
- npm run build: aprovado; build local final reconstruído após E2E para remover os endpoints fictícios do build de teste.
- npm run test:e2e: 14 aprovados em desktop e celular; validações de marca/preço e ausência de overflow horizontal.
- Inspeção visual por capturas locais em 1440px e 390px.

Nenhuma migração remota, configuração de SMTP, cobrança ou deploy foi executado. A auditoria anterior está em docs/DELIVERY.md e docs/AUDIT.md; os resultados acima são os mais recentes. Pendência de dependências: sete avisos altos no conjunto de ferramentas de desenvolvimento documentados em docs/DEPENDENCIES.md; dependências de produção sem alertas na auditoria anterior.
