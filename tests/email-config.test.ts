import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('configuração manual e declarativa preservam assuntos Zekro e links de autenticação', async () => {
  const script = await readFile(new URL('../scripts/configure-auth-email.mjs', import.meta.url), 'utf8');
  const config = await readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8');
  for (const [type, subject] of [['confirmation', 'Confirme seu email no Zekro'], ['recovery', 'Redefina sua senha no Zekro']]) {
    assert.ok(script.includes(subject));
    assert.ok(config.includes(`subject="${subject}"`) || config.includes(`subject = "${subject}"`));
    const html = await readFile(new URL(`../supabase/templates/${type}.html`, import.meta.url), 'utf8');
    assert.ok(html.includes('{{ .ConfirmationURL }}'));
    assert.ok(html.includes('Zekro'));
    assert.equal(html.includes('Barberflow'), false);
  }
});
