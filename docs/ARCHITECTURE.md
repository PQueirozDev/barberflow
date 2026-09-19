# Barberflow — arquitetura

## Decisões antes da implementação

Next.js App Router, React, TypeScript e Tailwind. Supabase fornece Auth com cookies SSR, PostgreSQL e Storage. Server Actions para operações autenticadas; Route Handlers para disponibilidade e reservas públicas. Nenhuma chave administrativa no navegador. O legado Prisma/Auth.js será desativado, sem remover dados de bancos existentes.

## Modelo

`profiles` referencia `auth.users` e mantém o nome e papel global USER/ADMIN. `barbershops` representa o tenant, com slug único, timezone IANA, dados públicos e suspensão. `barbershop_members` relaciona responsáveis ao tenant. `barbers`, `services`, `barber_services`, `customers`, `appointments`, `business_hours`, `barber_availability`, `blocked_times` e `subscriptions` possuem UUID e vínculo ao tenant. Foreign keys compostas impedem referências cruzadas. Valores monetários em centavos; instantes em timestamptz; horários semanais locais.

## Rotas

`/`: marketing; `/demonstracao`: demonstração explicitamente ilustrativa; `/cadastro`, `/login`, `/recuperar-senha`, `/redefinir-senha`, `/auth/callback`: autenticação; `/onboarding`: criação transacional; `/dashboard`: indicadores; `/dashboard/agenda`, `/dashboard/agendamentos`, `/dashboard/clientes`, `/dashboard/clientes/[id]`, `/dashboard/barbeiros`, `/dashboard/servicos`, `/dashboard/pagina`, `/dashboard/relatorios`, `/dashboard/configuracoes`: gestão; `/admin`: administração global; `/[slug]`: página e reserva pública. `/b/[slug]` preserva links antigos.

## Autorização e isolamento

Servidor valida usuário via Supabase Auth e resolve associação, sem aceitar tenant arbitrário. RLS é a segunda barreira. Dados privados nunca são legíveis anonimamente. A página pública usa RPC de projeção segura: só campos públicos, serviços ativos e barbeiros ativos. ADMIN vem de tabela protegida, nunca de user_metadata. Planos e suspensão só são alterados por administração. Storage usa primeiro segmento UUID do tenant e políticas de associação.

## Agendamento

Uma única função de slots no PostgreSQL considera timezone, funcionamento, disponibilidade, intervalos representados por múltiplas janelas, bloqueios, duração e reservas. A criação transacional adquire lock do barbeiro, recalcula os slots, aplica limites e cadastra cliente/reserva atomicamente. Constraint EXCLUDE GiST sobre intervalo [início,fim) impede sobreposição inclusive em inserções concorrentes diretas. Remarcação reutiliza validação. Status CANCELLED/NO_SHOW não ocupam agenda. Preço e duração são snapshots na reserva. Rate limit persistente aplicado antes da RPC pública pela API, com bucket adicional por telefone no banco.

## Billing e notificações

Assinatura FREE/PRO separada do tenant; provider/provider_subscription_id para futuro adapter Stripe/Mercado Pago. Sem cobrança fictícia. FREE limitado a 50 reservas por mês. Links wa.me permitem envio manual; nenhuma mensagem automática é enviada.

## Validação e entrega

Etapas: 1 arquitetura/schema; 2 autenticação/onboarding; 3 catálogo/horários/reserva; 4 dashboard/agenda/clientes/relatórios; 5 personalização/admin; 6 integração, testes e documentação. Testes SQL devem cobrir isolamento, acesso anônimo, referências cruzadas, disponibilidade e conflito; testes de domínio e build completam a validação. Configuração remota e deploy dependem do ambiente do usuário, não são presumidos.
