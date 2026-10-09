# Dependências e limites da auditoria

Em 08/10/2026, `npm audit` encontrou inicialmente 14 entradas (11 high,
3 moderate). Atualizações sem troca de Next major corrigiram Next 15.5.25 →
15.5.27, sharp 0.35.5, brace-expansion, source-map-js e parsers CSS.
Overrides mantêm PostCSS na linha 8 corrigida e postcss-selector-parser 7.1.6
nas dependências de Tailwind/postcss-nested. Build, lint e navegação verificam
compatibilidade. Não remover os overrides sem reavaliar os avisos.

`npm audit --omit=dev` retorna **0 vulnerabilidades** no lock atual.
O audit completo ainda retorna **7 entradas high**, todas na cadeia de
braces 3.0.3 → micromatch/chokidar/fast-glob → Tailwind 3 e plugin de ESLint.
O registro consultado não oferece versão de braces corrigida nessa linha;
o npm sugere migração major de Tailwind/ESLint para eliminar a cadeia.
Isso ficou pendente para preservar o CSS e evitar migração fora do escopo.

Esses parsers recebem padrões de arquivos definidos no repositório, não os
dados dos clientes. Não execute build/lint com globs de origem não confiável.
Os avisos são reais nas dependências; exploração na aplicação publicada não
foi demonstrada. Reavalie quando houver patch compatível ou planeje a migração
de Tailwind como trabalho independente, com comparação visual.

`@hookform/resolvers`, `react-hook-form` e `dotenv` foram removidos após busca
sem imports em src/tests. Node 22 usa --env-file no teste live. Prisma não faz
parte das dependências atuais: apenas permissões antigas de scripts de instalação
foram removidas. `prisma/` e Docker continuam preservados como legado documentado;
não executar o seed antigo nem conectar esse PostgreSQL ao ambiente atual.

pg e embedded-postgres são dependências **de desenvolvimento** para testar
transações reais. O cluster nasce em diretório temporário exclusivo, escuta
somente loopback, usa porta/credencial efêmeras e é encerrado após os testes.
Não lê DATABASE_URL ou arquivos .env. Auth/Storage dos testes são stand-ins,
portanto não comprovam entrega de email ou processamento de upload do Supabase.

Referências: [advisory de Next](https://github.com/vercel/next.js/security/advisories/GHSA-4jqv-mc3x-m676)
e [advisory de braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
