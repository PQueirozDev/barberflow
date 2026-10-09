# Zekro: identidade, teste e preparação para lançamento

O produto passa a se chamar Zekro. A oferta é Zekro Pro por **R$ 49,90/mês**, com **7 dias de teste**. Não há oferta gratuita permanente. **https://zekro.vercel.app** está vinculado e serve a nova versão em produção. As quatro migrações de outubro foram aplicadas com autorização. Estado atual, verificações e snapshot privado: [DEPLOYMENT_20261008.md](DEPLOYMENT_20261008.md).

## Banco e compatibilidade

Ordem das migrações incrementais, já aplicadas na produção autorizada (não reaplicar):

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
- Avaliar o registro da marca Zekro conforme a operação. A disponibilidade do subdomínio Vercel já foi confirmada; isso não comprova disponibilidade jurídica da marca.
- NEXT_PUBLIC_APP_URL, Site URL e redirect allowlist foram atualizados, preservando todos os redirects anteriores encontrados no servidor.
- As migrações passaram em PostgreSQL local isolado com as definições recuperadas do snapshot de produção e foram aplicadas após autorização. Continuar com homologação real de Auth/Storage e entrega de emails; o snapshot das migrações não substitui backup completo de desastre.
- Rever políticas de privacidade, termos e suporte com os dados reais do responsável pelo serviço. Não inventar identidade jurídica ou garantias de serviço.

## Entrega e deploy

Após autorização do usuário para publicar, as mudanças foram incorporadas à `main` por fast-forward e enviadas ao GitHub. A Vercel executou um build de produção. A implantação automática continua desabilitada apenas para `feat/zekro-security-trial`; a `main` é a branch de produção. O Pix usa liberação administrativa após conferência bancária. Homologação bancária ainda pendente.

A planilha privada original continua fora do Git: `C:\Users\Pedro\Documents\Barberflow_Privado\Barberflow_Gerenciamento_Acessos.xlsx`. Atualizar os dados de plataforma apenas após confirmar a configuração real; nunca incluir credenciais.

## Validação executada em 08/10/2026

- npm run typecheck: aprovado.
- npm run lint: aprovado.
- npm test: 48 testes aprovados, incluindo migração de FREE legado, preservação de PRO e concorrência PostgreSQL nativa.
- npm run build: aprovado; build local final reconstruído após E2E para remover os endpoints fictícios do build de teste.
- npm run test:e2e: 14 aprovados em desktop e celular; validações de marca/preço e ausência de overflow horizontal.
- Inspeção visual por capturas locais em 1440px e 390px.

Os números acima registram a entrega inicial de marca/teste. A entrega posterior de Pix/Google teve 60 testes e 20 E2E aprovados (docs/PIX_GOOGLE_LEGAL.md). O estado remoto posterior está em docs/DEPLOYMENT_20261008.md. A auditoria anterior está em docs/DELIVERY.md e docs/AUDIT.md. Pendência de dependências: sete avisos altos no conjunto de ferramentas de desenvolvimento documentados em docs/DEPENDENCIES.md; dependências de produção sem alertas na auditoria anterior.
