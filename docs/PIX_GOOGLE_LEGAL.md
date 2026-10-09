# Pix direto, Google e páginas legais

## Estado da implementação

Atualização remota: as migrações foram aplicadas em produção com autorização e a nova versão está em https://zekro.vercel.app. Configuração de Pix/contato fornecida pelo responsável foi registrada somente nas variáveis de produção da Vercel; seus valores não são registrados neste documento. Google OAuth ainda precisa do cliente Google Cloud. Consulte [DEPLOYMENT_20261008.md](DEPLOYMENT_20261008.md) para o estado atual; as observações de configuração pendente abaixo registram a entrega local anterior.

O pagamento do Zekro Pro é **Pix direto**, sem Mercado Pago, Stripe, webhook bancário ou cobrança recorrente. São R$ 49,90 por **30 dias**, após sete dias de teste. Não existe taxa de intermediário integrada. Tarifas bancárias, infraestrutura e limites dos planos gratuitos são externos ao código; não se deve prometer operação gratuita ilimitada.

### Configurar o recebedor

Configurar no ambiente do servidor (sem inventar valores):

- `PIX_KEY`: chave cadastrada na conta recebedora. Preferir chave aleatória para reduzir exposição de CPF, email ou telefone.
- `PIX_RECEIVER_NAME`: nome do recebedor, até 25 caracteres após normalização.
- `PIX_RECEIVER_CITY`: cidade, até 15 caracteres após normalização.
- `PLATFORM_OPERATOR_NAME`: identificação real do responsável pela plataforma, exibida em `/contato`.
- `SUPPORT_EMAIL`: email de atendimento real, exibido em `/contato`.

Não são tokens bancários. A chave e o recebedor aparecem necessariamente nas instruções do Pix. São enviados apenas ao proprietário autenticado no painel; não salvar em planilhas públicas ou usar credenciais bancárias nesses campos. Nenhuma configuração real foi extraída de arquivos privados nem aplicada à produção.

### Fluxo

1. OWNER acessa Configurações → Pagar com Pix → Gerar instruções.
2. Banco registra solicitação de R$ 49,90, período de 30 dias e `txid` único. Solicitações abertas para o mesmo recebedor são reutilizadas.
3. QR estático/copia e cola é gerado localmente segundo BR Code, com CRC16. Conferir titular real e valor no banco antes de transferir.
4. OWNER usa “Já fiz o Pix” depois da transferência. Isso apenas marca REPORTED; não concede acesso.
5. ADMIN da plataforma acessa `/admin/pix`, confere o crédito real na conta e informa R$ 49,90 e o identificador EndToEnd de 32 caracteres da transferência.
6. A confirmação transacional registra administrador, data e referência bancária, e acrescenta 30 dias ao prazo vigente. A mesma solicitação ou referência bancária não pode liberar acesso duas vezes. Confirmações concorrentes também são idempotentes.

Não é permitido aprovar usando apenas mensagem, captura de tela ou comprovante enviado pelo pagador. Não há upload de comprovantes ou coleta de CPF do pagador no Zekro. MANAGER não acessa instruções nem aprova pagamentos. OWNER não aprova seu próprio crédito; somente ADMIN da plataforma o faz.

O QR **estático não expira no banco** e pode ser pago mais de uma vez. A interface orienta a não repetir o Pix. Pagamentos duplicados, referências ausentes e transferências depois de recusa exigem conciliação manual e suporte. Reembolso é feito no banco pelo responsável; este código não executa transferências nem estornos. A recusa encerra uma solicitação aberta sem alterar a assinatura; não representa estorno de dinheiro.

Antes de lançar, definir atendimento, prazo operacional de conferência, identificação do responsável, política de retenção e procedimento de reembolso. Não há SLA de confirmação inventado nos textos.

## Migrações

Aplicar em homologação após as migrações 001 de segurança e 002 de teste:

- `202610080003_manual_pix.sql`: tabelas de solicitações e auditoria com RLS; RPCs OWNER/ADMIN e liberação idempotente.
- `202610080004_terms_acceptance.sql`: campos de aceite em profiles e onboarding com aceite transacional.

Para produção, autorização explícita permanece obrigatória. Não houve aplicação remota.

Rollback: antes da aplicação, exportar assinaturas, registrar os objetos novos e testar uma reversão em homologação. Em caso de problema, desabilitar novas solicitações removendo **apenas as configurações Pix do ambiente**, voltar o código e manter tabelas/auditoria/assinaturas confirmadas para conciliação. Não apagar registros de pagamentos nem desfazer acesso pago em massa. Preparar uma migração compensatória revisada se for necessário revogar RPCs ou remover o fluxo. Os campos de aceite podem permanecer; não apagar o histórico.

## Google OAuth

O botão está em login/cadastro. `/auth/google` inicia OAuth pelo Supabase SSR com **PKCE**, callback fixo e limite de tentativas. Não há Client Secret no navegador. A rota existente `/auth/callback` troca o código por sessão e segue ao dashboard/onboarding. Não há solicitação de escopos de Gmail, Drive ou contatos.

Para habilitar (configuração externa ainda pendente):

1. Criar um cliente OAuth do tipo Web no Google Auth Platform e preencher nome Zekro, contato, termos e privacidade com as URLs publicadas.
2. Autorizar no Google a origem real do aplicativo. Em **Authorized redirect URIs**, usar o callback mostrado pelo Supabase: `https://<project-ref>.supabase.co/auth/v1/callback` (não confundir com o callback Next.js).
3. Habilitar Google em Supabase → Authentication → Providers e configurar Client ID e Client Secret no provedor. Guardar o secret no gerenciador de senhas; nunca no Git/Excel.
4. Supabase → URL Configuration: Site URL real e redirect allowlist incluindo `https://zekro.vercel.app/auth/callback` e o callback local de desenvolvimento, depois de confirmar o endereço na Vercel.
5. Configurar `NEXT_PUBLIC_APP_URL` com a origem real, validar login completo e logout com uma conta de teste. Em modo de testes do Google, cadastrar test users conforme necessário.

Não foi feito login real no Google: faltam cliente/provedor configurados e autorização de alteração remota. O E2E valida início do OAuth, cookie PKCE e redirecionamento seguro contra o fixture local; não simula uma aprovação real do Google.

## Páginas legais

- `/termos`: preço, sete dias de teste, Pix direto, conferência manual, ausência de renovação automática, acesso após expiração, cancelamento e direitos legais.
- `/privacidade`: categorias de dados, finalidades, contas Google, separação de barbearias, fornecedores, cookies, direitos e conservação.
- `/contato`: identificação e email configuráveis, sem informações fictícias.

Cadastro por email exige checkbox validado no servidor. Onboarding de novos usuários, inclusive Google, exige aceite da versão `2026-10-08` e registra data/versão na mesma transação da criação da barbearia. A RPC histórica `create_barbershop` permanece por compatibilidade; os fluxos atuais usam `onboard_with_terms`. Não foi atribuído aceite retroativo a usuários existentes. Adequar os textos à identidade e operação reais antes da contratação pública.

## Referências técnicas

- [Manual de padrões do Pix — Banco Central](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf).
- [Gerador QR local de código aberto](https://github.com/soldair/node-qrcode).
- [Google Auth — Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google).
- [PKCE — Supabase](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

## Arquivos desta entrega

- `.env.example`
- `README.md`
- `docs/PIX_GOOGLE_LEGAL.md`
- `docs/ZEKRO_LAUNCH.md`
- `package-lock.json`
- `package.json`
- `src/app/admin/page.tsx`
- `src/app/admin/pix/page.tsx`
- `src/app/api/register/route.ts`
- `src/app/auth/google/route.ts`
- `src/app/contato/page.tsx`
- `src/app/dashboard/configuracoes/page.tsx`
- `src/app/dashboard/pagamento/page.tsx`
- `src/app/login/page.tsx`
- `src/app/page.tsx`
- `src/app/privacidade/page.tsx`
- `src/app/termos/page.tsx`
- `src/components/auth-form.tsx`
- `src/components/legal-layout.tsx`
- `src/components/onboarding-form.tsx`
- `src/components/pix-copy.tsx`
- `src/components/public-shop.tsx`
- `src/lib/legal.ts`
- `src/lib/pix-config.ts`
- `src/lib/pix.ts`
- `src/lib/validation.ts`
- `src/services/actions.ts`
- `src/services/billing.ts`
- `src/services/pix-actions.ts`
- `supabase/migrations/202610080003_manual_pix.sql`
- `supabase/migrations/202610080004_terms_acceptance.sql`
- `tests/concurrency.test.ts`
- `tests/e2e/public.spec.ts`
- `tests/pix-database.test.ts`
- `tests/pix.test.ts`

## Validação local

- npm run typecheck: aprovado.
- npm run lint: aprovado.
- npm test: 60 testes aprovados.
- npm run test:e2e: 20 testes aprovados (desktop e celular).
- npm audit --omit=dev: zero vulnerabilidades.
- Login Google real e transferência Pix real não foram executados; testes usam banco local e OAuth de início isolado.
- npm run build: aprovado; build final reconstruído após o E2E com o ambiente local normal.
- Inspeção visual local de login desktop e Termos em celular concluída.

A planilha privada foi atualizada com os nomes das cinco variáveis novas, Google Auth Platform e banco/Pix direto; nenhum valor de chave foi registrado. Backup privado preservado fora do Git. A conta de conferência precisa ter papel ADMIN da plataforma configurado pelo responsável em ambiente autorizado; OWNER/MANAGER não podem promover a si mesmos.
