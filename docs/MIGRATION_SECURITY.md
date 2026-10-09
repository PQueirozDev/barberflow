# Aplicação segura — 202610080001_security_stability

Esta migração não foi executada em produção. As duas migrações de setembro
permanecem intactas. O arquivo novo contém BEGIN/COMMIT e deve ser aplicado uma
única vez, após as duas anteriores, usando o SQL Editor autorizado. Como o banco
existente não registra aquelas migrações no CLI, não use `supabase db push`
sem primeiro reconciliar o histórico em um trabalho separado.

## Antes da aplicação

1. Use um Supabase de staging independente; nunca reutilize credenciais de
   produção no staging. Testes locais usam schemas Auth/Storage simulados.
2. Confirme o schema atual contra o versionado e verifique RLS/policies locais
   adicionais antes de aplicar. Confirme extensão btree_gist e constraint
   EXCLUDE em appointments.
3. Faça backup recuperável do banco e registre, em local privado, definições
   atuais das funções (`pg_get_functiondef`), policies (`pg_policies`) e grants
   (`information_schema.role_routine_grants`). Não copie dados de clientes para
   planilhas ou para o repositório. Verifique restauração em staging.
4. Levante quantos MANAGER existem e avise que preço, equipe e personalização
   passam a exigir OWNER. Nenhuma associação é alterada pela migração.
5. Rode `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` e
   `npm run test:e2e`. O último recompila para fixtures locais e deixa `.next`
   com URLs fictícias; execute um novo `npm run build` com o ambiente correto
   antes de qualquer publicação autorizada.

## Aplicação em staging e homologação

Execute apenas `supabase/migrations/202610080001_security_stability.sql` no
staging, inteiro. Verifique OWNER/MANAGER em agenda, serviço, cliente, equipe,
personalização, permissões e upload. Use duas sessões para reservar o mesmo
horário e para editar a mesma reserva. Teste remarcação, reativação, conflitos,
intervalos, serviço inativo, cancelamento e atendimento encerrado.

Novos índices atendem busca de telefone legado e limpeza de buckets expirados.
CREATE INDEX dentro da transação pode bloquear escrita em tabelas grandes:
avalie volume e janela antes da aplicação. Não altere a constraint GiST.
Não execute tests/live.mjs na produção. A entrega SMTP e comportamento real
de Auth/Storage ainda precisam ser homologados nesse staging.

Produção exige autorização explícita. Primeiro aplique a migração e valide,
depois publique o código autorizado: o código novo chama RPCs novas. Código
anterior continua compatível com as assinaturas originais, mas passa a receber
as negativas corretas para ações indevidas de MANAGER. Não altere a região.

## Rollback sem remover dados

Se a transação falhar, ela desfaz as alterações automaticamente. Verifique o
erro e o estado antes de tentar novamente; não reaplique uma transação já
confirmada. Não há backfill nem alteração massiva de clientes ou reservas.

Se houver regressão após commit, prefira voltar o código à versão anterior
e manter a autorização/proteção de clientes novas. Bloqueie a funcionalidade
afetada e prepare uma **nova migração corretiva** em staging; não edite este
arquivo depois que for aplicado. As assinaturas antigas das RPCs foram mantidas
para viabilizar essa volta do código. A versão anterior não possui as novas
telas de permissões nem editor de clientes.

Restaurar funções/policies anteriores exige revisão das definições arquivadas
e autorização, pois reabre as falhas corrigidas. Não execute DROP TABLE, não
restaure um backup sobre dados posteriores sem plano aprovado e não elimine
os índices/novas funções por rotina de rollback. Operações pessoais legítimas
realizadas após a aplicação devem ser preservadas.

## Convenções implementadas

- OWNER: configurações, equipe, permissões, preços, operações e relatórios.
- MANAGER: agenda, clientes, serviços, horários, bloqueios e relatórios atuais.
  Cria serviço inicialmente com preço zero; OWNER define o preço. Não altera
  preço existente nem troca reserva para serviço de preço diferente.
- Plano continua provisionado pelo ADMIN da plataforma. Não há checkout nem
  adapter de cobrança; não permitir autopromoção FREE → PRO. Gestão externa de
  assinatura pelo OWNER depende da futura integração de billing.
- PENDING → CONFIRMED/CANCELLED/NO_SHOW; CONFIRMED → COMPLETED/CANCELLED/NO_SHOW.
  Conclusão e ausência exigem que o horário já tenha começado. COMPLETED e
  NO_SHOW são terminais. CANCELLED só reativa para PENDING/CONFIRMED mediante
  seleção explícita de horário disponível. Mesmo status sem mudança é idempotente.
- Remarcação para o mesmo serviço preserva preço e duração da reserva; mudar
  serviço gera novos snapshots. FREE é revalidado na reativação/remarcação.
- A UI usa updated_at integral para rejeitar edição obsoleta. RPC antiga
  continua serializada, mas não recebe versão esperada; integrações futuras
  devem usar manage_appointment_checked.
- Nova reserva com telefone existente reutiliza o cadastro, sem atualizar PII.
  OWNER/MANAGER corrigem cadastro intencionalmente na área autenticada. Números
  brasileiros usam DDD + número; +55 é aceito na entrada. Registros antigos
  não são reescritos nem mesclados, incluindo eventuais duplicatas legadas.

Limites HTTP são por IP confiável na Vercel; fora dela, bucket compartilhado.
O bucket extra de telefone/email usa SHA-256 e transação independente. O limite
da RPC book_appointment faz parte da transação: falhas SQL não incrementam seu
contador, por isso a API também limita as tentativas antes da reserva.
Chave pública permite chamar projeções/slots diretamente no Supabase: limites
HTTP não substituem controles da infraestrutura nem limites nativos do Auth.
