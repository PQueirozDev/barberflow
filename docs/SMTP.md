# Email e autenticação

Atualização de produção: o SMTP existente foi preservado, e os assuntos/HTML dos templates de confirmação e recuperação Zekro foram aplicados pelo CLI oficial após a autorização para finalizar e publicar. As credenciais SMTP não foram extraídas nem alteradas. O Auth confirmou correspondência da configuração aplicada; entrega real e uso dos links ainda precisam ser homologados. Consulte [DEPLOYMENT_20261008.md](DEPLOYMENT_20261008.md).

Supabase Auth continua responsável pelos emails. Não há serviço pago contratado
nem credenciais SMTP configuradas por esta auditoria. Definir SMTP_* na Vercel
não configura sozinho o Supabase hospedado.

Os templates em `supabase/templates/` usam as cores atuais e o placeholder
`{{ .ConfirmationURL }}` de Auth. A confirmação passa por `/auth/callback`;
a recuperação usa `next=/redefinir-senha`. PKCE requer o navegador que iniciou
o fluxo. Código expirado/inválido redireciona ao login; solicite novo email.

## Preparação local e aplicação manual

Guarde em gerenciador de senhas ou arquivo privado ignorado pelo Git os valores
de SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL e
SMTP_FROM_NAME. Não use prefixo NEXT_PUBLIC. O remetente deve ser validado
no provedor; configure SPF, DKIM e DMARC no domínio quando disponível.

```sh
node scripts/configure-auth-email.mjs --check
node --env-file=/caminho/privado/smtp.env scripts/configure-auth-email.mjs
```

A segunda chamada apenas valida; não imprime valores nem acessa a rede.
Para aplicação manual em staging, o arquivo privado também precisa conter
SMTP_PROJECT_REF, SMTP_TARGET_ENV=staging e SUPABASE_ACCESS_TOKEN.
O token é da Management API, não é a service_role da aplicação.

```sh
node --env-file=/caminho/privado/smtp.env scripts/configure-auth-email.mjs --apply
```

Produção exige autorização explícita do responsável, SMTP_TARGET_ENV=production
e `--confirm-production=REFERENCIA_DO_PROJETO`. O script não altera confirmação
automática, domínio, plano nem região. Revogue o token administrativo de uso
temporário após a operação. Alternativamente, configure SMTP e cole os templates
no painel Auth do Supabase. Preserve a configuração anterior em local privado
para rollback manual, sem gravar credenciais no repositório.

## Validação em staging

Verifique cadastro/confirmar email, login antes e depois da confirmação,
recuperação para conta conhecida e desconhecida, link expirado, reutilizado e
aberto em outro navegador, senha curta e sessão expirada. Após redefinir,
o servidor revoga sessões de refresh globalmente e retorna ao login. JWTs de
acesso já emitidos permanecem válidos até sua expiração configurada no Auth.
O middleware valida usuário e atualiza cookies nas rotas autenticadas.

As rotas da aplicação limitam tentativas e respondem genericamente à recuperação.
Chamadas diretas ao Auth com a chave pública continuam possíveis: configure
também os limites nativos de Auth e, se necessário, CAPTCHA no projeto.
Não considere entrega SMTP validada apenas por um retorno HTTP de sucesso.

Referências oficiais: [SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
e [templates](https://supabase.com/docs/guides/auth/auth-email-templates).
