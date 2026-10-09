# Zekro — visual e identidade Google, 09/10/2026

Página inicial, cartões de recursos, ícones, formulários de autenticação e superfícies do painel refinados mantendo a identidade verde e as rotas existentes. FAQ explica teste de sete dias, assinatura por 30 dias, Pix com conferência manual e reservas sem conta. Sem fontes externas ou imagens adicionais no carregamento.

No projeto Google `zekro-511101`, o nome já era Zekro. Links de início, privacidade e termos estavam vazios: foram preenchidos e salvos. OAuth foi publicado em produção, sem alterar credenciais ou escopos. O Google confirmou que a marca ainda não era exibida; a verificação da marca foi iniciada. Aprovação depende do Google e não deve ser confundida com o salvamento do nome. Referência: https://supabase.com/docs/guides/auth/social-login/auth-google e https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification.

Validação: 61 testes unitários/SQL, 20 E2E desktop/celular, lint e build aprovados; typecheck aprovado após build. Inspeção visual local encontrou uma camada decorativa sobre a agenda e ela foi removida.

Pendências externas preservadas: recebimento/conferência de Pix real, confirmação de entrega de email pelo responsável e backup completo com restauração validada. Nenhum pagamento realizado, serviço pago contratado ou credencial alterada.
