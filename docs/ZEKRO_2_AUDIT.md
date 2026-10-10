# Zekro 2.0 — auditoria e plano técnico

Referência: `2f7bd5b`, clonado em 09/10/2026. Branch `zekro-2-0-auditoria`.
Inventariados aplicação, componentes, serviços, Auth, APIs, seis migrações,
políticas RLS/Storage, testes, scripts, configurações, documentação e legado.
Prisma/Docker são legados sem participação no runtime. Nenhuma credencial ou
base remota foi usada. Os documentos de entregas anteriores são históricos.

## Achados confirmados

| Prioridade | Evidência | Tratamento |
| --- | --- | --- |
| P0 | Nenhum problema crítico novo confirmado na revisão local | Não atribuir falhas históricas já corrigidas à versão atual |
| P1 | `analytics.ts` soma COMPLETED em `revenue`; clientes exibem “Total gasto” sem tabela de recebimentos | Distinguir valor de serviços e recebimentos registrados; financeiro separado da assinatura |
| P2 | Agenda avança meses com ±28 dias, podendo permanecer no mesmo mês | Navegação por mês calendário com teste de virada/ano |
| P2 | Onboarding aceita HH:MM sem validar hora real; submissão final não chama validação dos campos | Validar etapas, horário e resumo antes de criar; banco transacional/idempotente |
| P2 | Demonstração possui links de todos os módulos para `/cadastro` | Simulador local com navegação e mutações em memória |
| P2 | Relatórios, clientes e agenda carregam todo histórico com paginação interna até esgotar | Relatórios agregados no banco, agenda com intervalo e clientes paginados |
| P2 | Sitemap/robots, canonical público e noindex privado ausentes | Metadados nativos, sitemap público e exclusão explícita de áreas privadas |
| P2 | `npm audit` retorna sete entradas high de ferramentas de desenvolvimento (braces e dependentes) | Sem patch compatível publicado; não fazer downgrade de Next ou migração major às cegas |
| P3 | CSS contém várias camadas de overrides; arquivos TSX muito compactos | Formatar arquivos alterados, acrescentar estilos delimitados e verificar responsividade |
| P3 | Histórico de solicitações Pix não aparece para OWNER | Listar histórico preservando RPCs atuais de aprovação |

## Proteções existentes preservadas

- RLS por tenant, FKs compostas, permissões OWNER/MANAGER e ADMIN protegido.
- EXCLUDE GiST, locks transacionais, snapshots e versão otimista nas reservas.
- Origem, Zod, limite de corpo e rate limiting persistente nas APIs públicas.
- OAuth PKCE e callback restrito, cookies SSR, revogação de refresh após reset.
- Upload permitido somente de JPEG/PNG/WebP, até 5 MB, com políticas por pasta.
- Pix manual idempotente: REPORTED não libera acesso; ADMIN confirma no banco.
- Teste de sete dias, expiração no banco e histórico mantido após expiração.

## Sequência de implementação

A. Corrigir os bugs confirmados e validar a base com testes locais.
B. Aproveitar a landing existente, CTAs claros, demo interativa sem API e assistente de sete passos (conta já concluída).
C. Indicadores/agregações por período, agenda por intervalo, personalização existente e retenção baseada em visitas concluídas.
D. Pagamentos de atendimentos, CSV seguro, mensagens manuais de WhatsApp, lista de espera opcional e programa de fidelidade com resgates explícitos.
E. SEO, acessibilidade, E2E, typecheck, lint, build e documentação de migração/recuperação.

Novas tabelas usam RLS, grants mínimos e RPCs com autorização no banco. Migrações
existentes permanecem intactas. Não há inferência retroativa de recebimentos.
Migrações novas são executadas somente em bancos locais descartáveis nesta entrega.

## Limites de verificação

Configuração Vercel/Supabase remota, login Google completo, entrega de email,
uploads reais e Core Web Vitals de produção dependem de homologação externa.
O acesso HTTP de leitura à produção não retornou conteúdo nesta sessão.
`tests/live.mjs` faz escritas e não será executado. Nenhum teste local comprova
recebimento bancário. Resultados novos ficam em `ZEKRO_2_DELIVERY.md`.

Referências consultadas: [advisory braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
(sem versão corrigida informada) e [metadados robots do Next.js](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots).
