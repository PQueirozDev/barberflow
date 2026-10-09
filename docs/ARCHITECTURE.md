# Zekro — arquitetura

## Decisões antes da implementação

Next.js App Router, React, TypeScript e Tailwind. Supabase fornece Auth com cookies SSR, PostgreSQL e Storage. Server Actions para operações autenticadas; Route Handlers para disponibilidade e reservas públicas. Nenhuma chave administrativa no navegador. O legado Prisma/Auth.js será desativado, sem remover dados de bancos existentes.

## Modelo

`profiles` referencia `auth.users` e mantém o nome e papel global USER/ADMIN. `barbershops` representa o tenant, com slug único, timezone IANA, dados públicos e suspensão. `barbershop_members` relaciona responsáveis ao tenant. `barbers`, `services`, `barber_services`, `customers`, `appointments`, `business_hours`, `barber_availability`, `blocked_times` e `subscriptions` possuem UUID e vínculo ao tenant. Foreign keys compostas impedem referências cruzadas. Valores monetários em centavos; instantes em timestamptz; horários semanais locais.

## Rotas

`/`: marketing; `/demonstracao`: demonstração explicitamente ilustrativa; `/cadastro`, `/login`, `/recuperar-senha`, `/redefinir-senha`, `/auth/callback`: autenticação; `/onboarding`: criação transacional; `/dashboard`: indicadores; `/dashboard/agenda`, `/dashboard/agendamentos`, `/dashboard/clientes`, `/dashboard/clientes/[id]`, `/dashboard/barbeiros`, `/dashboard/servicos`, `/dashboard/pagina`, `/dashboard/relatorios`, `/dashboard/configuracoes`: gestão; `/admin`: administração global; `/[slug]`: página e reserva pública. `/b/[slug]` preserva links antigos.

## Autorização e isolamento

Servidor valida usuário via Supabase Auth e resolve associação, sem aceitar tenant arbitrário. RLS é a segunda barreira. Dados privados nunca são legíveis anonimamente. A página pública usa RPC de projeção segura: só campos públicos, serviços ativos e barbeiros ativos. ADMIN vem de tabela protegida, nunca de user_metadata. Planos e suspensão só são alterados por administração. Storage usa primeiro segmento UUID do tenant e políticas de associação.

A migração incremental de 08/10 introduz is_owner/can_manage_operations.
OWNER controla configurações, equipe, permissões e preços; MANAGER controla
operações, serviços, horários, clientes e relatórios atuais. RLS e RPCs aplicam
as mesmas restrições, incluindo escrita direta de preço. Storage aceita MANAGER
apenas no subdiretório services e bloqueia membros de tenants suspensos.
Auth é reaproveitado somente no contexto de renderização via React cache.

## Agendamento

Uma única função de slots no PostgreSQL considera timezone, funcionamento, disponibilidade, intervalos representados por múltiplas janelas, bloqueios, duração e reservas. A criação transacional adquire lock do barbeiro, recalcula os slots, aplica limites e cadastra cliente/reserva atomicamente. Constraint EXCLUDE GiST sobre intervalo [início,fim) impede sobreposição inclusive em inserções concorrentes diretas. Remarcação reutiliza validação. Status CANCELLED/NO_SHOW não ocupam agenda. Preço e duração são snapshots na reserva. Rate limit persistente aplicado antes da RPC pública pela API, com bucket adicional por telefone no banco.

Slots e validação transacional compartilham as regras de funcionamento,
disponibilidade, grade de cinco minutos, duração, bloqueios e conflitos.
Remarcação do mesmo serviço usa o snapshot da reserva também na lista de slots;
chamadas públicas não excluem reservas nem obtêm essa duração histórica.
manage_appointment_checked serializa por tenant, bloqueia a linha e compara
updated_at integral. A assinatura antiga permanece disponível sem a comparação
otimista. Estados terminais e reativação explícita seguem a máquina documentada
em MIGRATION_SECURITY.md. Reativação/remarcação revalidam a vigência da assinatura.

book_appointment normaliza telefone brasileiro e reutiliza cadastro existente
sem sobrescrever PII. Correções cadastrais usam update_customer autenticado.
A API impõe buckets independentes por IP e telefone, que contam tentativas
falhas; as respostas públicas não incluem email/telefone cadastral nem IDs
de clientes. Rate limiting não é prova de posse do número.

## Billing e notificações

Assinatura separada do tenant, com teste de sete dias e acesso PRO por R$ 49,90 a cada 30 dias. Não há oferta de plano gratuito permanente. O pagamento é Pix direto, sem intermediário: OWNER solicita a fatura e informa o pagamento; ADMIN verifica o recebimento no banco e aprova com referência bancária única. Informar o pagamento não libera acesso. A aprovação transacional é idempotente e auditada. Links wa.me permitem envio manual; nenhuma mensagem automática é enviada.

`/dashboard/pagamento` atende o proprietário; `/admin/pix` exige ADMIN. Login Google usa PKCE em `/auth/google` e `/auth/callback`. `/termos`, `/privacidade` e `/contato` publicam as informações legais; onboarding registra a versão aceita dos termos.

## Validação e entrega

Etapas: 1 arquitetura/schema; 2 autenticação/onboarding; 3 catálogo/horários/reserva; 4 dashboard/agenda/clientes/relatórios; 5 personalização/admin; 6 integração, testes e documentação. Testes SQL devem cobrir isolamento, acesso anônimo, referências cruzadas, disponibilidade e conflito; testes de domínio e build completam a validação. Configuração remota e deploy dependem do ambiente do usuário, não são presumidos.

Os testes atuais incluem PGlite, PostgreSQL nativo com conexões independentes e
fixtures HTTP locais. E2E recompila com URLs locais e credenciais fictícias.
Auth/Storage reais e SMTP exigem homologação adicional em staging. A auditoria
de 08/10, resultados e pendências estão em DELIVERY.md.
