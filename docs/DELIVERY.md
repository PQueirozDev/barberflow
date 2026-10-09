# Entrega da auditoria — 08/10/2026

Alterações locais concluídas, sem commit/push, deploy, migração remota, troca de
credenciais, plano ou região. Design e estilos existentes preservados. As duas
migrações já aplicadas continuam intactas. Nenhum dado de produção foi removido.

## Problemas encontrados e correções

| Evidência no código anterior | Correção entregue |
| --- | --- |
| update_shop, escrita de equipe e Storage verificavam somente associação | OWNER para configurações/equipe/preço, MANAGER operacional; RLS, RPCs e servidor; Storage de serviços separado e suspensão respeitada |
| ON CONFLICT de book_appointment sobrescrevia nome/WhatsApp/email | Cadastro existente reutilizado sem modificar PII; +55 normalizado; lookup legado sem backfill; edição intencional autenticada pelo mesmo tenant |
| manage_appointment aceitava transições arbitrárias de status | Máquina de estados, estados terminais e reativação explícita com disponibilidade; constraint GiST preservada |
| Remarcação reprificava/recalculava reservas e não recebia versão esperada | Snapshots preservados no mesmo serviço, slots compatíveis com a duração histórica, updated_at integral e locks; FREE revalidado |
| Disponibilidade sem limite da aplicação, recovery/reset somente no navegador | Rotas com Zod, origem, corpo limitado e rate limit persistente; erro público seguro; refresh sessions revogadas após redefinição |
| errorMessage podia devolver diagnósticos SQL nas APIs | Allowlist de mensagens públicas; detalhes internos não aparecem na resposta |
| getAppointments filtrava dias locais como UTC e excluía último segundo | Intervalo da meia-noite local até o dia seguinte, exclusivo; índice existente aproveitado |
| Chamadas duplicadas a Auth/tenant por layout e página | Cache de React por renderização, sem cache global de sessões |
| Dependências com avisos de segurança e imports inexistentes | Next 15.5.27, dependências transitivas corrigidas, três dependências sem uso removidas; pendências de build registradas |

Permissões OWNER/MANAGER existentes são mantidas; nenhum usuário foi promovido.
OWNER pode alterar papéis de membros já associados, mantendo pelo menos um
proprietário. Convite/cadastro de novos acessos e checkout não foram inventados.
Plano continua provisionado pelo ADMIN da plataforma; gestão externa de cobrança
pelo OWNER depende da futura integração de billing.

## Migração criada

`supabase/migrations/202610080001_security_stability.sql`: funções de autorização,
policies incrementais, proteção financeira em escrita direta, gerenciamento de
papéis/cadastro, reservas/slots, EXECUTE restrito, search_path com pg_temp ao final
e índices de telefone normalizado/rate-limit expirado. Sem DROP TABLE ou backfill.

Validada em PGlite e PostgreSQL nativo descartável. **Não aplicada em produção.**
Aplicação, homologação, ordem código/banco e rollback não destrutivo estão em
[MIGRATION_SECURITY.md](MIGRATION_SECURITY.md).

## Validação executada

| Comando/verificação | Resultado |
| --- | --- |
| Referência inicial: typecheck, lint, build, npm test | Passou; 16 testes |
| E2E inicial | Não abriu navegador: Chromium ausente |
| npm run typecheck | Passou |
| npm run lint | Passou |
| npm test | 45 testes, 45 passaram, zero falhas/pulados |
| npm run build | Passou com Next 15.5.27 |
| npm run test:e2e | 14 cenários passaram com Chrome instalado; desktop/celular e APIs com fixtures locais |
| E2E após ajuste final de slots SQL | 14 cenários passaram novamente, reutilizando o build local isolado |
| PostgreSQL nativo | Cinco cenários de concorrência passaram com conexões independentes |
| npm audit --omit=dev | Zero vulnerabilidades no lock atual |
| npm audit completo | Sete entradas high restantes na cadeia braces/Tailwind/ESLint; não é resultado zerado |
| Templates SMTP | --check passou; nenhum email real enviado |
| Bundle do navegador | 54 arquivos JS verificados, sem nome da variável administrativa ou chave fictícia service de teste |
| Excel | Reabertura, quatro abas/tabelas, filtros, validações e fórmulas conferidos; cache XML do total = 0 e custos desconhecidos = 4 |

Testes cobrem isolamento, OWNER/MANAGER, permissões EXECUTE, Storage/suspensão,
cliente público/correção autenticada, telefones, estados, cancelamento, reativação,
remarcação, disponibilidade, snapshots, versão obsoleta, limites, origem, erros e
inputs públicos. GiST também foi testado com inserções concorrentes diretas;
PostgreSQL pode abortar um dos escritores por conflito ou deadlock, preservando
uma única reserva. RPCs usam lock de tenant para evitar essa disputa direta.

O teste nativo não usa .env/DATABASE_URL. Auth e Storage dos testes são simulados.
tests/live.mjs não foi executado: ele escreve no Supabase configurado, que pode
ser produção. A entrega SMTP, confirmação/reset completos e upload real precisam
de um staging autorizado. Informações remotas de ENVIRONMENT.md são históricas.

O JavaScript inicial de cadastro/login/recuperação passou de **179 kB para 110 kB**
no relatório Next, retirando o SDK Supabase dessas telas. Não foi medida latência
de produção, planos EXPLAIN remotos ou score Lighthouse; não há alegação de ganho
medido nesses indicadores. CSS de identidade visual não foi alterado.

## Arquivos modificados e adicionados

```text
.gitignore
.vercelignore
README.md
docs/ARCHITECTURE.md
docs/ENVIRONMENT.md
docs/AUDIT.md
docs/DEPENDENCIES.md
docs/DELIVERY.md
docs/MIGRATION_SECURITY.md
docs/SMTP.md
package.json
package-lock.json
playwright.config.ts
scripts/configure-auth-email.mjs
scripts/test-e2e.mjs
src/app/api/appointments/route.ts
src/app/api/availability/route.ts
src/app/api/login/route.ts
src/app/api/register/route.ts
src/app/api/recover/route.ts
src/app/api/reset-password/route.ts
src/app/dashboard/barbeiros/page.tsx
src/app/dashboard/clientes/[id]/page.tsx
src/app/dashboard/configuracoes/page.tsx
src/app/dashboard/layout.tsx
src/app/dashboard/page.tsx
src/app/dashboard/pagina/page.tsx
src/app/dashboard/servicos/page.tsx
src/components/auth-form.tsx
src/components/dashboard/appointment-manager.tsx
src/components/dashboard/catalog.tsx
src/components/dashboard/customer-editor.tsx
src/components/dashboard/member-permissions.tsx
src/components/dashboard/shell.tsx
src/components/image-upload.tsx
src/lib/api-security.ts
src/lib/appointment-status.ts
src/lib/auth.ts
src/lib/date-range.ts
src/lib/http.ts
src/lib/permissions.ts
src/lib/validation.ts
src/services/actions.ts
src/services/queries.ts
src/types/domain.ts
supabase/migrations/202610080001_security_stability.sql
supabase/templates/confirmation.html
supabase/templates/recovery.html
tests/api-security.test.ts
tests/concurrency.test.ts
tests/database.test.ts
tests/e2e/security.spec.ts
tests/helpers/schema.ts
tests/helpers/supabase-test-server.ts
tests/security.test.ts
```

## Planilha administrativa privada

Arquivo: `C:\Users\Pedro\Documents\Barberflow_Privado\Barberflow_Gerenciamento_Acessos.xlsx`.
Quatro abas, tabelas, filtros, cores atuais, campos ajustados, listas e fórmulas
de total mensal/custos sem valor. Informações vieram da documentação/código e
URL fornecida. Emails, responsáveis, 2FA, referências de senhas, pagamentos e
datas desconhecidas ficaram em branco. Planos gratuitos são registros históricos,
não confirmação de fatura atual. SMTP aparece como pendente.

Nenhuma senha/token/chave/código de recuperação ou cliente real foi lido para
essa planilha. Contém somente nomes de variáveis. Pasta fora do repositório,
ACL restrita a QRZ\Pedro e SYSTEM. Nome do arquivo também ignorado por Git/Vercel
como defesa contra cópia acidental. Gerador local fica na mesma pasta privada;
dependência ExcelJS foi instalada apenas em ferramenta temporária, não no projeto.

Atualize contas, responsáveis, planos e renovações ao confirmar as informações;
em localização de senha escreva apenas cofre/item do gerenciador. Insira novos
custos dentro da tabela para ampliar a fórmula. Nunca anexe segredos. Mantenha
backup privado; se necessário, use a criptografia por senha do Excel, guardando
a senha exclusivamente no gerenciador. ACL não substitui criptografia para cópias
fora do computador. Não enviar a planilha ao GitHub.

## Riscos e pendências

- Homologar SQL, Auth, Storage e entrega de email no Supabase staging antes de
  qualquer aplicação autorizada. Inventariar policies/manutenções manuais remotas.
- Migração cria índices na transação; avaliar volume e janela para bloqueios.
- Código novo exige as RPCs novas: aplicar banco antes do deploy autorizado.
- E2E deixa .next com URLs de teste. Recompilar com configuração correta antes
  de publicar; nenhum deploy foi realizado.
- Sete avisos de ferramentas de build permanecem; [DEPENDENCIES.md](DEPENDENCIES.md)
  explica a cadeia e o limite da correção sem migração major de Tailwind.
- Supabase Auth/projeções públicas podem ser chamados diretamente com chave
  pública: rate limits HTTP não substituem limites da infraestrutura/Auth.
- JWTs já emitidos sobrevivem à revogação de refresh até expirar. Cadastro
  compartilhado por telefone não comprova posse do número. Duplicatas legadas
  não foram mescladas automaticamente.

## Recomendações para Barberflow 2.0 — não implementadas como bugs

1. Billing com checkout/webhooks idempotentes e portal do OWNER, sem autopromoção
   de plano, somente após escolher e autorizar provedor.
2. Convites e revogação de acessos com trilha de auditoria; políticas de retenção
   e direitos do titular para clientes; confirmação opcional de telefone.
3. Paginação e agregações de relatórios no servidor, guiadas por medição de volume,
   EXPLAIN/latência e perfil mobile. Não mudar região por suposição.
4. Homologação visual da migração Tailwind e monitoramento de patches do braces.
5. Testes de Auth/Storage/SMTP contra staging em CI e validação periódica de
   restauração de backups. Nenhum serviço pago contratado nesta entrega.
