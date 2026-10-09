# Auditoria de segurança e estabilidade — 08/10/2026

## Referência antes das alterações

Leitura de README, ARCHITECTURE, ENVIRONMENT, duas migrações, RLS, RPCs,
ações, rotas públicas, Auth, Storage, consultas e componentes. Árvore Git limpa.
Typecheck, lint, build e 16 testes passaram. E2E tentou executar os quatro
cenários, mas o Chromium do Playwright não está instalado.
Nenhuma operação remota de escrita foi realizada. Não executar tests/live.mjs
com as credenciais de produção.

## Correções por prioridade

1. **P0 — autorização:** update_shop e escrita de profissionais autorizam
   qualquer membro, inclusive MANAGER. Storage também aceita membros suspensos.
   Introduzir OWNER/operacional no SQL, RLS e servidor; preservar os papéis atuais.
2. **P0 — privacidade:** book_appointment altera nome, WhatsApp e email pelo
   telefone informado por um visitante. Reutilizar cadastro sem sobrescrever
   dados; normalizar números com e sem +55 sem migração destrutiva de clientes.
3. **P1 — reservas:** manage_appointment não define máquina de estados;
   COMPLETED pode voltar para CONFIRMED, CANCELLED pode virar NO_SHOW e uma
   atualização concorrente pode sobrescrever a anterior. Validar transições,
   disponibilidade, snapshots e versão esperada sob lock transacional.
4. **P1 — abuso e erros:** disponibilidade não tem limite da aplicação;
   recuperação e redefinição usam somente SDK no navegador. Erros públicos
   podem retornar mensagens internas. Adicionar validação e limites no servidor.
5. **P2 — consultas:** getAppointments filtra dias em UTC, apesar do fuso da
   barbearia, e exclui o último segundo do dia. Corrigir limites locais inclusivos
   e reaproveitar contexto Auth por renderização.
6. **P2 — operação:** preparar SMTP e templates para Supabase Auth, instruções
   de staging/aplicação/rollback e registros administrativos sem credenciais.

## Limites da auditoria

As políticas analisadas são as versionadas; alterações manuais remotas não
foram verificadas. EXCLUDE GiST, FKs compostas, ADMIN protegido, service_role
exclusiva do servidor, callback restrito e bucket limitado a imagens/5 MB já
existem e serão preservados. Prisma e Docker são legado documentado, sem
imports na aplicação; não é necessário apagá-los para corrigir os bugs.
Nenhuma lentidão foi medida em produção e nenhuma troca de região é proposta.
